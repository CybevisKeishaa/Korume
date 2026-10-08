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
  if (select position from lesson_collections lc join collections c on c.id = lc.collection_id where c.curriculum_level = 'N5' and lc.lesson_id = free2) <> 1 then raise exception 'FAIL dashboard sync order'; end if;
  perform sync_curriculum_manifest(jsonb_build_object('N5', jsonb_build_array(free2, free1)));  -- idempotent
  if (select count(*) from lesson_collections lc join collections c on c.id = lc.collection_id where c.kind = 'curriculum') <> 2
    then raise exception 'FAIL dashboard sync not idempotent'; end if;
  perform sync_curriculum_manifest(jsonb_build_object('N5', jsonb_build_array(free1)));
  select count(*) into n from lesson_collections lc join collections c on c.id = lc.collection_id where c.kind = 'curriculum';
  if n <> 1 then raise exception 'FAIL dashboard sync not authoritative (% rows)', n; end if;
  begin perform sync_curriculum_manifest(jsonb_build_object('N5', jsonb_build_array(free1), 'N4', jsonb_build_array(priv))); raise exception 'FAIL dashboard sync accepted PRIVATE'; exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  if (select count(*) from lesson_collections lc join collections c on c.id = lc.collection_id where c.kind = 'curriculum') <> 1 then raise exception 'FAIL dashboard sync not atomic'; end if;
  perform sync_curriculum_manifest('{}'::jsonb);
  if exists (select 1 from lesson_collections lc join collections c on c.id = lc.collection_id where c.kind = 'curriculum') then raise exception 'FAIL dashboard empty manifest kept members'; end if;
  raise notice 'PASS dashboard curriculum sync (order, idempotent, authoritative, PRIVATE, atomic, empty)';
end $$;
rollback;
