\set ON_ERROR_STOP on

-- Live gate for the Pronunciation Studio's SQL aggregates (JLPT Speaking and
-- the rail's three reads): the Supabase mock models no SQL, so this proves
-- the aggregates, the VN-day boundary, the caller scoping and the grants.
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
  ('jlptgate-pron-one', 'Pronunciation one', null, 'FREE', null),
  ('jlptgate-pron-two', 'Pronunciation two', null, 'FREE', null),
  ('jlptgate-n3-private', 'Gate N3 private', 'N3', 'PRIVATE', :'uid_b');

select id as n2_one from public.videos where youtube_video_id = 'jlptgate-n2-one' \gset
select id as n2_two from public.videos where youtube_video_id = 'jlptgate-n2-two' \gset
select id as pron_one from public.videos where youtube_video_id = 'jlptgate-pron-one' \gset
select id as pron_two from public.videos where youtube_video_id = 'jlptgate-pron-two' \gset

insert into public.transcripts (video_id, source) values (:'pron_one', 'ai_generated');
select id as transcript_id from public.transcripts where video_id = :'pron_one' order by created_at desc limit 1 \gset
insert into public.transcript_lines (transcript_id, start_time, end_time, text_jp) values
  (:'transcript_id', 0, 15, 'measured line'), (:'transcript_id', 15, null, 'unknown length');
select id as measured_line from public.transcript_lines where transcript_id = :'transcript_id' and end_time = 15 \gset
select id as unknown_line from public.transcript_lines where transcript_id = :'transcript_id' and end_time is null \gset
insert into public.shadowing_sessions (user_id, video_id, transcript_line_id, pronunciation_score, created_at) values
  -- Outside every window below: proves the window's lower bound.
  (:'uid_a', :'pron_one', :'measured_line', 50, '2026-09-19 12:00:00+00'),
  (:'uid_a', :'pron_one', :'measured_line', 70, '2026-09-20 16:30:00+00'),
  (:'uid_a', :'pron_one', :'measured_line', 80, '2026-09-20 17:30:00+00'),
  (:'uid_a', :'pron_one', :'unknown_line', null, '2026-09-20 17:31:00+00'),
  (:'uid_a', :'pron_two', null, 95, '2026-09-20 17:32:00+00'),
  (:'uid_b', :'pron_one', :'measured_line', 10, '2026-09-20 17:30:00+00');

-- A: two sessions on one lesson, one unscored, plus a session with no lesson.
-- B: one session on each N2 lesson.
insert into public.shadowing_sessions (user_id, video_id, pronunciation_score, created_at) values
  (:'uid_a', :'n2_one', 80, '2026-09-01 00:00:00+00'), (:'uid_a', :'n2_one', null, '2026-09-01 00:01:00+00'), (:'uid_a', null, 10, '2026-09-01 00:02:00+00'),
  (:'uid_b', :'n2_one', 20, '2026-09-01 00:00:00+00'), (:'uid_b', :'n2_two', 30, '2026-09-01 00:01:00+00');

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
  if pronunciation_speaking_seconds('2026-09-20 16:00:00+00', '2026-09-20 18:00:00+00') <> 30 then
    raise exception 'FAIL speaking seconds: caller lines or null end_time were counted incorrectly';
  end if;
  if (select count(*) from pronunciation_daily_means('2026-09-20 16:00:00+00', '2026-09-20 18:00:00+00')) <> 2 then
    raise exception 'FAIL daily means: VN midnight did not split the two sessions';
  end if;
  if (select pronunciation_score from pronunciation_recent_practice(2) where video_id = (select id from public.videos where youtube_video_id = 'jlptgate-pron-one')) <> 80 then
    raise exception 'FAIL recent practice: score is not limited to the last VN day';
  end if;
  -- The function's own row order, not one re-sorted here.
  if (select array_agg(rp.video_id order by rp.ord) from pronunciation_recent_practice(2) with ordinality as rp(video_id, practiced_at, pronunciation_score, ord)) is distinct from array[
    (select id from public.videos where youtube_video_id = 'jlptgate-pron-two'),
    (select id from public.videos where youtube_video_id = 'jlptgate-pron-one')
  ] then
    raise exception 'FAIL recent practice: newest lessons are not ordered first';
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
do $$
begin
  perform pronunciation_speaking_seconds(now() - interval '1 day', now());
  raise exception 'FAIL grant: anon can call pronunciation_speaking_seconds()';
exception when insufficient_privilege then
  raise notice 'PASS grant: anon is denied speaking seconds';
end $$;
do $$
begin
  perform pronunciation_daily_means(now() - interval '1 day', now());
  raise exception 'FAIL grant: anon can call pronunciation_daily_means()';
exception when insufficient_privilege then
  raise notice 'PASS grant: anon is denied daily means';
end $$;
do $$
begin
  perform pronunciation_recent_practice(3);
  raise exception 'FAIL grant: anon can call pronunciation_recent_practice()';
exception when insufficient_privilege then
  raise notice 'PASS grant: anon is denied recent practice';
end $$;
commit;

delete from auth.users where email like 'jlptgate-%@example.invalid';
delete from public.videos where youtube_video_id like 'jlptgate-%';
