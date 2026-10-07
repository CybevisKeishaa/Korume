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
    -- Hygiene only, and only for the starting presence: another presence's stale row is closed by its own
    -- next beat/start (closing it here would turn that beat into a closed-session no-op). Reads never depend on
    -- it: duration is always coalesce(ended_at, last_heartbeat_at).
    update study_sessions set ended_at = last_heartbeat_at
      where user_id = v_user and client_presence_id = p_client_presence and ended_at is null
        and v_now - last_heartbeat_at > v_gap;
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

-- §5.5 Merge overlapping UTC intervals per caller, then split at local midnight.
-- Open sessions stop at their last heartbeat, never at the time of the read.
create function study_time(p_tz text, p_from timestamptz, p_to timestamptz)
  returns table (day date, seconds bigint)
  language sql stable security invoker set search_path = public
as $$
  with iv as (
    select greatest(started_at, p_from) as s, least(coalesce(ended_at, last_heartbeat_at), p_to) as e
    from study_sessions
    where user_id = auth.uid() and started_at < p_to and coalesce(ended_at, last_heartbeat_at) > p_from
  ),
  ordered as (
    select s, e, max(e) over (order by s, e rows between unbounded preceding and 1 preceding) as prev_end
    from iv where e > s
  ),
  grouped as (
    select s, e, sum(case when prev_end is null or s > prev_end then 1 else 0 end) over (order by s, e) as grp
    from ordered
  ),
  merged as (
    select min(s) as s, max(e) as e from grouped group by grp
  ),
  split as (
    select g.d::date as day,
      extract(epoch from
        least(m.e, ((g.d::date + 1)::timestamp at time zone p_tz))
        - greatest(m.s, (g.d::date::timestamp at time zone p_tz))
      ) as secs
    from merged m,
      generate_series((m.s at time zone p_tz)::date, (m.e at time zone p_tz)::date, interval '1 day') as g(d)
  )
  select day, round(sum(secs))::bigint from split where secs > 0 group by day order by day;
$$;
revoke execute on function study_time(text, timestamptz, timestamptz) from public, anon;
grant execute on function study_time(text, timestamptz, timestamptz) to authenticated;

create function study_tracked_since() returns timestamptz
  language sql stable security invoker set search_path = public
as $$ select min(started_at) from study_sessions where user_id = auth.uid() $$;
revoke execute on function study_tracked_since() from public, anon;
grant execute on function study_tracked_since() to authenticated;

-- §9 Avatars: a private bucket of its own (lifecycle, MIME and retention differ from recordings). The server writes
-- with the service role; a learner may read only their own folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 524288, array['image/webp'])
on conflict (id) do nothing;
create policy avatars_select_own on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- §6 Profile read model. Every function is security invoker and scoped to auth.uid(); RLS is the second fence.
-- §6.0 C5: the earliest evidence Korume holds, from every canonical learning table with a real timestamp.
create function first_known_learning_at() returns timestamptz
  language sql stable security invoker set search_path = public
as $$
  select min(t) from (
    select min(created_at) as t from learning_outcomes where user_id = auth.uid()
    union all select min(started_at) from study_sessions where user_id = auth.uid()
    union all select min(created_at) from xp_events where user_id = auth.uid()
    union all select min(least(last_watched_at, completed_at)) from user_video_progress where user_id = auth.uid()
    union all select min(created_at) from shadowing_sessions where user_id = auth.uid()
    union all select min(created_at) from dictation_attempts where user_id = auth.uid()
    union all select min(created_at) from sentence_mining_cards where user_id = auth.uid()
    union all select min(started_at) from conversation_sessions where user_id = auth.uid()
    union all select min(completed_at) from user_test_attempts where user_id = auth.uid()
    union all select min(completed_at) from user_reading_attempts where user_id = auth.uid()
    union all select min(last_reviewed_at) from user_vocab_progress where user_id = auth.uid()
    union all select min(last_reviewed_at) from user_kanji_progress where user_id = auth.uid()
    union all select min(last_practiced_at) from user_grammar_progress where user_id = auth.uid()
    union all select min(earned_at) from user_badges where user_id = auth.uid()
  ) evidence;
$$;

create function profile_counts(p_mastery int)
  returns table (video_lessons_completed int, words_learned int)
  language sql stable security invoker set search_path = public
as $$
  select
    (select count(*)::int from user_video_progress where user_id = auth.uid() and completed_at is not null),
    (select count(*)::int from user_vocab_progress where user_id = auth.uid() and srs_stage >= p_mastery);
$$;

-- §6.1 Two sources, one axis. System milestones survive Delete Korume Memory; companion ones do not.
create function profile_journey(p_limit int, p_include_companion boolean)
  returns table (kind text, at timestamptz, label text)
  language sql stable security invoker set search_path = public
as $$
  select milestones.kind, milestones.at, milestones.label from (
    select 'first_activity' as kind, first_known_learning_at() as at, null::text as label
    union all (
      select 'first_video_completed', p.completed_at, v.title
      from user_video_progress p join videos v on v.id = p.video_id
      where p.user_id = auth.uid() and p.completed_at is not null order by p.completed_at limit 1)
    union all (
      select 'first_mastered_word', p.mastered_at, w.word
      from user_vocab_progress p join vocab w on w.id = p.vocab_id
      where p.user_id = auth.uid() and p.mastered_at is not null order by p.mastered_at limit 1)
    union all (
      select 'first_certification_passed', a.passed_at, t.level::text
      from user_test_attempts a join certification_tests t on t.id = a.test_id
      where a.user_id = auth.uid() and a.passed_at is not null order by a.passed_at limit 1)
    union all
      select 'badge_earned', ub.earned_at, b.name
      from user_badges ub join badges b on b.id = ub.badge_id where ub.user_id = auth.uid()
    union all
      select m.memory_type, m.occurred_at, coalesce(m.line_text_jp, m.title)
      from companion_memories m
      where p_include_companion and m.user_id = auth.uid()
        and m.memory_type in ('first_meeting', 'first_shadow', 'jlpt_passed', 'pinned_line')
  ) milestones
  where milestones.at is not null
  order by milestones.at desc
  limit p_limit;
$$;

-- §6.2 Content taxonomy only, and only with evidence (R11 #2).
create function favorite_lesson_sources(p_min_total int, p_min_per_source int, p_limit int)
  returns table (slug text, lessons int)
  language sql stable security invoker set search_path = public
as $$
  with evidenced as (
    select v.source_id, p.last_watched_at
    from user_video_progress p join videos v on v.id = p.video_id
    where p.user_id = auth.uid() and v.source_id is not null
  ),
  totals as (select count(*) as n from evidenced)
  select s.slug, count(*)::int
  from evidenced e join lesson_sources s on s.id = e.source_id, totals
  where totals.n >= p_min_total
  group by s.slug, s.display_order
  having count(*) >= p_min_per_source
  order by count(*) desc, max(e.last_watched_at) desc nulls last, s.display_order
  limit p_limit;
$$;

-- §6.3 C4: candidates frozen at the start of the learner's study day; deterministic pick.
create function todays_memory(p_tz text) returns setof companion_memories
  language sql stable security invoker set search_path = public
as $$
  with day as (
    select (now() at time zone p_tz)::date as d
  ),
  frozen as (
    select m.* from companion_memories m, day
    where m.user_id = auth.uid() and m.created_at < (day.d::timestamp at time zone p_tz)
      and m.memory_type in ('pinned_line', 'line_mastered')
  ),
  pool as (
    select * from frozen
    where memory_type = case when exists (select 1 from frozen where memory_type = 'pinned_line')
                             then 'pinned_line' else 'line_mastered' end
  ),
  ranked as (
    select pool.*, row_number() over (order by id) - 1 as idx, count(*) over () as n from pool
  )
  select id, user_id, kind, memory_type, title, video_id, transcript_line_id, timestamp_seconds, line_text_jp, note,
    is_anchor, dedupe_key, occurred_at, created_at
  from ranked, day
  where idx = abs(hashtext(auth.uid()::text || day.d::text)::bigint) % n;
$$;

revoke execute on function first_known_learning_at() from public, anon;
revoke execute on function profile_counts(int) from public, anon;
revoke execute on function profile_journey(int, boolean) from public, anon;
revoke execute on function favorite_lesson_sources(int, int, int) from public, anon;
revoke execute on function todays_memory(text) from public, anon;
grant execute on function first_known_learning_at(), profile_counts(int), profile_journey(int, boolean),
  favorite_lesson_sources(int, int, int), todays_memory(text) to authenticated;
