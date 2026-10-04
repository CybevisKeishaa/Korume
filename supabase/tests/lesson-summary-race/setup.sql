\set ON_ERROR_STOP on
-- Fixtures for the verify:db:summary race rounds: one learner, one FREE lesson with one line.
drop table if exists public.summary_race_results;
create table public.summary_race_results (case_name text not null, outcome text not null, token uuid);
delete from lesson_reflections where analysis_fingerprint like 'sgate-race-%';
delete from knowledge_entries where fingerprint like 'sgate-race-%';
delete from videos where youtube_video_id like 'summarygate-race%';
delete from auth.users where email like 'summarygate-race%@example.invalid';
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values ('5ca1ab1e-0000-4000-8000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'summarygate-race@example.invalid', crypt('password123', gen_salt('bf')), now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb);
insert into videos (id, youtube_video_id, title, library_access)
  values ('5ca1ab1e-0000-4000-8000-0000000000f3', 'summarygate-race', 'Summary race lesson', 'FREE');
insert into transcripts (id, video_id, source)
  values ('5ca1ab1e-0000-4000-8000-0000000000e3', '5ca1ab1e-0000-4000-8000-0000000000f3', 'user_submitted');
insert into transcript_lines (id, transcript_id, start_time, end_time, text_jp)
  values ('5ca1ab1e-0000-4000-8000-0000000000d5', '5ca1ab1e-0000-4000-8000-0000000000e3', 0, 2, '注文をお願いします。');
