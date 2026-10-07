-- port-profile (spec 2026-10-07). New objects only; changed objects are edited in their defining migrations.

-- §4.1 Every learning outcome recordActivity sees, awarded or not.
create table learning_outcomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  source_type text not null check (source_type in (
    'srs_review', 'dictation', 'shadowing', 'mining_review', 'jlpt_submit', 'reading_submit', 'conversation'
  )),
  item_key text not null check (length(item_key) between 1 and 128),
  created_at timestamptz not null default now()
);
create index idx_learning_outcomes_user_created on learning_outcomes (user_id, created_at);
alter table learning_outcomes enable row level security;
create policy learning_outcomes_select_own on learning_outcomes for select to authenticated
  using (user_id = auth.uid());
revoke all on learning_outcomes from anon, authenticated;
grant select on learning_outcomes to authenticated;
grant all on learning_outcomes to service_role;

-- §4.2 Evidence, eligibility and award share one transaction and one per-user lock.
create function record_learning_outcome(
  p_user uuid, p_source text, p_source_id text, p_xp int, p_tz text, p_daily boolean
) returns table (xp_awarded int, prev_xp int, next_xp int)
  language plpgsql security definer set search_path = public
as $$
declare
  v_today date := (now() at time zone p_tz)::date;
  v_day_start timestamptz := (v_today::timestamp at time zone p_tz);
  v_day_end timestamptz := ((v_today + 1)::timestamp at time zone p_tz);
  v_prev int;
  v_awarded int := 0;
begin
  if p_xp <= 0 then raise exception 'record_learning_outcome: xp must be positive'; end if;
  perform pg_advisory_xact_lock(hashtext('xp:' || p_user::text));
  insert into learning_outcomes (user_id, source_type, item_key) values (p_user, p_source, p_source_id);
  insert into user_stats (user_id) values (p_user) on conflict (user_id) do nothing;
  select xp into v_prev from user_stats where user_id = p_user for update;
  -- The eligibility check is a separate statement after taking the lock (L-040).
  if p_daily then
    if not exists (
      select 1 from xp_events e
      where e.user_id = p_user and e.source_type = p_source and e.source_id = p_source_id
        and e.created_at >= v_day_start and e.created_at < v_day_end
    ) then v_awarded := p_xp; end if;
  else
    if not exists (
      select 1 from xp_events e where e.user_id = p_user and e.source_type = p_source and e.source_id = p_source_id
    ) then v_awarded := p_xp; end if;
  end if;
  if v_awarded > 0 then
    insert into xp_events (user_id, source_type, source_id, xp) values (p_user, p_source, p_source_id, v_awarded);
    update user_stats set xp = xp + v_awarded where user_id = p_user;
  end if;
  return query select v_awarded, v_prev, v_prev + v_awarded;
end $$;
revoke execute on function record_learning_outcome(uuid, text, text, int, text, boolean) from public, anon, authenticated;
grant execute on function record_learning_outcome(uuid, text, text, int, text, boolean) to service_role;
