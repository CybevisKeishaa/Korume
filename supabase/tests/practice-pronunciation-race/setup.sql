\set ON_ERROR_STOP on
delete from videos where youtube_video_id = 'practicegate-race';
delete from auth.users where email = 'practicegate-race@example.invalid';
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values ('ba5eba11-0000-4000-8000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'practicegate-race@example.invalid', crypt('password123', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}');
insert into videos (id, youtube_video_id, title, library_access) values ('ba5eba11-0000-4000-8000-0000000000f2', 'practicegate-race', 'Practice race', 'FREE');
insert into transcripts (id, video_id, source) values ('ba5eba11-0000-4000-8000-0000000000e2', 'ba5eba11-0000-4000-8000-0000000000f2', 'user_submitted');
insert into transcript_lines (id, transcript_id, start_time, end_time, text_jp) values ('ba5eba11-0000-4000-8000-0000000000d4', 'ba5eba11-0000-4000-8000-0000000000e2', 0, 2, 'もう一度話します。');
insert into shadowing_sessions (id, user_id, video_id, transcript_line_id, recording_url)
values ('ba5eba11-0000-4000-8000-000000000107', 'ba5eba11-0000-4000-8000-00000000000c', 'ba5eba11-0000-4000-8000-0000000000f2',
  'ba5eba11-0000-4000-8000-0000000000d4', 'ba5eba11-0000-4000-8000-00000000000c/shadowing/race.wav');
