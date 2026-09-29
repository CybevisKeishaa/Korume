\set ON_ERROR_STOP on

-- Live gate for jlpt_speaking_summary(): the Supabase mock models no SQL, so
-- this proves the aggregate, the caller scoping and the grants.
delete from auth.users where email like 'jlptgate-%@example.invalid';
delete from public.videos where youtube_video_id like 'jlptgate-%';

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated',
    'authenticated', 'jlptgate-a@example.invalid', crypt('password123', gen_salt('bf')),
    now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated',
    'authenticated', 'jlptgate-b@example.invalid', crypt('password123', gen_salt('bf')),
    now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb);

select id as uid_a from public.users where email = 'jlptgate-a@example.invalid' \gset
select id as uid_b from public.users where email = 'jlptgate-b@example.invalid' \gset

-- The seed holds no N2 or N3 lesson, so those two levels are the gate's alone.
insert into public.videos (youtube_video_id, title, jlpt_level_estimate, library_access, added_by_user_id) values
  ('jlptgate-n2-one', 'Gate N2 one', 'N2', 'FREE', null),
  ('jlptgate-n2-two', 'Gate N2 two', 'N2', 'FREE', null),
  ('jlptgate-n3-private', 'Gate N3 private', 'N3', 'PRIVATE', :'uid_b');

select id as n2_one from public.videos where youtube_video_id = 'jlptgate-n2-one' \gset
select id as n2_two from public.videos where youtube_video_id = 'jlptgate-n2-two' \gset

-- A: two sessions on one lesson, one unscored, plus a session with no lesson.
-- B: one session on each N2 lesson.
insert into public.shadowing_sessions (user_id, video_id, pronunciation_score) values
  (:'uid_a', :'n2_one', 80), (:'uid_a', :'n2_one', null), (:'uid_a', null, 10),
  (:'uid_b', :'n2_one', 20), (:'uid_b', :'n2_two', 30);

begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'uid_a', 'role', 'authenticated')::text, true);
do $$
declare r record;
begin
  select * into r from jlpt_speaking_summary() where level = 'N2';
  if r.lesson_count <> 2 then raise exception 'FAIL count: A sees % N2 lessons, want 2', r.lesson_count; end if;
  if r.practiced_count <> 1 then raise exception 'FAIL practiced: A practised % N2 lessons, want 1', r.practiced_count; end if;
  if r.average_score <> 80 then raise exception 'FAIL average: A averages %, want 80 (unscored and B sessions excluded)', r.average_score; end if;
  if exists (select 1 from jlpt_speaking_summary() where level = 'N3') then
    raise exception 'FAIL RLS: A counts B''s private N3 lesson';
  end if;
  raise notice 'PASS A: 2 lessons, 1 practised, average 80, no private N3';
end $$;
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'uid_b', 'role', 'authenticated')::text, true);
do $$
declare r record;
begin
  select * into r from jlpt_speaking_summary() where level = 'N2';
  if r.practiced_count <> 2 or r.average_score <> 25 then
    raise exception 'FAIL B: practised %, average %, want 2 and 25', r.practiced_count, r.average_score;
  end if;
  select * into r from jlpt_speaking_summary() where level = 'N3';
  if r.lesson_count is distinct from 1::bigint or r.practiced_count <> 0 or r.average_score is not null then
    raise exception 'FAIL B N3: % lessons, % practised, average %, want 1, 0, null', r.lesson_count, r.practiced_count, r.average_score;
  end if;
  raise notice 'PASS B: own sessions only, own private lesson counted, no score is null';
end $$;
commit;

begin;
set local role anon;
do $$
begin
  perform jlpt_speaking_summary();
  raise exception 'FAIL grant: anon can call jlpt_speaking_summary()';
exception when insufficient_privilege then
  raise notice 'PASS grant: anon is denied';
end $$;
commit;

delete from auth.users where email like 'jlptgate-%@example.invalid';
delete from public.videos where youtube_video_id like 'jlptgate-%';
