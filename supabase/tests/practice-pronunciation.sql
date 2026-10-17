\set ON_ERROR_STOP on
\set uid_a 'ba5eba11-0000-4000-8000-00000000000a'
\set uid_b 'ba5eba11-0000-4000-8000-00000000000b'
\set vid 'ba5eba11-0000-4000-8000-0000000000f1'
\set tid 'ba5eba11-0000-4000-8000-0000000000e1'
\set l1 'ba5eba11-0000-4000-8000-0000000000d1'
\set l2 'ba5eba11-0000-4000-8000-0000000000d2'
\set l3 'ba5eba11-0000-4000-8000-0000000000d3'

begin;

delete from videos where youtube_video_id like 'practicegate-%';
delete from auth.users where email like 'practicegate-%@example.invalid';
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
select id::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'practicegate-' || name || '@example.invalid',
  crypt('password123', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb
from (values (:'uid_a', 'a'), (:'uid_b', 'b')) as u(id, name);
insert into videos (id, youtube_video_id, title, library_access) values (:'vid', 'practicegate-1', 'Practice gate lesson', 'FREE');
insert into transcripts (id, video_id, source) values (:'tid', :'vid', 'user_submitted');
insert into transcript_lines (id, transcript_id, start_time, end_time, text_jp) values
  (:'l1', :'tid', 0, 2, '今日は雨です。'), (:'l2', :'tid', 2, 4, '注文をお願いします。'), (:'l3', :'tid', 4, 6, 'ありがとうございました。');

-- Legacy rows exactly as pre-B1 code wrote them (postgres role: fixtures, not the learner).
insert into shadowing_sessions (id, user_id, video_id, transcript_line_id, recording_url, pronunciation_score, pitch_score, created_at) values
  ('ba5eba11-0000-4000-8000-000000000101', :'uid_a', :'vid', :'l1', :'uid_a' || '/shadowing/x.webm', 70, 60, now() - interval '3 days'),
  ('ba5eba11-0000-4000-8000-000000000102', :'uid_a', :'vid', :'l1', :'uid_a' || '/shadowing/y.wav', 90, null, now() - interval '2 days'),
  ('ba5eba11-0000-4000-8000-000000000103', :'uid_a', :'vid', :'l1', :'uid_a' || '/shadowing/z.wav', null, 55, now() - interval '1 day'),
  ('ba5eba11-0000-4000-8000-000000000104', :'uid_a', :'vid', :'l2', :'uid_a' || '/shadowing/w.wav', 40, null, now()),
  ('ba5eba11-0000-4000-8000-000000000105', :'uid_b', :'vid', :'l2', :'uid_b' || '/shadowing/v.wav', 99, null, now());

-- 1. Learners retain owner-only reads, but no score or session writes.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'uid_a', 'role', 'authenticated')::text, true) \g /dev/null
do $$
begin
  begin
    insert into shadowing_sessions (user_id, transcript_line_id)
      values (auth.uid(), 'ba5eba11-0000-4000-8000-0000000000d3');
    raise exception 'FAIL 1a: learner inserted a session';
  exception when insufficient_privilege then raise notice 'PASS 1a learner INSERT denied'; end;
  begin
    update shadowing_sessions set pronunciation_score = 100 where id = 'ba5eba11-0000-4000-8000-000000000104';
    raise exception 'FAIL 1b: learner updated a score';
  exception when insufficient_privilege then raise notice 'PASS 1b learner UPDATE denied'; end;
  if (select count(*) from shadowing_sessions) <> 4 then raise exception 'FAIL 1c: owner read/RLS changed'; end if;
  raise notice 'PASS 1c owner SELECT hides the other learner';
end $$;

-- 2. The scorer is server-only.
do $$
begin
  begin
    perform claim_pronunciation_scoring(auth.uid(), 'ba5eba11-0000-4000-8000-000000000103');
    raise exception 'FAIL 2: learner claimed scoring';
  exception when insufficient_privilege then raise notice 'PASS 2 learner scorer denied'; end;
end $$;
reset role;

-- 3. Expired leases rotate tokens; stale workers cannot finish or release a successor.
create temp table c1 (claim uuid);
create temp table c2 (claim uuid);
grant all on c1, c2 to service_role;
set local role service_role;
insert into c1 select claim from claim_pronunciation_scoring('ba5eba11-0000-4000-8000-00000000000a', 'ba5eba11-0000-4000-8000-000000000103');
do $$
begin
  if (select count(*) from c1) <> 1 or (select claim from c1) is null then raise exception 'FAIL 3a: first claim missing'; end if;
  if exists (select 1 from claim_pronunciation_scoring('ba5eba11-0000-4000-8000-00000000000a', 'ba5eba11-0000-4000-8000-000000000103')) then
    raise exception 'FAIL 3b: a live lease was claimed twice';
  end if;
end $$;
reset role;
update shadowing_sessions set scoring_started_at = now() - interval '91 seconds' where id = 'ba5eba11-0000-4000-8000-000000000103';
set local role service_role;
insert into c2 select claim from claim_pronunciation_scoring('ba5eba11-0000-4000-8000-00000000000a', 'ba5eba11-0000-4000-8000-000000000103');
do $$
declare r shadowing_sessions%rowtype;
begin
  if (select count(*) from c2) <> 1 or (select claim from c2) is null or (select claim from c2) = (select claim from c1) then
    raise exception 'FAIL 3c: expired lease did not rotate';
  end if;
  if finish_pronunciation_scoring('ba5eba11-0000-4000-8000-000000000103', (select claim from c1), 50, 50, '{"v":1}') is distinct from false then
    raise exception 'FAIL 3d: stale worker finished a successor lease';
  end if;
  select * into r from shadowing_sessions where id = 'ba5eba11-0000-4000-8000-000000000103';
  if r.pronunciation_score is not null or r.scoring_claim is distinct from (select claim from c2) then raise exception 'FAIL 3d: stale finish changed row'; end if;
  if release_pronunciation_scoring(r.id, (select claim from c1)) is distinct from false then raise exception 'FAIL 3e: stale worker released successor'; end if;
  if (select scoring_claim from shadowing_sessions where id = r.id) is distinct from (select claim from c2) then raise exception 'FAIL 3e: stale release changed claim'; end if;
  if finish_pronunciation_scoring(r.id, (select claim from c2), 80, 70,
      '{"v":1,"accuracy":81,"completeness":90,"recognizedText":"x","words":null}') is distinct from true then raise exception 'FAIL 3f: current worker could not finish'; end if;
  select * into r from shadowing_sessions where id = r.id;
  if r.pronunciation_score is distinct from 80::numeric or r.rhythm_score is distinct from 70::numeric
     or r.assessment->>'v' is distinct from '1' or r.scoring_claim is not null or r.scoring_started_at is not null then
    raise exception 'FAIL 3f: completion did not persist scores/assessment or clear lease';
  end if;
  if exists (select 1 from claim_pronunciation_scoring('ba5eba11-0000-4000-8000-00000000000a', r.id)) then raise exception 'FAIL 3g: scored row reclaimed'; end if;
  if exists (select 1 from claim_pronunciation_scoring('ba5eba11-0000-4000-8000-00000000000b', 'ba5eba11-0000-4000-8000-000000000104')) then raise exception 'FAIL 3h: another user claimed session'; end if;
  raise notice 'PASS 3 lease takeover, stale token refusal, immutable score, owner binding';
end $$;

-- 4. Aggregate scores use the latest scored row, while state follows the latest attempt.
set local role authenticated;
do $$
declare e jsonb := practice_stats('ba5eba11-0000-4000-8000-0000000000f1', 'pronunciation', 60); l jsonb;
begin
  if (e->>'lineCount')::int is distinct from 3 or (e->>'scoredLines')::int is distinct from 2
     or (e->>'mean')::numeric is distinct from 60::numeric or jsonb_array_length(e->'lines') is distinct from 2 then raise exception 'FAIL 4a: stats %', e; end if;
  select value into l from jsonb_array_elements(e->'lines') where value->>'lineId' = 'ba5eba11-0000-4000-8000-0000000000d1';
  if l->>'state' is distinct from 'scored' or (l->>'score')::numeric is distinct from 80::numeric then raise exception 'FAIL 4a: l1 %', l; end if;
  select value into l from jsonb_array_elements(e->'lines') where value->>'lineId' = 'ba5eba11-0000-4000-8000-0000000000d2';
  if l->>'state' is distinct from 'needs_review' or (l->>'score')::numeric is distinct from 40::numeric then raise exception 'FAIL 4a: l2 %', l; end if;
  if exists (select 1 from jsonb_array_elements(e->'lines') where value->>'lineId' = 'ba5eba11-0000-4000-8000-0000000000d3') then raise exception 'FAIL 4a: untouched l3 returned'; end if;
end $$;
reset role;
insert into shadowing_sessions (id, user_id, video_id, transcript_line_id, recording_url, created_at)
values ('ba5eba11-0000-4000-8000-000000000106', :'uid_a', :'vid', :'l1', :'uid_a' || '/shadowing/new.wav', now());
set local role authenticated;
do $$
declare e jsonb := practice_stats('ba5eba11-0000-4000-8000-0000000000f1', 'pronunciation', 60); l jsonb;
begin
  if jsonb_array_length(e->'lines') is distinct from 2 or (e->>'mean')::numeric is distinct from 60::numeric
     or (e->>'scoredLines')::int is distinct from 2 then raise exception 'FAIL 4b: newer unscored changed aggregate %', e; end if;
  select value into l from jsonb_array_elements(e->'lines') where value->>'lineId' = 'ba5eba11-0000-4000-8000-0000000000d1';
  if l->>'state' is distinct from 'unscored' or (l->>'score')::numeric is distinct from 80::numeric then raise exception 'FAIL 4b: l1 %', l; end if;
  begin
    perform practice_stats('ba5eba11-0000-4000-8000-0000000000f1', 'invalid', 60);
    raise exception 'FAIL 4c: unknown mode accepted';
  exception when invalid_parameter_value then null; end;
  raise notice 'PASS 4 latest scored values, newer unscored state, RLS, mode validation';
end $$;
reset role;

-- A successful release frees the row for a fresh token without changing its scores.
set local role service_role;
do $$
declare c uuid; d uuid;
begin
  select claim into c from claim_pronunciation_scoring('ba5eba11-0000-4000-8000-00000000000a', 'ba5eba11-0000-4000-8000-000000000106');
  if c is null or release_pronunciation_scoring('ba5eba11-0000-4000-8000-000000000106', c) is distinct from true then raise exception 'FAIL 3i: current release failed'; end if;
  select claim into d from claim_pronunciation_scoring('ba5eba11-0000-4000-8000-00000000000a', 'ba5eba11-0000-4000-8000-000000000106');
  if d is null or d = c then raise exception 'FAIL 3i: released session not reclaimable'; end if;
  perform release_pronunciation_scoring('ba5eba11-0000-4000-8000-000000000106', d);
  raise notice 'PASS 3i current release and reclaim';
end $$;
reset role;

-- 5. Assessments must be versioned JSON objects.
do $$
begin
  begin
    update shadowing_sessions set assessment = '[]' where id = 'ba5eba11-0000-4000-8000-000000000103';
    raise exception 'FAIL 5a: array assessment accepted';
  exception when check_violation then null; end;
  begin
    update shadowing_sessions set assessment = '{"x":1}' where id = 'ba5eba11-0000-4000-8000-000000000103';
    raise exception 'FAIL 5b: unversioned assessment accepted';
  exception when check_violation then null; end;
  raise notice 'PASS 5 assessment object/version constraint';
end $$;

-- 6. Reached line derives from watched position; pitch and pronunciation have independent latest rows.
set local role authenticated;
do $$
declare e jsonb := lesson_summary_evidence('ba5eba11-0000-4000-8000-0000000000f1', 2); l jsonb;
begin
  if (e->>'reachedLine')::int is distinct from 0 or e ? 'shadowedLines' then raise exception 'FAIL 6a: progress/old key %', e; end if;
  if (e->>'pronunciationMean')::numeric is distinct from 60::numeric or jsonb_array_length(e->'lines') is distinct from 2 then raise exception 'FAIL 6a: scored mean/lines %', e; end if;
  select value into l from jsonb_array_elements(e->'lines') where value->>'lineId' = 'ba5eba11-0000-4000-8000-0000000000d1';
  if (l->>'pronunciation')::numeric is distinct from 80::numeric or (l->>'pitch')::numeric is distinct from 55::numeric then raise exception 'FAIL 6a: independent latest values %', l; end if;
end $$;
reset role;
insert into user_video_progress (user_id, video_id, last_watched_position) values (:'uid_a', :'vid', 2.5)
on conflict (user_id, video_id) do update set last_watched_position = excluded.last_watched_position;
set local role authenticated;
do $$
begin
  if (lesson_summary_evidence('ba5eba11-0000-4000-8000-0000000000f1', 2)->>'reachedLine')::int is distinct from 2 then raise exception 'FAIL 6b: watched position 2.5 should reach two lines'; end if;
end $$;
reset role;
update user_video_progress set last_watched_position = 0 where user_id = :'uid_a' and video_id = :'vid';
set local role authenticated;
do $$
begin
  if (lesson_summary_evidence('ba5eba11-0000-4000-8000-0000000000f1', 2)->>'reachedLine')::int is distinct from 0 then raise exception 'FAIL 6c: position zero reached a line'; end if;
  raise notice 'PASS 6 reachedLine and independent latest scored/pitch evidence';
end $$;

-- 7. Dashboard activity counts distinct practised lines, not attempts.
do $$
declare n int;
begin
  select outcomes into n from practice_activity(now() - interval '7 days') where type = 'shadow_lines';
  if n is distinct from 2 then raise exception 'FAIL 7: shadow_lines % instead of 2', n; end if;
  raise notice 'PASS 7 practice activity counts distinct lines';
end $$;
reset role;

-- 8. Explicit grants and pinned definer search paths.
do $$
declare fn text;
begin
  if has_function_privilege('anon', 'practice_stats(uuid,text,numeric)', 'execute')
     or not has_function_privilege('authenticated', 'practice_stats(uuid,text,numeric)', 'execute') then raise exception 'FAIL 8: stats grants'; end if;
  foreach fn in array array['claim_pronunciation_scoring(uuid,uuid)', 'finish_pronunciation_scoring(uuid,uuid,numeric,numeric,jsonb)', 'release_pronunciation_scoring(uuid,uuid)'] loop
    if has_function_privilege('authenticated', fn, 'execute') or has_function_privilege('anon', fn, 'execute')
       or not has_function_privilege('service_role', fn, 'execute') then raise exception 'FAIL 8: scoring grants %', fn; end if;
    if not exists (select 1 from pg_proc where oid = fn::regprocedure and prosecdef and 'search_path=public' = any(proconfig)) then raise exception 'FAIL 8: definer search_path %', fn; end if;
  end loop;
  raise notice 'PASS 8 grants and pinned search_path';
end $$;

-- Nothing persists, even scoring fixture updates; a failed run rolls its transaction back on disconnect.
rollback;
delete from videos where youtube_video_id like 'practicegate-%';
delete from auth.users where email like 'practicegate-%@example.invalid';
