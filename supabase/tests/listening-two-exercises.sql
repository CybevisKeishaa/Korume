\set ON_ERROR_STOP on
-- verify:db:listening, migration 049 (spec 2026-10-26 listening-cloze-dictation §3.6, §3.10). Gate rows: users
-- 'listen2gate-*', videos 'listen2gate-*'. Learner A drives practice_stats; learner B drives Summary, missions and the
-- Dashboard skill reads. Fixture ids are fixed so learner blocks can name them literally.
\set uid_a '10ad0049-0000-4000-8000-00000000000a'
\set uid_b '10ad0049-0000-4000-8000-00000000000b'
\set vid '10ad0049-0000-4000-8000-0000000000f1'
\set tid '10ad0049-0000-4000-8000-0000000000e1'
\set l1 '10ad0049-0000-4000-8000-0000000000d1'
\set l2 '10ad0049-0000-4000-8000-0000000000d2'
\set l3 '10ad0049-0000-4000-8000-0000000000d3'
\set l4 '10ad0049-0000-4000-8000-0000000000d4'

-- A previous run that died halfway leaves its rows: clean up on the way in (L-017).
delete from videos where youtube_video_id like 'listen2gate-%';
delete from auth.users where email like 'listen2gate-%@example.invalid';

begin;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
select id::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'listen2gate-' || name || '@example.invalid',
  crypt('password123', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb
from (values (:'uid_a', 'a'), (:'uid_b', 'b')) as u(id, name);
insert into videos (id, youtube_video_id, title, library_access) values (:'vid', 'listen2gate-1', 'Listening 049 gate lesson', 'FREE');
insert into transcripts (id, video_id, source) values (:'tid', :'vid', 'user_submitted');
insert into transcript_lines (id, transcript_id, start_time, end_time, text_jp) values
  (:'l1', :'tid', 0, 2, '今日は雨です。'), (:'l2', :'tid', 2, 4, '注文をお願いします。'),
  (:'l3', :'tid', 4, 6, '泣いて勉強した。'), (:'l4', :'tid', 6, 8, 'ありがとうございました。');

-- Attempts are written by the server (postgres here). Times are relative to the transaction's now().
-- A, l1: an unhelped typing 90, then a later Word Bank 95 (easy mode = helped). A, l3: one cloze 70.
insert into dictation_attempts (id, user_id, video_id, transcript_line_id, user_input, accuracy_score, format, status,
                                easy_mode, hint_unit, hinted_units, chunk_order, cloze_selector_version, cloze_blanks, cloze_answers, created_at) values
  ('10ad0049-0000-4000-8000-000000000101', :'uid_a', :'vid', :'l1', '今日は雨です', 90, 'typing', 'submitted', false, null, '{}', null, null, null, null, now() - interval '3 days'),
  ('10ad0049-0000-4000-8000-000000000102', :'uid_a', :'vid', :'l1', '今日は雨です', 95, 'word_bank', 'submitted', true, null, '{}', '{0,1}', null, null, null, now() - interval '2 days'),
  ('10ad0049-0000-4000-8000-000000000103', :'uid_a', :'vid', :'l3', 'べんきょう', 70, 'cloze', 'submitted', false, null, '{}', null, 1, '{2}', '{べんきょう}', now() - interval '1 day'),
-- B: unhelped typing 80 (l1), typing 100 with one hinted unit (l2), cloze 60 (l3), a revealed Word Bank (l4, newest).
  ('10ad0049-0000-4000-8000-000000000201', :'uid_b', :'vid', :'l1', '今日は雨です', 80, 'typing', 'submitted', false, null, '{}', null, null, null, null, now() - interval '3 days'),
  ('10ad0049-0000-4000-8000-000000000202', :'uid_b', :'vid', :'l2', '注文をお願いします', 100, 'typing', 'submitted', false, 'grapheme1', '{0}', null, null, null, null, now() - interval '2 days'),
  ('10ad0049-0000-4000-8000-000000000203', :'uid_b', :'vid', :'l3', '勉強', 60, 'cloze', 'submitted', false, null, '{}', null, 1, '{2}', '{勉強}', now() - interval '1 day'),
  ('10ad0049-0000-4000-8000-000000000204', :'uid_b', :'vid', :'l4', '', null, 'word_bank', 'revealed', true, null, '{}', null, null, null, null, now() - interval '1 hour');

-- 1. Columns and checks: cloze rows carry selector + blanks (+ answers unless revealed); Word Bank is always easy mode.
do $$
declare a uuid := '10ad0049-0000-4000-8000-00000000000a'; l uuid := '10ad0049-0000-4000-8000-0000000000d3';
begin
  if (select format || '|' || cloze_blanks::text || '|' || cloze_answers::text from dictation_attempts
      where id = '10ad0049-0000-4000-8000-000000000103') is distinct from 'cloze|{2}|{べんきょう}' then
    raise exception 'FAIL 1a: cloze row not stored';
  end if;
  insert into dictation_attempts (id, user_id, transcript_line_id, user_input, accuracy_score, format, status, cloze_selector_version, cloze_blanks)
    values ('10ad0049-0000-4000-8000-000000000301', a, l, '', null, 'cloze', 'revealed', 1, '{2}');
  delete from dictation_attempts where id = '10ad0049-0000-4000-8000-000000000301';
  begin
    insert into dictation_attempts (user_id, transcript_line_id, user_input, accuracy_score, format, status, cloze_selector_version, cloze_answers)
      values (a, l, 'x', 50, 'cloze', 'submitted', 1, '{x}');
    raise exception 'FAIL 1b: cloze without cloze_blanks accepted';
  exception when check_violation then null; end;
  begin
    insert into dictation_attempts (user_id, transcript_line_id, user_input, accuracy_score, format, status, cloze_selector_version, cloze_blanks)
      values (a, l, 'x', 50, 'cloze', 'submitted', 1, '{2}');
    raise exception 'FAIL 1c: submitted cloze without cloze_answers accepted';
  exception when check_violation then null; end;
  begin
    insert into dictation_attempts (user_id, transcript_line_id, user_input, accuracy_score, format, status, cloze_selector_version, cloze_blanks)
      values (a, l, 'x', 50, 'typing', 'submitted', 1, '{2}');
    raise exception 'FAIL 1d: typing row with cloze columns accepted';
  exception when check_violation then null; end;
  begin
    insert into dictation_attempts (user_id, transcript_line_id, user_input, accuracy_score, format, status, chunk_order, easy_mode)
      values (a, l, 'x', 50, 'word_bank', 'submitted', '{0}', false);
    raise exception 'FAIL 1e: word_bank without easy_mode accepted';
  exception when check_violation then null; end;
  raise notice 'PASS 1 cloze columns, cloze/word_bank checks, grapheme1 hint unit';
end $$;

-- 2. One definition of helped.
do $$
begin
  if dictation_attempt_helped(false, '{}') is distinct from false or dictation_attempt_helped(true, '{}') is distinct from true
     or dictation_attempt_helped(false, '{1}') is distinct from true then
    raise exception 'FAIL 2: dictation_attempt_helped table';
  end if;
  raise notice 'PASS 2 dictation_attempt_helped';
end $$;

-- 3. practice_stats: dictation = typing + word_bank, latest submitted across both; cloze alone; old modes refused.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'uid_a', 'role', 'authenticated')::text, true) \g /dev/null
do $$
declare e jsonb; l jsonb;
begin
  e := practice_stats('10ad0049-0000-4000-8000-0000000000f1', 'dictation', 80);
  if (e->>'lineCount')::int is distinct from 4 or (e->>'scoredLines')::int is distinct from 1 or (e->>'mean')::numeric is distinct from 95
     or (e->>'helpedLines')::int is distinct from 1 or jsonb_array_length(e->'lines') is distinct from 1 then
    raise exception 'FAIL 3a: dictation stats %', e;
  end if;
  l := e->'lines'->0;
  if l->>'lineId' is distinct from '10ad0049-0000-4000-8000-0000000000d1' or l->>'state' is distinct from 'helped'
     or (l->>'score')::numeric is distinct from 95 then raise exception 'FAIL 3a: dictation l1 %', l; end if;
  e := practice_stats('10ad0049-0000-4000-8000-0000000000f1', 'cloze', 80);
  if (e->>'scoredLines')::int is distinct from 1 or (e->>'mean')::numeric is distinct from 70 or (e->>'helpedLines')::int is distinct from 0
     or e->'lines' is distinct from '[{"lineId":"10ad0049-0000-4000-8000-0000000000d3","state":"needs_review","score":70}]'::jsonb then
    raise exception 'FAIL 3b: cloze stats %', e;
  end if;
  begin
    perform practice_stats('10ad0049-0000-4000-8000-0000000000f1', 'typing', 80);
    raise exception 'FAIL 3c: mode typing accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform practice_stats('10ad0049-0000-4000-8000-0000000000f1', 'word_bank', 80);
    raise exception 'FAIL 3c: mode word_bank accepted';
  exception when invalid_parameter_value then null; end;
  raise notice 'PASS 3 practice_stats dictation/cloze, helped state, old modes refused';
end $$;
reset role;

-- 4. needs_review wins over helped: a helped typing row scoring 50 below the threshold.
insert into dictation_attempts (user_id, video_id, transcript_line_id, user_input, accuracy_score, format, status, hint_unit, hinted_units, created_at)
  values (:'uid_a', :'vid', :'l2', '注文', 50, 'typing', 'submitted', 'grapheme1', '{0,1}', now() - interval '1 hour');
set local role authenticated;
do $$
declare e jsonb := practice_stats('10ad0049-0000-4000-8000-0000000000f1', 'dictation', 80); l jsonb;
begin
  select value into l from jsonb_array_elements(e->'lines') where value->>'lineId' = '10ad0049-0000-4000-8000-0000000000d2';
  if l->>'state' is distinct from 'needs_review' or (l->>'score')::numeric is distinct from 50
     or (e->>'helpedLines')::int is distinct from 2 then raise exception 'FAIL 4: helped 50 %, stats %', l, e; end if;
  raise notice 'PASS 4 needs_review wins over helped';
end $$;

-- 5. Summary: Chép chính tả and Điền từ are two rows {mean, done, selfDone}; per-line items carry helped.
select set_config('request.jwt.claims', json_build_object('sub', :'uid_b', 'role', 'authenticated')::text, true) \g /dev/null
do $$
declare e jsonb := lesson_summary_evidence('10ad0049-0000-4000-8000-0000000000f1', 2); l jsonb;
begin
  if e ? 'wordBankMean' or e ? 'typingMean' then raise exception 'FAIL 5: per-format means still present %', e; end if;
  if e->'dictation' is distinct from '{"mean":90,"done":2,"selfDone":1}'::jsonb then raise exception 'FAIL 5: dictation %', e->'dictation'; end if;
  if e->'cloze' is distinct from '{"mean":60,"done":1,"selfDone":1}'::jsonb then raise exception 'FAIL 5: cloze %', e->'cloze'; end if;
  select value into l from jsonb_array_elements(e->'lines') where value->>'lineId' = '10ad0049-0000-4000-8000-0000000000d1';
  if l->'listening' is distinct from '[{"format":"typing","status":"submitted","score":80,"input":"今日は雨です","helped":false}]'::jsonb then
    raise exception 'FAIL 5: l1 %', l; end if;
  select value into l from jsonb_array_elements(e->'lines') where value->>'lineId' = '10ad0049-0000-4000-8000-0000000000d2';
  if l->'listening' is distinct from '[{"format":"typing","status":"submitted","score":100,"input":"注文をお願いします","helped":true}]'::jsonb then
    raise exception 'FAIL 5: l2 %', l; end if;
  select value into l from jsonb_array_elements(e->'lines') where value->>'lineId' = '10ad0049-0000-4000-8000-0000000000d3';
  if l->'listening' is distinct from '[{"format":"cloze","status":"submitted","score":60,"input":"勉強","helped":false}]'::jsonb then
    raise exception 'FAIL 5: l3 %', l; end if;
  raise notice 'PASS 5 summary rows dictation/cloze, helped per line';
end $$;

-- 6. Missions count the cloze line; the revealed Word Bank (newest) never counts nor moves last_at.
do $$
declare r record;
begin
  select * into r from practice_activity(now() - interval '7 days') where type = 'dictation_lines';
  if r.outcomes is distinct from 3 or r.last_at is distinct from now() - interval '1 day' then
    raise exception 'FAIL 6: dictation_lines % last_at %', r.outcomes, r.last_at;
  end if;
  raise notice 'PASS 6 practice_activity counts cloze, not revealed';
end $$;

-- 7. Dashboard Listening = typed without help only: the hinted 100 and the cloze 60 are not evidence.
do $$
declare s record;
begin
  select * into s from weekly_skill_windows('UTC', current_date - 13, current_date - 6, current_date + 1) where skill = 'listening';
  if not found or s.win <> 0 or s.attempts <> 1 or s.mean <> 80 then raise exception 'FAIL 7a: weekly listening %', s; end if;
  select * into s from weakness_scores('UTC', 30) where family = 'listening' and metric = 'accuracy';
  if not found or s.attempts <> 1 or s.score <> 80 then raise exception 'FAIL 7b: weakness listening %', s; end if;
  raise notice 'PASS 7 dashboard reads unhelped typing only';
end $$;
reset role;

-- 8. helped is callable by authenticated only.
do $$
begin
  if has_function_privilege('anon', 'dictation_attempt_helped(boolean,integer[])', 'execute')
     or not has_function_privilege('authenticated', 'dictation_attempt_helped(boolean,integer[])', 'execute') then
    raise exception 'FAIL 8: dictation_attempt_helped grants';
  end if;
  raise notice 'PASS 8 helped grants';
end $$;

rollback;
delete from videos where youtube_video_id like 'listen2gate-%';
delete from auth.users where email like 'listen2gate-%@example.invalid';
