\set ON_ERROR_STOP on

-- Single-session Ask Korume gate. All fixtures use korumegate-* identities.
delete from ai_generations where model = 'korumegate-fixture';
delete from videos where title like 'korumegate-%';
delete from auth.users where email like 'korumegate-%@example.invalid';

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
  if v_thread is null then raise exception 'FAIL 8 setup: Ask Korume thread is not readable'; end if;
  begin
    insert into conversation_sessions (user_id, kind) values (auth.uid(), 'ask_korume');
    raise exception 'FAIL 8a: learner created an Ask Korume thread directly';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into conversation_messages (session_id, role, content, content_json, content_schema_version)
      values (v_thread, 'ai', 'forged', '{"blocks":[]}', 1);
    raise exception 'FAIL 8b: learner forged an assistant message';
  exception when insufficient_privilege then null;
  end;
  update conversation_sessions set title = 'forged' where id = v_thread;
  get diagnostics v_changed = row_count;
  if v_changed <> 0 then raise exception 'FAIL 8c: learner changed an Ask Korume thread'; end if;
  update conversation_messages set role = 'ai' where session_id = v_thread;
  get diagnostics v_changed = row_count;
  if v_changed <> 0 then raise exception 'FAIL 8d: learner changed an Ask Korume message'; end if;
  delete from conversation_messages where session_id = v_thread;
  get diagnostics v_changed = row_count;
  if v_changed <> 0 then raise exception 'FAIL 8e: learner deleted an Ask Korume message directly'; end if;
  insert into conversation_sessions (user_id) values (auth.uid()) returning id into v_scenario;
  insert into conversation_messages (session_id, role, content) values (v_scenario, 'user', 'scenario');
  begin
    update conversation_sessions set kind = 'ask_korume' where id = v_scenario;
    raise exception 'FAIL 8f: learner changed a scenario into an Ask Korume thread';
  exception when insufficient_privilege then null;
  end;
  if (select count(*) from conversation_messages where session_id = v_scenario) <> 1 then
    raise exception 'FAIL 8g: scenario writes were blocked';
  end if;
  raise notice 'PASS 8 direct Ask Korume writes blocked; scenario writes preserved';
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

delete from ai_generations where model = 'korumegate-fixture';
delete from videos where title like 'korumegate-%';
delete from auth.users where email like 'korumegate-%@example.invalid';
