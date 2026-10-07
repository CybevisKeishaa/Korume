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

-- 7. study_streak is security invoker: B cannot read A's outcomes through it; anon cannot call it.
insert into learning_outcomes (user_id, source_type, item_key, created_at)
  select id, 'srs_review', 'seven', now() from users where email = 'profilegate-a@example.invalid';
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', (select id from users where email = 'profilegate-b@example.invalid'), 'role', 'authenticated')::text, true);
do $$
declare r record; a uuid := (select id from users where email = 'profilegate-a@example.invalid');
begin
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
select set_config('request.jwt.claims', json_build_object('sub', (select id from users where email = 'profilegate-b@example.invalid'), 'role', 'authenticated')::text, true);
do $$
declare blocked boolean := false; uid uuid := (select id from users where email = 'profilegate-b@example.invalid');
begin
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
  raise notice 'PASS profile authenticated grants and cross-user RLS';
end $$;
commit;

begin;
set local role anon;
do $$
declare blocked boolean := false;
begin
  begin
    perform record_learning_outcome((select id from users where email = 'profilegate-a@example.invalid'), 'dictation', 'line:forbidden', 10, 'UTC', true);
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
      values ((select id from users where email = 'profilegate-a@example.invalid'), 'dictation', 'line:forbidden');
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'FAIL profile anon insert grant'; end if;
  raise notice 'PASS profile anon RPC and table grants';
end $$;
commit;

delete from auth.users where email in ('profilegate-a@example.invalid', 'profilegate-b@example.invalid');
