-- Knowledge Economy core (spec 2026-10-02 part 1b §4.2–§4.3, §5.3): a shared AI knowledge cache with
-- single-flight leases, and a cost / entitlement ledger with a hard global USD budget per UTC day.
-- Every table is service-role only, SELECT included: cached content may come from PRIVATE lessons, so
-- learners read it only through the API after the access check and the entitlement projection.
-- Every money decision happens inside these security-definer functions, under row or advisory locks.

create table knowledge_entries (
  id uuid primary key default gen_random_uuid(),
  fingerprint text not null,
  section text not null check (section ~ '^[a-z_]+$'),
  locale text not null check (locale in ('vi', 'en')),
  context_key text not null default '',
  schema_version int not null,
  generator_version int not null,
  content_variant text not null check (content_variant in ('full', 'preview')),
  status text not null check (status in ('pending', 'ready', 'failed')),
  lease_until timestamptz,
  -- A leader's completion counts only with the token it was given: a stale leader whose lease
  -- expired and was taken over can no longer overwrite the new leader's content.
  lease_token uuid,
  content jsonb,
  model text,
  provider text,
  source text not null default 'ai_generated' check (source = 'ai_generated'),
  error_code text,
  failed_at timestamptz,
  retry_after timestamptz,
  attempts int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (fingerprint, section, locale, context_key, schema_version, generator_version, content_variant)
);

create table ai_reservations (
  id uuid primary key default gen_random_uuid(),
  requested_by_user_id uuid references users (id) on delete set null,
  billing_scope text not null check (billing_scope in ('learner', 'system')),
  entitlement_kind text check (entitlement_kind in ('free_sentence', 'plus_section', 'korume_free_turn', 'korume_plus_turn')),
  turn_id uuid,
  fingerprint text not null,
  reserved_credits int not null default 0 check (reserved_credits >= 0),
  reserved_usd numeric(12, 6) not null check (reserved_usd >= 0),
  status text not null default 'held' check (status in ('held', 'settled', 'released')),
  expires_at timestamptz not null,
  period_day date not null,
  period_month date not null,
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  expired_at timestamptz,
  late_spent_at timestamptz,
  check ((billing_scope = 'system') = (entitlement_kind is null))
);
create index ai_reservations_user_day on ai_reservations (requested_by_user_id, period_day, status);
create index ai_reservations_held_expiry on ai_reservations (expires_at) where status = 'held';
create unique index ai_reservations_turn_active on ai_reservations (turn_id)
  where turn_id is not null and status in ('held', 'settled');

-- Append-only: one row per provider call, failures included.
create table ai_generations (
  id uuid primary key default gen_random_uuid(),
  requested_by_user_id uuid references users (id) on delete set null,
  billing_scope text not null check (billing_scope in ('learner', 'system')),
  knowledge_entry_id uuid references knowledge_entries (id) on delete set null,
  reservation_id uuid references ai_reservations (id) on delete set null,
  section text not null,
  provider text not null,
  model text not null,
  input_tokens int not null default 0 check (input_tokens >= 0),
  output_tokens int not null default 0 check (output_tokens >= 0),
  cache_read_tokens int not null default 0 check (cache_read_tokens >= 0),
  latency_ms int,
  estimated_cost_usd numeric(12, 6) not null default 0 check (estimated_cost_usd >= 0),
  outcome text not null check (outcome in ('success', 'provider_error', 'validation_error')),
  turn_id uuid,
  created_at timestamptz not null default now()
);
create index ai_generations_turn on ai_generations (turn_id) where turn_id is not null;

-- The settled entitlement charge.
create table ai_usage_charges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  entitlement_kind text not null check (entitlement_kind in ('free_sentence', 'plus_section', 'korume_free_turn', 'korume_plus_turn')),
  fingerprint text not null,
  credits int not null default 0 check (credits >= 0),
  generation_id uuid references ai_generations (id) on delete set null,
  reservation_id uuid not null unique references ai_reservations (id) on delete cascade,
  period_day date not null,
  period_month date not null,
  created_at timestamptz not null default now()
);
create unique index ai_usage_charges_free_sentence_once on ai_usage_charges (user_id, period_day, fingerprint)
  where entitlement_kind = 'free_sentence';
create unique index ai_usage_charges_plus_generation_once on ai_usage_charges (generation_id)
  where entitlement_kind in ('plus_section', 'korume_plus_turn');
create index ai_usage_charges_user_month on ai_usage_charges (user_id, period_month);

-- The hard global budget, one row per UTC day, updated only under its row lock.
create table ai_budget_days (
  period_day date primary key,
  reserved_usd numeric(12, 6) not null default 0 check (reserved_usd >= 0),
  spent_usd numeric(12, 6) not null default 0 check (spent_usd >= 0)
);

alter table knowledge_entries enable row level security;
alter table ai_generations enable row level security;
alter table ai_reservations enable row level security;
alter table ai_usage_charges enable row level security;
alter table ai_budget_days enable row level security;

revoke all on knowledge_entries from anon, authenticated;
revoke all on ai_generations from anon, authenticated;
revoke all on ai_reservations from anon, authenticated;
revoke all on ai_usage_charges from anon, authenticated;
revoke all on ai_budget_days from anon, authenticated;

grant all on knowledge_entries to service_role;
grant all on ai_generations to service_role;
grant all on ai_reservations to service_role;
grant all on ai_usage_charges to service_role;
grant all on ai_budget_days to service_role;

-- ready → content; failed inside its backoff → backoff; a miss, an expired lease or a failure past its
-- backoff → this caller becomes the leader (insert, or compare-and-swap takeover); otherwise follower.
-- attempts is the entry's attempt count after this claim: the caller derives the next backoff from it.
create function knowledge_claim_lease(p_key jsonb, p_lease_seconds int)
returns table (entry_id uuid, outcome text, lease_token uuid, content jsonb, retry_after timestamptz, attempts int,
  model text)
language plpgsql security definer set search_path = public as $$
declare
  v_entry knowledge_entries%rowtype;
  v_id uuid;
  v_token uuid;
  v_attempts int;
  v_lease timestamptz := now() + make_interval(secs => p_lease_seconds);
begin
  insert into knowledge_entries as k (fingerprint, section, locale, context_key, schema_version, generator_version,
    content_variant, status, lease_until, lease_token)
  values (p_key->>'fingerprint', p_key->>'section', p_key->>'locale', coalesce(p_key->>'contextKey', ''),
    (p_key->>'schemaVersion')::int, (p_key->>'generatorVersion')::int, p_key->>'contentVariant',
    'pending', v_lease, gen_random_uuid())
  on conflict (fingerprint, section, locale, context_key, schema_version, generator_version, content_variant) do nothing
  returning k.id, k.lease_token into v_id, v_token;
  if v_id is not null then
    return query select v_id, 'leader'::text, v_token, null::jsonb, null::timestamptz, 1, null::text;
    return;
  end if;

  select * into v_entry from knowledge_entries k
  where k.fingerprint = p_key->>'fingerprint' and k.section = p_key->>'section' and k.locale = p_key->>'locale'
    and k.context_key = coalesce(p_key->>'contextKey', '') and k.schema_version = (p_key->>'schemaVersion')::int
    and k.generator_version = (p_key->>'generatorVersion')::int and k.content_variant = p_key->>'contentVariant'
  for update;

  if v_entry.status = 'ready' then
    return query select v_entry.id, 'ready'::text, null::uuid, v_entry.content, null::timestamptz, v_entry.attempts,
      v_entry.model;
  elsif v_entry.status = 'failed' and v_entry.retry_after > now() then
    return query select v_entry.id, 'backoff'::text, null::uuid, null::jsonb, v_entry.retry_after, v_entry.attempts,
      null::text;
  elsif v_entry.status = 'failed' or v_entry.lease_until < now() then
    update knowledge_entries k
      set status = 'pending', lease_until = v_lease, lease_token = gen_random_uuid(), attempts = k.attempts + 1,
          updated_at = now()
      where k.id = v_entry.id
      returning k.lease_token, k.attempts into v_token, v_attempts;
    return query select v_entry.id, 'leader'::text, v_token, null::jsonb, null::timestamptz, v_attempts, null::text;
  else
    return query select v_entry.id, 'follower'::text, null::uuid, null::jsonb, null::timestamptz, v_entry.attempts,
      null::text;
  end if;
end $$;

create function knowledge_complete(p_entry uuid, p_lease_token uuid, p_content jsonb, p_model text, p_provider text)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  update knowledge_entries
    set status = 'ready', content = p_content, model = p_model, provider = p_provider, lease_until = null,
        error_code = null, failed_at = null, retry_after = null, updated_at = now()
    where id = p_entry and lease_token = p_lease_token and status = 'pending';
  return found;
end $$;

create function knowledge_fail(p_entry uuid, p_lease_token uuid, p_error_code text, p_retry_after timestamptz)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  update knowledge_entries
    set status = 'failed', error_code = p_error_code, failed_at = now(), retry_after = p_retry_after,
        lease_until = null, updated_at = now()
    where id = p_entry and lease_token = p_lease_token and status = 'pending';
  return found;
end $$;

-- Releases every expired held reservation and returns its USD to its day's budget.
create function ai_release_expired() returns void
language plpgsql security definer set search_path = public as $$
begin
  -- Every ai_reserve sweeps; different learners are not serialised by the user lock, so two sweepers can deadlock on expired rows; one sweeper at a time preserves user → sweep → reservations → budget order.
  perform pg_advisory_xact_lock(hashtext('ai-release-expired'));
  with expired as (
    update ai_reservations set status = 'released', closed_at = now(), expired_at = now()
    where status = 'held' and expires_at < now()
    returning period_day, reserved_usd
  ), per_day as (
    select period_day, sum(reserved_usd) as usd from expired group by period_day
  )
  update ai_budget_days b set reserved_usd = greatest(b.reserved_usd - per_day.usd, 0)
  from per_day where b.period_day = per_day.period_day;
end $$;

-- The cost of a call whose hold expired before it finished: spent once, on the hold's day.
create function ai_record_late_spend(p_reservation uuid, p_usd numeric) returns void
language plpgsql security definer set search_path = public as $$
declare v_day date;
begin
  if coalesce(p_usd, 0) <= 0 then return; end if;
  update ai_reservations set late_spent_at = now()
    where id = p_reservation and status = 'released' and expired_at is not null and late_spent_at is null
    returning period_day into v_day;
  if not found then return; end if;
  update ai_budget_days set spent_usd = spent_usd + p_usd where period_day = v_day;
end $$;

-- One transaction: global budget, then the learner's Free slot or Plus fuse/credits, then the hold.
-- p_limits: { globalUsdPerDay, freeSentencesPerDay, plusMaxSectionsPerDay, plusCreditsPerMonth }.
-- A Free sentence that already holds today's slot gets 'already_charged' WITH a reservation: the
-- generation still holds global budget, and settle's charge insert dedupes on the partial unique index.
create function ai_reserve(p_requested_by uuid, p_billing_scope text, p_entitlement_kind text, p_fingerprint text,
  p_reserved_credits int, p_reserved_usd numeric, p_limits jsonb, p_ttl_seconds int, p_turn_id uuid default null)
returns table (reservation_id uuid, outcome text, resets_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  v_day date := (now() at time zone 'utc')::date;
  v_month date := date_trunc('month', (now() at time zone 'utc'))::date;
  v_next_day timestamptz := ((now() at time zone 'utc')::date + 1)::timestamp at time zone 'utc';
  v_next_month timestamptz := (date_trunc('month', (now() at time zone 'utc')) + interval '1 month') at time zone 'utc';
  v_budget ai_budget_days%rowtype;
  v_outcome text := 'reserved';
  v_id uuid;
  v_count int;
  v_credits int;
begin
  if p_billing_scope = 'learner' and (p_requested_by is null or p_entitlement_kind is null) then
    raise exception 'learner reservations need a user and an entitlement kind' using errcode = 'check_violation';
  end if;
  if p_billing_scope = 'learner' then
    -- Serialises one learner's reservations; different learners only meet at the budget row.
    perform pg_advisory_xact_lock(hashtext('ai-user:' || p_requested_by::text));
  end if;

  perform ai_release_expired();

  if p_turn_id is not null and exists (
    select 1 from ai_reservations r where r.turn_id = p_turn_id and r.status in ('held', 'settled')
  ) then
    return query select null::uuid, 'turn_exists'::text, null::timestamptz;
    return;
  end if;

  insert into ai_budget_days (period_day) values (v_day) on conflict do nothing;
  select * into v_budget from ai_budget_days where period_day = v_day for update;
  if v_budget.reserved_usd + v_budget.spent_usd + p_reserved_usd > (p_limits->>'globalUsdPerDay')::numeric then
    return query select null::uuid, 'budget_exhausted'::text, v_next_day;
    return;
  end if;

  if p_billing_scope = 'learner' and p_entitlement_kind = 'free_sentence' then
    if exists (
      select 1 from ai_reservations r
      where r.requested_by_user_id = p_requested_by and r.period_day = v_day and r.entitlement_kind = 'free_sentence'
        and r.fingerprint = p_fingerprint and r.status in ('held', 'settled')
    ) then
      v_outcome := 'already_charged';
    else
      select count(distinct r.fingerprint) into v_count from ai_reservations r
      where r.requested_by_user_id = p_requested_by and r.period_day = v_day and r.entitlement_kind = 'free_sentence'
        and r.status in ('held', 'settled');
      if v_count >= (p_limits->>'freeSentencesPerDay')::int then
        return query select null::uuid, 'quota_exhausted'::text, v_next_day;
        return;
      end if;
    end if;
  elsif p_billing_scope = 'learner' and p_entitlement_kind = 'korume_free_turn' then
    select count(*) into v_count from ai_reservations r
    where r.requested_by_user_id = p_requested_by and r.period_day = v_day and r.entitlement_kind = 'korume_free_turn'
      and r.status in ('held', 'settled');
    if v_count >= (p_limits->>'askKorumeFreeTurnsPerDay')::int then
      return query select null::uuid, 'quota_exhausted'::text, v_next_day;
      return;
    end if;
  elsif p_billing_scope = 'learner' and p_entitlement_kind in ('plus_section', 'korume_plus_turn') then
    select count(*) into v_count from ai_reservations r
    where r.requested_by_user_id = p_requested_by and r.period_day = v_day and r.entitlement_kind = p_entitlement_kind
      and r.status in ('held', 'settled');
    if v_count >= (case when p_entitlement_kind = 'plus_section'
                        then (p_limits->>'plusMaxSectionsPerDay')::int
                        else (p_limits->>'askKorumePlusTurnsPerDay')::int end) then
      return query select null::uuid, 'fuse_tripped'::text, v_next_day;
      return;
    end if;
    select coalesce((select sum(c.credits) from ai_usage_charges c
                     where c.user_id = p_requested_by and c.period_month = v_month
                       and c.entitlement_kind in ('plus_section', 'korume_plus_turn')), 0)
         + coalesce((select sum(r.reserved_credits) from ai_reservations r
                     where r.requested_by_user_id = p_requested_by and r.period_month = v_month
                       and r.entitlement_kind in ('plus_section', 'korume_plus_turn') and r.status = 'held'), 0)
      into v_credits;
    if v_credits + p_reserved_credits > (p_limits->>'plusCreditsPerMonth')::int then
      return query select null::uuid, 'credits_exhausted'::text, v_next_month;
      return;
    end if;
  end if;

  insert into ai_reservations (requested_by_user_id, billing_scope, entitlement_kind, fingerprint, reserved_credits,
    reserved_usd, expires_at, period_day, period_month, turn_id)
  values (p_requested_by, p_billing_scope, p_entitlement_kind, p_fingerprint,
    case when p_entitlement_kind in ('plus_section', 'korume_plus_turn') then p_reserved_credits else 0 end,
    p_reserved_usd, now() + make_interval(secs => p_ttl_seconds), v_day, v_month, p_turn_id)
  returning id into v_id;
  update ai_budget_days set reserved_usd = reserved_usd + p_reserved_usd where period_day = v_day;
  return query select v_id, v_outcome, null::timestamptz;
end $$;

create function ai_record_generation(p_row jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  insert into public.ai_generations (requested_by_user_id, billing_scope, knowledge_entry_id, reservation_id, section,
    provider, model, input_tokens, output_tokens, cache_read_tokens, latency_ms, estimated_cost_usd, outcome, turn_id)
  values ((p_row->>'requestedByUserId')::uuid, p_row->>'billingScope', (p_row->>'knowledgeEntryId')::uuid,
    (p_row->>'reservationId')::uuid, p_row->>'section', p_row->>'provider', p_row->>'model',
    coalesce((p_row->>'inputTokens')::int, 0), coalesce((p_row->>'outputTokens')::int, 0),
    coalesce((p_row->>'cacheReadTokens')::int, 0), (p_row->>'latencyMs')::int,
    coalesce((p_row->>'estimatedCostUsd')::numeric, 0), p_row->>'outcome', (p_row->>'turnId')::uuid)
  returning id into v_id;
  return v_id;
end $$;

-- held → settled exactly once. Unused upper-bound USD returns to the budget; the real cost is spent.
-- A learner reservation becomes a charge (credits for Plus, a slot for Free, deduped per day/sentence).
create function ai_settle(p_reservation uuid, p_generation uuid, p_actual_credits int, p_actual_usd numeric)
returns boolean
language plpgsql security definer set search_path = public as $$
declare v_res ai_reservations%rowtype;
begin
  update ai_reservations set status = 'settled', closed_at = now()
    where id = p_reservation and status = 'held'
    returning * into v_res;
  if not found then
    perform ai_record_late_spend(p_reservation, p_actual_usd);
    return false;
  end if;
  update ai_budget_days
    set reserved_usd = greatest(reserved_usd - v_res.reserved_usd, 0), spent_usd = spent_usd + p_actual_usd
    where period_day = v_res.period_day;
  if v_res.billing_scope = 'learner' and v_res.requested_by_user_id is not null then
    insert into ai_usage_charges (user_id, entitlement_kind, fingerprint, credits, generation_id, reservation_id,
      period_day, period_month)
    values (v_res.requested_by_user_id, v_res.entitlement_kind, v_res.fingerprint,
      case when v_res.entitlement_kind in ('plus_section', 'korume_plus_turn') then greatest(p_actual_credits, 0) else 0 end,
      p_generation, v_res.id, v_res.period_day, v_res.period_month)
    on conflict do nothing;
  end if;
  return true;
end $$;

-- held → released exactly once; the learner is never charged. p_spent_usd is money the provider call
-- already cost (validation error, stale leader) and stays spent against the global budget.
create function ai_release(p_reservation uuid, p_spent_usd numeric default 0)
returns boolean
language plpgsql security definer set search_path = public as $$
declare v_res ai_reservations%rowtype;
begin
  update ai_reservations set status = 'released', closed_at = now()
    where id = p_reservation and status = 'held'
    returning * into v_res;
  if not found then
    perform ai_record_late_spend(p_reservation, p_spent_usd);
    return false;
  end if;
  update ai_budget_days
    set reserved_usd = greatest(reserved_usd - v_res.reserved_usd, 0), spent_usd = spent_usd + p_spent_usd
    where period_day = v_res.period_day;
  return true;
end $$;

-- What a learner has used this UTC day / month; limits and reset times are composed by the API.
create function ai_usage_snapshot(p_user uuid, p_day date, p_month date) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'freeSentencesUsed', (
      select count(distinct r.fingerprint) from ai_reservations r
      where r.requested_by_user_id = p_user and r.period_day = p_day and r.entitlement_kind = 'free_sentence'
        and r.status in ('held', 'settled')),
    'plusCreditsUsed', (
      coalesce((select sum(c.credits) from ai_usage_charges c
                where c.user_id = p_user and c.period_month = p_month
                  and c.entitlement_kind in ('plus_section', 'korume_plus_turn')), 0)
      + coalesce((select sum(r.reserved_credits) from ai_reservations r
                  where r.requested_by_user_id = p_user and r.period_month = p_month
                    and r.entitlement_kind in ('plus_section', 'korume_plus_turn') and r.status = 'held'), 0)),
    'askKorumeTurnsUsed', (
      select count(*) from ai_reservations r where r.requested_by_user_id = p_user and r.period_day = p_day
        and r.entitlement_kind in ('korume_free_turn', 'korume_plus_turn') and r.status in ('held', 'settled')))
$$;

revoke all on function knowledge_claim_lease(jsonb, int) from public, anon, authenticated;
revoke all on function knowledge_complete(uuid, uuid, jsonb, text, text) from public, anon, authenticated;
revoke all on function knowledge_fail(uuid, uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function ai_release_expired() from public, anon, authenticated;
revoke all on function ai_reserve(uuid, text, text, text, int, numeric, jsonb, int, uuid) from public, anon, authenticated;
revoke all on function ai_record_generation(jsonb) from public, anon, authenticated;
revoke all on function ai_record_late_spend(uuid, numeric) from public, anon, authenticated;
revoke all on function ai_settle(uuid, uuid, int, numeric) from public, anon, authenticated;
revoke all on function ai_release(uuid, numeric) from public, anon, authenticated;
revoke all on function ai_usage_snapshot(uuid, date, date) from public, anon, authenticated;

grant execute on function knowledge_claim_lease(jsonb, int) to service_role;
grant execute on function knowledge_complete(uuid, uuid, jsonb, text, text) to service_role;
grant execute on function knowledge_fail(uuid, uuid, text, timestamptz) to service_role;
grant execute on function ai_release_expired() to service_role;
grant execute on function ai_reserve(uuid, text, text, text, int, numeric, jsonb, int, uuid) to service_role;
grant execute on function ai_record_generation(jsonb) to service_role;
grant execute on function ai_record_late_spend(uuid, numeric) to service_role;
grant execute on function ai_settle(uuid, uuid, int, numeric) to service_role;
grant execute on function ai_release(uuid, numeric) to service_role;
grant execute on function ai_usage_snapshot(uuid, date, date) to service_role;
