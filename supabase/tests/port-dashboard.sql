\set ON_ERROR_STOP on
delete from auth.users where email in ('dashgate-a@example.invalid', 'dashgate-b@example.invalid');
delete from videos where youtube_video_id like 'dashgate-%' or youtube_video_id = 'dashgate-legacy';
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'dashgate-a@example.invalid', crypt('password123', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb),
  (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'dashgate-b@example.invalid', crypt('password123', gen_salt('bf')), now(), now(), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb);

-- C4 one access predicate: FREE yes, PLUS only with an active subscription, PRIVATE only in the learner's library.
do $$
declare a uuid := (select id from users where email = 'dashgate-a@example.invalid');
  free_v uuid; plus_v uuid; priv_v uuid;
begin
  insert into videos (youtube_video_id, title, library_access) values ('dashgate-free', 'g free', 'FREE') returning id into free_v;
  insert into videos (youtube_video_id, title, library_access) values ('dashgate-plus', 'g plus', 'PLUS') returning id into plus_v;
  insert into videos (youtube_video_id, title, library_access) values ('dashgate-priv', 'g priv', 'PRIVATE') returning id into priv_v;
  perform set_config('dashgate.a', a::text, false);
  perform set_config('dashgate.b', (select id::text from users where email = 'dashgate-b@example.invalid'), false);
  perform set_config('dashgate.free_v', free_v::text, false);
  perform set_config('dashgate.plus_v', plus_v::text, false);
  perform set_config('dashgate.priv_v', priv_v::text, false);
  if not can_open_lesson(free_v, a) or can_open_lesson(plus_v, a) or can_open_lesson(priv_v, a) then
    raise exception 'FAIL dashboard can_open_lesson without subscription';
  end if;
end $$;

do $$
declare free_t uuid; plus_t uuid; priv_t uuid;
begin
  insert into transcripts (video_id, source) values (current_setting('dashgate.free_v')::uuid, 'user_submitted') returning id into free_t;
  insert into transcripts (video_id, source) values (current_setting('dashgate.plus_v')::uuid, 'user_submitted') returning id into plus_t;
  insert into transcripts (video_id, source) values (current_setting('dashgate.priv_v')::uuid, 'user_submitted') returning id into priv_t;
  insert into transcript_lines (transcript_id, start_time, text_jp) values
    (free_t, 0, 'free'), (plus_t, 0, 'plus'), (priv_t, 0, 'private');
  perform set_config('dashgate.free_t', free_t::text, false);
  perform set_config('dashgate.plus_t', plus_t::text, false);
  perform set_config('dashgate.priv_t', priv_t::text, false);
end $$;

begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('dashgate.a'), 'role', 'authenticated')::text, true);
do $$
begin
  if auth.uid() is distinct from current_setting('dashgate.a')::uuid
    or (select count(*) from transcripts where id in (current_setting('dashgate.free_t')::uuid, current_setting('dashgate.plus_t')::uuid, current_setting('dashgate.priv_t')::uuid)) <> 1
    or (select count(*) from transcript_lines where transcript_id in (current_setting('dashgate.free_t')::uuid, current_setting('dashgate.plus_t')::uuid, current_setting('dashgate.priv_t')::uuid)) <> 1 then
    raise exception 'FAIL dashboard C4 denied access through transcript RLS';
  end if;
end $$;
commit;

insert into subscriptions (user_id, plan, status) values (current_setting('dashgate.a')::uuid, 'premium_monthly', 'active');
insert into user_lesson_library (user_id, lesson_id) values (current_setting('dashgate.a')::uuid, current_setting('dashgate.priv_v')::uuid);
do $$
begin
  if not can_open_lesson(current_setting('dashgate.plus_v')::uuid, current_setting('dashgate.a')::uuid)
    or not can_open_lesson(current_setting('dashgate.priv_v')::uuid, current_setting('dashgate.a')::uuid) then
    raise exception 'FAIL dashboard can_open_lesson with subscription and library';
  end if;
end $$;

begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('dashgate.a'), 'role', 'authenticated')::text, true);
do $$
begin
  if (select count(*) from transcripts where id in (current_setting('dashgate.free_t')::uuid, current_setting('dashgate.plus_t')::uuid, current_setting('dashgate.priv_t')::uuid)) <> 3
    or (select count(*) from transcript_lines where transcript_id in (current_setting('dashgate.free_t')::uuid, current_setting('dashgate.plus_t')::uuid, current_setting('dashgate.priv_t')::uuid)) <> 3 then
    raise exception 'FAIL dashboard C4 did not grant A transcript access';
  end if;
end $$;
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('dashgate.b'), 'role', 'authenticated')::text, true);
do $$
begin
  if (select count(*) from transcripts where id in (current_setting('dashgate.free_t')::uuid, current_setting('dashgate.plus_t')::uuid, current_setting('dashgate.priv_t')::uuid)) <> 1
    or (select count(*) from transcript_lines where transcript_id in (current_setting('dashgate.free_t')::uuid, current_setting('dashgate.plus_t')::uuid, current_setting('dashgate.priv_t')::uuid)) <> 1 then
    raise exception 'FAIL dashboard C4 leaked A access through transcript RLS';
  end if;
  -- B passing A's id learns nothing: RLS hides A's subscription and library rows from B.
  if can_open_lesson(current_setting('dashgate.plus_v')::uuid, current_setting('dashgate.a')::uuid)
    or can_open_lesson(current_setting('dashgate.priv_v')::uuid, current_setting('dashgate.a')::uuid) then
    raise exception 'FAIL dashboard can_open_lesson revealed another learner''s access';
  end if;
  raise notice 'PASS dashboard can_open_lesson and transcript RLS';
end $$;
commit;

begin;
set local role anon;
do $$
declare blocked boolean := false;
begin
  begin
    perform can_open_lesson(current_setting('dashgate.free_v')::uuid, current_setting('dashgate.a')::uuid);
  exception when insufficient_privilege then blocked := true;
  end;
  if not blocked then raise exception 'FAIL dashboard anon can_open_lesson grant'; end if;
  raise notice 'PASS dashboard anon cannot call can_open_lesson';
end $$;
commit;

delete from subscriptions where user_id = current_setting('dashgate.a')::uuid;
delete from videos where youtube_video_id like 'dashgate-%';

-- S7 first completion: stamped once by the server, never moved, client values ignored.
do $$
declare a uuid := (select id from users where email = 'dashgate-a@example.invalid'); v uuid; first_at timestamptz;
begin
  insert into videos (youtube_video_id, title, library_access) values ('dashgate-s7', 'g s7', 'FREE') returning id into v;
  insert into user_video_progress (user_id, video_id, last_watched_position, first_completed_at)
    values (a, v, 10, '2000-01-01');
  if (select first_completed_at from user_video_progress where user_id = a and video_id = v) is not null then
    raise exception 'FAIL dashboard S7 accepted a client first_completed_at';
  end if;
  update user_video_progress set completed_at = now() where user_id = a and video_id = v;
  select first_completed_at into first_at from user_video_progress where user_id = a and video_id = v;
  if first_at is null then raise exception 'FAIL dashboard S7 not stamped'; end if;
end $$;

-- Re-completion runs in a LATER transaction: now() inside one transaction is constant, so a trigger that re-stamps
-- would be invisible if both updates shared one. `is distinct from` also catches a re-completion that nulls it.
do $$
declare a uuid := (select id from users where email = 'dashgate-a@example.invalid');
  v uuid := (select id from videos where youtube_video_id = 'dashgate-s7'); first_at timestamptz;
begin
  select first_completed_at into first_at from user_video_progress where user_id = a and video_id = v;
  update user_video_progress set completed_at = now() + interval '1 day', first_completed_at = null
    where user_id = a and video_id = v;
  if (select first_completed_at from user_video_progress where user_id = a and video_id = v) is distinct from first_at then
    raise exception 'FAIL dashboard S7 moved on re-completion';
  end if;
  delete from videos where id = v;
  raise notice 'PASS dashboard first_completed_at';
end $$;

-- A first write that already carries the completion (PATCH completed=true, no row yet), and the upsert path.
do $$
declare a uuid := (select id from users where email = 'dashgate-a@example.invalid'); v uuid; w uuid; first_at timestamptz;
begin
  insert into videos (youtube_video_id, title, library_access) values ('dashgate-s7i', 'g s7i', 'FREE') returning id into v;
  insert into user_video_progress (user_id, video_id, completed_at, first_completed_at) values (a, v, now(), '2000-01-01');
  if (select first_completed_at from user_video_progress where user_id = a and video_id = v) is distinct from now() then
    raise exception 'FAIL dashboard S7 insert-with-completion not stamped by the server';
  end if;
  insert into videos (youtube_video_id, title, library_access) values ('dashgate-s7u', 'g s7u', 'FREE') returning id into w;
  insert into user_video_progress (user_id, video_id, last_watched_position) values (a, w, 5);
  insert into user_video_progress (user_id, video_id, completed_at, first_completed_at) values (a, w, now(), '2000-01-01')
    on conflict (user_id, video_id) do update
      set completed_at = excluded.completed_at, first_completed_at = excluded.first_completed_at;
  select first_completed_at into first_at from user_video_progress where user_id = a and video_id = w;
  if first_at is distinct from now() then raise exception 'FAIL dashboard S7 upsert completion not stamped once'; end if;
  delete from videos where id in (v, w);
  raise notice 'PASS dashboard S7 insert and upsert completion';
end $$;

-- No backfill: an existing completed row with no first-completion timestamp stays outside future mission windows.
begin;  -- the trigger is off only inside this transaction, even if a statement fails
insert into videos (youtube_video_id, title, library_access) values ('dashgate-legacy', 'g legacy', 'FREE');
alter table user_video_progress disable trigger user_video_progress_first_completed;
insert into user_video_progress (user_id, video_id, completed_at)
  values ((select id from users where email = 'dashgate-a@example.invalid'),
          (select id from videos where youtube_video_id = 'dashgate-legacy'), now());
alter table user_video_progress enable trigger user_video_progress_first_completed;
update user_video_progress set completed_at = now() + interval '1 day'
  where video_id = (select id from videos where youtube_video_id = 'dashgate-legacy');
commit;
do $$
begin
  if (select first_completed_at from user_video_progress where video_id = (select id from videos where youtube_video_id = 'dashgate-legacy')) is not null then
    raise exception 'FAIL dashboard S7 backfilled an existing completion';
  end if;
  raise notice 'PASS dashboard S7 never backfills existing completions';
end $$;
delete from videos where youtube_video_id = 'dashgate-legacy';

-- C3 curriculum sync (rollback block: the seed curriculum fixture survives, spec E2 amendment 4).
begin;
do $$
declare free1 uuid; free2 uuid; priv uuid; n int;
begin
  insert into videos (youtube_video_id, title, library_access) values ('dashgate-c1', 'c1', 'FREE') returning id into free1;
  insert into videos (youtube_video_id, title, library_access) values ('dashgate-c2', 'c2', 'FREE') returning id into free2;
  insert into videos (youtube_video_id, title, library_access) values ('dashgate-cp', 'cp', 'PRIVATE') returning id into priv;
  perform sync_curriculum_manifest(jsonb_build_object('N5', jsonb_build_array(free2, free1)));
  if (select position from lesson_collections lc join collections c on c.id = lc.collection_id where c.curriculum_level = 'N5' and lc.lesson_id = free2) <> 1
    or (select position from lesson_collections lc join collections c on c.id = lc.collection_id where c.curriculum_level = 'N5' and lc.lesson_id = free1) <> 2
    then raise exception 'FAIL dashboard sync order'; end if;
  perform sync_curriculum_manifest(jsonb_build_object('N5', jsonb_build_array(free2, free1)));  -- idempotent
  if (select count(*) from lesson_collections lc join collections c on c.id = lc.collection_id where c.kind = 'curriculum') <> 2
    then raise exception 'FAIL dashboard sync not idempotent'; end if;
  perform sync_curriculum_manifest(jsonb_build_object('N5', jsonb_build_array(free1)));
  select count(*) into n from lesson_collections lc join collections c on c.id = lc.collection_id where c.kind = 'curriculum';
  if n <> 1 then raise exception 'FAIL dashboard sync not authoritative (% rows)', n; end if;
  -- N5 is rewritten before N4 fails on PRIVATE: atomic means N5 is still [free1] afterwards.
  begin
    perform sync_curriculum_manifest(jsonb_build_object('N5', jsonb_build_array(free2), 'N4', jsonb_build_array(priv)));
    raise exception 'FAIL dashboard sync accepted PRIVATE';
  exception when others then
    if sqlerrm like 'FAIL%' or sqlerrm not like '%PRIVATE video%' then raise; end if;
  end;
  if not exists (select 1 from lesson_collections lc join collections c on c.id = lc.collection_id
                 where c.curriculum_level = 'N5' and lc.lesson_id = free1)
    or (select count(*) from lesson_collections lc join collections c on c.id = lc.collection_id where c.kind = 'curriculum') <> 1
    then raise exception 'FAIL dashboard sync not atomic'; end if;
  begin
    perform sync_curriculum_manifest(jsonb_build_object('N5', jsonb_build_array(free1, free1)));
    raise exception 'FAIL dashboard sync accepted a duplicate';
  exception when others then if sqlerrm like 'FAIL%' or sqlerrm not like '%duplicate lesson%' then raise; end if;
  end;
  begin
    perform sync_curriculum_manifest(jsonb_build_object('N5', jsonb_build_array(free1), 'N4', jsonb_build_array(free1)));
    raise exception 'FAIL dashboard sync accepted a lesson in two curricula';
  exception when others then if sqlerrm like 'FAIL%' or sqlerrm not like '%two curricula%' then raise; end if;
  end;
  begin
    perform sync_curriculum_manifest(null);
    raise exception 'FAIL dashboard sync accepted a null manifest';
  exception when others then if sqlerrm like 'FAIL%' or sqlerrm not like '%manifest must be an object%' then raise; end if;
  end;
  perform sync_curriculum_manifest('{}'::jsonb);
  if exists (select 1 from lesson_collections lc join collections c on c.id = lc.collection_id where c.kind = 'curriculum') then raise exception 'FAIL dashboard empty manifest kept members'; end if;
  raise notice 'PASS dashboard curriculum sync (order, idempotent, authoritative, PRIVATE, atomic, duplicate, two curricula, null, empty)';
end $$;
rollback;

-- C4: a subscription can open PLUS curriculum but cannot change FREE progression.
begin;
do $$
declare free1 uuid; free2 uuid; free3 uuid; plus1 uuid;
begin
  insert into videos (youtube_video_id, title, library_access) values ('dashgate-j1', 'journey free 1', 'FREE') returning id into free1;
  insert into videos (youtube_video_id, title, library_access) values ('dashgate-j2', 'journey free 2', 'FREE') returning id into free2;
  insert into videos (youtube_video_id, title, library_access) values ('dashgate-j3', 'journey free 3', 'FREE') returning id into free3;
  insert into videos (youtube_video_id, title, library_access) values ('dashgate-jp', 'journey plus', 'PLUS') returning id into plus1;
  -- PLUS first: the next milestone must still be the lowest-position INCOMPLETE FREE lesson (free2 at position 3).
  perform sync_curriculum_manifest(jsonb_build_object('N5', jsonb_build_array(plus1, free1, free2, free3)));
  perform set_config('dashgate.j2', free2::text, true);
  insert into user_video_progress (user_id, video_id, completed_at)
    values (current_setting('dashgate.a')::uuid, free1, now());
end $$;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('dashgate.a'), 'role', 'authenticated')::text, true);
do $$
begin
  if not exists (
    select 1 from curriculum_journey()
    where level = 'N5' and core_total = 3 and core_completed = 1 and plus_total = 1 and plus_accessible = 0
      and next_video_id = current_setting('dashgate.j2')::uuid and next_position = 3 and next_title = 'journey free 2'
  ) then
    raise exception 'FAIL dashboard journey changed core progression before subscription';
  end if;
end $$;

set local role postgres;
insert into subscriptions (user_id, plan, status)
  values (current_setting('dashgate.a')::uuid, 'premium_monthly', 'active');
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('dashgate.a'), 'role', 'authenticated')::text, true);
do $$
begin
  if not exists (
    select 1 from curriculum_journey()
    where level = 'N5' and core_total = 3 and core_completed = 1 and plus_total = 1 and plus_accessible = 1
      and next_video_id = current_setting('dashgate.j2')::uuid
  ) then
    raise exception 'FAIL dashboard journey subscription changed core progression';
  end if;
  raise notice 'PASS dashboard curriculum journey subscription never changes core progression';
end $$;
rollback;

-- D5 placement reads curriculum membership only, through the authenticated invoker path, with its own rows.
begin;
do $$
declare first_v uuid; v uuid;
begin
  insert into videos (youtube_video_id, title, library_access) values ('dashgate-p1', 'placement 1', 'FREE') returning id into first_v;
  insert into videos (youtube_video_id, title, library_access) values ('dashgate-p2', 'placement 2', 'FREE') returning id into v;
  perform sync_curriculum_manifest(jsonb_build_object('N4', jsonb_build_array(first_v, v)));
  perform set_config('dashgate.pl', v::text, true);
end $$;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('dashgate.a'), 'role', 'authenticated')::text, true);
do $$
begin
  if (select row(collection_title, lesson_position)::text from curriculum_membership(current_setting('dashgate.pl')::uuid))
     is distinct from '("JLPT N4",2)' then
    raise exception 'FAIL dashboard curriculum_membership placement';
  end if;
  raise notice 'PASS dashboard curriculum_membership placement';
end $$;
rollback;

-- S3 lexical_key parity: the SQL generated column equals normalizeRef for every lib/summary/lexical-key-fixture.ts case.
do $$
declare bad text;
begin
  create temporary table lexical_cases (input text, key text) on commit drop;
  insert into lexical_cases values
    (E'\u3000食べる\u3000', '食べる'),
    ('ﾀﾍﾞﾙ', 'タベル'),
    ('Ｔｏｋｙｏ', 'Tokyo'),
    (E'\u00a0日本\u3000', '日本'),
    ('お茶', 'お茶'),
    (E'\u0009飲む\u000a', '飲む');
  insert into vocab (word, jlpt_level) select input, 'N5' from lexical_cases;
  select v.word into bad from vocab v join lexical_cases c on c.input = v.word where v.lexical_key is distinct from c.key limit 1;
  delete from vocab where word in (select input from lexical_cases);
  if bad is not null then raise exception 'FAIL dashboard lexical_key parity for %', bad; end if;
  raise notice 'PASS dashboard lexical_key parity';
end $$;

-- S3 "min before filter": curated 食べる mastered 30 days ago, mined again today -> not new this window; 飲む is new;
-- a sentence card never counts. Current count: 食べる + 飲む.
begin;
do $$
declare a uuid := current_setting('dashgate.a')::uuid; vid uuid; voc uuid;
begin
  insert into videos (youtube_video_id, title, library_access) values ('dashgate-s3', 's3', 'FREE') returning id into vid;
  insert into vocab (word, jlpt_level) values ('食べる', 'N5') returning id into voc;
  insert into user_vocab_progress (user_id, vocab_id, srs_stage, mastered_at) values (a, voc, 3, now() - interval '30 days');
  insert into sentence_mining_cards (user_id, video_id, target_word, sentence_jp, source_kind, source_ref, srs_stage, mastered_at) values
    (a, vid, '食べる', 's', 'vocabulary', '食べる', 2, now()),
    (a, vid, '飲む', 's', 'selection', '飲む', 2, now()),
    (a, vid, 'x', '文全体', 'sentence', null, 5, now());
end $$;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('dashgate.a'), 'role', 'authenticated')::text, true);
do $$
begin
  if newly_mastered_count(2, date_trunc('day', now()), date_trunc('day', now()) + interval '1 day') <> 1 then
    raise exception 'FAIL dashboard S3 min before filter: new = %',
      newly_mastered_count(2, date_trunc('day', now()), date_trunc('day', now()) + interval '1 day');
  end if;
  if current_mastered_count(2) <> 2 then
    raise exception 'FAIL dashboard S3 current mastered = %', current_mastered_count(2);
  end if;
  raise notice 'PASS dashboard S3 lexical mastery (min before filter, sentence excluded, current)';
end $$;
rollback;

-- S2 mining mastered_at is kept once set (shared keep_first_mastered_at trigger).
begin;
do $$
declare a uuid := current_setting('dashgate.a')::uuid; vid uuid; card uuid;
begin
  insert into videos (youtube_video_id, title, library_access) values ('dashgate-s2', 's2', 'FREE') returning id into vid;
  insert into sentence_mining_cards (user_id, video_id, target_word, sentence_jp, source_ref, mastered_at)
    values (a, vid, '走る', 's', '走る', '2026-09-01') returning id into card;
  update sentence_mining_cards set srs_stage = 0, mastered_at = null where id = card;
  if (select mastered_at from sentence_mining_cards where id = card) is distinct from '2026-09-01'::timestamptz then
    raise exception 'FAIL dashboard S2 mining mastered_at was reset';
  end if;
  raise notice 'PASS dashboard S2 mining mastered_at kept';
end $$;
rollback;

-- D12 due definitions (plan P2) and RLS: kanji due = progress row with next_review_at null or past; mining due = any
-- card null or past, including exactly at p_at; a caller passing another learner's id sees nothing of theirs.
begin;
do $$
declare a uuid := current_setting('dashgate.a')::uuid; k1 uuid; k2 uuid; vid uuid;
begin
  insert into kanji (character) values ('㐀') returning id into k1;
  insert into kanji (character) values ('㐁') returning id into k2;
  insert into user_kanji_progress (user_id, kanji_id, next_review_at) values
    (a, k1, now() - interval '1 hour'), (a, k2, now() + interval '1 day');
  insert into videos (youtube_video_id, title, library_access) values ('dashgate-d12', 'd12', 'FREE') returning id into vid;
  insert into sentence_mining_cards (user_id, video_id, target_word, sentence_jp, source_ref, next_review_at) values
    (a, vid, '新', 's', '新', null),
    (a, vid, '境', 's', '境', '2026-10-08T12:00:00Z'),
    (a, vid, '先', 's', '先', '2026-10-08T12:00:01Z');
  if (select count(*) from review_due_keys(a, array['kanji'], now())) <> 1
    or not exists (select 1 from review_due_keys(a, array['kanji'], now()) where item_key = 'kanji:' || k1) then
    raise exception 'FAIL dashboard D12 kanji due definition';
  end if;
  if (select count(*) from review_due_keys(a, array['mining'], '2026-10-08T12:00:00Z')) <> 2 then
    raise exception 'FAIL dashboard D12 mining due (null + exactly at p_at): %',
      (select count(*) from review_due_keys(a, array['mining'], '2026-10-08T12:00:00Z'));
  end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', current_setting('dashgate.b'), 'role', 'authenticated')::text, true);
do $$
begin
  if exists (select 1 from review_due_keys(current_setting('dashgate.a')::uuid, array['kanji', 'mining'], now())) then
    raise exception 'FAIL dashboard D12 review_due_keys leaked another learner''s cards';
  end if;
  raise notice 'PASS dashboard D12 due definitions and RLS';
end $$;
rollback;
