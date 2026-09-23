\set ON_ERROR_STOP on

delete from auth.users where email like 'settingsgate-%@example.invalid';

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated',
    'authenticated', 'settingsgate-a@example.invalid', crypt('password123', gen_salt('bf')),
    now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated',
    'authenticated', 'settingsgate-b@example.invalid', crypt('password123', gen_salt('bf')),
    now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb);

select id as uid_a from public.users where email = 'settingsgate-a@example.invalid' \gset
select id as uid_b from public.users where email = 'settingsgate-b@example.invalid' \gset

begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'uid_a', 'role', 'authenticated')::text, true);
insert into public.user_preferences (user_id) values (:'uid_a');
do $$
begin
  if auth.uid() is null then raise exception 'FAIL RLS setup: auth.uid() is null'; end if;
  if (select count(*) from public.user_preferences) <> 1 then
    raise exception 'FAIL RLS: user A cannot read their own row';
  end if;
  raise notice 'PASS RLS: user A inserts and reads their own row';
end $$;
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'uid_b', 'role', 'authenticated')::text, true);
do $$
declare visible_rows int; changed_rows int;
begin
  if auth.uid() is null then raise exception 'FAIL RLS setup: auth.uid() is null'; end if;
  select count(*) into visible_rows from public.user_preferences where user_id <> auth.uid();
  update public.user_preferences set reduce_motion = true where user_id <> auth.uid();
  get diagnostics changed_rows = row_count;
  if visible_rows <> 0 or changed_rows <> 0 then
    raise exception 'FAIL RLS: user B saw % or changed % rows of A', visible_rows, changed_rows;
  end if;
  raise notice 'PASS RLS: user B cannot read or update user A';
end $$;
commit;

do $$
begin
  begin
    insert into public.user_preferences (user_id, learning_schedule, schedule_days)
      values ((select id from public.users where email = 'settingsgate-b@example.invalid'), 'weekdays', '{1,2,3}');
    raise exception 'FAIL schedule: weekdays accepted non-canonical days';
  exception when check_violation then null;
  end;
  begin
    insert into public.user_preferences (user_id, learning_schedule, schedule_days)
      values ((select id from public.users where email = 'settingsgate-b@example.invalid'), 'custom', '{}');
    raise exception 'FAIL schedule: custom accepted empty days';
  exception when check_violation then null;
  end;
  begin
    insert into public.user_preferences (user_id, learning_schedule, schedule_days)
      values ((select id from public.users where email = 'settingsgate-b@example.invalid'), 'custom', '{0}');
    raise exception 'FAIL schedule: custom accepted out-of-range day';
  exception when check_violation then null;
  end;
  insert into public.user_preferences (user_id, learning_schedule, schedule_days)
    values ((select id from public.users where email = 'settingsgate-b@example.invalid'), 'custom', '{2,4}');
  raise notice 'PASS schedule constraints reject invalid days and accept custom days';
end $$;

do $$
declare uid_a uuid; uid_b uuid; session_a uuid; session_b uuid;
begin
  select id into uid_a from public.users where email = 'settingsgate-a@example.invalid';
  select id into uid_b from public.users where email = 'settingsgate-b@example.invalid';
  update public.user_stats set xp = 42 where user_id = uid_a;
  insert into public.companion_memories (user_id, kind, memory_type, dedupe_key)
    values
      (uid_a, 'gifted', 'pinned_line', 'settingsgate-a-1'),
      (uid_a, 'gifted', 'pinned_line', 'settingsgate-a-2'),
      (uid_b, 'gifted', 'pinned_line', 'settingsgate-b-1'),
      (uid_b, 'gifted', 'pinned_line', 'settingsgate-b-2');
  insert into public.conversation_sessions (user_id) values (uid_a) returning id into session_a;
  insert into public.conversation_sessions (user_id) values (uid_b) returning id into session_b;
  insert into public.conversation_messages (session_id, role, content)
    values (session_a, 'user', 'A'), (session_b, 'user', 'B');
end $$;

begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'uid_a', 'role', 'authenticated')::text, true);
select public.erase_companion_memory();
commit;

do $$
declare uid_a uuid; uid_b uuid;
begin
  select id into uid_a from public.users where email = 'settingsgate-a@example.invalid';
  select id into uid_b from public.users where email = 'settingsgate-b@example.invalid';
  if (select count(*) from public.companion_memories where user_id = uid_a) <> 0
    or (select count(*) from public.conversation_sessions where user_id = uid_a) <> 0
    or (select count(*) from public.conversation_messages m join public.conversation_sessions s on s.id = m.session_id where s.user_id = uid_a) <> 0
    -- coalesce, so a missing user_stats row fails loudly instead of comparing
    -- against NULL and passing while proving nothing.
    or coalesce((select xp from public.user_stats where user_id = uid_a), -1) <> 42 then
    raise exception 'FAIL erase: user A memory removal affected the wrong data';
  end if;
  if (select count(*) from public.companion_memories where user_id = uid_b) <> 2
    or (select count(*) from public.conversation_sessions where user_id = uid_b) <> 1
    or (select count(*) from public.conversation_messages m join public.conversation_sessions s on s.id = m.session_id where s.user_id = uid_b) <> 1 then
    raise exception 'FAIL erase: user B memory was changed';
  end if;
  raise notice 'PASS erase_companion_memory removes only caller memory and preserves progress';
end $$;

delete from auth.users where email like 'settingsgate-%@example.invalid';

do $$
begin
  if (select count(*) from public.users where email like 'settingsgate-%@example.invalid') <> 0 then
    raise exception 'FAIL teardown: gate users survive';
  end if;
  raise notice 'PASS teardown';
end $$;
