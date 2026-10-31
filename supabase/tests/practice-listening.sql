\set ON_ERROR_STOP on
-- verify:db:listening (spec 2026-10-15 shadowing-practice-modes §5.3, §6.2, §7, §7.1). Gate rows: users
-- 'listengate-*', videos 'listengate-*'. Fixture ids are fixed so learner blocks can name them literally.
\set uid_a '1157e000-0000-4000-8000-00000000000a'
\set uid_b '1157e000-0000-4000-8000-00000000000b'
\set vid '1157e000-0000-4000-8000-0000000000f1'
\set tid '1157e000-0000-4000-8000-0000000000e1'
\set l1 '1157e000-0000-4000-8000-0000000000d1'
\set l2 '1157e000-0000-4000-8000-0000000000d2'
\set l3 '1157e000-0000-4000-8000-0000000000d3'

-- A previous run that died halfway leaves its rows: clean up on the way in (L-017).
delete from videos where youtube_video_id like 'listengate-%';
delete from auth.users where email like 'listengate-%@example.invalid';

begin;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
select id::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'listengate-' || name || '@example.invalid',
  crypt('password123', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb
from (values (:'uid_a', 'a'), (:'uid_b', 'b')) as u(id, name);
insert into videos (id, youtube_video_id, title, library_access) values (:'vid', 'listengate-1', 'Listening gate lesson', 'FREE');
insert into transcripts (id, video_id, source) values (:'tid', :'vid', 'user_submitted');
insert into transcript_lines (id, transcript_id, start_time, end_time, text_jp) values
  (:'l1', :'tid', 0, 2, '今日は雨です。'), (:'l2', :'tid', 2, 4, '注文をお願いします。'), (:'l3', :'tid', 4, 6, 'ありがとうございました。');

-- Attempts are written by the server (postgres here), never by the learner. Times are relative to the transaction's
-- now(), so every comparison below is exact. Newest of A's rows is the revealed one, which must not move last_at.
-- Since 049 every Word Bank row is easy mode.
insert into dictation_attempts (id, user_id, video_id, transcript_line_id, user_input, accuracy_score, format, status, chunk_order, easy_mode, created_at) values
  ('1157e000-0000-4000-8000-000000000101', :'uid_a', :'vid', :'l1', '今日は雨です', 95, 'typing', 'submitted', null, false, now() - interval '3 days'),
  ('1157e000-0000-4000-8000-000000000102', :'uid_a', :'vid', :'l2', 'ちゅうもん', 70, 'typing', 'submitted', null, false, now() - interval '2 days'),
  ('1157e000-0000-4000-8000-000000000103', :'uid_a', :'vid', :'l2', '注文をお願いします', 90, 'word_bank', 'submitted', '{1,0}', true, now() - interval '1 day'),
  ('1157e000-0000-4000-8000-000000000104', :'uid_a', :'vid', :'l1', '', null, 'typing', 'revealed', null, false, now() - interval '1 hour'),
  ('1157e000-0000-4000-8000-000000000105', :'uid_b', :'vid', :'l2', 'b', 99, 'typing', 'submitted', null, false, now() - interval '1 hour');
-- A legacy unscored row can only exist from the backfill; the trigger is lifted for this one fixture row only,
-- inside the transaction, so a failed run restores it on rollback.
alter table dictation_attempts disable trigger dictation_attempts_no_new_unscored;
insert into dictation_attempts (id, user_id, video_id, transcript_line_id, user_input, accuracy_score, format, status, created_at) values
  ('1157e000-0000-4000-8000-000000000106', :'uid_a', :'vid', :'l3', 'ありがとう', null, 'typing', 'unscored', now() - interval '4 days');
alter table dictation_attempts enable trigger dictation_attempts_no_new_unscored;

-- 1. D25: learners keep owner-only reads but cannot write attempts.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'uid_a', 'role', 'authenticated')::text, true) \g /dev/null
do $$
begin
  begin
    insert into dictation_attempts (user_id, user_input, accuracy_score, format, status)
      values (auth.uid(), 'x', 50, 'typing', 'submitted');
    raise exception 'FAIL 1a: learner inserted an attempt';
  exception when insufficient_privilege then raise notice 'PASS 1a learner INSERT denied'; end;
  begin
    update dictation_attempts set accuracy_score = 100 where id = '1157e000-0000-4000-8000-000000000102';
    raise exception 'FAIL 1b: learner updated a score';
  exception when insufficient_privilege then raise notice 'PASS 1b learner UPDATE denied'; end;
  if (select count(*) from dictation_attempts) <> 5 then raise exception 'FAIL 1c: owner read/RLS changed'; end if;
  raise notice 'PASS 1c owner SELECT hides the other learner';
end $$;
reset role;

-- 2. D21 backfill, run on a copy of the table shape holding one scored and one unscored legacy row. The statement
-- is the migration's own (pinned in 20261021000048_practice_listening.test.ts).
create temp table legacy_copy (like dictation_attempts including defaults);
alter table legacy_copy alter column format drop not null, alter column status drop not null;
insert into legacy_copy (id, user_id, user_input, accuracy_score, created_at) values
  ('1157e000-0000-4000-8000-000000000201', :'uid_a', 'scored', 55, now()),
  ('1157e000-0000-4000-8000-000000000202', :'uid_a', 'unscored', null, now());
update legacy_copy
   set format = 'typing', status = case when accuracy_score is null then 'unscored' else 'submitted' end;
do $$
begin
  if (select array_agg(format || '/' || status order by id) from legacy_copy) is distinct from array['typing/submitted', 'typing/unscored'] then
    raise exception 'FAIL 2: backfill gave %', (select array_agg(format || '/' || status order by id) from legacy_copy);
  end if;
  raise notice 'PASS 2 backfill: scored -> typing/submitted, unscored -> typing/unscored';
end $$;

-- 3. Checks: submitted iff scored; Word Bank needs an arrangement unless the answer was shown.
do $$
declare a uuid := '1157e000-0000-4000-8000-00000000000a'; l uuid := '1157e000-0000-4000-8000-0000000000d1';
begin
  begin
    insert into dictation_attempts (user_id, transcript_line_id, user_input, accuracy_score, format, status) values (a, l, 'x', null, 'typing', 'submitted');
    raise exception 'FAIL 3a: submitted without a score accepted';
  exception when check_violation then null; end;
  begin
    insert into dictation_attempts (user_id, transcript_line_id, user_input, accuracy_score, format, status) values (a, l, 'x', 10, 'typing', 'revealed');
    raise exception 'FAIL 3b: revealed with a score accepted';
  exception when check_violation then null; end;
  begin
    insert into dictation_attempts (user_id, transcript_line_id, user_input, accuracy_score, format, status, chunk_order, easy_mode) values (a, l, 'x', 10, 'word_bank', 'submitted', null, true);
    raise exception 'FAIL 3c: submitted Word Bank without chunk_order accepted';
  exception when check_violation then null; end;
  insert into dictation_attempts (id, user_id, transcript_line_id, user_input, accuracy_score, format, status, chunk_order, easy_mode)
    values ('1157e000-0000-4000-8000-000000000301', a, l, '', null, 'word_bank', 'revealed', null, true);
  delete from dictation_attempts where id = '1157e000-0000-4000-8000-000000000301';
  raise notice 'PASS 3 score/status and word_bank/chunk_order checks';
end $$;

-- 4. unscored is legacy-only: never inserted, never reached by update; a legacy row stays readable and editable.
do $$
declare a uuid := '1157e000-0000-4000-8000-00000000000a'; l uuid := '1157e000-0000-4000-8000-0000000000d3';
begin
  begin
    insert into dictation_attempts (user_id, transcript_line_id, user_input, accuracy_score, format, status) values (a, l, 'x', null, 'typing', 'unscored');
    raise exception 'FAIL 4a: a new unscored attempt was inserted';
  exception when check_violation then null; end;
  begin
    update dictation_attempts set status = 'unscored', accuracy_score = null where id = '1157e000-0000-4000-8000-000000000102';
    raise exception 'FAIL 4b: a submitted attempt was turned into unscored';
  exception when check_violation then null; end;
  update dictation_attempts set user_input = 'ありがとう!' where id = '1157e000-0000-4000-8000-000000000106';
  if (select status || '|' || user_input from dictation_attempts where id = '1157e000-0000-4000-8000-000000000106') is distinct from 'unscored|ありがとう!' then
    raise exception 'FAIL 4c: legacy unscored row not readable/updatable';
  end if;
  raise notice 'PASS 4 unscored trigger: insert and update-into refused, legacy row kept';
end $$;

-- 5. practice_stats Chép chính tả (049): typing + word_bank, score = latest submitted across both (R1), state = latest
-- of any status across both (R2). The later Word Bank 90 is easy mode, so l2 reads helped.
set local role authenticated;
do $$
declare e jsonb; l jsonb;
begin
  e := practice_stats('1157e000-0000-4000-8000-0000000000f1', 'dictation', 80);
  if (e->>'lineCount')::int is distinct from 3 or (e->>'scoredLines')::int is distinct from 2 or (e->>'helpedLines')::int is distinct from 1
     or (e->>'mean')::numeric is distinct from 92.5 or jsonb_array_length(e->'lines') is distinct from 3 then raise exception 'FAIL 5a: dictation stats %', e; end if;
  select value into l from jsonb_array_elements(e->'lines') where value->>'lineId' = '1157e000-0000-4000-8000-0000000000d1';
  if l->>'state' is distinct from 'revealed' or (l->>'score')::numeric is distinct from 95 then raise exception 'FAIL 5a: dictation l1 %', l; end if;
  select value into l from jsonb_array_elements(e->'lines') where value->>'lineId' = '1157e000-0000-4000-8000-0000000000d2';
  if l->>'state' is distinct from 'helped' or (l->>'score')::numeric is distinct from 90 then raise exception 'FAIL 5a: dictation l2 %', l; end if;
  select value into l from jsonb_array_elements(e->'lines') where value->>'lineId' = '1157e000-0000-4000-8000-0000000000d3';
  if l->>'state' is distinct from 'unscored' or jsonb_typeof(l->'score') is distinct from 'null' then raise exception 'FAIL 5a: dictation l3 %', l; end if;
  begin
    perform practice_stats('1157e000-0000-4000-8000-0000000000f1', 'listening', 80);
    raise exception 'FAIL 5c: mode listening accepted';
  exception when invalid_parameter_value then null; end;
  raise notice 'PASS 5 practice_stats dictation across formats, B invisible, unknown mode refused';
end $$;

-- 6. Summary evidence: the Chép chính tả row over each line's latest submitted (R1, 049), the latest attempt of any
-- status per format per line (R2).
do $$
declare e jsonb := lesson_summary_evidence('1157e000-0000-4000-8000-0000000000f1', 2); l jsonb;
begin
  if e ? 'dictationMean' or e ? 'typingMean' or e ? 'wordBankMean' then raise exception 'FAIL 6: old means still present %', e; end if;
  if e->'dictation' is distinct from '{"mean":92.5,"done":2,"selfDone":1}'::jsonb
     or e->'cloze' is distinct from '{"mean":null,"done":0,"selfDone":0}'::jsonb then
    raise exception 'FAIL 6: dictation % cloze %', e->'dictation', e->'cloze';
  end if;
  select value into l from jsonb_array_elements(e->'lines') where value->>'lineId' = '1157e000-0000-4000-8000-0000000000d1';
  if l ? 'dictation' or l ? 'dictationInput'
     or l->'listening' is distinct from '[{"format":"typing","status":"revealed","score":null,"input":"","helped":false}]'::jsonb then
    raise exception 'FAIL 6: l1 %', l;
  end if;
  select value into l from jsonb_array_elements(e->'lines') where value->>'lineId' = '1157e000-0000-4000-8000-0000000000d2';
  if l->'listening' is distinct from '[{"format":"typing","status":"submitted","score":70,"input":"ちゅうもん","helped":false},
                                        {"format":"word_bank","status":"submitted","score":90,"input":"注文をお願いします","helped":true}]'::jsonb then
    raise exception 'FAIL 6: l2 %', l;
  end if;
  select value into l from jsonb_array_elements(e->'lines') where value->>'lineId' = '1157e000-0000-4000-8000-0000000000d3';
  if l->'listening' is distinct from '[{"format":"typing","status":"unscored","score":null,"input":"ありがとう!","helped":false}]'::jsonb then
    raise exception 'FAIL 6: l3 %', l;
  end if;
  raise notice 'PASS 6 summary evidence per format';
end $$;

-- 7. Dashboard Listening is Typing, submitted only (D20): the Word Bank 90 is not evidence there.
do $$
declare s record;
begin
  select * into s from weekly_skill_windows('UTC', current_date - 13, current_date - 6, current_date + 1) where skill = 'listening';
  if not found or s.win <> 0 or s.attempts <> 2 or s.mean <> 82.5 then raise exception 'FAIL 7a: weekly listening %', s; end if;
  select * into s from weakness_scores('UTC', 30) where family = 'listening' and metric = 'accuracy';
  if not found or s.attempts <> 2 or s.score <> 82.5 then raise exception 'FAIL 7b: weakness listening %', s; end if;
  raise notice 'PASS 7 dashboard reads typing submitted only';
end $$;

-- 8. Mission: distinct lines with a submitted attempt, both formats (P9); revealed and unscored never count.
do $$
declare r record;
begin
  select * into r from practice_activity(now() - interval '7 days') where type = 'dictation_lines';
  if r.outcomes is distinct from 2 then raise exception 'FAIL 8: dictation_lines % instead of 2', r.outcomes; end if;
  if r.last_at is distinct from now() - interval '1 day' or r.last_video_id is distinct from '1157e000-0000-4000-8000-0000000000f1' then
    raise exception 'FAIL 8: last_at/last_video_id % / % must come from the latest submitted row', r.last_at, r.last_video_id;
  end if;
  raise notice 'PASS 8 practice_activity counts distinct submitted lines';
end $$;
reset role;

-- 9. Read functions: authenticated only.
do $$
declare fn text;
begin
  foreach fn in array array['practice_stats(uuid,text,numeric)', 'lesson_summary_evidence(uuid,integer)',
                            'weekly_skill_windows(text,date,date,date)', 'weakness_scores(text,integer)',
                            'practice_activity(timestamp with time zone)'] loop
    if has_function_privilege('anon', fn, 'execute') or not has_function_privilege('authenticated', fn, 'execute') then
      raise exception 'FAIL 9: grants %', fn;
    end if;
  end loop;
  raise notice 'PASS 9 read-function grants';
end $$;

rollback;
delete from videos where youtube_video_id like 'listengate-%';
delete from auth.users where email like 'listengate-%@example.invalid';
