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
  first_award int; second_award int;
begin
  select xp_awarded into first_award from record_learning_outcome(uid, 'srs_review', 'vocab:daily', 10, 'Asia/Ho_Chi_Minh', true);
  select xp_awarded into second_award from record_learning_outcome(uid, 'srs_review', 'vocab:daily', 10, 'Asia/Ho_Chi_Minh', true);
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
