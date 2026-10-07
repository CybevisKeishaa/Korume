\set ON_ERROR_STOP on
delete from auth.users where email in ('profilegate-a@example.invalid', 'profilegate-b@example.invalid');
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'profilegate-a@example.invalid', crypt('password123', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'profilegate-b@example.invalid', crypt('password123', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb);

do $$
declare uid uuid := (select id from users where email = 'profilegate-a@example.invalid');
  first_award int; second_award int; first_had boolean; second_had boolean;
begin
  select xp_awarded, had_outcome_today into first_award, first_had from record_learning_outcome(uid, 'srs_review', 'vocab:daily', 10, 'Asia/Ho_Chi_Minh', true);
  select xp_awarded, had_outcome_today into second_award, second_had from record_learning_outcome(uid, 'srs_review', 'vocab:daily', 10, 'Asia/Ho_Chi_Minh', true);
  if first_had is distinct from false or second_had is distinct from true then
    raise exception 'FAIL profile had_outcome_today (first %, second %)', first_had, second_had;
  end if;
  if first_award <> 10 or second_award <> 0
    or (select count(*) from learning_outcomes where user_id = uid and item_key = 'vocab:daily') <> 2
    or (select count(*) from xp_events where user_id = uid and source_id = 'vocab:daily') <> 1
    or (select xp from user_stats where user_id = uid) <> 10 then
    raise exception 'FAIL profile daily award';
  end if;
  raise notice 'PASS profile daily outcome evidence and one XP award';
end $$;

do $$
declare uid uuid := (select id from users where email = 'profilegate-a@example.invalid'); awarded int;
begin
  select xp_awarded into awarded from record_learning_outcome(uid, 'srs_review', 'vocab:daily', 10, 'America/Los_Angeles', true);
  if awarded <> 0 or (select count(*) from xp_events where user_id = uid and source_id = 'vocab:daily') <> 1 then
    raise exception 'FAIL profile zone change re-awarded';
  end if;
  raise notice 'PASS profile zone change cannot re-award same instant';
end $$;

do $$
declare uid uuid := (select id from users where email = 'profilegate-a@example.invalid'); awarded int;
begin
  insert into xp_events (user_id, source_type, source_id, xp, created_at)
    values (uid, 'dictation', 'line:old', 10, now() - interval '2 days');
  select xp_awarded into awarded from record_learning_outcome(uid, 'dictation', 'line:old', 10, 'Asia/Ho_Chi_Minh', true);
  if awarded <> 10 or (select count(*) from xp_events where user_id = uid and source_id = 'line:old') <> 2 then
    raise exception 'FAIL profile next local day';
  end if;
  raise notice 'PASS profile next local day re-awards';
end $$;

do $$
declare uid uuid := (select id from users where email = 'profilegate-a@example.invalid');
  first_award int; second_award int; caught boolean := false;
begin
  select xp_awarded into first_award from record_learning_outcome(uid, 'conversation', 'session:once', 10, 'Asia/Ho_Chi_Minh', false);
  select xp_awarded into second_award from record_learning_outcome(uid, 'conversation', 'session:once', 10, 'America/Los_Angeles', false);
  begin
    insert into xp_events (user_id, source_type, source_id, xp) values (uid, 'conversation', 'session:once', 10);
  exception when unique_violation then caught := true;
  end;
  if first_award <> 10 or second_award <> 0 or not caught then raise exception 'FAIL profile once-only award'; end if;
  raise notice 'PASS profile once-only award and unique index';
end $$;

do $$
begin
  if ((('2026-03-08'::date + 1)::timestamp at time zone 'America/Los_Angeles')
    - ('2026-03-08'::timestamp at time zone 'America/Los_Angeles')) <> interval '23 hours' then
    raise exception 'FAIL profile DST local day';
  end if;
  raise notice 'PASS profile LA DST local day is 23 hours';
end $$;

do $$
declare uid uuid := (select id from users where email = 'profilegate-a@example.invalid');
  z text; ds timestamptz; awarded int;
begin
  foreach z in array array['America/Los_Angeles', 'Asia/Ho_Chi_Minh'] loop
    ds := ((now() at time zone z)::date)::timestamp at time zone z;
    insert into xp_events (user_id, source_type, source_id, xp, created_at)
      values (uid, 'shadowing', 'win:before:' || z, 10, ds - interval '1 minute');
    select xp_awarded into awarded from record_learning_outcome(uid, 'shadowing', 'win:before:' || z, 10, z, true);
    if awarded <> 10 then raise exception 'FAIL profile % award from before local midnight was blocked', z; end if;
    if now() < ds + interval '1 minute' then
      raise notice 'SKIP profile % after-midnight half (local midnight is under a minute old)', z;
    else
      insert into xp_events (user_id, source_type, source_id, xp, created_at)
        values (uid, 'shadowing', 'win:after:' || z, 10, ds + interval '1 minute');
      select xp_awarded into awarded from record_learning_outcome(uid, 'shadowing', 'win:after:' || z, 10, z, true);
      if awarded <> 0 then raise exception 'FAIL profile % award after local midnight re-awarded', z; end if;
    end if;
    raise notice 'PASS profile local-day window boundary in %', z;
  end loop;
end $$;

-- §4.3 study_streak: a projection of learning_outcomes, nothing stored.
create function pg_temp.noon(d date, tz text) returns timestamptz language sql immutable
as $$ select (d::timestamp + interval '12 hours') at time zone tz $$;

do $$
declare uid uuid := (select id from users where email = 'profilegate-a@example.invalid');
  r record; hcm text := 'Asia/Ho_Chi_Minh'; alld smallint[] := '{1,2,3,4,5,6,7}';
begin
  -- 1. three consecutive local days ending today
  delete from learning_outcomes where user_id = uid;
  insert into learning_outcomes (user_id, source_type, item_key, created_at)
    select uid, 'srs_review', 'k' || d, pg_temp.noon(d::date, hcm)
    from generate_series('2026-10-05'::date, '2026-10-07'::date, interval '1 day') d;
  select * into r from study_streak(uid, hcm, alld, '2026-10-07');
  if r.current_streak <> 3 or r.longest_streak <> 3 or r.last_active <> '2026-10-07' then
    raise exception 'FAIL profile streak three days: % % %', r.current_streak, r.longest_streak, r.last_active;
  end if;
  raise notice 'PASS profile streak counts consecutive local days';

  -- 2. repeat-only day (outcome row, no xp_events) still counts (C1)
  delete from learning_outcomes where user_id = uid;
  delete from xp_events where user_id = uid;
  insert into learning_outcomes (user_id, source_type, item_key, created_at)
    values (uid, 'srs_review', 'repeat', pg_temp.noon('2026-10-06', hcm)), (uid, 'srs_review', 'repeat', pg_temp.noon('2026-10-07', hcm));
  select * into r from study_streak(uid, hcm, alld, '2026-10-07');
  if (select count(*) from xp_events where user_id = uid) <> 0 or r.current_streak <> 2 then
    raise exception 'FAIL profile repeat-only day did not count: %', r.current_streak;
  end if;
  raise notice 'PASS profile repeat-only day counts (C1)';

  -- 3. unscheduled days do not break a run (C2)
  delete from learning_outcomes where user_id = uid;
  insert into learning_outcomes (user_id, source_type, item_key, created_at)
    values (uid, 'srs_review', 'fri', pg_temp.noon('2026-10-02', hcm)), (uid, 'srs_review', 'mon', pg_temp.noon('2026-10-05', hcm));
  select * into r from study_streak(uid, hcm, '{1,2,3,4,5}', '2026-10-05');
  if r.current_streak <> 2 or r.longest_streak <> 2 then
    raise exception 'FAIL profile weekday schedule bridged weekend: % %', r.current_streak, r.longest_streak;
  end if;
  select * into r from study_streak(uid, hcm, alld, '2026-10-05');
  if r.current_streak <> 1 or r.longest_streak <> 1 then
    raise exception 'FAIL profile every-day schedule bridged weekend: % %', r.current_streak, r.longest_streak;
  end if;
  raise notice 'PASS profile streak honours the schedule (C2)';

  -- 4. alive vs broken
  delete from learning_outcomes where user_id = uid;
  insert into learning_outcomes (user_id, source_type, item_key, created_at) values (uid, 'srs_review', 'a', pg_temp.noon('2026-10-06', hcm));
  select * into r from study_streak(uid, hcm, alld, '2026-10-07');
  if r.current_streak <> 1 then raise exception 'FAIL profile yesterday should keep the streak alive: %', r.current_streak; end if;
  select * into r from study_streak(uid, hcm, alld, '2026-10-08');
  if r.current_streak <> 0 or r.longest_streak <> 1 or r.last_active <> '2026-10-06' then
    raise exception 'FAIL profile two scheduled days ago: % % %', r.current_streak, r.longest_streak, r.last_active;
  end if;
  delete from learning_outcomes where user_id = uid;
  insert into learning_outcomes (user_id, source_type, item_key, created_at) values (uid, 'srs_review', 'fri', pg_temp.noon('2026-10-02', hcm));
  select * into r from study_streak(uid, hcm, '{1,2,3,4,5}', '2026-10-05');
  if r.current_streak <> 1 then raise exception 'FAIL profile Friday to Monday gap should stay alive: %', r.current_streak; end if;
  select * into r from study_streak(uid, hcm, '{1,2,3,4,5}', '2026-10-06');
  if r.current_streak <> 0 then raise exception 'FAIL profile missed Monday should break: %', r.current_streak; end if;
  raise notice 'PASS profile streak alive/broken boundaries';

  -- 5. zone change re-derives the same instants
  delete from learning_outcomes where user_id = uid;
  insert into learning_outcomes (user_id, source_type, item_key, created_at)
    values (uid, 'srs_review', 'x', '2026-10-06T16:30:00Z'), (uid, 'srs_review', 'y', '2026-10-06T17:30:00Z');
  select * into r from study_streak(uid, 'America/Los_Angeles', alld, '2026-10-06');
  if r.current_streak <> 1 or r.longest_streak <> 1 or r.last_active <> '2026-10-06' then
    raise exception 'FAIL profile Los Angeles one day: % % %', r.current_streak, r.longest_streak, r.last_active;
  end if;
  select * into r from study_streak(uid, hcm, alld, '2026-10-07');
  if r.current_streak <> 2 or r.longest_streak <> 2 or r.last_active <> '2026-10-07' then
    raise exception 'FAIL profile Ho Chi Minh two days: % % %', r.current_streak, r.longest_streak, r.last_active;
  end if;
  raise notice 'PASS profile streak is derived in the current zone';

  -- 5b. longest comes from the longest run, isodow (not dow) buckets the schedule
  delete from learning_outcomes where user_id = uid;
  insert into learning_outcomes (user_id, source_type, item_key, created_at)
    select uid, 'srs_review', 'l' || d, pg_temp.noon(d::date, hcm)
    from unnest(array['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-05']) d;
  select * into r from study_streak(uid, hcm, alld, '2026-10-05');
  if r.current_streak <> 1 or r.longest_streak <> 3 then
    raise exception 'FAIL profile longest run vs current run: % %', r.current_streak, r.longest_streak;
  end if;
  raise notice 'PASS profile longest run is kept apart from the current run';

  -- 5c. activity on an unscheduled day still counts toward the run
  delete from learning_outcomes where user_id = uid;
  insert into learning_outcomes (user_id, source_type, item_key, created_at)
    select uid, 'srs_review', 'w' || d, pg_temp.noon(d::date, hcm)
    from unnest(array['2026-10-02', '2026-10-03', '2026-10-05']) d;
  select * into r from study_streak(uid, hcm, '{1,2,3,4,5}', '2026-10-05');
  if r.current_streak <> 3 or r.longest_streak <> 3 then
    raise exception 'FAIL profile unscheduled-day activity dropped: % %', r.current_streak, r.longest_streak;
  end if;
  raise notice 'PASS profile unscheduled-day activity counts';

  -- 6. badge invariant: shrinking the streak never deletes a badge
  delete from learning_outcomes where user_id = uid;
  insert into learning_outcomes (user_id, source_type, item_key, created_at)
    values (uid, 'srs_review', 'fri', pg_temp.noon('2026-10-02', hcm)), (uid, 'srs_review', 'mon', pg_temp.noon('2026-10-05', hcm));
  insert into user_badges (user_id, badge_id) select uid, id from badges limit 1;
  select * into r from study_streak(uid, hcm, '{1,2,3,4,5}', '2026-10-05');
  if r.current_streak <> 2 then raise exception 'FAIL profile weekday streak before shrink: %', r.current_streak; end if;
  select * into r from study_streak(uid, hcm, alld, '2026-10-05');
  if r.current_streak <> 1 or (select count(*) from user_badges where user_id = uid) <> 1 then
    raise exception 'FAIL profile badge revoked or streak not shrunk';
  end if;
  if (select provolatile from pg_proc where proname = 'study_streak') <> 's' then
    raise exception 'FAIL profile study_streak must be stable';
  end if;
  delete from user_badges where user_id = uid;
  raise notice 'PASS profile badges are never revoked';
end $$;

-- 7. study_streak is security invoker. Identities are resolved as postgres BEFORE the role switch
-- (under authenticated, users_select_own would hide every row and the claims would carry a null sub).
select set_config('gate.a', (select id::text from users where email = 'profilegate-a@example.invalid'), false);
select set_config('gate.b', (select id::text from users where email = 'profilegate-b@example.invalid'), false);
delete from learning_outcomes where user_id in (current_setting('gate.a')::uuid, current_setting('gate.b')::uuid);
insert into learning_outcomes (user_id, source_type, item_key, created_at)
  values (current_setting('gate.a')::uuid, 'srs_review', 'seven', now()),
         (current_setting('gate.b')::uuid, 'srs_review', 'seven-b', now());

begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('gate.a'), 'role', 'authenticated')::text, true);
do $$
declare r record; a uuid := current_setting('gate.a')::uuid;
begin
  if auth.uid() is distinct from a then raise exception 'FAIL profile claims for A did not resolve: %', auth.uid(); end if;
  select * into r from study_streak(a, 'UTC', '{1,2,3,4,5,6,7}', (now() at time zone 'UTC')::date);
  if r.current_streak <> 1 or r.longest_streak <> 1 or r.last_active is distinct from (now() at time zone 'UTC')::date then
    raise exception 'FAIL profile A cannot read its own streak: % % %', r.current_streak, r.longest_streak, r.last_active;
  end if;
  if (select count(*) from learning_outcomes) <> 1 then raise exception 'FAIL profile A should see exactly its own outcome'; end if;
  raise notice 'PASS profile A reads its own streak and outcomes (positive control)';
end $$;
commit;
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('gate.b'), 'role', 'authenticated')::text, true);
do $$
declare r record; a uuid := current_setting('gate.a')::uuid;
begin
  if auth.uid() is distinct from current_setting('gate.b')::uuid then raise exception 'FAIL profile claims for B did not resolve: %', auth.uid(); end if;
  select * into r from study_streak(a, 'UTC', '{1,2,3,4,5,6,7}', (now() at time zone 'UTC')::date);
  if r.current_streak <> 0 or r.longest_streak <> 0 or r.last_active is not null then
    raise exception 'FAIL profile streak leaked across users: % % %', r.current_streak, r.longest_streak, r.last_active;
  end if;
  raise notice 'PASS profile study_streak is confined by RLS';
end $$;
commit;
begin;
set local role anon;
do $$
declare blocked boolean := false;
begin
  begin
    perform * from study_streak('00000000-0000-0000-0000-000000000000', 'UTC', '{1}', current_date);
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'FAIL profile anon streak grant'; end if;
  raise notice 'PASS profile anon cannot call study_streak';
end $$;
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('gate.b'), 'role', 'authenticated')::text, true);
do $$
declare blocked boolean := false; uid uuid := current_setting('gate.b')::uuid;
begin
  if auth.uid() is distinct from uid then raise exception 'FAIL profile claims for B did not resolve: %', auth.uid(); end if;
  begin
    perform record_learning_outcome(uid, 'dictation', 'line:forbidden', 10, 'UTC', true);
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'FAIL profile authenticated RPC grant'; end if;
  blocked := false;
  begin
    insert into learning_outcomes (user_id, source_type, item_key) values (uid, 'dictation', 'line:forbidden');
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'FAIL profile authenticated insert grant'; end if;
  blocked := false;
  begin
    truncate learning_outcomes;
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'FAIL profile authenticated truncate grant'; end if;
  if (select count(*) from learning_outcomes where user_id <> uid) <> 0 then
    raise exception 'FAIL profile outcomes RLS';
  end if;
  if (select count(*) from learning_outcomes where user_id = uid) < 1 then
    raise exception 'FAIL profile B cannot see its own outcomes (positive control)';
  end if;
  raise notice 'PASS profile authenticated grants and cross-user RLS';
end $$;
commit;

begin;
set local role anon;
do $$
declare blocked boolean := false;
begin
  begin
    perform record_learning_outcome(current_setting('gate.a')::uuid, 'dictation', 'line:forbidden', 10, 'UTC', true);
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'FAIL profile anon RPC grant'; end if;
  blocked := false;
  begin
    perform 1 from learning_outcomes limit 1;
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'FAIL profile anon select grant'; end if;
  blocked := false;
  begin
    insert into learning_outcomes (user_id, source_type, item_key)
      values (current_setting('gate.a')::uuid, 'dictation', 'line:forbidden');
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'FAIL profile anon insert grant'; end if;
  raise notice 'PASS profile anon RPC and table grants';
end $$;
commit;

-- 3. study_heartbeat / study_sessions (spec §5). Time moves by shifting started_at and last_heartbeat_at back as
-- postgres between transactions (now() is fixed inside one). Identities come from gate.a / gate.b.
delete from study_sessions where user_id in (current_setting('gate.a')::uuid, current_setting('gate.b')::uuid);
select set_config('gate.p', gen_random_uuid()::text, false);

-- 3.1 start creates segment 0
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('gate.a'), 'role', 'authenticated')::text, true);
do $$
declare r record; s study_sessions%rowtype;
begin
  if auth.uid() is distinct from current_setting('gate.a')::uuid then raise exception 'FAIL study claims for A: %', auth.uid(); end if;
  select * into r from study_heartbeat(current_setting('gate.p')::uuid, null, 'shadowing', '123e4567-e89b-12d3-a456-426614174000', 0, 'start');
  select * into s from study_sessions where id = r.session_id;
  if s.segment_no <> 0 or s.started_at <> now() or s.last_heartbeat_at <> now() or s.last_seq <> 0 or s.ended_at is not null or r.segmented then
    raise exception 'FAIL study start: %', s;
  end if;
  perform set_config('gate.s0', r.session_id::text, false);
  raise notice 'PASS study start creates segment 0';
end $$;
commit;

-- 3.2 start again (lost response) -> same session, no new row
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('gate.a'), 'role', 'authenticated')::text, true);
do $$
declare r record;
begin
  select * into r from study_heartbeat(current_setting('gate.p')::uuid, null, 'shadowing', '123e4567-e89b-12d3-a456-426614174000', 0, 'start');
  if r.session_id <> current_setting('gate.s0')::uuid or (select count(*) from study_sessions) <> 1 then
    raise exception 'FAIL study start retry created a row or a new id';
  end if;
  raise notice 'PASS study start retry is idempotent';
end $$;
commit;

-- 3.3 beat 1 after 30 s
update study_sessions set started_at = started_at - interval '30 seconds', last_heartbeat_at = last_heartbeat_at - interval '30 seconds'
  where id = current_setting('gate.s0')::uuid;
select set_config('gate.before', (select last_heartbeat_at::text from study_sessions where id = current_setting('gate.s0')::uuid), false);
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('gate.a'), 'role', 'authenticated')::text, true);
do $$
declare r record; l timestamptz;
begin
  select * into r from study_heartbeat(current_setting('gate.p')::uuid, current_setting('gate.s0')::uuid, 'shadowing', null, 1, 'beat');
  select last_heartbeat_at into l from study_sessions where id = r.session_id;
  if l - current_setting('gate.before')::timestamptz not between interval '30 seconds' and interval '31 seconds' or r.accepted_seq <> 1 then
    raise exception 'FAIL study beat 1 advanced by %', l - current_setting('gate.before')::timestamptz;
  end if;
  raise notice 'PASS study beat advances by the elapsed 30 s';
end $$;
commit;

-- 3.4 beat 2 after 60 s: capped at +45 s
update study_sessions set started_at = started_at - interval '60 seconds', last_heartbeat_at = last_heartbeat_at - interval '60 seconds'
  where id = current_setting('gate.s0')::uuid;
select set_config('gate.before', (select last_heartbeat_at::text from study_sessions where id = current_setting('gate.s0')::uuid), false);
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('gate.a'), 'role', 'authenticated')::text, true);
do $$
declare l timestamptz;
begin
  perform study_heartbeat(current_setting('gate.p')::uuid, current_setting('gate.s0')::uuid, 'shadowing', null, 2, 'beat');
  select last_heartbeat_at into l from study_sessions where id = current_setting('gate.s0')::uuid;
  if l - current_setting('gate.before')::timestamptz <> interval '45 seconds' then
    raise exception 'FAIL study extension not capped at 45 s: %', l - current_setting('gate.before')::timestamptz;
  end if;
  perform set_config('gate.before', l::text, false);
  raise notice 'PASS study delayed beat is capped at 45 s';
end $$;
commit;

-- 3.5 duplicate beat 2 / 3.6 stale stop 1
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('gate.a'), 'role', 'authenticated')::text, true);
do $$
declare r record; s study_sessions%rowtype;
begin
  select * into r from study_heartbeat(current_setting('gate.p')::uuid, current_setting('gate.s0')::uuid, 'shadowing', null, 2, 'beat');
  select * into s from study_sessions where id = current_setting('gate.s0')::uuid;
  if r.accepted_seq <> 2 or s.last_heartbeat_at <> current_setting('gate.before')::timestamptz then
    raise exception 'FAIL study duplicate beat moved time or seq: % %', r.accepted_seq, s.last_heartbeat_at;
  end if;
  raise notice 'PASS study duplicate beat is a no-op';
  perform study_heartbeat(current_setting('gate.p')::uuid, current_setting('gate.s0')::uuid, 'shadowing', null, 1, 'stop');
  select * into s from study_sessions where id = current_setting('gate.s0')::uuid;
  if s.ended_at is not null or s.last_seq <> 2 then raise exception 'FAIL study stale stop closed the session'; end if;
  raise notice 'PASS study stale stop leaves the session open';
end $$;
commit;

-- 3.7 gap: 5 min silence, beat 3 starts segment 1
update study_sessions set started_at = started_at - interval '5 minutes', last_heartbeat_at = last_heartbeat_at - interval '5 minutes'
  where id = current_setting('gate.s0')::uuid;
select set_config('gate.before', (select last_heartbeat_at::text from study_sessions where id = current_setting('gate.s0')::uuid), false);
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('gate.a'), 'role', 'authenticated')::text, true);
do $$
declare r record; o study_sessions%rowtype; n study_sessions%rowtype;
begin
  select * into r from study_heartbeat(current_setting('gate.p')::uuid, current_setting('gate.s0')::uuid, 'shadowing', null, 3, 'beat');
  select * into o from study_sessions where id = current_setting('gate.s0')::uuid;
  select * into n from study_sessions where id = r.session_id;
  if not r.segmented or r.session_id = o.id or n.segment_no <> 1 or n.started_at <> now()
    or o.ended_at is distinct from current_setting('gate.before')::timestamptz or o.last_heartbeat_at <> o.ended_at then
    raise exception 'FAIL study gap segmentation: % % %', r, o, n;
  end if;
  perform set_config('gate.s1', r.session_id::text, false);
  raise notice 'PASS study gap closes the old segment at its last heartbeat and opens segment 1';
end $$;
commit;

-- 3.8 beat to the closed segment 0 with seq 9
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('gate.a'), 'role', 'authenticated')::text, true);
do $$
declare r record;
begin
  select * into r from study_heartbeat(current_setting('gate.p')::uuid, current_setting('gate.s0')::uuid, 'shadowing', null, 9, 'beat');
  if r.session_id <> current_setting('gate.s0')::uuid or r.accepted_seq <> 3 or r.segmented
    or (select count(*) from study_sessions) <> 2 then
    raise exception 'FAIL study beat to a closed segment: %', r;
  end if;
  raise notice 'PASS study beat to a closed segment is a no-op';
end $$;
commit;

-- 3.9 stop closes at last_heartbeat_at, not now()
update study_sessions set started_at = started_at - interval '10 seconds', last_heartbeat_at = last_heartbeat_at - interval '10 seconds'
  where id = current_setting('gate.s1')::uuid;
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('gate.a'), 'role', 'authenticated')::text, true);
do $$
declare s study_sessions%rowtype;
begin
  perform study_heartbeat(current_setting('gate.p')::uuid, current_setting('gate.s1')::uuid, 'shadowing', null, 4, 'stop');
  select * into s from study_sessions where id = current_setting('gate.s1')::uuid;
  if s.ended_at is distinct from s.last_heartbeat_at or s.ended_at >= now() or s.last_seq <> 4 then
    raise exception 'FAIL study stop ended_at: % vs %', s.ended_at, s.last_heartbeat_at;
  end if;
  raise notice 'PASS study stop ends at last_heartbeat_at';
end $$;
commit;

-- 3.10 B cannot touch A's session; positive control: B can use its own
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('gate.b'), 'role', 'authenticated')::text, true);
do $$
declare blocked boolean := false; r record;
begin
  if auth.uid() is distinct from current_setting('gate.b')::uuid then raise exception 'FAIL study claims for B: %', auth.uid(); end if;
  begin
    perform study_heartbeat(current_setting('gate.p')::uuid, current_setting('gate.s0')::uuid, 'shadowing', null, 99, 'beat');
  exception when no_data_found then blocked := true;
  end;
  if not blocked then raise exception 'FAIL study B reached A session'; end if;
  if (select count(*) from study_sessions) <> 0 then raise exception 'FAIL study B sees A rows'; end if;
  select * into r from study_heartbeat(gen_random_uuid(), null, 'conversation', null, 0, 'start');
  if (select count(*) from study_sessions where user_id = current_setting('gate.b')::uuid) <> 1 then
    raise exception 'FAIL study B cannot start its own session (positive control)';
  end if;
  raise notice 'PASS study B is confined to its own sessions';
end $$;
commit;

-- 3.11 grants
begin;
set local role anon;
-- A signed claim makes auth.uid() non-null, so only the grant (not the function's own null-user guard) can block this call.
select set_config('request.jwt.claims', json_build_object('sub', current_setting('gate.a'), 'role', 'anon')::text, true);
do $$
declare blocked boolean := false;
begin
  begin
    perform study_heartbeat(gen_random_uuid(), null, 'shadowing', null, 0, 'start');
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'FAIL study anon rpc grant'; end if;
  blocked := false;
  begin perform 1 from study_sessions limit 1;
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'FAIL study anon select grant'; end if;
  blocked := false;
  begin
    insert into study_sessions (user_id, client_presence_id, surface, started_at, last_heartbeat_at, last_seq)
      values (current_setting('gate.a')::uuid, gen_random_uuid(), 'shadowing', now(), now(), 0);
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'FAIL study anon insert grant'; end if;
  raise notice 'PASS study anon rpc and table grants';
end $$;
commit;
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('gate.a'), 'role', 'authenticated')::text, true);
do $$
declare blocked boolean; stmt text;
begin
  if auth.uid() is distinct from current_setting('gate.a')::uuid then raise exception 'FAIL study claims for A: %', auth.uid(); end if;
  foreach stmt in array array[
    'insert into study_sessions (user_id, client_presence_id, surface, started_at, last_heartbeat_at, last_seq) values (auth.uid(), gen_random_uuid(), ''shadowing'', now(), now(), 0)',
    'update study_sessions set last_seq = 50',
    'delete from study_sessions',
    'truncate study_sessions'
  ] loop
    blocked := false;
    begin execute stmt;
    exception when insufficient_privilege then blocked := true;
    end;
    if not blocked then raise exception 'FAIL study authenticated write not blocked: %', stmt; end if;
  end loop;
  if (select count(*) from study_sessions) <> 2 then raise exception 'FAIL study A cannot read its own rows (positive control)'; end if;
  raise notice 'PASS study authenticated has no direct write grant';
end $$;
commit;

-- 3.12 check constraints
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('gate.a'), 'role', 'authenticated')::text, true);
do $$
declare blocked boolean := false;
begin
  begin
    perform study_heartbeat(gen_random_uuid(), null, 'karaoke', null, 0, 'start');
  exception when check_violation then blocked := true;
  end;
  if not blocked then raise exception 'FAIL study unknown surface accepted'; end if;
  blocked := false;
  begin
    perform study_heartbeat(gen_random_uuid(), null, 'kanji', repeat('x', 129), 0, 'start');
  exception when check_violation then blocked := true;
  end;
  if not blocked then raise exception 'FAIL study 129-char context accepted'; end if;
  raise notice 'PASS study surface and context checks';
end $$;
commit;

delete from auth.users where email in ('profilegate-a@example.invalid', 'profilegate-b@example.invalid');
