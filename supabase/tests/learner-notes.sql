\set ON_ERROR_STOP on

delete from auth.users where email like 'notesgate-%@example.invalid';
delete from public.videos where youtube_video_id like 'NOTESGATE%';

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated',
    'authenticated', 'notesgate-a@example.invalid', crypt('password123', gen_salt('bf')),
    now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated',
    'authenticated', 'notesgate-b@example.invalid', crypt('password123', gen_salt('bf')),
    now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb);

select id as uid_a from public.users where email = 'notesgate-a@example.invalid' \gset
select id as uid_b from public.users where email = 'notesgate-b@example.invalid' \gset

do $$
declare uid_a uuid; free_video uuid; private_video uuid; transcript uuid;
begin
  select id into strict uid_a from public.users where email = 'notesgate-a@example.invalid';
  insert into public.videos(youtube_video_id, title, library_access)
    values ('NOTESGATEFREE', 'Notes gate free lesson', 'FREE') returning id into free_video;
  insert into public.transcripts(video_id, source, language)
    values (free_video, 'youtube_caption', 'ja') returning id into transcript;
  insert into public.transcript_lines(transcript_id, start_time, end_time, text_jp)
    values (transcript, 0, 2, '無料の文'), (transcript, 2, 4, '二つ目の文');

  insert into public.videos(youtube_video_id, title, added_by_user_id, library_access)
    values ('NOTESGATEPRIVATE', 'Notes gate private lesson', uid_a, 'PRIVATE') returning id into private_video;
  insert into public.transcripts(video_id, source, language)
    values (private_video, 'youtube_caption', 'ja') returning id into transcript;
  insert into public.transcript_lines(transcript_id, start_time, end_time, text_jp)
    values (transcript, 0, 2, '非公開の文');
end $$;

select id as free_video_id from public.videos where youtube_video_id = 'NOTESGATEFREE' \gset
select l.id as free_line_id from public.transcript_lines l join public.transcripts t on t.id = l.transcript_id
  join public.videos v on v.id = t.video_id where v.youtube_video_id = 'NOTESGATEFREE' order by l.start_time limit 1 \gset
select l.id as free_line2_id from public.transcript_lines l join public.transcripts t on t.id = l.transcript_id
  join public.videos v on v.id = t.video_id where v.youtube_video_id = 'NOTESGATEFREE' order by l.start_time offset 1 limit 1 \gset
select id as private_video_id from public.videos where youtube_video_id = 'NOTESGATEPRIVATE' \gset
select l.id as private_line_id from public.transcript_lines l join public.transcripts t on t.id = l.transcript_id
  join public.videos v on v.id = t.video_id where v.youtube_video_id = 'NOTESGATEPRIVATE' \gset

-- 1. A notes a FREE line and the FREE lesson; a second upsert replaces the body (the API's PUT).
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'uid_a', 'role', 'authenticated')::text, true);
insert into public.sentence_notes(user_id, transcript_line_id, body) values (:'uid_a', :'free_line_id', '最初');
insert into public.sentence_notes(user_id, transcript_line_id, body) values (:'uid_a', :'free_line_id', '覚える')
  on conflict (user_id, transcript_line_id) do update set body = excluded.body;
insert into public.lesson_notes(user_id, video_id, body) values (:'uid_a', :'free_video_id', '最初')
  on conflict (user_id, video_id) do update set body = excluded.body;
insert into public.lesson_notes(user_id, video_id, body) values (:'uid_a', :'free_video_id', '授業のメモ')
  on conflict (user_id, video_id) do update set body = excluded.body;
do $$
begin
  if auth.uid() is null then raise exception 'FAIL 1 setup: auth.uid() is null'; end if;
  if (select string_agg(body, ',') from public.sentence_notes) is distinct from '覚える' then
    raise exception 'FAIL 1: sentence note upsert left %', (select string_agg(body, ',') from public.sentence_notes);
  end if;
  if (select string_agg(body, ',') from public.lesson_notes) is distinct from '授業のメモ' then
    raise exception 'FAIL 1: lesson note upsert left %', (select string_agg(body, ',') from public.lesson_notes);
  end if;
  raise notice 'PASS 1 A upserts a sentence note and a lesson note on a readable FREE lesson';
end $$;
commit;

-- 2. The database, not the client, stamps updated_at on an upsert.
update public.sentence_notes set updated_at = now() - interval '1 day' where user_id = :'uid_a';
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'uid_a', 'role', 'authenticated')::text, true);
insert into public.sentence_notes(user_id, transcript_line_id, body) values (:'uid_a', :'free_line_id', '覚えた')
  on conflict (user_id, transcript_line_id) do update set body = excluded.body;
do $$
begin
  if (select updated_at from public.sentence_notes) < now() - interval '1 minute' then
    raise exception 'FAIL 2: updated_at was not advanced by the upsert';
  end if;
  raise notice 'PASS 2 updated_at advances on upsert';
end $$;
commit;

-- 3. B cannot read, update or delete A's notes.
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'uid_b', 'role', 'authenticated')::text, true);
do $$
declare seen int; changed int; removed int;
begin
  select (select count(*) from public.sentence_notes) + (select count(*) from public.lesson_notes) into seen;
  update public.sentence_notes set body = 'hijack'; get diagnostics changed = row_count;
  update public.lesson_notes set body = 'hijack'; get diagnostics removed = row_count;
  changed := changed + removed;
  delete from public.sentence_notes; get diagnostics removed = row_count;
  if seen <> 0 or changed <> 0 or removed <> 0 then
    raise exception 'FAIL 3: B saw % rows, updated %, deleted %', seen, changed, removed;
  end if;
  delete from public.lesson_notes; get diagnostics removed = row_count;
  if removed <> 0 then raise exception 'FAIL 3: B deleted % lesson notes', removed; end if;
  raise notice 'PASS 3 B cannot read, update or delete A notes';
end $$;
commit;

-- 4-6. A PRIVATE line or lesson B cannot read, ownership spoofing, and moving a note onto one are refused.
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'uid_b', 'role', 'authenticated')::text, true);
select set_config('notesgate.private_line_id', :'private_line_id', true);
select set_config('notesgate.private_video_id', :'private_video_id', true);
select set_config('notesgate.free_line2_id', :'free_line2_id', true);
select set_config('notesgate.uid_a', :'uid_a', true);
do $$
begin
  begin
    insert into public.sentence_notes(user_id, transcript_line_id, body)
      values (auth.uid(), current_setting('notesgate.private_line_id')::uuid, 'peek');
    raise exception 'FAIL 4: B noted A private line';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.lesson_notes(user_id, video_id, body)
      values (auth.uid(), current_setting('notesgate.private_video_id')::uuid, 'peek');
    raise exception 'FAIL 4: B noted A private lesson';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.sentence_notes(user_id, transcript_line_id, body)
      values (current_setting('notesgate.uid_a')::uuid, current_setting('notesgate.free_line2_id')::uuid, 'spoof');
    raise exception 'FAIL 5: B created a note owned by A';
  exception when insufficient_privilege then null;
  end;
  insert into public.sentence_notes(user_id, transcript_line_id, body)
    values (auth.uid(), current_setting('notesgate.free_line2_id')::uuid, 'mine');
  begin
    update public.sentence_notes set transcript_line_id = current_setting('notesgate.private_line_id')::uuid;
    raise exception 'FAIL 6: B moved a note onto A private line';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.sentence_notes set user_id = current_setting('notesgate.uid_a')::uuid;
    raise exception 'FAIL 6: B gave a note to A';
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS 4/5/6 unreadable targets, spoofed owners and moved notes are refused';
end $$;
commit;

-- 7. Bodies are bounded: never empty (an empty note is a delete), at most 4000 / 20000 code points.
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'uid_b', 'role', 'authenticated')::text, true);
select set_config('notesgate.free_line_id', :'free_line_id', true);
select set_config('notesgate.free_video_id', :'free_video_id', true);
do $$
declare line uuid := current_setting('notesgate.free_line_id')::uuid; video uuid := current_setting('notesgate.free_video_id')::uuid;
begin
  begin insert into public.sentence_notes(user_id, transcript_line_id, body) values (auth.uid(), line, '');
    raise exception 'FAIL 7: empty sentence note accepted'; exception when check_violation then null; end;
  begin insert into public.sentence_notes(user_id, transcript_line_id, body) values (auth.uid(), line, repeat('あ', 4001));
    raise exception 'FAIL 7: 4001-character sentence note accepted'; exception when check_violation then null; end;
  begin insert into public.lesson_notes(user_id, video_id, body) values (auth.uid(), video, repeat('あ', 20001));
    raise exception 'FAIL 7: 20001-character lesson note accepted'; exception when check_violation then null; end;
  insert into public.sentence_notes(user_id, transcript_line_id, body) values (auth.uid(), line, repeat('𠮷', 4000));
  insert into public.lesson_notes(user_id, video_id, body) values (auth.uid(), video, repeat('あ', 20000));
  raise notice 'PASS 7 body bounds hold in code points';
end $$;
rollback;

-- 8. anon has no access at all.
begin;
set local role anon;
do $$
begin
  begin perform 1 from public.sentence_notes; raise exception 'FAIL 8: anon read sentence_notes';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.lesson_notes; raise exception 'FAIL 8: anon read lesson_notes';
  exception when insufficient_privilege then null; end;
  raise notice 'PASS 8 anon is refused';
end $$;
commit;

-- 9. Notes cascade with their line, their lesson and their user.
do $$
declare uid_a uuid; uid_b uuid; free_line uuid; free_video uuid;
begin
  select id into strict uid_a from public.users where email = 'notesgate-a@example.invalid';
  select id into strict uid_b from public.users where email = 'notesgate-b@example.invalid';
  select id into strict free_video from public.videos where youtube_video_id = 'NOTESGATEFREE';
  select transcript_line_id into strict free_line from public.sentence_notes where user_id = uid_a;
  delete from public.transcript_lines where id = free_line;
  if exists (select 1 from public.sentence_notes where transcript_line_id = free_line) then
    raise exception 'FAIL 9: deleting the line kept its note';
  end if;
  delete from public.videos where id = free_video;
  if exists (select 1 from public.lesson_notes where video_id = free_video) then
    raise exception 'FAIL 9: deleting the lesson kept its note';
  end if;
  insert into public.lesson_notes(user_id, video_id, body)
    select uid_b, id, 'b' from public.videos where youtube_video_id = 'NOTESGATEPRIVATE';
  delete from auth.users where id = uid_b;
  if exists (select 1 from public.lesson_notes where user_id = uid_b) then
    raise exception 'FAIL 9: deleting the user kept their notes';
  end if;
  raise notice 'PASS 9 notes cascade with line, lesson and user';
end $$;

delete from auth.users where email like 'notesgate-%@example.invalid';
delete from public.videos where youtube_video_id like 'NOTESGATE%';

do $$
begin
  if exists (select 1 from public.users where email like 'notesgate-%@example.invalid')
    or exists (select 1 from public.videos where youtube_video_id like 'NOTESGATE%') then
    raise exception 'FAIL teardown: gate rows survive';
  end if;
  raise notice 'PASS teardown';
end $$;
