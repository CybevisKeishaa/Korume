\set ON_ERROR_STOP on
-- verify:db:kanji (spec 2026-11-06 port-kanji §4.3): user_kanji_progress keyed by the kanji literal. The one-off
-- before/after value proof ran against the local DB when 055 was applied (task-3 report); this gate pins the
-- post-migration contract. Gate rows: users 'kanjigate-*'.
\set uid_a '4a41e000-0000-4000-8000-00000000000a'
\set uid_b '4a41e000-0000-4000-8000-00000000000b'

-- A previous run that died halfway leaves its rows: clean up on the way in (L-017).
delete from auth.users where email like 'kanjigate-%@example.invalid';

begin;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
select id::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'kanjigate-' || name || '@example.invalid',
  crypt('password123', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb
from (values (:'uid_a', 'a'), (:'uid_b', 'b')) as u(id, name);

-- 1. Shape: PK (user_id, literal), no kanji_id, reviews/lapses counters, the one-code-point check, index + RLS kept.
do $$
begin
  if (select array_agg(a.attname::text order by a.attname) from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
      where c.conrelid = 'user_kanji_progress'::regclass and c.contype = 'p') is distinct from array['literal', 'user_id'] then
    raise exception 'FAIL 1a: primary key is not (user_id, literal)';
  end if;
  if exists (select 1 from information_schema.columns where table_name = 'user_kanji_progress' and column_name = 'kanji_id') then
    raise exception 'FAIL 1b: kanji_id still exists';
  end if;
  if (select array_agg(column_name || ' ' || data_type || ' ' || is_nullable || ' ' || coalesce(column_default, '-') order by column_name)
      from information_schema.columns where table_name = 'user_kanji_progress' and column_name in ('literal', 'reviews', 'lapses'))
     is distinct from array['lapses integer NO 0', 'literal text NO -', 'reviews integer NO 0'] then
    raise exception 'FAIL 1c: literal/reviews/lapses columns: %', (select array_agg(column_name || ' ' || data_type || ' ' || is_nullable
      || ' ' || coalesce(column_default, '-') order by column_name) from information_schema.columns
      where table_name = 'user_kanji_progress' and column_name in ('literal', 'reviews', 'lapses'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'user_kanji_progress'::regclass and contype = 'c'
                 and pg_get_constraintdef(oid) like '%char_length(literal) = 1%') then
    raise exception 'FAIL 1d: literal check constraint missing';
  end if;
  if not exists (select 1 from pg_indexes where indexname = 'idx_kanji_progress_due')
     or not exists (select 1 from pg_policies where tablename = 'user_kanji_progress' and policyname = 'kanji_progress_own') then
    raise exception 'FAIL 1e: due index or RLS policy lost';
  end if;
  raise notice 'PASS 1 user_kanji_progress shape';
end $$;

-- 2. Any one Han code point is a key, a curated kanji or not (𠮟 is non-BMP and not in the curated table); two
-- characters are not. New rows start at reviews = 0, lapses = 0.
insert into user_kanji_progress (user_id, literal, next_review_at) values
  (:'uid_a', '一', now() - interval '1 hour'), (:'uid_a', '𠮟', null), (:'uid_a', '二', now() + interval '1 day'),
  (:'uid_b', '一', now() - interval '1 hour'), (:'uid_b', '二', null);
do $$
begin
  begin
    insert into user_kanji_progress (user_id, literal) values ('4a41e000-0000-4000-8000-00000000000a', '日本');
    raise exception 'FAIL 2a: a two-character literal was accepted';
  exception when check_violation then raise notice 'PASS 2a two characters rejected'; end;
  if exists (select 1 from kanji where character = '𠮟') then raise exception 'FAIL 2b: 𠮟 is curated, the fixture proves nothing'; end if;
  if exists (select 1 from user_kanji_progress where user_id = '4a41e000-0000-4000-8000-00000000000a' and (reviews <> 0 or lapses <> 0)) then
    raise exception 'FAIL 2c: counters do not default to 0';
  end if;
  raise notice 'PASS 2 literal keys';
end $$;

-- 3. review_due_keys emits 'kanji:' || literal for due rows only (null or past), including the non-curated one.
do $$
declare a uuid := '4a41e000-0000-4000-8000-00000000000a';
begin
  if (select array_agg(item_key order by item_key collate "C") from review_due_keys(a, '{kanji}', now()))
     is distinct from array['kanji:一', 'kanji:𠮟'] then
    raise exception 'FAIL 3a: review_due_keys: %', (select array_agg(item_key order by item_key collate "C") from review_due_keys(a, '{kanji}', now()));
  end if;
  if (select p.prosecdef or not ('search_path=public' = any (p.proconfig)) from pg_proc p where p.proname = 'review_due_keys')
     or has_function_privilege('anon', 'review_due_keys(uuid,text[],timestamptz)', 'execute')
     or not has_function_privilege('authenticated', 'review_due_keys(uuid,text[],timestamptz)', 'execute')
     or not has_function_privilege('service_role', 'review_due_keys(uuid,text[],timestamptz)', 'execute') then
    raise exception 'FAIL 3b: review_due_keys security/grants changed';
  end if;
  raise notice 'PASS 3 review_due_keys by literal';
end $$;

-- 4. No stored mission key still names a kanji by uuid (the migration rewrote them to the literal).
do $$
begin
  if exists (select 1 from learning_outcomes where item_key ~ '^kanji:[0-9a-f]{8}-[0-9a-f]{4}-')
     or exists (select 1 from daily_mission_eligible where item_key ~ '^kanji:[0-9a-f]{8}-[0-9a-f]{4}-') then
    raise exception 'FAIL 4: a kanji:<uuid> mission key survived';
  end if;
  raise notice 'PASS 4 mission keys by literal';
end $$;

-- 6. user_kanji_favorites: own rows only, no update grant, one-code-point check, newest-first created_at.
do $$
declare a uuid := '4a41e000-0000-4000-8000-00000000000a'; b uuid := '4a41e000-0000-4000-8000-00000000000b';
begin
  begin
    insert into user_kanji_favorites (user_id, literal) values (a, '日本');
    raise exception 'FAIL 6a: a two-character literal was accepted';
  exception when check_violation then raise notice 'PASS 6a two characters rejected'; end;
  if has_table_privilege('authenticated', 'user_kanji_favorites', 'update') then
    raise exception 'FAIL 6b: authenticated can update';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'user_kanji_favorites'::regclass) then
    raise exception 'FAIL 6c: RLS off';
  end if;
  insert into user_kanji_favorites (user_id, literal) values (a, '𠮟'), (b, '一');
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub', :'uid_a', true);
do $$
declare a uuid := '4a41e000-0000-4000-8000-00000000000a'; b uuid := '4a41e000-0000-4000-8000-00000000000b';
begin
  if (select count(*) from user_kanji_favorites) <> 1 or exists (select 1 from user_kanji_favorites where user_id = b) then
    raise exception 'FAIL 6d: another learner''s favorite is visible';
  end if;
  insert into user_kanji_favorites (user_id, literal) values (a, '二');
  begin
    insert into user_kanji_favorites (user_id, literal) values (b, '三');
    raise exception 'FAIL 6e: inserted a row for another user';
  exception when insufficient_privilege then raise notice 'PASS 6e foreign insert refused'; end;
  begin
    update user_kanji_favorites set literal = '三' where user_id = a;
    raise exception 'FAIL 6f: update allowed';
  exception when insufficient_privilege then raise notice 'PASS 6f update refused'; end;
  delete from user_kanji_favorites where literal = '二';
  delete from user_kanji_favorites where user_id = b;
  if (select count(*) from user_kanji_favorites) <> 1 then raise exception 'FAIL 6g: own delete failed'; end if;
  raise notice 'PASS 6 favorites RLS';
end $$;
reset role;
do $$
begin
  if (select count(*) from user_kanji_favorites where user_id = '4a41e000-0000-4000-8000-00000000000b') <> 1 then
    raise exception 'FAIL 6h: delete reached another learner''s row';
  end if;
end $$;

-- 7. Lesson examples (task 5): kanji_lesson_lines / kanji_lesson_counts see public lessons and the caller's own
-- private ones (invoker RLS), never another learner's private lesson, and only the latest transcript per video.
do $$
declare
  a uuid := '4a41e000-0000-4000-8000-00000000000a'; b uuid := '4a41e000-0000-4000-8000-00000000000b';
  vp uuid; va uuid; vb uuid; t uuid;
begin
  insert into videos (youtube_video_id, title, library_access) values ('kg-pub', 'kg-pub', 'FREE') returning id into vp;
  insert into videos (youtube_video_id, title, library_access, added_by_user_id) values ('kg-a', 'kg-a', 'PRIVATE', a) returning id into va;
  insert into videos (youtube_video_id, title, library_access, added_by_user_id) values ('kg-b', 'kg-b', 'PRIVATE', b) returning id into vb;
  insert into transcripts (video_id, source, created_at) values (vp, 'user_submitted', now() - interval '1 day') returning id into t;
  insert into transcript_lines (transcript_id, start_time, text_jp) values (t, 0, '古い緑');
  insert into transcripts (video_id, source) values (vp, 'user_submitted') returning id into t;
  insert into transcript_lines (transcript_id, start_time, text_jp, text_translation) values (t, 1, '緑の森', 'green forest'), (t, 2, '青い空', null);
  insert into transcripts (video_id, source) values (va, 'user_submitted') returning id into t;
  insert into transcript_lines (transcript_id, start_time, text_jp) values (t, 5, '緑茶'), (t, 3, '新緑');
  insert into transcripts (video_id, source) values (vb, 'user_submitted') returning id into t;
  insert into transcript_lines (transcript_id, start_time, text_jp) values (t, 0, '緑色');
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub', :'uid_a', true);
do $$
begin
  if (select array_agg(text_jp order by lesson_title, start_time) from kanji_lesson_lines('緑', 10, 0)) is distinct from array['新緑', '緑茶', '緑の森'] then
    raise exception 'FAIL 7a: lines = %', (select array_agg(text_jp order by lesson_title, start_time) from kanji_lesson_lines('緑', 10, 0));
  end if;
  if (select array_agg(text_jp) from kanji_lesson_lines('緑', 1, 1)) is distinct from array['緑茶'] then
    raise exception 'FAIL 7b: limit/offset paging';
  end if;
  if (select array_agg(lesson_title || ':' || occurrences order by occurrences desc, lesson_title) from kanji_lesson_counts('緑', 10))
     is distinct from array['kg-a:2', 'kg-pub:1'] then
    raise exception 'FAIL 7c: counts = %', (select array_agg(lesson_title || ':' || occurrences) from kanji_lesson_counts('緑', 10));
  end if;
  if (select count(*) from kanji_lesson_counts('緑', 1)) <> 1 then raise exception 'FAIL 7d: count limit'; end if;
  raise notice 'PASS 7 lesson lines and counts';
end $$;
reset role;
do $$
begin
  if has_function_privilege('anon', 'kanji_lesson_lines(text,int,int)', 'execute')
     or has_function_privilege('anon', 'kanji_lesson_counts(text,int)', 'execute') then
    raise exception 'FAIL 7e: anon can execute';
  end if;
  if not has_function_privilege('authenticated', 'kanji_lesson_lines(text,int,int)', 'execute')
     or not has_function_privilege('authenticated', 'kanji_lesson_counts(text,int)', 'execute') then
    raise exception 'FAIL 7f: authenticated cannot execute';
  end if;
  raise notice 'PASS 7g execute grants';
end $$;

-- 5. Erasure: deleting the users row removes that learner's progress rows and only those.
delete from users where id = :'uid_b';
do $$
begin
  if exists (select 1 from user_kanji_progress where user_id = '4a41e000-0000-4000-8000-00000000000b')
     or (select count(*) from user_kanji_progress where user_id = '4a41e000-0000-4000-8000-00000000000a') <> 3 then
    raise exception 'FAIL 5: user delete did not cascade exactly';
  end if;
  if exists (select 1 from user_kanji_favorites where user_id = '4a41e000-0000-4000-8000-00000000000b')
     or (select count(*) from user_kanji_favorites where user_id = '4a41e000-0000-4000-8000-00000000000a') <> 1 then
    raise exception 'FAIL 5b: favorites did not cascade exactly';
  end if;
  raise notice 'PASS 5 cascade on user delete';
end $$;

rollback;
delete from auth.users where email like 'kanjigate-%@example.invalid';
