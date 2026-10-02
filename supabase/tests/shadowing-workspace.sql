\set ON_ERROR_STOP on

delete from auth.users where email like 'shadowinggate-%@example.invalid';
delete from public.videos where youtube_video_id like 'SHADOWGATE%';

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated',
    'authenticated', 'shadowinggate-a@example.invalid', crypt('password123', gen_salt('bf')),
    now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated',
    'authenticated', 'shadowinggate-b@example.invalid', crypt('password123', gen_salt('bf')),
    now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb);

select id as uid_a from public.users where email = 'shadowinggate-a@example.invalid' \gset
select id as uid_b from public.users where email = 'shadowinggate-b@example.invalid' \gset

do $$
declare uid_a uuid;
  free_video uuid;
  private_video uuid;
  transcript uuid;
begin
  select id into strict uid_a from public.users where email = 'shadowinggate-a@example.invalid';
  insert into public.videos(youtube_video_id, title, library_access)
    values ('SHADOWGATEFREE', 'Shadowing gate free lesson', 'FREE') returning id into free_video;
  insert into public.transcripts(video_id, source, language)
    values (free_video, 'youtube_caption', 'ja') returning id into transcript;
  insert into public.transcript_lines(transcript_id, start_time, end_time, text_jp)
    values (transcript, 0, 2, '無料の文'), (transcript, 2, 4, '二つ目の文');

  insert into public.videos(youtube_video_id, title, added_by_user_id, library_access)
    values ('SHADOWGATEPRIVATE', 'Shadowing gate private lesson', uid_a, 'PRIVATE') returning id into private_video;
  insert into public.transcripts(video_id, source, language)
    values (private_video, 'youtube_caption', 'ja') returning id into transcript;
  insert into public.transcript_lines(transcript_id, start_time, end_time, text_jp)
    values (transcript, 0, 2, '非公開の文');
end $$;

select id as free_video_id from public.videos where youtube_video_id = 'SHADOWGATEFREE' \gset
select l.id as free_line_id from public.transcript_lines l join public.transcripts t on t.id = l.transcript_id
  join public.videos v on v.id = t.video_id where v.youtube_video_id = 'SHADOWGATEFREE' order by l.start_time limit 1 \gset
select id as private_video_id from public.videos where youtube_video_id = 'SHADOWGATEPRIVATE' \gset
select l.id as private_line_id from public.transcript_lines l join public.transcripts t on t.id = l.transcript_id
  join public.videos v on v.id = t.video_id where v.youtube_video_id = 'SHADOWGATEPRIVATE' \gset

-- 1. Learner A may mark and bookmark a FREE lesson they can read.
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'uid_a', 'role', 'authenticated')::text, true);
insert into public.sentence_marks(user_id, transcript_line_id, kind)
  values (:'uid_a', :'free_line_id', 'bookmark'), (:'uid_a', :'free_line_id', 'difficult');
insert into public.user_lesson_bookmarks(user_id, video_id) values (:'uid_a', :'free_video_id');
do $$
begin
  if auth.uid() is null then raise exception 'FAIL 1 setup: auth.uid() is null'; end if;
  if (select count(*) from public.sentence_marks) <> 2 then raise exception 'FAIL 1: A cannot read two marks'; end if;
  if (select count(*) from public.user_lesson_bookmarks) <> 1 then raise exception 'FAIL 1: A cannot read their bookmark'; end if;
  raise notice 'PASS 1 A marks and bookmarks a readable FREE lesson';
end $$;
commit;

-- 2. The composite mark key makes repeated API toggles idempotently detectable.
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'uid_a', 'role', 'authenticated')::text, true);
select set_config('shadowinggate.free_line_id', :'free_line_id', true);
do $$
begin
  begin
    insert into public.sentence_marks(user_id, transcript_line_id, kind)
      values (auth.uid(), current_setting('shadowinggate.free_line_id')::uuid, 'bookmark');
    raise exception 'FAIL 2: duplicate mark was accepted';
  exception when unique_violation then null;
  end;
  raise notice 'PASS 2 duplicate mark raises unique_violation';
end $$;
commit;

-- 3. Learner B cannot read or delete A's rows.
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'uid_b', 'role', 'authenticated')::text, true);
do $$
declare visible_marks int; visible_bookmarks int; deleted_marks int; deleted_bookmarks int;
begin
  select count(*) into visible_marks from public.sentence_marks where user_id <> auth.uid();
  select count(*) into visible_bookmarks from public.user_lesson_bookmarks where user_id <> auth.uid();
  delete from public.sentence_marks where user_id <> auth.uid(); get diagnostics deleted_marks = row_count;
  delete from public.user_lesson_bookmarks where user_id <> auth.uid(); get diagnostics deleted_bookmarks = row_count;
  if visible_marks <> 0 or visible_bookmarks <> 0 or deleted_marks <> 0 or deleted_bookmarks <> 0 then
    raise exception 'FAIL 3: B saw marks=% bookmarks=% or deleted marks=% bookmarks=%', visible_marks, visible_bookmarks, deleted_marks, deleted_bookmarks;
  end if;
  raise notice 'PASS 3 B cannot read or delete A rows';
end $$;
commit;

-- 4-5. The insert checks inherit transcript/video visibility from their RLS policies.
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'uid_b', 'role', 'authenticated')::text, true);
select set_config('shadowinggate.private_line_id', :'private_line_id', true);
select set_config('shadowinggate.private_video_id', :'private_video_id', true);
do $$
begin
  begin
    insert into public.sentence_marks(user_id, transcript_line_id, kind)
      values (auth.uid(), current_setting('shadowinggate.private_line_id')::uuid, 'bookmark');
    raise exception 'FAIL 4: B marked A private line';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.user_lesson_bookmarks(user_id, video_id)
      values (auth.uid(), current_setting('shadowinggate.private_video_id')::uuid);
    raise exception 'FAIL 5: B bookmarked A private video';
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS 4/5 inaccessible PRIVATE line and video cannot be saved';
end $$;
commit;

-- 6-7. Ownership spoofing and UPDATE are both refused at the database boundary.
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'uid_b', 'role', 'authenticated')::text, true);
select set_config('shadowinggate.uid_a', :'uid_a', true);
select set_config('shadowinggate.free_line_id', :'free_line_id', true);
do $$
begin
  begin
    insert into public.sentence_marks(user_id, transcript_line_id, kind)
      values (current_setting('shadowinggate.uid_a')::uuid, current_setting('shadowinggate.free_line_id')::uuid, 'bookmark');
    raise exception 'FAIL 6: B created a mark owned by A';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.user_lesson_bookmarks(user_id, video_id)
      select current_setting('shadowinggate.uid_a')::uuid, id from public.videos where youtube_video_id = 'SHADOWGATEFREE';
    raise exception 'FAIL 6: B created a lesson bookmark owned by A';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.sentence_marks set kind = 'difficult';
    raise exception 'FAIL 7: B updated sentence marks without UPDATE grant';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.user_lesson_bookmarks set created_at = now();
    raise exception 'FAIL 7: B updated lesson bookmarks without UPDATE grant';
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS 6/7 ownership spoofing and update are refused';
end $$;
commit;

-- 8. A can remove exactly their own bookmark mark.
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'uid_a', 'role', 'authenticated')::text, true);
do $$
declare deleted_marks int;
begin
  delete from public.sentence_marks where kind = 'bookmark'; get diagnostics deleted_marks = row_count;
  if deleted_marks <> 1 then raise exception 'FAIL 8: A deleted % bookmark marks, expected 1', deleted_marks; end if;
  raise notice 'PASS 8 A removes exactly their bookmark mark';
end $$;
commit;

-- 9. Foreign keys cascade line marks and lesson bookmarks.
do $$
declare free_line uuid; free_video uuid;
begin
  select l.id into strict free_line from public.transcript_lines l join public.transcripts t on t.id = l.transcript_id
    join public.videos v on v.id = t.video_id where v.youtube_video_id = 'SHADOWGATEFREE' order by l.start_time limit 1;
  select id into strict free_video from public.videos where youtube_video_id = 'SHADOWGATEFREE';
  if (select count(*) from public.sentence_marks where transcript_line_id = free_line) <> 1 then
    raise exception 'FAIL 9 setup: expected exactly one surviving mark on the FREE line';
  end if;
  if (select count(*) from public.user_lesson_bookmarks where video_id = free_video) <> 1 then
    raise exception 'FAIL 9 setup: expected exactly one bookmark on the FREE video';
  end if;
  delete from public.transcript_lines where id = free_line;
  if exists (select 1 from public.sentence_marks where transcript_line_id = free_line) then
    raise exception 'FAIL 9: deleting the FREE line did not cascade its mark';
  end if;
  delete from public.videos where id = free_video;
  if exists (select 1 from public.user_lesson_bookmarks where video_id = free_video) then
    raise exception 'FAIL 9: deleting the FREE video did not cascade its bookmark';
  end if;
  raise notice 'PASS 9 line marks and lesson bookmarks cascade';
end $$;

-- 10. Representative preference CHECKs reject illegal values (the static test pins all 12) and legal non-defaults are accepted.
do $$
declare uid_b uuid;
begin
  select id into strict uid_b from public.users where email = 'shadowinggate-b@example.invalid';
  begin insert into public.user_preferences(user_id, reading_furigana) values (uid_b, 'all'); raise exception 'FAIL 10: invalid furigana accepted'; exception when check_violation then null; end;
  begin insert into public.user_preferences(user_id, playback_default_rate) values (uid_b, 0.8); raise exception 'FAIL 10: invalid rate accepted'; exception when check_violation then null; end;
  begin insert into public.user_preferences(user_id, playback_loop_count) values (uid_b, 2); raise exception 'FAIL 10: invalid loop count accepted'; exception when check_violation then null; end;
  begin insert into public.user_preferences(user_id, study_atmosphere) values (uid_b, 'beach'); raise exception 'FAIL 10: invalid atmosphere accepted'; exception when check_violation then null; end;
  insert into public.user_preferences(user_id, reading_furigana, reading_translation, reading_jp_font, reading_text_size,
    reading_line_height, reading_width, reading_emphasis, reading_color_preset, playback_default_rate, playback_loop_count,
    playback_auto_pause, show_shortcut_hints, resume_behavior, study_atmosphere)
  values (uid_b, 'always', 'reveal', 'mincho', 'xl', 'airy', 'wide', 'strong', 'high_contrast', 2, 0, true, true, 'restart', 'summer_night');
  raise notice 'PASS 10 preference CHECKs reject invalid values and accept legal non-defaults';
end $$;

delete from auth.users where email like 'shadowinggate-%@example.invalid';
delete from public.videos where youtube_video_id like 'SHADOWGATE%';

do $$
begin
  if (select count(*) from public.users where email like 'shadowinggate-%@example.invalid') <> 0 then
    raise exception 'FAIL teardown: gate users survive';
  end if;
  if (select count(*) from public.videos where youtube_video_id like 'SHADOWGATE%') <> 0 then
    raise exception 'FAIL teardown: gate videos survive';
  end if;
  raise notice 'PASS teardown';
end $$;
