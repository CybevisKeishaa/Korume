\set ON_ERROR_STOP on

-- Single-session cases of verify:db:knowledge (spec 2026-10-02 part 1b §7). The multi-connection race
-- cases live in supabase/tests/knowledge-race/. Gate rows: users 'knowledgegate-*', fingerprints 'kgate-*'.

delete from ai_usage_charges where fingerprint like 'kgate-%';
delete from ai_generations where section like 'kgate%';
delete from ai_reservations where fingerprint like 'kgate-%';
delete from knowledge_entries where fingerprint like 'kgate-%';
delete from auth.users where email like 'knowledgegate-%@example.invalid';

-- Today's budget row is shared with real local usage: snapshot it and restore it at the end.
insert into ai_budget_days (period_day) values ((now() at time zone 'utc')::date) on conflict do nothing;
create temp table kgate_budget as select * from ai_budget_days where period_day = (now() at time zone 'utc')::date;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
select gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'knowledgegate-' || name || '@example.invalid', crypt('password123', gen_salt('bf')), now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb
from unnest(array['plus', 'free', 'free2', 'free3', 'system']) as name;

create or replace function pg_temp.kgate_user(p_name text) returns uuid language sql as $$
  select id from public.users where email = 'knowledgegate-' || p_name || '@example.invalid'
$$;
create or replace function pg_temp.kgate_key(p_fp text, p_section text default 'lite') returns jsonb language sql as $$
  select jsonb_build_object('fingerprint', p_fp, 'section', p_section, 'locale', 'vi', 'contextKey', '',
    'schemaVersion', 1, 'generatorVersion', 1, 'contentVariant', 'full')
$$;
create or replace function pg_temp.kgate_limits(p_free int default 3, p_fuse int default 200, p_credits int default 1000)
returns jsonb language sql as $$
  select jsonb_build_object('globalUsdPerDay', 1000000, 'freeSentencesPerDay', p_free,
    'plusMaxSectionsPerDay', p_fuse, 'plusCreditsPerMonth', p_credits)
$$;

-- 1. An expired lease is taken over by compare-and-swap; the stale token can no longer complete.
do $$
declare first record; second record; again record; stale_ok boolean; row knowledge_entries%rowtype;
begin
  select * into first from knowledge_claim_lease(pg_temp.kgate_key('kgate-lease'), 30);
  if first.outcome <> 'leader' then raise exception 'FAIL 1: first claim is %', first.outcome; end if;
  select * into again from knowledge_claim_lease(pg_temp.kgate_key('kgate-lease'), 30);
  if again.outcome <> 'follower' then raise exception 'FAIL 1: live lease gave %', again.outcome; end if;
  update knowledge_entries set lease_until = now() - interval '1 second' where id = first.entry_id;
  select * into second from knowledge_claim_lease(pg_temp.kgate_key('kgate-lease'), 30);
  if second.outcome <> 'leader' or second.lease_token = first.lease_token then
    raise exception 'FAIL 1: expired lease was not taken over with a new token';
  end if;
  stale_ok := knowledge_complete(first.entry_id, first.lease_token, '{"by":"stale"}', 'm', 'p');
  select * into row from knowledge_entries where id = first.entry_id;
  if stale_ok or row.status <> 'pending' or row.lease_token <> second.lease_token or row.attempts <> 2 then
    raise exception 'FAIL 1: stale leader changed the entry (ok=%, status=%)', stale_ok, row.status;
  end if;
  if not knowledge_complete(second.entry_id, second.lease_token, '{"by":"second"}', 'm', 'p') then
    raise exception 'FAIL 1: current leader could not complete';
  end if;
  select * into again from knowledge_claim_lease(pg_temp.kgate_key('kgate-lease'), 30);
  if again.outcome <> 'ready' or again.content->>'by' <> 'second' then raise exception 'FAIL 1: ready read'; end if;
  raise notice 'PASS 1 CAS takeover of an expired lease; stale leader is a no-op';
end $$;

-- 2. A failure backs off, then becomes claimable again.
do $$
declare c record;
begin
  select * into c from knowledge_claim_lease(pg_temp.kgate_key('kgate-fail'), 30);
  if not knowledge_fail(c.entry_id, c.lease_token, 'provider', now() + interval '10 minutes') then
    raise exception 'FAIL 2: leader could not fail its entry';
  end if;
  select * into c from knowledge_claim_lease(pg_temp.kgate_key('kgate-fail'), 30);
  if c.outcome <> 'backoff' or c.retry_after is null then raise exception 'FAIL 2: no backoff (%)', c.outcome; end if;
  update knowledge_entries set retry_after = now() - interval '1 second' where id = c.entry_id;
  select * into c from knowledge_claim_lease(pg_temp.kgate_key('kgate-fail'), 30);
  if c.outcome <> 'leader' then raise exception 'FAIL 2: past backoff gave %', c.outcome; end if;
  raise notice 'PASS 2 failure backs off, then is retryable';
end $$;

-- 3. Provider error: releasing restores the capacity a refused reserve needed.
do $$
declare a record; b record; c record;
begin
  select * into a from ai_reserve(pg_temp.kgate_user('plus'), 'learner', 'plus_section', 'kgate-p3', 1, 0.01, pg_temp.kgate_limits(3, 1), 120);
  select * into b from ai_reserve(pg_temp.kgate_user('plus'), 'learner', 'plus_section', 'kgate-p3', 1, 0.01, pg_temp.kgate_limits(3, 1), 120);
  if a.outcome <> 'reserved' or b.outcome <> 'fuse_tripped' then raise exception 'FAIL 3: % / %', a.outcome, b.outcome; end if;
  if not ai_release(a.reservation_id) then raise exception 'FAIL 3: release returned false'; end if;
  select * into c from ai_reserve(pg_temp.kgate_user('plus'), 'learner', 'plus_section', 'kgate-p3', 1, 0.01, pg_temp.kgate_limits(3, 1), 120);
  if c.outcome <> 'reserved' then raise exception 'FAIL 3: capacity not restored (%)', c.outcome; end if;
  perform ai_release(c.reservation_id);
  raise notice 'PASS 3 provider error release restores capacity';
end $$;

-- 4. Validation error: the cost stays spent, the learner is not charged.
do $$
declare r record; before ai_budget_days%rowtype; after ai_budget_days%rowtype;
begin
  select * into before from ai_budget_days where period_day = (now() at time zone 'utc')::date;
  select * into r from ai_reserve(pg_temp.kgate_user('plus'), 'learner', 'plus_section', 'kgate-p4', 3, 0.05, pg_temp.kgate_limits(), 120);
  if not ai_release(r.reservation_id, 0.02) then raise exception 'FAIL 4: release false'; end if;
  select * into after from ai_budget_days where period_day = (now() at time zone 'utc')::date;
  if after.spent_usd - before.spent_usd <> 0.02 or after.reserved_usd <> before.reserved_usd then
    raise exception 'FAIL 4: budget moved by spent %, reserved %', after.spent_usd - before.spent_usd, after.reserved_usd - before.reserved_usd;
  end if;
  if exists (select 1 from ai_usage_charges where reservation_id = r.reservation_id) then
    raise exception 'FAIL 4: a validation error charged the learner';
  end if;
  raise notice 'PASS 4 validation error spends USD, releases the learner';
end $$;

-- 5. An expired held reservation does not lock the Free slot.
do $$
declare a record; b record;
begin
  select * into a from ai_reserve(pg_temp.kgate_user('free2'), 'learner', 'free_sentence', 'kgate-f5a', 0, 0.01, pg_temp.kgate_limits(1), -1);
  select * into b from ai_reserve(pg_temp.kgate_user('free2'), 'learner', 'free_sentence', 'kgate-f5b', 0, 0.01, pg_temp.kgate_limits(1), 120);
  if a.outcome <> 'reserved' or b.outcome <> 'reserved' then raise exception 'FAIL 5: % / %', a.outcome, b.outcome; end if;
  if (select status from ai_reservations where id = a.reservation_id) <> 'released' then
    raise exception 'FAIL 5: expired hold was not released';
  end if;
  perform ai_release(b.reservation_id);
  raise notice 'PASS 5 expired hold is released by the next reserve';
end $$;

-- 6 + 7. Settling below the upper bound charges the actual credits; repeated settle/release change nothing.
do $$
declare r record; g uuid; before ai_budget_days%rowtype; after ai_budget_days%rowtype; used jsonb;
begin
  select * into r from ai_reserve(pg_temp.kgate_user('plus'), 'learner', 'plus_section', 'kgate-p6', 3, 0.05, pg_temp.kgate_limits(), 120);
  g := ai_record_generation(jsonb_build_object('requestedByUserId', pg_temp.kgate_user('plus'), 'billingScope', 'learner',
    'reservationId', r.reservation_id, 'section', 'kgate', 'provider', 'fake', 'model', 'm', 'inputTokens', 10,
    'outputTokens', 20, 'estimatedCostUsd', 0.01, 'outcome', 'success'));
  if not ai_settle(r.reservation_id, g, 1, 0.01) then raise exception 'FAIL 6: settle false'; end if;
  if (select credits from ai_usage_charges where reservation_id = r.reservation_id) <> 1 then
    raise exception 'FAIL 6: charge does not carry the actual credits';
  end if;
  used := ai_usage_snapshot(pg_temp.kgate_user('plus'), (now() at time zone 'utc')::date,
    date_trunc('month', now() at time zone 'utc')::date);
  if (used->>'plusCreditsUsed')::int <> 1 then raise exception 'FAIL 6: month total is %', used; end if;
  raise notice 'PASS 6 settle below the upper bound refunds the difference';

  select * into before from ai_budget_days where period_day = (now() at time zone 'utc')::date;
  if ai_settle(r.reservation_id, g, 1, 0.01) or ai_release(r.reservation_id, 0.5) then
    raise exception 'FAIL 7: a second settle or release returned true';
  end if;
  select * into after from ai_budget_days where period_day = (now() at time zone 'utc')::date;
  if after is distinct from before or (select count(*) from ai_usage_charges where reservation_id = r.reservation_id) <> 1 then
    raise exception 'FAIL 7: repeated settle/release changed totals';
  end if;
  raise notice 'PASS 7 settle and release are idempotent';
end $$;

-- 8. System scope consumes global budget only, never Free/Plus entitlement.
do $$
declare r record; before ai_budget_days%rowtype; after ai_budget_days%rowtype;
begin
  select * into before from ai_budget_days where period_day = (now() at time zone 'utc')::date;
  select * into r from ai_reserve(pg_temp.kgate_user('system'), 'system', null, 'kgate-s8', 0, 0.03, pg_temp.kgate_limits(0, 0, 0), 120);
  if r.outcome <> 'reserved' then raise exception 'FAIL 8: system reserve refused (%)', r.outcome; end if;
  select * into after from ai_budget_days where period_day = (now() at time zone 'utc')::date;
  if after.reserved_usd - before.reserved_usd <> 0.03 then raise exception 'FAIL 8: global budget not held'; end if;
  perform ai_settle(r.reservation_id, null, 0, 0.02);
  if exists (select 1 from ai_usage_charges where reservation_id = r.reservation_id) then
    raise exception 'FAIL 8: system scope created a learner charge';
  end if;
  raise notice 'PASS 8 system scope holds budget only';
end $$;

-- 9. A learner reservation without an entitlement kind is refused.
do $$
begin
  begin
    perform ai_reserve(pg_temp.kgate_user('free'), 'learner', null, 'kgate-x9', 0, 0.01, pg_temp.kgate_limits(), 120);
    raise exception 'FAIL 9: learner reservation without entitlement accepted';
  exception when check_violation then null;
  end;
  begin
    insert into ai_reservations (requested_by_user_id, billing_scope, entitlement_kind, fingerprint, reserved_usd,
      expires_at, period_day, period_month)
    values (pg_temp.kgate_user('free'), 'learner', null, 'kgate-x9', 0, now(), current_date, current_date);
    raise exception 'FAIL 9: table CHECK accepted a learner row without entitlement';
  exception when check_violation then null;
  end;
  raise notice 'PASS 9 learner reservation needs an entitlement kind';
end $$;

-- 10. Free: nine sections of one sentence use one slot; the fourth sentence is refused.
do $$
declare r record; i int; reserved int := 0; already int := 0;
begin
  for i in 1..9 loop
    select * into r from ai_reserve(pg_temp.kgate_user('free'), 'learner', 'free_sentence', 'kgate-f10-1', 0, 0.01, pg_temp.kgate_limits(3), 120);
    if r.outcome = 'reserved' then reserved := reserved + 1; elsif r.outcome = 'already_charged' then already := already + 1; end if;
    perform ai_settle(r.reservation_id, null, 0, 0.01);
  end loop;
  if reserved <> 1 or already <> 8 then raise exception 'FAIL 10: % reserved, % already charged', reserved, already; end if;
  if (select count(*) from ai_usage_charges where user_id = pg_temp.kgate_user('free')) <> 1 then
    raise exception 'FAIL 10: nine sections produced more than one charge';
  end if;
  for i in 2..3 loop
    select * into r from ai_reserve(pg_temp.kgate_user('free'), 'learner', 'free_sentence', 'kgate-f10-' || i, 0, 0.01, pg_temp.kgate_limits(3), 120);
    if r.outcome <> 'reserved' then raise exception 'FAIL 10: sentence % refused', i; end if;
    perform ai_settle(r.reservation_id, null, 0, 0.01);
  end loop;
  select * into r from ai_reserve(pg_temp.kgate_user('free'), 'learner', 'free_sentence', 'kgate-f10-4', 0, 0.01, pg_temp.kgate_limits(3), 120);
  if r.outcome <> 'quota_exhausted' or r.reservation_id is not null
     or r.resets_at <> ((now() at time zone 'utc')::date + 1)::timestamp at time zone 'utc' then
    raise exception 'FAIL 10: fourth sentence gave % resets %', r.outcome, r.resets_at;
  end if;
  raise notice 'PASS 10 one slot per sentence, fourth sentence refused until next UTC midnight';
end $$;

-- 11. Learners and anon cannot touch the cache, the ledger or the functions.
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
do $$
declare t text;
begin
  foreach t in array array['knowledge_entries', 'ai_generations', 'ai_reservations', 'ai_usage_charges', 'ai_budget_days'] loop
    begin
      execute format('select 1 from %I limit 1', t);
      raise exception 'FAIL 11: authenticated read %', t;
    exception when insufficient_privilege then null;
    end;
  end loop;
  begin
    perform ai_reserve(gen_random_uuid(), 'learner', 'free_sentence', 'kgate-x', 0, 0, '{}'::jsonb, 1);
    raise exception 'FAIL 11: authenticated executed ai_reserve';
  exception when insufficient_privilege then null;
  end;
  begin
    perform knowledge_claim_lease('{}'::jsonb, 1);
    raise exception 'FAIL 11: authenticated executed knowledge_claim_lease';
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS 11a authenticated has no access';
end $$;
commit;
begin;
set local role anon;
do $$
begin
  begin
    perform 1 from knowledge_entries limit 1;
    raise exception 'FAIL 11: anon read knowledge_entries';
  exception when insufficient_privilege then null;
  end;
  begin
    perform ai_settle(gen_random_uuid(), null, 0, 0);
    raise exception 'FAIL 11: anon executed ai_settle';
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS 11b anon has no access';
end $$;
commit;

-- Cleanup and restore today's budget row.
delete from ai_usage_charges where fingerprint like 'kgate-%';
delete from ai_generations where section like 'kgate%';
delete from ai_reservations where fingerprint like 'kgate-%';
delete from knowledge_entries where fingerprint like 'kgate-%';
delete from auth.users where email like 'knowledgegate-%@example.invalid';
update ai_budget_days b set reserved_usd = k.reserved_usd, spent_usd = k.spent_usd from kgate_budget k
  where b.period_day = k.period_day;
