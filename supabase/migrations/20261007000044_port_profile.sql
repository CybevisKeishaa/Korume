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
) returns table (xp_awarded int, prev_xp int, next_xp int, had_outcome_today boolean)
  language plpgsql security definer set search_path = public
as $$
declare
  v_today date := (now() at time zone p_tz)::date;
  v_day_start timestamptz := (v_today::timestamp at time zone p_tz);
  v_day_end timestamptz := ((v_today + 1)::timestamp at time zone p_tz);
  v_prev int;
  v_awarded int := 0;
  v_had boolean;
begin
  if p_xp <= 0 then raise exception 'record_learning_outcome: xp must be positive'; end if;
  perform pg_advisory_xact_lock(hashtext('xp:' || p_user::text));
  -- Read before the insert: did the learner already have an outcome today? (lets the caller skip badge work)
  select exists (
    select 1 from learning_outcomes where user_id = p_user and created_at >= v_day_start and created_at < v_day_end
  ) into v_had;
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
  return query select v_awarded, v_prev, v_prev + v_awarded, v_had;
end $$;
revoke execute on function record_learning_outcome(uuid, text, text, int, text, boolean) from public, anon, authenticated;
grant execute on function record_learning_outcome(uuid, text, text, int, text, boolean) to service_role;

-- §4.3 Streak = projection of learning_outcomes into the CURRENT zone and schedule (C1, C2). Writes nothing, so it
-- can never revoke a badge. A gap made only of unscheduled ISO weekdays does not break a run.
create function study_streak(p_user uuid, p_tz text, p_schedule smallint[], p_today date)
  returns table (current_streak int, longest_streak int, last_active date)
  language sql stable security invoker set search_path = public
as $$
  with days as (
    select distinct (created_at at time zone p_tz)::date as day
    from learning_outcomes where user_id = p_user
  ),
  ordered as (
    select day, lag(day) over (order by day) as prev from days
  ),
  breaks as (
    select day,
      case when prev is null then 1
           when exists (
             select 1 from generate_series(1, day - prev - 1) g(n)
             where extract(isodow from prev + g.n)::smallint = any (p_schedule)
           ) then 1
           else 0 end as is_break
    from ordered
  ),
  runs as (
    select day, sum(is_break) over (order by day) as run_id from breaks
  ),
  run_sizes as (
    select run_id, count(*)::int as size, max(day) as last_day from runs group by run_id
  ),
  last_run as (
    select * from run_sizes order by last_day desc limit 1
  )
  select
    coalesce((
      select case
        when lr.last_day >= p_today then lr.size
        when not exists (
          select 1 from generate_series(1, p_today - lr.last_day - 1) g(n)
          where extract(isodow from lr.last_day + g.n)::smallint = any (p_schedule)
        ) then lr.size
        else 0 end
      from last_run lr
    ), 0),
    coalesce((select max(size) from run_sizes), 0),
    (select max(day) from days);
$$;
revoke execute on function study_streak(uuid, text, smallint[], date) from public, anon;
grant execute on function study_streak(uuid, text, smallint[], date) to authenticated, service_role;

-- §5.1 Active study time as UTC intervals. Only the server clock writes timestamps.
create table study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  client_presence_id uuid not null,
  segment_no int not null default 0,
  surface text not null check (surface in (
    'shadowing', 'dictation', 'summary', 'srs_review', 'kanji', 'certification', 'conversation', 'korume_chat'
  )),
  context_id text check (context_id is null or length(context_id) between 1 and 128),
  started_at timestamptz not null,
  last_heartbeat_at timestamptz not null,
  ended_at timestamptz,
  last_seq int not null check (last_seq >= 0),
  unique (user_id, client_presence_id, segment_no),
  check (last_heartbeat_at >= started_at),
  check (ended_at is null or ended_at = last_heartbeat_at)
);
create index idx_study_sessions_user_started on study_sessions (user_id, started_at);
create index idx_study_sessions_open on study_sessions (user_id) where ended_at is null;
alter table study_sessions enable row level security;
create policy study_sessions_select_own on study_sessions for select to authenticated using (user_id = auth.uid());
revoke all on study_sessions from anon, authenticated;
grant select on study_sessions to authenticated;
grant all on study_sessions to service_role;

-- §5.2 / §5.3 The only writer. The user comes from auth.uid(), never from the client.
create function study_heartbeat(
  p_client_presence uuid, p_session uuid, p_surface text, p_context text, p_seq int, p_kind text
) returns table (session_id uuid, accepted_seq int, segmented boolean)
  language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_now timestamptz := now();
  v_gap interval := interval '90 seconds';
  v_ext interval := interval '45 seconds';
  s study_sessions%rowtype;
  v_seg int;
begin
  if v_user is null then raise exception 'study_heartbeat: not signed in' using errcode = '42501'; end if;
  if p_kind not in ('start', 'beat', 'stop') or p_seq < 0 then
    raise exception 'study_heartbeat: bad request' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext('study:' || v_user::text));

  if p_kind = 'start' then
    select * into s from study_sessions
      where user_id = v_user and client_presence_id = p_client_presence and ended_at is null
      order by segment_no desc limit 1;
    if found and v_now - s.last_heartbeat_at <= v_gap then
      return query select s.id, s.last_seq, false;
      return;
    end if;
    -- Hygiene only: correctness never depends on it (duration is always coalesce(ended_at, last_heartbeat_at)).
    update study_sessions set ended_at = last_heartbeat_at
      where user_id = v_user and ended_at is null and v_now - last_heartbeat_at > v_gap;
    select coalesce(max(segment_no) + 1, 0) into v_seg from study_sessions
      where user_id = v_user and client_presence_id = p_client_presence;
    insert into study_sessions (user_id, client_presence_id, segment_no, surface, context_id, started_at,
      last_heartbeat_at, last_seq)
      values (v_user, p_client_presence, v_seg, p_surface, p_context, v_now, v_now, p_seq)
      returning * into s;
    return query select s.id, s.last_seq, false;
    return;
  end if;

  select * into s from study_sessions where id = p_session and user_id = v_user for update;
  if not found then raise exception 'study_heartbeat: unknown session' using errcode = 'P0002'; end if;
  -- Stale, duplicate, or aimed at a closed segment: a no-op that reports the current state (R10 #1, #2).
  if s.ended_at is not null or p_seq <= s.last_seq then
    return query select s.id, s.last_seq, false;
    return;
  end if;

  if p_kind = 'stop' then
    update study_sessions set ended_at = last_heartbeat_at, last_seq = p_seq where id = s.id;
    return query select s.id, p_seq, false;
    return;
  end if;

  if v_now - s.last_heartbeat_at > v_gap then
    update study_sessions set ended_at = last_heartbeat_at, last_seq = p_seq where id = s.id;
    select coalesce(max(segment_no) + 1, 0) into v_seg from study_sessions
      where user_id = v_user and client_presence_id = s.client_presence_id;
    insert into study_sessions (user_id, client_presence_id, segment_no, surface, context_id, started_at,
      last_heartbeat_at, last_seq)
      values (v_user, s.client_presence_id, v_seg, s.surface, s.context_id, v_now, v_now, p_seq)
      returning * into s;
    return query select s.id, p_seq, true;
    return;
  end if;

  update study_sessions set last_heartbeat_at = least(v_now, last_heartbeat_at + v_ext), last_seq = p_seq
    where id = s.id;
  return query select s.id, p_seq, false;
end $$;
revoke execute on function study_heartbeat(uuid, uuid, text, text, int, text) from public, anon;
grant execute on function study_heartbeat(uuid, uuid, text, text, int, text) to authenticated;
