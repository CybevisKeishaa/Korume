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

-- 3.13 start hygiene closes only the starting presence (R-5a): presence Y starting must not close idle presence X
select set_config('gate.x', gen_random_uuid()::text, false);
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('gate.a'), 'role', 'authenticated')::text, true);
do $$
declare r record;
begin
  select * into r from study_heartbeat(current_setting('gate.x')::uuid, null, 'kanji', '123e4567-e89b-12d3-a456-426614174000', 0, 'start');
  perform set_config('gate.sx', r.session_id::text, false);
end $$;
commit;
update study_sessions set started_at = started_at - interval '5 minutes', last_heartbeat_at = last_heartbeat_at - interval '5 minutes'
  where id = current_setting('gate.sx')::uuid;
select set_config('gate.before', (select last_heartbeat_at::text from study_sessions where id = current_setting('gate.sx')::uuid), false);
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('gate.a'), 'role', 'authenticated')::text, true);
do $$
declare r record; o study_sessions%rowtype;
begin
  perform study_heartbeat(gen_random_uuid(), null, 'kanji', '123e4567-e89b-12d3-a456-426614174000', 0, 'start');
  select * into o from study_sessions where id = current_setting('gate.sx')::uuid;
  if o.ended_at is not null then raise exception 'FAIL study start of another presence closed this one'; end if;
  select * into r from study_heartbeat(current_setting('gate.x')::uuid, current_setting('gate.sx')::uuid, 'kanji', null, 1, 'beat');
  select * into o from study_sessions where id = current_setting('gate.sx')::uuid;
  if not r.segmented or r.session_id = o.id or o.ended_at is distinct from current_setting('gate.before')::timestamptz then
    raise exception 'FAIL study idle presence did not segment after another presence started: % %', r, o;
  end if;
  raise notice 'PASS study another presence start leaves an idle presence to its own next beat';
end $$;
commit;

-- 3.14 the 90 s gap boundary (R-5b): 80 s stays, 100 s segments
select set_config('gate.z', gen_random_uuid()::text, false);
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('gate.a'), 'role', 'authenticated')::text, true);
do $$
declare r record;
begin
  select * into r from study_heartbeat(current_setting('gate.z')::uuid, null, 'kanji', '123e4567-e89b-12d3-a456-426614174000', 0, 'start');
  perform set_config('gate.sz', r.session_id::text, false);
end $$;
commit;
update study_sessions set started_at = started_at - interval '80 seconds', last_heartbeat_at = last_heartbeat_at - interval '80 seconds'
  where id = current_setting('gate.sz')::uuid;
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('gate.a'), 'role', 'authenticated')::text, true);
do $$
declare r record;
begin
  select * into r from study_heartbeat(current_setting('gate.z')::uuid, current_setting('gate.sz')::uuid, 'kanji', null, 1, 'beat');
  if r.segmented or r.session_id <> current_setting('gate.sz')::uuid then raise exception 'FAIL study 80 s silence segmented'; end if;
end $$;
commit;
update study_sessions set started_at = started_at - interval '100 seconds', last_heartbeat_at = last_heartbeat_at - interval '100 seconds'
  where id = current_setting('gate.sz')::uuid;
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('gate.a'), 'role', 'authenticated')::text, true);
do $$
declare r record;
begin
  select * into r from study_heartbeat(current_setting('gate.z')::uuid, current_setting('gate.sz')::uuid, 'kanji', null, 2, 'beat');
  if not r.segmented or r.session_id = current_setting('gate.sz')::uuid then raise exception 'FAIL study 100 s silence did not segment'; end if;
  raise notice 'PASS study 90 s gap boundary (80 s stays, 100 s segments)';
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

-- 3.15 rapid beats cannot outrun real time (§11): a burst of beats advances the session by wall-clock only
select set_config('gate.q', gen_random_uuid()::text, false);
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('gate.a'), 'role', 'authenticated')::text, true);
do $$
declare r record;
begin
  select * into r from study_heartbeat(current_setting('gate.q')::uuid, null, 'kanji', '123e4567-e89b-12d3-a456-426614174000', 0, 'start');
  perform set_config('gate.sq', r.session_id::text, false);
end $$;
commit;
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('gate.a'), 'role', 'authenticated')::text, true);
do $$ begin perform study_heartbeat(current_setting('gate.q')::uuid, current_setting('gate.sq')::uuid, 'kanji', null, 1, 'beat'); end $$;
commit;
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('gate.a'), 'role', 'authenticated')::text, true);
do $$ begin perform study_heartbeat(current_setting('gate.q')::uuid, current_setting('gate.sq')::uuid, 'kanji', null, 2, 'beat'); end $$;
commit;
do $$
declare s study_sessions%rowtype;
begin
  select * into s from study_sessions where id = current_setting('gate.sq')::uuid;
  if s.last_heartbeat_at - s.started_at > interval '10 seconds' or s.last_heartbeat_at > clock_timestamp() or s.last_seq <> 2 then
    raise exception 'FAIL study rapid beats outran real time: % % %', s.started_at, s.last_heartbeat_at, s.last_seq;
  end if;
  raise notice 'PASS study rapid beats cannot outrun real time';
end $$;

-- 4. Study-time read model: independent fixed intervals, scoped through JWT claims.
delete from study_sessions where user_id in (current_setting('gate.a')::uuid, current_setting('gate.b')::uuid);
insert into study_sessions (user_id, client_presence_id, surface, started_at, last_heartbeat_at, ended_at, last_seq)
values
  (current_setting('gate.a')::uuid, gen_random_uuid(), 'kanji', '2026-09-01 10:00Z', '2026-09-01 10:30Z', '2026-09-01 10:30Z', 1),
  (current_setting('gate.a')::uuid, gen_random_uuid(), 'kanji', '2026-09-02 10:00Z', '2026-09-02 10:30Z', '2026-09-02 10:30Z', 1),
  (current_setting('gate.a')::uuid, gen_random_uuid(), 'kanji', '2026-09-02 10:15Z', '2026-09-02 10:45Z', '2026-09-02 10:45Z', 1),
  (current_setting('gate.a')::uuid, gen_random_uuid(), 'kanji', '2026-09-03 10:00Z', '2026-09-03 10:10Z', '2026-09-03 10:10Z', 1),
  (current_setting('gate.a')::uuid, gen_random_uuid(), 'kanji', '2026-09-03 10:10Z', '2026-09-03 10:20Z', '2026-09-03 10:20Z', 1),
  (current_setting('gate.a')::uuid, gen_random_uuid(), 'kanji', '2026-09-04 10:00Z', '2026-09-04 10:12Z', null, 1),
  (current_setting('gate.a')::uuid, gen_random_uuid(), 'kanji', '2026-09-05 10:00Z', '2026-09-05 10:10Z', '2026-09-05 10:10Z', 1),
  (current_setting('gate.a')::uuid, gen_random_uuid(), 'kanji', '2026-09-05 10:20Z', '2026-09-05 10:30Z', '2026-09-05 10:30Z', 1),
  (current_setting('gate.a')::uuid, gen_random_uuid(), 'kanji', '2026-09-08 10:00Z', '2026-09-08 10:30Z', '2026-09-08 10:30Z', 1),
  (current_setting('gate.a')::uuid, gen_random_uuid(), 'shadowing', '2026-09-08 10:10Z', '2026-09-08 10:40Z', '2026-09-08 10:40Z', 1),
  (current_setting('gate.a')::uuid, gen_random_uuid(), 'kanji', '2026-09-06 23:00Z', '2026-09-07 01:00Z', '2026-09-07 01:00Z', 1),
  (current_setting('gate.a')::uuid, gen_random_uuid(), 'kanji', '2026-10-01 16:50Z', '2026-10-01 17:20Z', '2026-10-01 17:20Z', 1),
  (current_setting('gate.a')::uuid, gen_random_uuid(), 'kanji', '2026-11-01 07:30Z', '2026-11-01 09:30Z', '2026-11-01 09:30Z', 1),
  (current_setting('gate.a')::uuid, gen_random_uuid(), 'kanji', '2026-11-02 07:30Z', '2026-11-02 08:30Z', '2026-11-02 08:30Z', 1);

begin;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('gate.a'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare r record; n int; total bigint;
begin
  if auth.uid() is distinct from current_setting('gate.a')::uuid then raise exception 'FAIL study time A identity'; end if;
  select count(*), sum(seconds) into n, total from study_time('UTC', '2026-09-01 00:00Z', '2026-09-02 00:00Z');
  if n <> 1 or total <> 1800 then raise exception 'FAIL study time 4.1 single interval: %, %', n, total; end if;
  select * into r from study_time('UTC', '2026-09-01 00:00Z', '2026-09-02 00:00Z');
  if r.day is distinct from '2026-09-01'::date then raise exception 'FAIL study time 4.1 local day: %', r; end if;
  raise notice 'PASS study time 4.1 single interval';
  select count(*), sum(seconds) into n, total from study_time('UTC', '2026-09-02 00:00Z', '2026-09-03 00:00Z');
  if n <> 1 or total <> 2700 then raise exception 'FAIL study time 4.2 overlap: %, %', n, total; end if;
  raise notice 'PASS study time 4.2 overlap';
  select count(*), sum(seconds) into n, total from study_time('UTC', '2026-09-03 00:00Z', '2026-09-04 00:00Z');
  -- The read model returns daily totals, so whether touching inputs formed one internal interval is unobservable here.
  if n <> 1 or total <> 1200 then raise exception 'FAIL study time 4.3 touching: %, %', n, total; end if;
  raise notice 'PASS study time 4.3 touching';
  select count(*), sum(seconds) into n, total from study_time('UTC', '2026-09-04 00:00Z', '2026-09-05 00:00Z');
  if n <> 1 or total <> 720 then raise exception 'FAIL study time 4.4 open heartbeat end: %, %', n, total; end if;
  raise notice 'PASS study time 4.4 open heartbeat end';
  select count(*), sum(seconds) into n, total from study_time('UTC', '2026-09-05 00:00Z', '2026-09-06 00:00Z');
  if n <> 1 or total <> 1200 then raise exception 'FAIL study time 4.9 disjoint gap: %, %', n, total; end if;
  raise notice 'PASS study time 4.9 disjoint gap';
  select count(*), sum(seconds) into n, total from study_time('UTC', '2026-09-08 00:00Z', '2026-09-09 00:00Z');
  if n <> 1 or total <> 2400 then raise exception 'FAIL study time two surfaces at once double-counted: %, %', n, total; end if;
  raise notice 'PASS study time two tabs on two surfaces never double-count';
  select * into r from study_time('UTC', '2026-09-07 00:00Z', '2026-09-08 00:00Z');
  if r.day is distinct from '2026-09-07'::date or r.seconds is distinct from 3600
    or (select count(*) from study_time('UTC', '2026-09-07 00:00Z', '2026-09-08 00:00Z')) <> 1
    then raise exception 'FAIL study time 4.10 window clipping: %', r; end if;
  raise notice 'PASS study time 4.10 window clipping';
  select count(*), sum(seconds) into n, total from study_time('Asia/Ho_Chi_Minh', '2026-10-01 00:00Z', '2026-10-02 00:00Z');
  if n <> 2 or total <> 1800 then raise exception 'FAIL study time 4.5 local split total: %, %', n, total; end if;
  for r in select * from study_time('Asia/Ho_Chi_Minh', '2026-10-01 00:00Z', '2026-10-02 00:00Z') loop
    if (r.day = '2026-10-01' and r.seconds <> 600) or (r.day = '2026-10-02' and r.seconds <> 1200)
      or r.day not in ('2026-10-01', '2026-10-02') then raise exception 'FAIL study time 4.5 local bucket: %', r; end if;
  end loop;
  raise notice 'PASS study time 4.5 local midnight';
  select * into r from study_time('America/Los_Angeles', '2026-10-01 00:00Z', '2026-10-02 00:00Z');
  if r.day is distinct from '2026-10-01'::date or r.seconds is distinct from 1800
    or (select count(*) from study_time('America/Los_Angeles', '2026-10-01 00:00Z', '2026-10-02 00:00Z')) <> 1
    then raise exception 'FAIL study time 4.6 LA bucket: %', r; end if;
  raise notice 'PASS study time 4.6 same interval LA bucket';
  select * into r from study_time('America/Los_Angeles', '2026-11-01 00:00Z', '2026-11-02 00:00Z');
  if r.day is distinct from '2026-11-01'::date or r.seconds is distinct from 7200
    or (select count(*) from study_time('America/Los_Angeles', '2026-11-01 00:00Z', '2026-11-02 00:00Z')) <> 1
    then raise exception 'FAIL study time 4.7 fall-back: %', r; end if;
  raise notice 'PASS study time 4.7 DST fall-back';
  select count(*), sum(seconds) into n, total from study_time('America/Los_Angeles', '2026-11-02 07:30Z', '2026-11-02 08:30Z');
  if n <> 2 or total <> 3600 then raise exception 'FAIL study time 4.11 DST midnight count: %, %', n, total; end if;
  if (select count(*) from study_time('America/Los_Angeles', '2026-11-02 07:30Z', '2026-11-02 08:30Z')
      where day = '2026-11-01' and seconds = 1800) <> 1
    or (select count(*) from study_time('America/Los_Angeles', '2026-11-02 07:30Z', '2026-11-02 08:30Z')
      where day = '2026-11-02' and seconds = 1800) <> 1
    then raise exception 'FAIL study time 4.11 DST midnight buckets'; end if;
  raise notice 'PASS study time 4.11 DST midnight';
  if study_tracked_since() is distinct from '2026-09-01 10:00Z'::timestamptz then
    raise exception 'FAIL study time 4.8 A tracked since'; end if;
  raise notice 'PASS study time 4.8 A tracked since';
end $$;
commit;

begin;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('gate.b'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
begin
  if auth.uid() is distinct from current_setting('gate.b')::uuid then raise exception 'FAIL study time B identity'; end if;
  if (select count(*) from study_time('UTC', '2026-09-01 00:00Z', '2026-12-01 00:00Z')) <> 0
    or study_tracked_since() is not null then raise exception 'FAIL study time 4.8 B privacy'; end if;
  if (select prosecdef from pg_proc where oid = 'study_time(text,timestamptz,timestamptz)'::regprocedure) is distinct from false
    then raise exception 'FAIL study time 4.8 invoker security'; end if;
  raise notice 'PASS study time 4.8 B privacy and invoker security';
end $$;
commit;

-- 5. Profile columns, first-transition timestamps, avatars bucket (spec §2.1, §2.2, §9). Identities from gate.a / gate.b,
-- claims built BEFORE the role switch; every "cannot" has a "can" beside it.
-- storage.protect_delete blocks direct deletes unless storage.allow_delete_query is true; the gate owns these throwaway rows.
begin;
set local storage.allow_delete_query = 'true';
delete from storage.objects where bucket_id in ('avatars', 'recordings')
  and (storage.foldername(name))[1] in (current_setting('gate.a'), current_setting('gate.b'));
commit;
delete from certification_tests where id = '00000000-0000-0000-0000-0000000000b1';
delete from vocab where id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2');
insert into vocab (id, word) values ('00000000-0000-0000-0000-0000000000a1', 'profilegate'), ('00000000-0000-0000-0000-0000000000a2', 'profilegate2');
insert into certification_tests (id, level, title) values ('00000000-0000-0000-0000-0000000000b1', 'N5', 'profilegate');
insert into user_vocab_progress (user_id, vocab_id, srs_stage, mastered_at)
  values (current_setting('gate.a')::uuid, '00000000-0000-0000-0000-0000000000a1', 2, '2026-09-01 10:00Z');
insert into user_test_attempts (user_id, test_id, score, completed_at, passed_at)
  values (current_setting('gate.a')::uuid, '00000000-0000-0000-0000-0000000000b1', 90, '2026-09-02 10:00Z', '2026-09-02 10:00Z');
insert into storage.objects (bucket_id, name) values
  ('avatars', current_setting('gate.a') || '/avatar.webp'),
  ('avatars', current_setting('gate.b') || '/avatar.webp');

-- 5.1 bucket shape (postgres)
do $$
begin
  if not exists (select 1 from storage.buckets where id = 'avatars' and public = false
      and file_size_limit = 524288 and allowed_mime_types = array['image/webp']) then
    raise exception 'FAIL profile avatars bucket must exist, private, 512 KiB, image/webp only';
  end if;
  raise notice 'PASS profile avatars bucket is private with its limits';
end $$;

-- 5.2 PostgreSQL seeds the boundary values; authenticated cannot bypass save_profile for any Edit Profile column.
update users set username = 'keishaa', bio = repeat('b', 160), country = 'VN', native_language = 'vi',
  target_jlpt_level = 'N3', learning_goal = repeat('g', 200),
  preferred_practices = array['kanji','grammar','reading','vocabulary','shadowing','listening','pronunciation','conversation']
  where id = current_setting('gate.a')::uuid;
begin;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('gate.a'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare column_name text; caught boolean;
begin
  if auth.uid() is distinct from current_setting('gate.a')::uuid then raise exception 'FAIL profile 5.2 claims for A: %', auth.uid(); end if;
  foreach column_name in array array['username', 'bio', 'country', 'native_language', 'target_jlpt_level', 'learning_goal', 'preferred_practices'] loop
    caught := false;
    begin
      execute format('update users set %I = %I where id = auth.uid()', column_name, column_name);
    exception when insufficient_privilege then caught := true; end;
    if not caught then raise exception 'FAIL profile 5.2 authenticated can update %', column_name; end if;
  end loop;
  if not exists (select 1 from users where id = auth.uid() and username = 'keishaa' and char_length(bio) = 160
      and country = 'VN' and native_language = 'vi' and target_jlpt_level = 'N3' and char_length(learning_goal) = 200
      and cardinality(preferred_practices) = 8) then
    raise exception 'FAIL profile 5.2 seeded boundary values did not persist';
  end if;
  if (select count(*) from storage.objects where bucket_id = 'avatars') <> 1
    or not exists (select 1 from storage.objects where bucket_id = 'avatars' and name = current_setting('gate.a') || '/avatar.webp') then
    raise exception 'FAIL profile 5.2 A must read exactly its own avatar object';
  end if;
  raise notice 'PASS profile authenticated cannot update seven Edit Profile columns and reads only its own avatar';
end $$;
commit;

-- 5.2b mastered_at: a NULL value can be SET by an update through the trigger (the only production path)
begin;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('gate.a'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare v uuid := '00000000-0000-0000-0000-0000000000a2';
begin
  if auth.uid() is distinct from current_setting('gate.a')::uuid then raise exception 'FAIL profile 5.2b claims for A: %', auth.uid(); end if;
  insert into user_vocab_progress (user_id, vocab_id, srs_stage) values (auth.uid(), v, 1);
  update user_vocab_progress set srs_stage = 2, mastered_at = '2026-09-05 10:00Z' where vocab_id = v;
  if (select mastered_at from user_vocab_progress where vocab_id = v) is distinct from '2026-09-05 10:00Z'::timestamptz then
    raise exception 'FAIL profile 5.2b first mastered_at did not land';
  end if;
  update user_vocab_progress set srs_stage = 0, mastered_at = null where vocab_id = v;
  if (select mastered_at from user_vocab_progress where vocab_id = v) is distinct from '2026-09-05 10:00Z'::timestamptz then
    raise exception 'FAIL profile 5.2b mastered_at changed after being set';
  end if;
  raise notice 'PASS profile mastered_at: NULL can be set once, then stays';
end $$;
commit;

-- 5.3 server-only column and immutable timestamps
begin;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('gate.a'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare caught text;
begin
  if auth.uid() is distinct from current_setting('gate.a')::uuid then raise exception 'FAIL profile 5.3 claims for A: %', auth.uid(); end if;
  caught := null;
  begin update users set avatar_path = current_setting('gate.a') || '/avatar.webp' where id = auth.uid(); exception when insufficient_privilege then caught := 'ok'; end;
  if caught is null then raise exception 'FAIL profile 5.3 avatar_path is client-writable'; end if;
  -- passed_at: A reads its attempt (positive control) but can never rewrite it
  if (select count(*) from user_test_attempts) <> 1 then raise exception 'FAIL profile 5.3 A cannot read its own attempt'; end if;
  caught := null;
  begin update user_test_attempts set passed_at = null; exception when insufficient_privilege then caught := 'ok'; end;
  if caught is null then raise exception 'FAIL profile 5.3 passed_at is client-updatable'; end if;
  -- mastered_at: the update itself lands (stage drops) but the first-mastery instant stays
  update user_vocab_progress set srs_stage = 0, mastered_at = null where vocab_id = '00000000-0000-0000-0000-0000000000a1';
  if (select srs_stage from user_vocab_progress where vocab_id = '00000000-0000-0000-0000-0000000000a1') <> 0 then
    raise exception 'FAIL profile 5.3 A cannot update its own progress row';
  end if;
  if (select mastered_at from user_vocab_progress where vocab_id = '00000000-0000-0000-0000-0000000000a1') is distinct from '2026-09-01 10:00Z'::timestamptz then
    raise exception 'FAIL profile 5.3 mastered_at was reset';
  end if;
  raise notice 'PASS profile server-only avatar_path, insert-only passed_at, immutable mastered_at';
end $$;
commit;

-- The database constraints still reject invalid values through a privileged write.
do $$
declare caught boolean;
begin
  caught := false;
  begin update users set username = 'Keishaa' where id = current_setting('gate.a')::uuid;
  exception when check_violation then caught := true; end;
  if not caught then raise exception 'FAIL profile 5.3 uppercase username accepted'; end if;
  caught := false;
  begin update users set bio = repeat('b', 161) where id = current_setting('gate.a')::uuid;
  exception when check_violation then caught := true; end;
  if not caught then raise exception 'FAIL profile 5.3 161-char bio accepted'; end if;
  caught := false;
  begin update users set preferred_practices = array_fill('kanji'::text, array[9]) where id = current_setting('gate.a')::uuid;
  exception when check_violation then caught := true; end;
  if not caught then raise exception 'FAIL profile 5.3 nine practices accepted'; end if;
  update users set bio = 'still writable' where id = current_setting('gate.a')::uuid;
  if (select bio from users where id = current_setting('gate.a')::uuid) <> 'still writable' then raise exception 'FAIL profile 5.3 privileged bio update failed'; end if;
  raise notice 'PASS profile privileged writes obey username, bio and practices checks';
end $$;

-- 5.4 B cannot write a username, sees only its own avatar, cannot write the avatars bucket; own recordings insert
begin;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('gate.b'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare caught text;
begin
  if auth.uid() is distinct from current_setting('gate.b')::uuid then raise exception 'FAIL profile 5.4 claims for B: %', auth.uid(); end if;
  caught := null;
  begin update users set username = 'keishaa_b' where id = auth.uid(); exception when insufficient_privilege then caught := 'ok'; end;
  if caught is null then raise exception 'FAIL profile 5.4 B can update its own username'; end if;
  if (select count(*) from storage.objects where bucket_id = 'avatars') <> 1
    or exists (select 1 from storage.objects where bucket_id = 'avatars' and name like current_setting('gate.a') || '/%') then
    raise exception 'FAIL profile 5.4 B must read only its own avatar object';
  end if;
  caught := null;
  begin
    insert into storage.objects (bucket_id, name) values ('avatars', current_setting('gate.b') || '/new.webp');
  exception when insufficient_privilege then caught := 'ok'; end;
  if caught is null then raise exception 'FAIL profile 5.4 B wrote into avatars'; end if;
  insert into storage.objects (bucket_id, name) values ('recordings', current_setting('gate.b') || '/ok.webm');
  raise notice 'PASS profile B: username server-write-only, own avatar only, avatars server-write-only';
end $$;
commit;

-- A privileged write keeps the unique-index check and creates B's username for save_profile 7.2.
do $$
declare caught boolean := false;
begin
  begin update users set username = 'keishaa' where id = current_setting('gate.b')::uuid;
  exception when unique_violation then caught := true; end;
  if not caught then raise exception 'FAIL profile 5.4 duplicate username accepted'; end if;
  update users set username = 'keishaa_b' where id = current_setting('gate.b')::uuid;
  if (select username from users where id = current_setting('gate.b')::uuid) is distinct from 'keishaa_b' then raise exception 'FAIL profile 5.4 privileged free username failed'; end if;
  raise notice 'PASS profile privileged username writes reject duplicates and accept free names';
end $$;


-- 6. Profile read model (spec §6): five security-invoker functions scoped to auth.uid(). Identities come from gate.a /
-- gate.b, claims are built BEFORE the role switch, and every "B sees none" case has A's positive control beside it.
-- Fixtures are inserted as postgres between transactions.
create or replace function pg_temp.clean_profile_evidence() returns void language plpgsql as $$
declare a uuid := current_setting('gate.a')::uuid; b uuid := current_setting('gate.b')::uuid;
begin
  delete from learning_outcomes where user_id in (a, b);
  delete from xp_events where user_id in (a, b);
  delete from study_sessions where user_id in (a, b);
  delete from user_video_progress where user_id in (a, b);
  delete from user_vocab_progress where user_id in (a, b);
  delete from user_test_attempts where user_id in (a, b);
  delete from user_badges where user_id in (a, b);
  delete from companion_memories where user_id in (a, b);
end $$;
delete from videos where id in (select ('00000000-0000-0000-0000-0000000000c' || i)::uuid from generate_series(1, 8) i);
delete from lesson_sources where id in ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000d3');
delete from badges where id = '00000000-0000-0000-0000-0000000000e1';
delete from vocab where word like 'pgcount%';
insert into lesson_sources (id, slug, display_order) values
  ('00000000-0000-0000-0000-0000000000d1', 'pg-anime', 90),
  ('00000000-0000-0000-0000-0000000000d2', 'pg-nhk', 91),
  ('00000000-0000-0000-0000-0000000000d3', 'pg-drama', 89);
insert into videos (id, youtube_video_id, title, source_id, library_access) values
  ('00000000-0000-0000-0000-0000000000c1', 'pgprofile-v1', 'pg video 1', '00000000-0000-0000-0000-0000000000d1', 'FREE'),
  ('00000000-0000-0000-0000-0000000000c2', 'pgprofile-v2', 'pg video 2', '00000000-0000-0000-0000-0000000000d1', 'FREE'),
  ('00000000-0000-0000-0000-0000000000c3', 'pgprofile-v3', 'pg video 3', '00000000-0000-0000-0000-0000000000d1', 'FREE'),
  ('00000000-0000-0000-0000-0000000000c4', 'pgprofile-v4', 'pg video 4', '00000000-0000-0000-0000-0000000000d2', 'FREE'),
  ('00000000-0000-0000-0000-0000000000c5', 'pgprofile-v5', 'pg video 5', '00000000-0000-0000-0000-0000000000d2', 'FREE'),
  ('00000000-0000-0000-0000-0000000000c6', 'pgprofile-v6', 'pg video 6', '00000000-0000-0000-0000-0000000000d3', 'FREE'),
  ('00000000-0000-0000-0000-0000000000c7', 'pgprofile-v7', 'pg video 7', '00000000-0000-0000-0000-0000000000d3', 'FREE');
insert into badges (id, name) values ('00000000-0000-0000-0000-0000000000e1', 'pg badge');

-- 6.1 first_known_learning_at: the earliest evidence in ANY canonical table (C5), not just the new ones.
select pg_temp.clean_profile_evidence();
insert into xp_events (user_id, source_type, source_id, xp, created_at)
  values (current_setting('gate.a')::uuid, 'dictation', 'line:legacy', 10, '2025-03-01 10:00Z');
insert into user_video_progress (user_id, video_id) values (current_setting('gate.a')::uuid, '00000000-0000-0000-0000-0000000000c1');
update user_video_progress set last_watched_at = '2025-05-01 10:00Z' where user_id = current_setting('gate.a')::uuid;
begin;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('gate.a'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
begin
  if auth.uid() is distinct from current_setting('gate.a')::uuid then raise exception 'FAIL profile 6.1 claims for A: %', auth.uid(); end if;
  if first_known_learning_at() is distinct from '2025-03-01 10:00Z'::timestamptz then
    raise exception 'FAIL profile 6.1 A first evidence should be the xp_events row, got %', first_known_learning_at();
  end if;
  raise notice 'PASS profile first_known_learning_at takes the earliest source (positive control)';
end $$;
commit;
begin;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('gate.b'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
begin
  if auth.uid() is distinct from current_setting('gate.b')::uuid then raise exception 'FAIL profile 6.1 claims for B: %', auth.uid(); end if;
  if first_known_learning_at() is not null then raise exception 'FAIL profile 6.1 B sees evidence: %', first_known_learning_at(); end if;
  raise notice 'PASS profile first_known_learning_at is null for a learner with nothing and never reads A';
end $$;
commit;

-- 6.2 profile_counts: aggregated in SQL (1 200 rows exceed PostgREST max_rows).
select pg_temp.clean_profile_evidence();
insert into vocab (id, word) select ('00000000-0000-0000-0001-' || lpad(i::text, 12, '0'))::uuid, 'pgcount' || i from generate_series(1, 1200) i;
insert into user_vocab_progress (user_id, vocab_id, srs_stage) values
  (current_setting('gate.a')::uuid, '00000000-0000-0000-0001-000000000001', 1),
  (current_setting('gate.a')::uuid, '00000000-0000-0000-0001-000000000002', 2),
  (current_setting('gate.a')::uuid, '00000000-0000-0000-0001-000000000003', 5);
insert into user_video_progress (user_id, video_id, completed_at) values
  (current_setting('gate.a')::uuid, '00000000-0000-0000-0000-0000000000c1', '2026-01-01 10:00Z'),
  (current_setting('gate.a')::uuid, '00000000-0000-0000-0000-0000000000c2', '2026-01-02 10:00Z'),
  (current_setting('gate.a')::uuid, '00000000-0000-0000-0000-0000000000c3', null);
begin;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('gate.a'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare r record;
begin
  if auth.uid() is distinct from current_setting('gate.a')::uuid then raise exception 'FAIL profile 6.2 claims for A: %', auth.uid(); end if;
  select * into r from profile_counts(2);
  if r.words_learned <> 2 or r.video_lessons_completed <> 2 then
    raise exception 'FAIL profile 6.2 counts for A: words %, videos %', r.words_learned, r.video_lessons_completed;
  end if;
  raise notice 'PASS profile_counts(2): stages 1,2,5 -> 2 words; 2 completed + 1 in-progress -> 2 videos (positive control)';
end $$;
commit;
begin;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('gate.b'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare r record;
begin
  if auth.uid() is distinct from current_setting('gate.b')::uuid then raise exception 'FAIL profile 6.2 claims for B: %', auth.uid(); end if;
  select * into r from profile_counts(2);
  if r.words_learned <> 0 or r.video_lessons_completed <> 0 then
    raise exception 'FAIL profile 6.2 B counted A rows: words %, videos %', r.words_learned, r.video_lessons_completed;
  end if;
  raise notice 'PASS profile_counts: B sees none of A rows';
end $$;
commit;
delete from user_vocab_progress where user_id = current_setting('gate.a')::uuid;
insert into user_vocab_progress (user_id, vocab_id, srs_stage, mastered_at)
  select current_setting('gate.a')::uuid, id, 3, '2026-02-01 10:00Z' from vocab where word like 'pgcount%';
begin;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('gate.a'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
begin
  if auth.uid() is distinct from current_setting('gate.a')::uuid then raise exception 'FAIL profile 6.2b claims for A: %', auth.uid(); end if;
  if (select words_learned from profile_counts(2)) <> 1200 then
    raise exception 'FAIL profile 6.2b 1200 mastered rows counted as %', (select words_learned from profile_counts(2));
  end if;
  raise notice 'PASS profile_counts aggregates 1200 rows in SQL';
end $$;
commit;

-- 6.3 profile_journey: system milestones plus companion ones, newest first; erasing the companion keeps the system ones.
select pg_temp.clean_profile_evidence();
insert into xp_events (user_id, source_type, source_id, xp, created_at)
  values (current_setting('gate.a')::uuid, 'dictation', 'line:journey', 10, '2025-11-01 00:00Z');
insert into user_video_progress (user_id, video_id, completed_at) values
  (current_setting('gate.a')::uuid, '00000000-0000-0000-0000-0000000000c1', '2026-01-02 00:00Z'),
  (current_setting('gate.a')::uuid, '00000000-0000-0000-0000-0000000000c2', '2026-01-05 00:00Z');
-- the learner's real first completion is a lesson they can no longer read (PRIVATE, not in their library)
insert into videos (id, youtube_video_id, title) values ('00000000-0000-0000-0000-0000000000c8', 'pgprofile-v8', 'pg hidden video');
insert into user_video_progress (user_id, video_id, completed_at)
  values (current_setting('gate.a')::uuid, '00000000-0000-0000-0000-0000000000c8', '2025-12-01 00:00Z');
update user_video_progress set last_watched_at = completed_at where user_id = current_setting('gate.a')::uuid;
insert into vocab (id, word) values ('00000000-0000-0000-0002-000000000001', 'pgcountjourney') on conflict do nothing;
insert into user_vocab_progress (user_id, vocab_id, srs_stage, mastered_at)
  values (current_setting('gate.a')::uuid, '00000000-0000-0000-0002-000000000001', 3, '2026-02-01 00:00Z');
insert into certification_tests (id, level, title) values ('00000000-0000-0000-0000-0000000000b1', 'N5', 'profilegate') on conflict do nothing;
insert into user_test_attempts (user_id, test_id, score, completed_at, passed_at)
  values (current_setting('gate.a')::uuid, '00000000-0000-0000-0000-0000000000b1', 90, '2026-03-01 00:00Z', '2026-03-01 00:00Z');
insert into user_badges (user_id, badge_id, earned_at)
  values (current_setting('gate.a')::uuid, '00000000-0000-0000-0000-0000000000e1', '2026-04-01 00:00Z');
insert into companion_memories (user_id, kind, memory_type, title, line_text_jp, dedupe_key, occurred_at) values
  (current_setting('gate.a')::uuid, 'discovered', 'first_meeting', 'Hello', null, 'pg:meet', '2026-05-01 00:00Z'),
  (current_setting('gate.a')::uuid, 'discovered', 'first_shadow', 'First shadow', null, 'pg:shadow', '2026-05-02 00:00Z'),
  (current_setting('gate.a')::uuid, 'discovered', 'jlpt_passed', 'N5', null, 'pg:jlpt', '2026-05-03 00:00Z'),
  (current_setting('gate.a')::uuid, 'gifted', 'pinned_line', 'Pinned', 'こんにちは', 'pg:pin', '2026-05-04 00:00Z'),
  (current_setting('gate.a')::uuid, 'discovered', 'line_mastered', 'Not a milestone', 'x', 'pg:lm', '2026-05-05 00:00Z');
begin;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('gate.a'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare kinds text; labels text;
begin
  if auth.uid() is distinct from current_setting('gate.a')::uuid then raise exception 'FAIL profile 6.3 claims for A: %', auth.uid(); end if;
  select string_agg(kind, ',' order by at desc), string_agg(coalesce(label, '-'), ',' order by at desc) into kinds, labels
    from profile_journey(20, true);
  if kinds is distinct from 'pinned_line,jlpt_passed,first_shadow,first_meeting,badge_earned,first_certification_passed,first_mastered_word,first_video_completed,first_activity'
    or labels is distinct from 'こんにちは,N5,First shadow,Hello,pg badge,N5,pgcountjourney,-,-' then
    raise exception 'FAIL profile 6.3 journey for A: % / %', kinds, labels;
  end if;
  if (select count(*) from profile_journey(3, true)) <> 3 then raise exception 'FAIL profile 6.3 limit ignored'; end if;
  if (select at from profile_journey(20, true) where kind = 'first_video_completed') is distinct from '2025-12-01 00:00Z'::timestamptz then
    raise exception 'FAIL profile 6.3 a hidden first completion must still date the milestone';
  end if;
  select string_agg(kind, ',' order by at desc) into kinds from profile_journey(20, false);
  if kinds is distinct from 'badge_earned,first_certification_passed,first_mastered_word,first_video_completed,first_activity' then
    raise exception 'FAIL profile 6.3 companion kinds not dropped when excluded: %', kinds;
  end if;
  raise notice 'PASS profile_journey newest first with labels, limit, and p_include_companion = false (positive control)';
end $$;
commit;
begin;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('gate.b'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
begin
  if auth.uid() is distinct from current_setting('gate.b')::uuid then raise exception 'FAIL profile 6.3 claims for B: %', auth.uid(); end if;
  if (select count(*) from profile_journey(20, true)) <> 0 then raise exception 'FAIL profile 6.3 B sees A journey rows'; end if;
  raise notice 'PASS profile_journey: B sees none of A rows';
end $$;
commit;
begin;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('gate.a'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare kinds text;
begin
  if auth.uid() is distinct from current_setting('gate.a')::uuid then raise exception 'FAIL profile 6.3b claims for A: %', auth.uid(); end if;
  perform erase_companion_memory();
  select string_agg(kind, ',' order by at desc) into kinds from profile_journey(20, true);
  if kinds is distinct from 'badge_earned,first_certification_passed,first_mastered_word,first_video_completed,first_activity' then
    raise exception 'FAIL profile 6.3b erase must leave every system milestone: %', kinds;
  end if;
  raise notice 'PASS profile_journey keeps system milestones after erase_companion_memory';
end $$;
commit;

-- 6.4 favorite_lesson_sources(3, 2, 6): content taxonomy with evidence only.
select pg_temp.clean_profile_evidence();
insert into user_video_progress (user_id, video_id) select current_setting('gate.a')::uuid, ('00000000-0000-0000-0000-0000000000c' || i)::uuid from generate_series(1, 2) i;
update user_video_progress set last_watched_at = '2026-01-01 00:00Z' where user_id = current_setting('gate.a')::uuid;
begin;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('gate.a'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
begin
  if auth.uid() is distinct from current_setting('gate.a')::uuid then raise exception 'FAIL profile 6.4a claims for A: %', auth.uid(); end if;
  if (select count(*) from favorite_lesson_sources(3, 2, 6)) <> 0 then raise exception 'FAIL profile 6.4a below the total must return nothing'; end if;
  raise notice 'PASS favorite_lesson_sources: 2 evidenced lessons -> no rows';
end $$;
commit;
insert into user_video_progress (user_id, video_id) values (current_setting('gate.a')::uuid, '00000000-0000-0000-0000-0000000000c4');
update user_video_progress set last_watched_at = '2026-02-01 00:00Z' where video_id = '00000000-0000-0000-0000-0000000000c4';
begin;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('gate.a'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare r record; n int := 0;
begin
  if auth.uid() is distinct from current_setting('gate.a')::uuid then raise exception 'FAIL profile 6.4b claims for A: %', auth.uid(); end if;
  for r in select * from favorite_lesson_sources(3, 2, 6) loop
    n := n + 1;
    if r.slug <> 'pg-anime' or r.lessons <> 2 then raise exception 'FAIL profile 6.4b unexpected row % %', r.slug, r.lessons; end if;
  end loop;
  if n <> 1 then raise exception 'FAIL profile 6.4b expected only anime, got % rows', n; end if;
  raise notice 'PASS favorite_lesson_sources: anime, anime, nhk -> only anime (nhk has 1 < 2)';
end $$;
commit;
begin;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('gate.b'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
begin
  if auth.uid() is distinct from current_setting('gate.b')::uuid then raise exception 'FAIL profile 6.4 claims for B: %', auth.uid(); end if;
  if (select count(*) from favorite_lesson_sources(0, 0, 6)) <> 0 then raise exception 'FAIL profile 6.4 B sees A lessons'; end if;
  raise notice 'PASS favorite_lesson_sources: B sees none of A rows';
end $$;
commit;
-- ties: anime 2, nhk 2 (latest watch 02-02), drama 2 (latest watch 02-02) -> drama (display_order 89), nhk (91), anime (90, older)
insert into user_video_progress (user_id, video_id) select current_setting('gate.a')::uuid, ('00000000-0000-0000-0000-0000000000c' || i)::uuid from generate_series(5, 7) i;
update user_video_progress set last_watched_at = '2026-02-02 00:00Z' where video_id in
  ('00000000-0000-0000-0000-0000000000c5', '00000000-0000-0000-0000-0000000000c6', '00000000-0000-0000-0000-0000000000c7');
begin;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('gate.a'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare s text;
begin
  if auth.uid() is distinct from current_setting('gate.a')::uuid then raise exception 'FAIL profile 6.4c claims for A: %', auth.uid(); end if;
  select string_agg(slug, ',' order by ord) into s from (select slug, row_number() over () as ord from favorite_lesson_sources(3, 2, 6)) q;
  if s is distinct from 'pg-drama,pg-nhk,pg-anime' then raise exception 'FAIL profile 6.4c tie order: %', s; end if;
  if (select count(*) from favorite_lesson_sources(3, 2, 2)) <> 2 then raise exception 'FAIL profile 6.4c limit ignored'; end if;
  raise notice 'PASS favorite_lesson_sources ties: latest watch, then display_order; limit honoured';
end $$;
commit;
insert into user_video_progress (user_id, video_id, last_watched_position) values (current_setting('gate.a')::uuid, '00000000-0000-0000-0000-0000000000c3', 1);
update user_video_progress set last_watched_at = '2025-01-01 00:00Z' where video_id = '00000000-0000-0000-0000-0000000000c3';
begin;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('gate.a'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare s text;
begin
  if auth.uid() is distinct from current_setting('gate.a')::uuid then raise exception 'FAIL profile 6.4d claims for A: %', auth.uid(); end if;
  select string_agg(slug || ':' || lessons, ',' order by ord) into s from (select slug, lessons, row_number() over () as ord from favorite_lesson_sources(3, 2, 6)) q;
  if s is distinct from 'pg-anime:3,pg-drama:2,pg-nhk:2' then raise exception 'FAIL profile 6.4d count beats recency: %', s; end if;
  if (select count(*) from favorite_lesson_sources(3, 3, 6)) <> 1 then raise exception 'FAIL profile 6.4d p_min_per_source ignored'; end if;
  raise notice 'PASS favorite_lesson_sources: count first, p_min_per_source honoured';
end $$;
commit;

-- 6.5 todays_memory (C4): candidates frozen at the start of the learner's local day; the pick is deterministic.
select pg_temp.clean_profile_evidence();
select set_config('gate.ds', (((now() at time zone 'Asia/Ho_Chi_Minh')::date)::timestamp at time zone 'Asia/Ho_Chi_Minh')::text, false);
insert into companion_memories (id, user_id, kind, memory_type, title, dedupe_key, created_at, occurred_at) values
  ('ffffffff-0000-0000-0000-000000000001', current_setting('gate.a')::uuid, 'gifted', 'pinned_line', 'y1', 'pg:y1', current_setting('gate.ds')::timestamptz - interval '2 hours', now()),
  ('ffffffff-0000-0000-0000-000000000002', current_setting('gate.a')::uuid, 'gifted', 'pinned_line', 'y2', 'pg:y2', current_setting('gate.ds')::timestamptz - interval '3 hours', now());
begin;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('gate.a'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare picked uuid; n int;
begin
  if auth.uid() is distinct from current_setting('gate.a')::uuid then raise exception 'FAIL profile 6.5 claims for A: %', auth.uid(); end if;
  select count(*), min(id::text)::uuid into n, picked from todays_memory('Asia/Ho_Chi_Minh');
  if n <> 1 or picked::text not like 'ffffffff-%' then raise exception 'FAIL profile 6.5 expected one yesterday pinned memory, got % %', n, picked; end if;
  perform set_config('gate.pick', picked::text, false);
  raise notice 'PASS todays_memory picks one of two pinned memories created yesterday (positive control)';
end $$;
commit;
-- C4: memories created today must not change the pick. Insert enough of them, sorted BEFORE yesterday's, that an
-- unfrozen pool would move the pick (idx = hash mod n lands on a today row).
do $$
declare h bigint := abs(hashtext(current_setting('gate.a') || ((now() at time zone 'Asia/Ho_Chi_Minh')::date)::text)::bigint);
  k int := 1;
begin
  while h % (2 + k) >= k and k < 50 loop k := k + 1; end loop;
  insert into companion_memories (id, user_id, kind, memory_type, title, dedupe_key, created_at, occurred_at)
    select ('00000000-0000-0000-0003-' || lpad(i::text, 12, '0'))::uuid, current_setting('gate.a')::uuid, 'gifted', 'pinned_line',
      'today' || i, 'pg:today' || i, current_setting('gate.ds')::timestamptz, now()
    from generate_series(1, k) i;
end $$;
begin;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('gate.a'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare picked uuid; n int;
begin
  if auth.uid() is distinct from current_setting('gate.a')::uuid then raise exception 'FAIL profile 6.5b claims for A: %', auth.uid(); end if;
  select count(*), min(id::text)::uuid into n, picked from todays_memory('Asia/Ho_Chi_Minh');
  if n <> 1 or picked::text is distinct from current_setting('gate.pick') then
    raise exception 'FAIL profile 6.5b a memory created today moved the pick (% -> %)', current_setting('gate.pick'), picked;
  end if;
  raise notice 'PASS todays_memory pick is frozen against memories created today (C4)';
end $$;
commit;
begin;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('gate.b'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
begin
  if auth.uid() is distinct from current_setting('gate.b')::uuid then raise exception 'FAIL profile 6.5 claims for B: %', auth.uid(); end if;
  if (select count(*) from todays_memory('Asia/Ho_Chi_Minh')) <> 0 then raise exception 'FAIL profile 6.5 B sees A memories'; end if;
  raise notice 'PASS todays_memory: B sees none of A rows';
end $$;
commit;
-- only today's memories -> nothing
delete from companion_memories where user_id = current_setting('gate.a')::uuid and id::text like 'ffffffff-%';
begin;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('gate.a'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
begin
  if auth.uid() is distinct from current_setting('gate.a')::uuid then raise exception 'FAIL profile 6.5c claims for A: %', auth.uid(); end if;
  if (select count(*) from todays_memory('Asia/Ho_Chi_Minh')) <> 0 then raise exception 'FAIL profile 6.5c only-today memories must give no row'; end if;
  raise notice 'PASS todays_memory: only today memories -> no row';
end $$;
commit;
-- no pinned yesterday, line_mastered yesterday -> a line_mastered row
delete from companion_memories where user_id = current_setting('gate.a')::uuid;
insert into companion_memories (user_id, kind, memory_type, title, dedupe_key, created_at, occurred_at) values
  (current_setting('gate.a')::uuid, 'discovered', 'line_mastered', 'lm1', 'pg:lm1', current_setting('gate.ds')::timestamptz - interval '2 hours', now()),
  (current_setting('gate.a')::uuid, 'gifted', 'pinned_line', 'today pin', 'pg:todaypin', current_setting('gate.ds')::timestamptz, now());
begin;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('gate.a'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
begin
  if auth.uid() is distinct from current_setting('gate.a')::uuid then raise exception 'FAIL profile 6.5d claims for A: %', auth.uid(); end if;
  if (select count(*) from todays_memory('Asia/Ho_Chi_Minh') where title = 'lm1') <> 1
    or (select count(*) from todays_memory('Asia/Ho_Chi_Minh')) <> 1 then
    raise exception 'FAIL profile 6.5d no pinned yesterday must fall back to line_mastered';
  end if;
  raise notice 'PASS todays_memory falls back to line_mastered';
end $$;
commit;

-- 6.6 grants: anon cannot call any of the five; authenticated can (positive control is every case above)
begin;
set local role anon;
do $$
declare blocked int := 0;
begin
  begin perform first_known_learning_at(); exception when insufficient_privilege then blocked := blocked + 1; end;
  begin perform * from profile_counts(2); exception when insufficient_privilege then blocked := blocked + 1; end;
  begin perform * from profile_journey(1, true); exception when insufficient_privilege then blocked := blocked + 1; end;
  begin perform * from favorite_lesson_sources(1, 1, 1); exception when insufficient_privilege then blocked := blocked + 1; end;
  begin perform * from todays_memory('UTC'); exception when insufficient_privilege then blocked := blocked + 1; end;
  if blocked <> 5 then raise exception 'FAIL profile 6.6 anon can call % of 5 read-model functions', 5 - blocked; end if;
  if exists (select 1 from pg_proc where proname in ('first_known_learning_at', 'profile_counts', 'profile_journey', 'favorite_lesson_sources', 'todays_memory')
      and (prosecdef or provolatile <> 's')) then
    raise exception 'FAIL profile 6.6 read-model functions must be stable security invoker';
  end if;
  raise notice 'PASS profile read-model grants: anon blocked; all five stable security invoker';
end $$;
commit;

-- 7. save_profile (spec §8.4, §9): one atomic write, callable by the service role only. Identities come from gate.a / gate.b
-- (resolved as postgres, never read through RLS); p_user is always passed explicitly, as the server does after authenticating.
update users set avatar_path = current_setting('gate.a') || '/profile/old.webp' where id = current_setting('gate.a')::uuid;
create or replace function pg_temp.sp_fields(p_username text) returns jsonb language sql as $$
  select jsonb_build_object('displayName', 'Saved A', 'username', p_username, 'bio', 'hello', 'country', 'JP',
    'timeZone', 'Asia/Tokyo', 'nativeLanguage', 'vi', 'targetJlptLevel', 'N2', 'learningGoal', 'be fluent',
    'preferredPractices', jsonb_build_array('kanji', 'reading'))
$$;
create or replace function pg_temp.sp_prefs() returns jsonb language sql as $$
  select jsonb_build_object('dailyMinutes', 30, 'readingTranslation', 'reveal', 'readingFurigana', 'always', 'companionEnabled', false)
$$;

-- 7.1 A saves every field in one call and gets the previous avatar path back; B's row does not move (positive control: A moved)
select set_config('gate.b_before', (select to_jsonb(u)::text from users u where id = current_setting('gate.b')::uuid), false);
begin;
set local role service_role;
do $$
declare a uuid := current_setting('gate.a')::uuid; prev text;
begin
  prev := save_profile(a, pg_temp.sp_fields('saved_a'), pg_temp.sp_prefs(), 'keep', null);
  if prev is distinct from current_setting('gate.a') || '/profile/old.webp' then raise exception 'FAIL profile 7.1 previous avatar path: %', prev; end if;
  if not exists (select 1 from users where id = a and name = 'Saved A' and username = 'saved_a' and bio = 'hello'
      and country = 'JP' and study_timezone = 'Asia/Tokyo' and native_language = 'vi' and target_jlpt_level = 'N2'
      and learning_goal = 'be fluent' and preferred_practices = array['kanji', 'reading'] and daily_minutes = 30
      and avatar_path = current_setting('gate.a') || '/profile/old.webp') then
    raise exception 'FAIL profile 7.1 A columns not all saved (keep leaves the avatar)';
  end if;
  if not exists (select 1 from user_preferences where user_id = a and reading_translation = 'reveal'
      and reading_furigana = 'always' and companion_enabled = false) then
    raise exception 'FAIL profile 7.1 A preferences not saved';
  end if;
  prev := save_profile(a, pg_temp.sp_fields('saved_a') || '{"bio": ""}'::jsonb, pg_temp.sp_prefs() || '{"companionEnabled": true}', 'keep', null);
  if (select bio from users where id = a) is not null or not (select companion_enabled from user_preferences where user_id = a) then
    raise exception 'FAIL profile 7.1 empty bio must store NULL and the second save must update the existing preferences row';
  end if;
  if (select to_jsonb(u)::text from users u where id = current_setting('gate.b')::uuid) is distinct from current_setting('gate.b_before') then
    raise exception 'FAIL profile 7.1 saving for A changed B';
  end if;
  raise notice 'PASS profile save_profile writes every field once, returns the previous avatar path, leaves B alone';
end $$;
commit;

-- 7.2 atomic: a username owned by B raises unique_violation and leaves EVERY A column and preference unchanged
select set_config('gate.a_before', (select to_jsonb(u)::text from users u where id = current_setting('gate.a')::uuid), false);
select set_config('gate.a_prefs_before', (select to_jsonb(p)::text from user_preferences p where user_id = current_setting('gate.a')::uuid), false);
begin;
set local role service_role;
do $$
declare a uuid := current_setting('gate.a')::uuid; caught text;
begin
  if (select username from users where id = current_setting('gate.b')::uuid) is distinct from 'keishaa_b' then raise exception 'FAIL profile 7.2 fixture: B owns keishaa_b'; end if;
  begin
    perform save_profile(a, pg_temp.sp_fields('keishaa_b') || '{"displayName": "Changed", "bio": "changed"}'::jsonb,
      pg_temp.sp_prefs() || '{"dailyMinutes": 60, "readingFurigana": "hidden"}', 'replace', current_setting('gate.a') || '/profile/new.webp');
  exception when unique_violation then caught := 'ok'; end;
  if caught is null then raise exception 'FAIL profile 7.2 a username taken by B was accepted'; end if;
  if (select to_jsonb(u)::text from users u where id = a) is distinct from current_setting('gate.a_before')
    or (select to_jsonb(p)::text from user_preferences p where user_id = a) is distinct from current_setting('gate.a_prefs_before') then
    raise exception 'FAIL profile 7.2 a failed save changed A (not atomic)';
  end if;
  perform save_profile(a, pg_temp.sp_fields('saved_a2'), pg_temp.sp_prefs(), 'keep', null);
  if (select username from users where id = a) is distinct from 'saved_a2' then raise exception 'FAIL profile 7.2 positive control: a free username must save'; end if;
  raise notice 'PASS profile save_profile is atomic on a unique_violation (positive control: free username saves)';
end $$;
commit;

-- 7.3 replace is confined to <A>/profile/; return value is the previous path; remove clears; keep leaves
begin;
set local role service_role;
do $$
declare a uuid := current_setting('gate.a')::uuid; b uuid := current_setting('gate.b')::uuid; bad text; caught text; prev text;
begin
  foreach bad in array array[current_setting('gate.b') || '/profile/x.webp', current_setting('gate.a') || '/other/x.webp',
    current_setting('gate.a') || '/avatar.webp', '/profile/x.webp'] loop
    caught := null;
    begin perform save_profile(a, pg_temp.sp_fields('saved_a2'), pg_temp.sp_prefs(), 'replace', bad);
    exception when check_violation then caught := 'ok'; end;
    if caught is null then raise exception 'FAIL profile 7.3 replace accepted path %', bad; end if;
  end loop;
  caught := null;
  begin perform save_profile(a, pg_temp.sp_fields('saved_a2'), pg_temp.sp_prefs(), 'replace', null);
  exception when check_violation then caught := 'ok'; end;
  if caught is null then raise exception 'FAIL profile 7.3 replace with a null path accepted'; end if;
  if (select avatar_path from users where id = a) is distinct from current_setting('gate.a') || '/profile/old.webp' then
    raise exception 'FAIL profile 7.3 a rejected replace changed avatar_path';
  end if;
  prev := save_profile(a, pg_temp.sp_fields('saved_a2'), pg_temp.sp_prefs(), 'replace', current_setting('gate.a') || '/profile/new.webp');
  if prev is distinct from current_setting('gate.a') || '/profile/old.webp'
    or (select avatar_path from users where id = a) is distinct from current_setting('gate.a') || '/profile/new.webp' then
    raise exception 'FAIL profile 7.3 positive control: a valid replace must save and return the old path (%)', prev;
  end if;
  prev := save_profile(a, pg_temp.sp_fields('saved_a2'), pg_temp.sp_prefs(), 'remove', null);
  if prev is distinct from current_setting('gate.a') || '/profile/new.webp' or (select avatar_path from users where id = a) is not null then
    raise exception 'FAIL profile 7.3 remove must clear avatar_path and return the old one (%)', prev;
  end if;
  prev := save_profile(a, pg_temp.sp_fields('saved_a2'), pg_temp.sp_prefs(), 'remove', null);
  if prev is not null then raise exception 'FAIL profile 7.3 removing nothing returns null (%)', prev; end if;
  caught := null;
  begin perform save_profile(a, pg_temp.sp_fields('saved_a2'), pg_temp.sp_prefs(), 'drop', null);
  exception when invalid_parameter_value then caught := 'ok'; end;
  if caught is null then raise exception 'FAIL profile 7.3 unknown avatar action accepted'; end if;
  caught := null;
  begin perform save_profile(gen_random_uuid(), pg_temp.sp_fields('ghost_user'), pg_temp.sp_prefs(), 'keep', null);
  exception when no_data_found then caught := 'ok'; end;
  if caught is null then raise exception 'FAIL profile 7.3 unknown user accepted'; end if;
  raise notice 'PASS profile save_profile avatar actions: replace confined to <A>/profile/, previous path returned';
end $$;
commit;

-- 7.4 grants: the service role only. anon and authenticated (a real signed claim, valid arguments) are refused.
begin;
set local role anon;
do $$
declare caught text;
begin
  begin perform save_profile(current_setting('gate.a')::uuid, '{"displayName":"x","username":"anon_try","bio":"","country":"JP","timeZone":"Asia/Tokyo","nativeLanguage":"vi","targetJlptLevel":"N2","learningGoal":"","preferredPractices":[]}'::jsonb, '{"dailyMinutes":30,"readingTranslation":"reveal","readingFurigana":"always","companionEnabled":false}'::jsonb, 'keep', null);
  exception when insufficient_privilege then caught := 'ok'; end;
  if caught is null then raise exception 'FAIL profile 7.4 anon executed save_profile'; end if;
  raise notice 'PASS profile anon cannot execute save_profile';
end $$;
commit;
begin;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('gate.a'), 'role', 'authenticated')::text, true);
set local role authenticated;
do $$
declare caught text;
begin
  if auth.uid() is distinct from current_setting('gate.a')::uuid then raise exception 'FAIL profile 7.4 claims for A: %', auth.uid(); end if;
  begin perform save_profile(auth.uid(), '{"displayName":"x","username":"auth_try","bio":"","country":"JP","timeZone":"Asia/Tokyo","nativeLanguage":"vi","targetJlptLevel":"N2","learningGoal":"","preferredPractices":[]}'::jsonb, '{"dailyMinutes":30,"readingTranslation":"reveal","readingFurigana":"always","companionEnabled":false}'::jsonb, 'keep', null);
  exception when insufficient_privilege then caught := 'ok'; end;
  if caught is null then raise exception 'FAIL profile 7.4 authenticated executed save_profile'; end if;
  raise notice 'PASS profile authenticated cannot execute save_profile';
end $$;
commit;
do $$
begin
  if exists (select 1 from pg_proc p, aclexplode(p.proacl) acl
      where p.proname = 'save_profile' and acl.privilege_type = 'EXECUTE' and (acl.grantee = 0 or acl.grantee::regrole::text not in ('service_role', 'postgres')))
    or not has_function_privilege('service_role', 'save_profile(uuid, jsonb, jsonb, text, text)', 'execute')
    or not (select prosecdef from pg_proc where proname = 'save_profile') then
    raise exception 'FAIL profile 7.4 save_profile must be security definer with EXECUTE for service_role only';
  end if;
  raise notice 'PASS profile save_profile: security definer, EXECUTE service_role only';
end $$;

select pg_temp.clean_profile_evidence();
delete from videos where id in (select ('00000000-0000-0000-0000-0000000000c' || i)::uuid from generate_series(1, 8) i);
delete from lesson_sources where id in ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000d3');
delete from badges where id = '00000000-0000-0000-0000-0000000000e1';
delete from vocab where word like 'pgcount%';
-- storage.protect_delete blocks direct deletes unless storage.allow_delete_query is true; the gate owns these throwaway rows.
begin;
set local storage.allow_delete_query = 'true';
delete from storage.objects where bucket_id in ('avatars', 'recordings')
  and (storage.foldername(name))[1] in (current_setting('gate.a'), current_setting('gate.b'));
commit;
delete from certification_tests where id = '00000000-0000-0000-0000-0000000000b1';
delete from vocab where id in ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2');

delete from auth.users where email in ('profilegate-a@example.invalid', 'profilegate-b@example.invalid');
