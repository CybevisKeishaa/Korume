\set ON_ERROR_STOP on

-- Single-session Ask Korume gate. All fixtures use korumegate-* identities.
delete from ai_generations where model = 'korumegate-fixture';
delete from ai_usage_charges where fingerprint like 'korumegate-ent-%';
delete from ai_reservations where fingerprint like 'korumegate-ent-%';
delete from videos where title like 'korumegate-%';
delete from auth.users where email like 'korumegate-%@example.invalid';
insert into ai_budget_days (period_day) values ((now() at time zone 'utc')::date) on conflict do nothing;
create temp table korumegate_budget as select * from ai_budget_days where period_day = (now() at time zone 'utc')::date;

-- 1. Existing scenario sessions remain valid after the discriminator is added.
do $$
begin
  if exists (select 1 from conversation_sessions where kind <> 'scenario'
    or origin_video_id is not null or origin_line_id is not null or origin_span is not null
    or origin_route is not null or title is not null) then
    raise exception 'FAIL 1: a pre-existing session is not a plain scenario';
  end if;
  raise notice 'PASS 1 pre-existing sessions are valid scenarios';
end $$;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
select gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'korumegate-' || name || '@example.invalid', crypt('password123', gen_salt('bf')), now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb
from unnest(array['a', 'b']) as name;

create or replace function pg_temp.kgate_user(p_name text) returns uuid language sql as $$
  select id from public.users where email = 'korumegate-' || p_name || '@example.invalid'
$$;

-- 2. Scenario type is still optional, while Korume-only fields are forbidden.
do $$
declare v_id uuid;
begin
  insert into conversation_sessions (user_id, scenario_type)
    values (pg_temp.kgate_user('a'), null) returning id into v_id;
  if (select kind from conversation_sessions where id = v_id) is distinct from 'scenario' then
    raise exception 'FAIL 2a: scenario default changed';
  end if;
  begin
    insert into conversation_sessions (user_id, title)
      values (pg_temp.kgate_user('a'), 'forbidden');
  exception when check_violation then
    raise notice 'PASS 2 scenario title rejected';
    return;
  end;
  raise exception 'FAIL 2b: scenario title was accepted';
end $$;

insert into videos (youtube_video_id, title, added_by_user_id)
  values ('KORUMEGATE1', 'korumegate-source', pg_temp.kgate_user('a'));
insert into transcripts (video_id, source)
  select id, 'user_submitted' from videos where title = 'korumegate-source';
insert into transcript_lines (transcript_id, start_time, text_jp)
  select t.id, 0, '日本語です' from transcripts t join videos v on v.id = t.video_id
  where v.title = 'korumegate-source';

create or replace function pg_temp.kgate_video() returns uuid language sql as $$
  select id from public.videos where title = 'korumegate-source'
$$;
create or replace function pg_temp.kgate_line() returns uuid language sql as $$
  select l.id from public.transcript_lines l join public.transcripts t on t.id = l.transcript_id
    where t.video_id = pg_temp.kgate_video() order by l.start_time limit 1
$$;

-- Each call is an independent subtransaction; only the expected CHECK failure passes.
create or replace function pg_temp.kgate_reject_anchor(
  p_case text, p_video uuid, p_line uuid, p_span jsonb, p_route text
) returns void language plpgsql as $$
begin
  begin
    insert into public.conversation_sessions (user_id, kind, origin_video_id, origin_line_id, origin_span, origin_route)
      values (pg_temp.kgate_user('a'), 'ask_korume', p_video, p_line, p_span, p_route);
  exception when check_violation then
    return;
  end;
  raise exception 'FAIL %: invalid anchor was accepted', p_case;
end $$;

-- 3. A valid UTF-16 span is accepted; every invalid shape or route is rejected separately.
do $$
declare v_id uuid;
begin
  insert into conversation_sessions (user_id, kind, origin_video_id, origin_line_id, origin_span, origin_route)
    values (pg_temp.kgate_user('a'), 'ask_korume', pg_temp.kgate_video(), pg_temp.kgate_line(),
      '{"start":0,"end":3}', '/shadowing/example?line=example') returning id into v_id;
  if (select origin_span from conversation_sessions where id = v_id) is distinct from '{"start":0,"end":3}'::jsonb then
    raise exception 'FAIL 3a: valid span changed';
  end if;
end $$;
select pg_temp.kgate_reject_anchor('3b', pg_temp.kgate_video(), pg_temp.kgate_line(), '{"start":3,"end":3}', null);
select pg_temp.kgate_reject_anchor('3c', pg_temp.kgate_video(), pg_temp.kgate_line(), '{"start":-1,"end":2}', null);
select pg_temp.kgate_reject_anchor('3d', pg_temp.kgate_video(), pg_temp.kgate_line(), '{"start":0.5,"end":2}', null);
select pg_temp.kgate_reject_anchor('3e', pg_temp.kgate_video(), pg_temp.kgate_line(), '{"start":0,"end":2,"x":1}', null);
select pg_temp.kgate_reject_anchor('3f', pg_temp.kgate_video(), pg_temp.kgate_line(), '{"end":2}', null);
select pg_temp.kgate_reject_anchor('3g', pg_temp.kgate_video(), null, '{"start":0,"end":2}', null);
select pg_temp.kgate_reject_anchor('3h', null, pg_temp.kgate_line(), null, null);
select pg_temp.kgate_reject_anchor('3i', pg_temp.kgate_video(), pg_temp.kgate_line(), null, '//evil');
select pg_temp.kgate_reject_anchor('3j', pg_temp.kgate_video(), pg_temp.kgate_line(), null, 'https://x');
select pg_temp.kgate_reject_anchor('3k', pg_temp.kgate_video(), pg_temp.kgate_line(), null, '/a:b');
select pg_temp.kgate_reject_anchor('3l', pg_temp.kgate_video(), pg_temp.kgate_line(), 'null'::jsonb, null);
do $$ begin raise notice 'PASS 3 valid anchor accepted; invalid spans, dependencies and routes rejected'; end $$;

-- 4. Delete a line, then a video through its transcript cascade. Chats survive both.
do $$
declare v_video uuid := pg_temp.kgate_video(); v_line uuid := pg_temp.kgate_line();
  v_thread uuid; v_other uuid; v_line2 uuid; v_transcript uuid;
begin
  insert into conversation_sessions (user_id, kind, origin_video_id, origin_line_id, origin_span, origin_route)
    values (pg_temp.kgate_user('a'), 'ask_korume', v_video, v_line, '{"start":0,"end":3}', '/shadowing/source')
    returning id into v_thread;
  insert into conversation_messages (session_id, role, content)
    values (v_thread, 'user', 'question'), (v_thread, 'ai', 'answer');
  delete from transcript_lines where id = v_line;
  if (select count(*) from conversation_sessions where id = v_thread) <> 1
    or (select origin_video_id from conversation_sessions where id = v_thread) is distinct from v_video
    or (select origin_line_id from conversation_sessions where id = v_thread) is not null
    or (select origin_span from conversation_sessions where id = v_thread) is not null
    or (select origin_route from conversation_sessions where id = v_thread) is distinct from '/shadowing/source'
    or (select count(*) from conversation_messages where session_id = v_thread) <> 2 then
    raise exception 'FAIL 4a: deleting a line lost chat or left a dependent anchor';
  end if;

  select id into v_transcript from transcripts where video_id = v_video;
  insert into transcript_lines (transcript_id, start_time, text_jp)
    values (v_transcript, 1, '次の文') returning id into v_line2;
  insert into conversation_sessions (user_id, kind, origin_video_id, origin_line_id, origin_span, origin_route)
    values (pg_temp.kgate_user('a'), 'ask_korume', v_video, v_line2, '{"start":0,"end":2}', '/shadowing/source')
    returning id into v_other;
  insert into conversation_messages (session_id, role, content)
    values (v_other, 'user', 'question'), (v_other, 'ai', 'answer');
  delete from videos where id = v_video;
  if (select count(*) from conversation_sessions where id = v_other) <> 1
    or (select origin_video_id from conversation_sessions where id = v_other) is not null
    or (select origin_line_id from conversation_sessions where id = v_other) is not null
    or (select origin_span from conversation_sessions where id = v_other) is not null
    or (select origin_route from conversation_sessions where id = v_other) is not null
    or (select count(*) from conversation_messages where session_id = v_other) <> 2 then
    raise exception 'FAIL 4b: video cascade lost chat or left an anchor';
  end if;
  raise notice 'PASS 4 line and video deletion preserve chat and clear dependent anchors';
end $$;

-- 5. Structured content is paired with its version, user rows are plain, turns are unique by role.
do $$
declare v_thread uuid; v_turn uuid := gen_random_uuid();
begin
  insert into conversation_sessions (user_id, kind) values (pg_temp.kgate_user('a'), 'ask_korume') returning id into v_thread;
  begin
    insert into conversation_messages (session_id, role, content, content_json, content_schema_version)
      values (v_thread, 'user', 'x', '{"blocks":[]}', 1);
  exception when check_violation then
    raise notice 'PASS 5a user structured content rejected';
  end;
  if exists (select 1 from conversation_messages where session_id = v_thread) then
    raise exception 'FAIL 5a: user structured content was accepted';
  end if;
  begin
    insert into conversation_messages (session_id, role, content, content_json)
      values (v_thread, 'ai', 'x', '{"blocks":[]}');
  exception when check_violation then
    raise notice 'PASS 5b unversioned assistant content rejected';
  end;
  if exists (select 1 from conversation_messages where session_id = v_thread) then
    raise exception 'FAIL 5b: unversioned assistant content was accepted';
  end if;
  insert into conversation_messages (session_id, turn_id, role, content)
    values (v_thread, v_turn, 'user', 'first');
  begin
    insert into conversation_messages (session_id, turn_id, role, content)
      values (v_thread, v_turn, 'user', 'duplicate');
  exception when unique_violation then
    raise notice 'PASS 5c duplicate user turn rejected';
  end;
  if (select count(*) from conversation_messages where session_id = v_thread and turn_id = v_turn and role = 'user') <> 1 then
    raise exception 'FAIL 5c: duplicate user turn was accepted';
  end if;
  insert into conversation_sessions (user_id) values (pg_temp.kgate_user('a')) returning id into v_thread;
  insert into conversation_messages (session_id, role, content)
    values (v_thread, 'user', 'first'), (v_thread, 'user', 'second');
  if (select count(*) from conversation_messages where session_id = v_thread and turn_id is null) <> 2 then
    raise exception 'FAIL 5d: scenario messages without turn IDs were rejected';
  end if;
  raise notice 'PASS 5 message shape and turn uniqueness';
end $$;

-- 6. The same telemetry RPC stores optional turn correlation.
do $$
declare v_turn uuid := gen_random_uuid(); v_with uuid; v_without uuid;
begin
  v_with := ai_record_generation(jsonb_build_object('billingScope', 'system', 'section', 'korume_plan',
    'provider', 'fake', 'model', 'korumegate-fixture', 'outcome', 'success', 'turnId', v_turn));
  v_without := ai_record_generation(jsonb_build_object('billingScope', 'system', 'section', 'korume_answer',
    'provider', 'fake', 'model', 'korumegate-fixture', 'outcome', 'success'));
  if (select turn_id from ai_generations where id = v_with) is distinct from v_turn
    or (select turn_id from ai_generations where id = v_without) is not null then
    raise exception 'FAIL 6: optional generation turn ID did not round trip';
  end if;
  raise notice 'PASS 6 generation turn correlation is optional';
end $$;

-- 7. Existing memory erasure removes only the caller's Ask Korume threads and messages.
insert into conversation_sessions (user_id, kind, title)
  values (pg_temp.kgate_user('a'), 'ask_korume', 'A'), (pg_temp.kgate_user('b'), 'ask_korume', 'B');
insert into conversation_messages (session_id, role, content)
  select id, 'user', 'question' from conversation_sessions where title in ('A', 'B')
    and user_id in (pg_temp.kgate_user('a'), pg_temp.kgate_user('b'));
create temp table kgate_erased_sessions as
  select id from conversation_sessions where user_id = pg_temp.kgate_user('a');
select pg_temp.kgate_user('a') as uid_a \gset

-- Direct learner writes cannot forge a server-owned thread or reply; scenario writes still work.
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'uid_a', 'role', 'authenticated')::text, true);
do $$
declare v_thread uuid; v_scenario uuid; v_changed int;
begin
  select id into v_thread from conversation_sessions where title = 'A' and kind = 'ask_korume';
  if v_thread is null then raise exception 'FAIL 7a setup: Ask Korume thread is not readable'; end if;
  begin
    insert into conversation_sessions (user_id, kind) values (auth.uid(), 'ask_korume');
    raise exception 'FAIL 7a: learner created an Ask Korume thread directly';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into conversation_messages (session_id, role, content, content_json, content_schema_version)
      values (v_thread, 'ai', 'forged', '{"blocks":[]}', 1);
    raise exception 'FAIL 7b: learner forged an assistant message';
  exception when insufficient_privilege then null;
  end;
  update conversation_sessions set title = 'forged' where id = v_thread;
  get diagnostics v_changed = row_count;
  if v_changed <> 0 then raise exception 'FAIL 7c: learner changed an Ask Korume thread'; end if;
  update conversation_messages set role = 'ai' where session_id = v_thread;
  get diagnostics v_changed = row_count;
  if v_changed <> 0 then raise exception 'FAIL 7d: learner changed an Ask Korume message'; end if;
  delete from conversation_messages where session_id = v_thread;
  get diagnostics v_changed = row_count;
  if v_changed <> 0 then raise exception 'FAIL 7e: learner deleted an Ask Korume message directly'; end if;
  insert into conversation_sessions (user_id) values (auth.uid()) returning id into v_scenario;
  insert into conversation_messages (session_id, role, content) values (v_scenario, 'user', 'scenario');
  begin
    update conversation_sessions set kind = 'ask_korume' where id = v_scenario;
    raise exception 'FAIL 7f: learner changed a scenario into an Ask Korume thread';
  exception when insufficient_privilege then null;
  end;
  if (select count(*) from conversation_messages where session_id = v_scenario) <> 1 then
    raise exception 'FAIL 7g: scenario writes were blocked';
  end if;
  raise notice 'PASS 7a direct Ask Korume writes blocked; scenario writes preserved';
end $$;
commit;

-- The same authenticated learner can still erase their own thread through the existing function.
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'uid_a', 'role', 'authenticated')::text, true);
select public.erase_companion_memory();
commit;
do $$
begin
  if exists (select 1 from conversation_sessions where user_id = pg_temp.kgate_user('a'))
    or exists (select 1 from conversation_messages where session_id in (select id from kgate_erased_sessions))
    or (select count(*) from conversation_sessions where user_id = pg_temp.kgate_user('b') and kind = 'ask_korume') <> 1
    or (select count(*) from conversation_messages m join conversation_sessions s on s.id = m.session_id
      where s.user_id = pg_temp.kgate_user('b')) <> 1 then
    raise exception 'FAIL 7: erasure lost another learner or kept the caller''s chat';
  end if;
  raise notice 'PASS 7 memory erasure removes only the caller''s Korume chat';
end $$;

-- 8–13. Per-turn entitlement. Each case has its own learner so previous held rows cannot mask its result.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
select gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'korumegate-' || name || '@example.invalid', crypt('password123', gen_salt('bf')), now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb
from unnest(array['ent-free', 'ent-expired', 'ent-fuse', 'ent-pool-a', 'ent-pool-b', 'ent-turn', 'ent-complete']) as name;

create or replace function pg_temp.korume_limits(p_free int default 10, p_plus int default 100,
  p_credits int default 1000) returns jsonb language sql as $$
  select jsonb_build_object('globalUsdPerDay', 1000000, 'freeSentencesPerDay', 3,
    'plusMaxSectionsPerDay', 200, 'plusCreditsPerMonth', p_credits,
    'askKorumeFreeTurnsPerDay', p_free, 'askKorumePlusTurnsPerDay', p_plus)
$$;

-- 8. Free counts turns, even when their fingerprints repeat; released holds restore a slot.
do $$
declare r record; first_id uuid; today date := (now() at time zone 'utc')::date;
begin
  for i in 1..10 loop
    select * into r from ai_reserve(pg_temp.kgate_user('ent-free'), 'learner', 'korume_free_turn',
      'korumegate-ent-free', 0, 0.01, pg_temp.korume_limits(), 120, gen_random_uuid());
    if r.outcome <> 'reserved' then raise exception 'FAIL 8: turn % yielded %', i, r.outcome; end if;
    if i = 1 then first_id := r.reservation_id; end if;
  end loop;
  select * into r from ai_reserve(pg_temp.kgate_user('ent-free'), 'learner', 'korume_free_turn',
    'korumegate-ent-free', 0, 0.01, pg_temp.korume_limits(), 120, gen_random_uuid());
  if r.outcome <> 'quota_exhausted' or r.resets_at is distinct from ((today + 1)::timestamp at time zone 'utc') then
    raise exception 'FAIL 8: Free limit or UTC reset incorrect: %, %', r.outcome, r.resets_at;
  end if;
  perform ai_release(first_id);
  select * into r from ai_reserve(pg_temp.kgate_user('ent-free'), 'learner', 'korume_free_turn',
    'korumegate-ent-free', 0, 0.01, pg_temp.korume_limits(), 120, gen_random_uuid());
  if r.outcome <> 'reserved' then raise exception 'FAIL 8: released slot still counted (%)', r.outcome; end if;
  raise notice 'PASS 8 Free per-turn quota and UTC reset';
end $$;

-- 9. ai_reserve reclaims expired holds before counting the Free limit.
do $$
declare r record;
begin
  for i in 1..10 loop
    select * into r from ai_reserve(pg_temp.kgate_user('ent-expired'), 'learner', 'korume_free_turn',
      'korumegate-ent-expired', 0, 0.01, pg_temp.korume_limits(), 120, gen_random_uuid());
    if r.outcome <> 'reserved' then raise exception 'FAIL 9 setup: %', r.outcome; end if;
    update ai_reservations set expires_at = now() - interval '1 second' where id = r.reservation_id;
  end loop;
  select * into r from ai_reserve(pg_temp.kgate_user('ent-expired'), 'learner', 'korume_free_turn',
    'korumegate-ent-expired', 0, 0.01, pg_temp.korume_limits(), 120, gen_random_uuid());
  if r.outcome <> 'reserved' or (select count(*) from ai_reservations
      where requested_by_user_id = pg_temp.kgate_user('ent-expired') and status = 'released') <> 10 then
    raise exception 'FAIL 9: expired holds ate quota (%)', r.outcome;
  end if;
  raise notice 'PASS 9 expired holds do not eat the Free day';
end $$;

-- 10. Plus has its own turn fuse; Knowledge sections do not enter that count.
do $$
declare r record;
begin
  select * into r from ai_reserve(pg_temp.kgate_user('ent-fuse'), 'learner', 'plus_section',
    'korumegate-ent-section', 1, 0.01, pg_temp.korume_limits(10, 2), 120);
  if r.outcome <> 'reserved' then raise exception 'FAIL 10 section setup: %', r.outcome; end if;
  for i in 1..3 loop
    select * into r from ai_reserve(pg_temp.kgate_user('ent-fuse'), 'learner', 'korume_plus_turn',
      'korumegate-ent-fuse', 1, 0.01, pg_temp.korume_limits(10, 2), 120, gen_random_uuid());
    if r.outcome is distinct from (case when i <= 2 then 'reserved' else 'fuse_tripped' end) then
      raise exception 'FAIL 10: turn % yielded %', i, r.outcome;
    end if;
  end loop;
  raise notice 'PASS 10 Plus turn fuse excludes Knowledge sections';
end $$;

-- 11. Settled credits from either paid kind reduce the other's monthly capacity.
do $$
declare r record; snap jsonb; day date := (now() at time zone 'utc')::date;
  month date := date_trunc('month', now() at time zone 'utc')::date;
begin
  select * into r from ai_reserve(pg_temp.kgate_user('ent-pool-a'), 'learner', 'plus_section',
    'korumegate-ent-pool-a', 6, 0.01, pg_temp.korume_limits(10, 100, 10), 120);
  if r.outcome <> 'reserved' or not ai_settle(r.reservation_id, null, 6, 0.01) then
    raise exception 'FAIL 11a setup: Plus section did not settle';
  end if;
  select * into r from ai_reserve(pg_temp.kgate_user('ent-pool-a'), 'learner', 'korume_plus_turn',
    'korumegate-ent-pool-a', 5, 0.01, pg_temp.korume_limits(10, 100, 10), 120, gen_random_uuid());
  snap := ai_usage_snapshot(pg_temp.kgate_user('ent-pool-a'), day, month);
  if r.outcome <> 'credits_exhausted' or (snap->>'plusCreditsUsed')::int <> 6 then
    raise exception 'FAIL 11a: shared pool % / %', r.outcome, snap;
  end if;
  select * into r from ai_reserve(pg_temp.kgate_user('ent-pool-b'), 'learner', 'korume_plus_turn',
    'korumegate-ent-pool-b', 6, 0.01, pg_temp.korume_limits(10, 100, 10), 120, gen_random_uuid());
  if r.outcome <> 'reserved' or not ai_settle(r.reservation_id, null, 6, 0.01) then
    raise exception 'FAIL 11b setup: Korume turn did not settle';
  end if;
  select * into r from ai_reserve(pg_temp.kgate_user('ent-pool-b'), 'learner', 'plus_section',
    'korumegate-ent-pool-b', 5, 0.01, pg_temp.korume_limits(10, 100, 10), 120);
  snap := ai_usage_snapshot(pg_temp.kgate_user('ent-pool-b'), day, month);
  if r.outcome <> 'credits_exhausted' or (snap->>'plusCreditsUsed')::int <> 6
    or (snap->>'askKorumeTurnsUsed')::int <> 1 then
    raise exception 'FAIL 11b: shared pool % / %', r.outcome, snap;
  end if;
  raise notice 'PASS 11 Plus credit pool is shared both ways';
end $$;

-- 12. A turn reserves the budget once. A release allows a new attempt with that turn ID.
do $$
declare r record; first_id uuid; turn uuid := gen_random_uuid(); before_usd numeric; after_usd numeric;
begin
  select reserved_usd into before_usd from ai_budget_days where period_day = (now() at time zone 'utc')::date;
  select * into r from ai_reserve(pg_temp.kgate_user('ent-turn'), 'learner', 'korume_free_turn',
    'korumegate-ent-turn', 0, 0.25, pg_temp.korume_limits(), 120, turn);
  first_id := r.reservation_id;
  if r.outcome <> 'reserved' then raise exception 'FAIL 12 setup: %', r.outcome; end if;
  select * into r from ai_reserve(pg_temp.kgate_user('ent-turn'), 'learner', 'korume_free_turn',
    'korumegate-ent-turn', 0, 0.25, pg_temp.korume_limits(), 120, turn);
  select reserved_usd into after_usd from ai_budget_days where period_day = (now() at time zone 'utc')::date;
  if r.outcome <> 'turn_exists' or after_usd - before_usd <> 0.25 then
    raise exception 'FAIL 12: duplicate turn reserved budget twice: %, %', r.outcome, after_usd - before_usd;
  end if;
  perform ai_release(first_id);
  select * into r from ai_reserve(pg_temp.kgate_user('ent-turn'), 'learner', 'korume_free_turn',
    'korumegate-ent-turn', 0, 0.25, pg_temp.korume_limits(), 120, turn);
  if r.outcome <> 'reserved' then raise exception 'FAIL 12: released turn cannot retry (%)', r.outcome; end if;
  raise notice 'PASS 12 one active reservation and one budget hold per turn';
end $$;

-- 13. The answer, charge, title and touch are one transaction; a repeated completion is inert.
do $$
declare s uuid; t uuid := gen_random_uuid(); r record; answer record; again record; old_update timestamptz;
  free_s uuid; free_t uuid := gen_random_uuid(); free_r record; free_answer record;
begin
  insert into conversation_sessions (user_id, kind) values (pg_temp.kgate_user('ent-complete'), 'ask_korume') returning id into s;
  insert into conversation_messages (session_id, role, turn_id, content) values (s, 'user', t, 'question');
  update conversation_sessions set updated_at = now() - interval '1 hour' where id = s;
  select updated_at into old_update from conversation_sessions where id = s;
  select * into r from ai_reserve(pg_temp.kgate_user('ent-complete'), 'learner', 'korume_plus_turn',
    'korumegate-ent-complete-plus', 3, 0.02, pg_temp.korume_limits(), 120, t);
  if r.outcome <> 'reserved' then raise exception 'FAIL 13 setup: %', r.outcome; end if;
  select * into answer from korume_complete_turn(s, t, r.reservation_id, null, 3, 0.01,
    'answer', '{"blocks":[]}', '{"sources":[]}', 'first title');
  select * into again from korume_complete_turn(s, t, r.reservation_id, null, 3, 0.01,
    'duplicate', '{"blocks":[]}', '{"sources":[]}', 'second title');
  if not answer.charged or again.charged or answer.message_id is distinct from again.message_id
    or (select count(*) from conversation_messages where session_id = s and turn_id = t and role = 'ai') <> 1
    or (select count(*) from ai_usage_charges where reservation_id = r.reservation_id and credits = 3) <> 1
    or (select status from ai_reservations where id = r.reservation_id) <> 'settled'
    or (select title from conversation_sessions where id = s) <> 'first title'
    or (select updated_at from conversation_sessions where id = s) <= old_update
    or (select count(*) from conversation_messages where id = answer.message_id
        and content_schema_version = 1 and grounding_schema_version = 1) <> 1 then
    raise exception 'FAIL 13: Plus completion or idempotency';
  end if;
  insert into conversation_sessions (user_id, kind, title)
    values (pg_temp.kgate_user('ent-complete'), 'ask_korume', 'saved title') returning id into free_s;
  insert into conversation_messages (session_id, role, turn_id, content) values (free_s, 'user', free_t, 'question');
  select * into free_r from ai_reserve(pg_temp.kgate_user('ent-complete'), 'learner', 'korume_free_turn',
    'korumegate-ent-complete-free', 0, 0.02, pg_temp.korume_limits(), 120, free_t);
  select * into free_answer from korume_complete_turn(free_s, free_t, free_r.reservation_id, null, 99, 0.01,
    'free answer', '{"blocks":[]}', '{"sources":[]}', 'new title');
  if not free_answer.charged or (select credits from ai_usage_charges where reservation_id = free_r.reservation_id) <> 0
    or (select title from conversation_sessions where id = free_s) <> 'saved title' then
    raise exception 'FAIL 13: Free completion charged credits or replaced title';
  end if;
  raise notice 'PASS 13 atomic and idempotent completion';
end $$;

delete from ai_generations where model = 'korumegate-fixture';
delete from ai_usage_charges where fingerprint like 'korumegate-ent-%';
delete from ai_reservations where fingerprint like 'korumegate-ent-%';
delete from videos where title like 'korumegate-%';
delete from auth.users where email like 'korumegate-%@example.invalid';
update ai_budget_days b set reserved_usd = k.reserved_usd, spent_usd = k.spent_usd
  from korumegate_budget k where b.period_day = k.period_day;
