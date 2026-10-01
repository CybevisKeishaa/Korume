\set ON_ERROR_STOP on

-- Live gate for the Pronunciation Studio's SQL aggregates (JLPT Speaking and
-- the rail's three reads): the Supabase mock models no SQL, so this proves
-- the aggregates, the VN-day boundary, the caller scoping and the grants.
delete from public.collections where slug like 'jlptgate-search-%';
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

insert into public.transcripts (video_id, source, created_at) values (:'pron_one', 'ai_generated', '2026-09-20 17:00:00+00');
select id as transcript_id from public.transcripts where video_id = :'pron_one' order by created_at desc limit 1 \gset
insert into public.transcript_lines (transcript_id, start_time, end_time, text_jp) values
  (:'transcript_id', 0, 15, 'measured line'), (:'transcript_id', 15, null, 'unknown length');
select id as measured_line from public.transcript_lines where transcript_id = :'transcript_id' and end_time = 15 \gset
select id as unknown_line from public.transcript_lines where transcript_id = :'transcript_id' and end_time is null \gset
insert into public.transcripts (video_id, source, created_at) values (:'pron_one', 'user_submitted', '2026-09-20 18:00:00+00');
select id as latest_transcript_id from public.transcripts where video_id = :'pron_one' order by created_at desc, id desc limit 1 \gset
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
do $$
begin
  perform lesson_last_spoken_at(array[]::uuid[]);
  raise exception 'FAIL grant: anon can call lesson_last_spoken_at()';
exception when insufficient_privilege then
  raise notice 'PASS grant: anon is denied last spoken at';
end $$;
commit;

-- Ruling 17's speaking half: the caller's newest session per lesson, never
-- another learner's, and one row per lesson asked for.
select set_config('gate.pron_one', :'pron_one', false), set_config('gate.pron_two', :'pron_two', false);

-- Ruling 19: past max_rows (1000). SQL has no cap, so this proves the view's
-- meaning at that size and its caller scoping; the cap itself is the unit
-- tests' (test/supabase-mock.ts `enforcePostgrestCap`).
insert into public.videos (youtube_video_id, title, library_access)
select 'jlptgate-page-' || n, 'Pagination gate ' || n, 'FREE' from generate_series(1, 1001) n;
insert into public.user_lesson_library (user_id, lesson_id)
select :'uid_a', id from public.videos where youtube_video_id like 'jlptgate-page-%';
insert into public.user_video_progress (user_id, video_id, last_watched_position)
select :'uid_a', id, 1 from public.videos where youtube_video_id = 'jlptgate-page-1001';
select set_config('gate.transcript_id', :'latest_transcript_id', false);
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'uid_a', 'role', 'authenticated')::text, true);
do $$ begin
  if (select count(*) from learner_videos where in_library) < 1001 then raise exception 'FAIL learner_videos: A''s 1001 library lessons are not all in_library'; end if;
  if not (select in_progress from learner_videos where youtube_video_id = 'jlptgate-page-1001') then raise exception 'FAIL learner_videos: missing progress'; end if;
  if (select transcript_id from latest_transcript_ids(array[current_setting('gate.pron_one')::uuid])) is distinct from current_setting('gate.transcript_id')::uuid then raise exception 'FAIL latest transcript'; end if;
end $$;
commit;
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'uid_b', 'role', 'authenticated')::text, true);
do $$
declare progress record;
begin
  select in_library, in_progress, last_watched_position, last_watched_at into progress
  from learner_videos where youtube_video_id = 'jlptgate-page-1001';
  if progress.in_library or progress.in_progress or progress.last_watched_position is not null or progress.last_watched_at is not null then
    raise exception 'FAIL learner_videos RLS: B observed A progress';
  end if;
  -- B's own private import, never added to a library, still counts as B's.
  if not coalesce((select in_library from learner_videos where youtube_video_id = 'jlptgate-n3-private'), false) then
    raise exception 'FAIL learner_videos: own private import is not in_library';
  end if;
end $$;
commit;

insert into public.videos (youtube_video_id, title, library_access) values
  ('jlptgate-rank-a', 'Rank A', 'FREE'), ('jlptgate-rank-b', 'Rank B', 'FREE');
insert into public.user_lesson_library (user_id, lesson_id)
select learner.id, lesson.id
from (values (:'uid_a'::uuid), (:'uid_b'::uuid)) as learner(id)
cross join (select id from public.videos where youtube_video_id in ('jlptgate-rank-a', 'jlptgate-rank-b')) as lesson;
begin;
set local role service_role;
do $$
declare actual uuid[]; expected uuid[];
begin
  select array_agg(lesson_id order by ord) into actual from popular_lesson_ids(2) with ordinality as ranked(lesson_id, ord);
  select array_agg(id order by id) into expected from public.videos where youtube_video_id in ('jlptgate-rank-a', 'jlptgate-rank-b');
  if actual is distinct from expected then raise exception 'FAIL popular rank: %, want %', actual, expected; end if;
end $$;
commit;
begin;
set local role anon;
do $$ begin perform popular_lesson_ids(1); raise exception 'FAIL popular anon grant'; exception when insufficient_privilege then raise notice 'PASS popular anon denied'; end $$;
commit;
begin;
set local role authenticated;
do $$ begin perform popular_lesson_ids(1); raise exception 'FAIL popular authenticated grant'; exception when insufficient_privilege then raise notice 'PASS popular authenticated denied'; end $$;
commit;
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'uid_a', 'role', 'authenticated')::text, true);
do $$
declare spoken timestamptz; rows_back int;
begin
  select count(*) into rows_back from lesson_last_spoken_at(array[current_setting('gate.pron_one')::uuid, current_setting('gate.pron_two')::uuid]);
  if rows_back <> 2 then raise exception 'FAIL last spoken: % rows, want one per lesson (2)', rows_back; end if;
  select spoken_at into spoken from lesson_last_spoken_at(array[current_setting('gate.pron_one')::uuid]);
  if spoken is distinct from '2026-09-20 17:31:00+00'::timestamptz then
    raise exception 'FAIL last spoken: A''s newest session on pron_one is %, want 2026-09-20 17:31', spoken;
  end if;
  raise notice 'PASS last spoken: newest own session per lesson';
end $$;
commit;

-- B spoke only pron_one, and earlier than A: a leak of A's sessions shows as a
-- second row or as 17:31.
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'uid_b', 'role', 'authenticated')::text, true);
do $$
declare spoken timestamptz; rows_back int;
begin
  select count(*), max(spoken_at) into rows_back, spoken from lesson_last_spoken_at(array[current_setting('gate.pron_one')::uuid, current_setting('gate.pron_two')::uuid]);
  if rows_back <> 1 or spoken is distinct from '2026-09-20 17:30:00+00'::timestamptz then
    raise exception 'FAIL last spoken: B sees % rows, newest %, want 1 row at 17:30 (A leaked)', rows_back, spoken;
  end if;
  raise notice 'PASS last spoken: never another learner''s session';
end $$;
commit;

-- Saved-path policy, progress timestamp trigger, and the two RPC grants added
-- for the Studio. Claude runs this live after a fresh reset.
select id as path_id from public.collections where kind = 'path' order by display_order limit 1 \gset
select id as shelf_id from public.collections where kind = 'shelf' order by display_order limit 1 \gset
-- psql does not expand :'var' inside a DO body, so the blocks read session settings.
select set_config('gate.uid_a', :'uid_a', false), set_config('gate.shelf_id', :'shelf_id', false),
  set_config('gate.n2_one', :'n2_one', false);
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'uid_a', 'role', 'authenticated')::text, true);
insert into public.user_saved_collections (user_id, collection_id) values (:'uid_a', :'path_id');
do $$ begin
  insert into public.user_saved_collections (user_id, collection_id) values (current_setting('gate.uid_a')::uuid, current_setting('gate.shelf_id')::uuid);
  raise exception 'FAIL saved paths: a shelf was saved';
exception when insufficient_privilege then raise notice 'PASS saved paths: shelf refused'; end $$;
do $$ begin
  update public.user_saved_collections set saved_at = now() where user_id = auth.uid();
  raise exception 'FAIL saved paths: UPDATE was allowed';
exception when insufficient_privilege then raise notice 'PASS saved paths: UPDATE denied'; end $$;
insert into public.user_video_progress (user_id, video_id, last_watched_position) values (:'uid_a', :'n2_one', 1);
update public.user_video_progress set last_watched_at = now() - interval '1 hour' where user_id = :'uid_a' and video_id = :'n2_one';
select last_watched_at as watched_before from public.user_video_progress where user_id = :'uid_a' and video_id = :'n2_one' \gset
select set_config('gate.watched_before', :'watched_before', false);
update public.user_video_progress set last_watched_position = 2 where user_id = :'uid_a' and video_id = :'n2_one';
do $$ begin
  if (select last_watched_at <= current_setting('gate.watched_before')::timestamptz from public.user_video_progress where user_id = current_setting('gate.uid_a')::uuid and video_id = current_setting('gate.n2_one')::uuid) then raise exception 'FAIL progress trigger: position change did not stamp'; end if;
end $$;
select last_watched_at as watched_after from public.user_video_progress where user_id = :'uid_a' and video_id = :'n2_one' \gset
select set_config('gate.watched_after', :'watched_after', false);
update public.user_video_progress set completed_at = completed_at where user_id = :'uid_a' and video_id = :'n2_one';
do $$ begin
  if (select last_watched_at is distinct from current_setting('gate.watched_after')::timestamptz from public.user_video_progress where user_id = current_setting('gate.uid_a')::uuid and video_id = current_setting('gate.n2_one')::uuid) then raise exception 'FAIL progress trigger: unrelated update changed timestamp'; end if;
end $$;
commit;
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'uid_b', 'role', 'authenticated')::text, true);
do $$ begin
  if exists (select 1 from public.user_saved_collections where user_id = current_setting('gate.uid_a')::uuid) then raise exception 'FAIL saved paths: user B read user A row'; end if;
end $$;
commit;
begin;
set local role anon;
do $$ begin perform video_sentence_counts(array[]::uuid[]); raise exception 'FAIL grant: anon can call video_sentence_counts()'; exception when insufficient_privilege then raise notice 'PASS grant: anon denied sentence counts'; end $$;
do $$ begin perform pronunciation_metric_means(now() - interval '1 day', now()); raise exception 'FAIL grant: anon can call pronunciation_metric_means()'; exception when insufficient_privilege then raise notice 'PASS grant: anon denied metric means'; end $$;
commit;

-- Search paths under the caller's videos RLS: FREE and PLUS are visible to A,
-- while B's unshared PRIVATE lesson is not. Rows and total must agree.
insert into public.videos (youtube_video_id, title, library_access, added_by_user_id) values
  ('jlptgate-search-free', 'Search gate free', 'FREE', null),
  ('jlptgate-search-plus', 'Search gate plus', 'PLUS', null),
  ('jlptgate-search-private', 'Search gate private', 'PRIVATE', :'uid_b');
insert into public.collections (slug, title, kind, display_order) values
  ('jlptgate-search-open', 'Gate Ramen Path Open', 'path', 900),
  ('jlptgate-search-hidden', 'Gate Ramen Path Hidden', 'path', 901),
  ('jlptgate-search-plus', 'Gate Ramen Path Plus', 'path', 902),
  ('jlptgate-search-percent', 'Gate Ramen 100% Path', 'path', 903),
  ('jlptgate-search-percent-word', 'Gate Ramen 100 Percent Path', 'path', 904);
insert into public.collections (slug, title, kind, skill_focus, display_order) values
  ('jlptgate-search-goal', 'Gate Ramen Goal', 'goal', 'accuracy', 905);
insert into public.lesson_collections (collection_id, lesson_id, position)
select c.id, v.id, 0
from public.collections c
join public.videos v on (c.slug, v.youtube_video_id) in (
  ('jlptgate-search-open', 'jlptgate-search-free'),
  ('jlptgate-search-hidden', 'jlptgate-search-private'),
  ('jlptgate-search-plus', 'jlptgate-search-plus'),
  ('jlptgate-search-percent', 'jlptgate-search-free'),
  ('jlptgate-search-percent-word', 'jlptgate-search-free'),
  ('jlptgate-search-goal', 'jlptgate-search-free')
);
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'uid_a', 'role', 'authenticated')::text, true);
do $$
declare got text[]; total bigint;
begin
  select array_agg(c.slug order by r.ord), max(r.total) into got, total
  from search_learning_collections('path', '%Gate Ramen%', 10, 0)
    with ordinality as r(collection_id, total, ord)
  join collections c on c.id = r.collection_id;
  if got is distinct from array[
    'jlptgate-search-open',
    'jlptgate-search-plus',
    'jlptgate-search-percent',
    'jlptgate-search-percent-word'
  ] or total <> 4 then
    raise exception 'FAIL search paths A: got % total %, want visible FREE/PLUS paths only, total 4', got, total;
  end if;
  select array_agg(c.slug order by r.ord), max(r.total) into got, total
  from search_learning_collections('path', E'%100\\%%', 10, 0)
    with ordinality as r(collection_id, total, ord)
  join collections c on c.id = r.collection_id;
  if got is distinct from array['jlptgate-search-percent'] or total <> 1 then
    raise exception 'FAIL search paths escape: literal %% did not match only its title (got % total %)', got, total;
  end if;
  select array_agg(c.slug order by r.ord), max(r.total) into got, total
  from search_learning_collections('goal', '%Gate Ramen%', 10, 0)
    with ordinality as r(collection_id, total, ord)
  join collections c on c.id = r.collection_id;
  if got is distinct from array['jlptgate-search-goal'] or total <> 1 then
    raise exception 'FAIL search goals: p_kind did not return only the matching goal (got % total %)', got, total;
  end if;
  -- The facade's count-only call: one row, carrying the full total.
  if (select array[count(*), max(r.total)] from search_learning_collections('path', '%Gate Ramen%', 1, 0) r) <> array[1, 4]::bigint[] then
    raise exception 'FAIL search paths count-only: limit 1 must return one row with total 4';
  end if;
  if (select count(*) from search_learning_collections('path', '%Gate Ramen%', 10, 4)) <> 0 then
    raise exception 'FAIL search paths: offset past the end returned rows';
  end if;
  raise notice 'PASS search paths A: FREE/PLUS visible, B private hidden, literal %% escaped';
end $$;
commit;
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'uid_b', 'role', 'authenticated')::text, true);
do $$
declare got text[]; total bigint;
begin
  select array_agg(c.slug order by r.ord), max(r.total) into got, total
  from search_learning_collections('path', '%Gate Ramen%', 10, 0)
    with ordinality as r(collection_id, total, ord)
  join collections c on c.id = r.collection_id;
  if got is distinct from array[
    'jlptgate-search-open',
    'jlptgate-search-hidden',
    'jlptgate-search-plus',
    'jlptgate-search-percent',
    'jlptgate-search-percent-word'
  ] or total <> 5 then
    raise exception 'FAIL search paths B: got % total %, want own private path included, total 5', got, total;
  end if;
  raise notice 'PASS search paths B: own private path visible';
end $$;
commit;
begin;
set local role anon;
do $$ begin
  perform search_learning_collections('path', '%', 1, 0);
  raise exception 'FAIL grant: anon can search collections';
exception when insufficient_privilege then
  raise notice 'PASS grant: anon denied collection search';
end $$;
commit;

delete from public.collections where slug like 'jlptgate-search-%';
delete from auth.users where email like 'jlptgate-%@example.invalid';
delete from public.videos where youtube_video_id like 'jlptgate-%';
