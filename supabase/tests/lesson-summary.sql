\set ON_ERROR_STOP on

-- Single-session cases of verify:db:summary (spec 2026-10-04 summary-analysis §3, §5.5, §6). The multi-connection
-- race cases live in supabase/tests/lesson-summary-race/. Gate rows: users 'summarygate-*', videos
-- 'summarygate-*', fingerprints 'sgate-*'. Fixture ids are fixed so learner blocks can name them literally.

\set uid_a '5ca1ab1e-0000-4000-8000-00000000000a'
\set uid_b '5ca1ab1e-0000-4000-8000-00000000000b'

delete from lesson_reflections where analysis_fingerprint like 'sgate-%';
delete from videos where youtube_video_id like 'summarygate-%';
delete from auth.users where email like 'summarygate-%@example.invalid';

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
select id::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'summarygate-' || name || '@example.invalid', crypt('password123', gen_salt('bf')), now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb
from (values (:'uid_a', 'a'), (:'uid_b', 'b')) as u(id, name);

-- V1: the lesson (two real lines and one whitespace-only line). V2: another lesson, for the cross-lesson target.
insert into videos (id, youtube_video_id, title, library_access) values
  ('5ca1ab1e-0000-4000-8000-0000000000f1', 'summarygate-1', 'Summary gate lesson', 'FREE'),
  ('5ca1ab1e-0000-4000-8000-0000000000f2', 'summarygate-2', 'Summary gate other lesson', 'FREE');
insert into transcripts (id, video_id, source) values
  ('5ca1ab1e-0000-4000-8000-0000000000e1', '5ca1ab1e-0000-4000-8000-0000000000f1', 'user_submitted'),
  ('5ca1ab1e-0000-4000-8000-0000000000e2', '5ca1ab1e-0000-4000-8000-0000000000f2', 'user_submitted');
insert into transcript_lines (id, transcript_id, start_time, end_time, text_jp) values
  ('5ca1ab1e-0000-4000-8000-0000000000d1', '5ca1ab1e-0000-4000-8000-0000000000e1', 0, 2, '今日は雨です。'),
  ('5ca1ab1e-0000-4000-8000-0000000000d2', '5ca1ab1e-0000-4000-8000-0000000000e1', 2, 4, '注文をお願いします。'),
  ('5ca1ab1e-0000-4000-8000-0000000000d3', '5ca1ab1e-0000-4000-8000-0000000000e1', 4, 5, '   '),
  ('5ca1ab1e-0000-4000-8000-0000000000d4', '5ca1ab1e-0000-4000-8000-0000000000e2', 0, 2, '別の授業です。');

create or replace function pg_temp.sgate_key(p_fp text) returns jsonb language sql as $$
  select jsonb_build_object('videoId', '5ca1ab1e-0000-4000-8000-0000000000f1', 'locale', 'vi',
    'analysisFingerprint', p_fp, 'evidenceFingerprint', 'sgate-evidence', 'schemaVersion', 1, 'generatorVersion', 1)
$$;

-- 1. A learner with nothing on the lesson: whitespace line excluded, no division by zero, empty arrays.
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'uid_a', 'role', 'authenticated')::text, true) \g /dev/null
do $$
declare e jsonb := lesson_summary_evidence('5ca1ab1e-0000-4000-8000-0000000000f1', 2);
begin
  if (e->>'hasTranscript')::boolean is not true then raise exception 'FAIL 1: hasTranscript is %', e->'hasTranscript'; end if;
  if (e->>'lineCount')::int <> 2 then raise exception 'FAIL 1: lineCount % (whitespace line must not count)', e->'lineCount'; end if;
  if (e->>'shadowedLines')::int <> 0 then raise exception 'FAIL 1: shadowedLines %', e->'shadowedLines'; end if;
  if jsonb_typeof(e->'pronunciationMean') <> 'null' or jsonb_typeof(e->'dictationMean') <> 'null' then
    raise exception 'FAIL 1: means must be null, got % / %', e->'pronunciationMean', e->'dictationMean';
  end if;
  if (e->'cards'->>'total')::int <> 0 or e->'lines' <> '[]'::jsonb or e->'saved' <> '[]'::jsonb then
    raise exception 'FAIL 1: expected no cards, lines or saved, got %', e;
  end if;
  raise notice 'PASS 1 empty learner evidence';
end $$;
commit;

-- 2 + 3. Sessions: B's row is invisible to A; the mean is over A's raw values; per-line score is the latest.
insert into shadowing_sessions (user_id, transcript_line_id, pronunciation_score, pitch_score, created_at) values
  (:'uid_a', '5ca1ab1e-0000-4000-8000-0000000000d1', 55.5, 40, now() - interval '2 hours'),
  (:'uid_a', '5ca1ab1e-0000-4000-8000-0000000000d1', 60.0, 45, now() - interval '1 hour'),
  (:'uid_b', '5ca1ab1e-0000-4000-8000-0000000000d1', 99.0, 99, now());
insert into dictation_attempts (user_id, transcript_line_id, accuracy_score, user_input) values
  (:'uid_a', '5ca1ab1e-0000-4000-8000-0000000000d2', 70, 'ちゅうもんをおねがいします');
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'uid_a', 'role', 'authenticated')::text, true) \g /dev/null
do $$
declare e jsonb := lesson_summary_evidence('5ca1ab1e-0000-4000-8000-0000000000f1', 2); l jsonb;
begin
  if (e->>'pronunciationMean')::numeric <> 57.75 then
    raise exception 'FAIL 2/3: pronunciationMean % (expected 57.75 from A only; B''s 99 must be invisible)', e->'pronunciationMean';
  end if;
  raise notice 'PASS 2 another learner''s sessions are invisible';
  if (e->>'shadowedLines')::int <> 1 then raise exception 'FAIL 3: shadowedLines %', e->'shadowedLines'; end if;
  select value into l from jsonb_array_elements(e->'lines') where value->>'lineId' = '5ca1ab1e-0000-4000-8000-0000000000d1';
  if (l->>'pronunciation')::numeric <> 60.0 or (l->>'pitch')::numeric <> 45 then
    raise exception 'FAIL 3: line 1 must carry the LATEST session (60 / 45), got %', l;
  end if;
  select value into l from jsonb_array_elements(e->'lines') where value->>'lineId' = '5ca1ab1e-0000-4000-8000-0000000000d2';
  if (l->>'dictation')::numeric <> 70 or l->>'dictationInput' <> 'ちゅうもんをおねがいします' then
    raise exception 'FAIL 3: line 2 dictation evidence wrong: %', l;
  end if;
  raise notice 'PASS 3 raw mean and latest-per-line scores';
end $$;
commit;

-- 4. Saved counts by distinct source_ref; a card whose line was deleted still counts and is absent from `saved`.
insert into sentence_mining_cards (user_id, video_id, transcript_line_id, target_word, sentence_jp, source_kind, source_ref, srs_stage) values
  (:'uid_a', '5ca1ab1e-0000-4000-8000-0000000000f1', '5ca1ab1e-0000-4000-8000-0000000000d2', '注文', 'x', 'selection', '注文', 0),
  (:'uid_a', '5ca1ab1e-0000-4000-8000-0000000000f1', '5ca1ab1e-0000-4000-8000-0000000000d2', '注文', 'x', 'selection', '注文', 0),
  (:'uid_a', '5ca1ab1e-0000-4000-8000-0000000000f1', '5ca1ab1e-0000-4000-8000-0000000000d2', '注文', 'x', 'vocabulary', '注文', 3),
  (:'uid_a', '5ca1ab1e-0000-4000-8000-0000000000f1', null, '傘', 'x', 'vocabulary', '傘', 0);
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'uid_a', 'role', 'authenticated')::text, true) \g /dev/null
do $$
declare e jsonb := lesson_summary_evidence('5ca1ab1e-0000-4000-8000-0000000000f1', 2);
begin
  if (e->'cards'->>'vocabularyRefs')::int <> 2 then
    raise exception 'FAIL 4: vocabularyRefs % (注文 once across selection + vocabulary, plus the orphaned 傘)', e->'cards'->'vocabularyRefs';
  end if;
  if (e->'cards'->>'total')::int <> 4 or (e->'cards'->>'mastered')::int <> 1 or (e->'cards'->>'knowledgeRemembered')::int <> 1 then
    raise exception 'FAIL 4: card totals wrong: %', e->'cards';
  end if;
  if jsonb_array_length(e->'saved') <> 1 or e->'saved'->0->>'ref' <> '注文' or e->'saved'->0->>'kind' <> 'vocabulary' then
    raise exception 'FAIL 4: saved must hold only the line-anchored vocabulary card, got %', e->'saved';
  end if;
  raise notice 'PASS 4 saved knowledge counts distinct refs and survives a deleted line';
end $$;
commit;

-- 5. The kind/ref check holds both ways.
do $$
begin
  begin
    insert into sentence_mining_cards (user_id, video_id, target_word, sentence_jp, source_kind, source_ref)
      values ('5ca1ab1e-0000-4000-8000-00000000000a', '5ca1ab1e-0000-4000-8000-0000000000f1', 'x', 'x', 'vocabulary', null);
    raise exception 'FAIL 5: a vocabulary card without a ref was accepted';
  exception when check_violation then null;
  end;
  begin
    insert into sentence_mining_cards (user_id, video_id, target_word, sentence_jp, source_kind, source_ref)
      values ('5ca1ab1e-0000-4000-8000-00000000000a', '5ca1ab1e-0000-4000-8000-0000000000f1', 'x', 'x', 'sentence', 'x');
    raise exception 'FAIL 5: a sentence card with a ref was accepted';
  exception when check_violation then null;
  end;
  raise notice 'PASS 5 sentence iff null ref';
end $$;

-- 6. Summary saves are unique per user + line + kind + ref; free mining (selection) may repeat.
do $$
begin
  begin
    insert into sentence_mining_cards (user_id, video_id, transcript_line_id, target_word, sentence_jp, source_kind, source_ref)
      values ('5ca1ab1e-0000-4000-8000-00000000000a', '5ca1ab1e-0000-4000-8000-0000000000f1',
              '5ca1ab1e-0000-4000-8000-0000000000d2', '注文', 'x', 'vocabulary', '注文');
    raise exception 'FAIL 6: a duplicate vocabulary save was accepted';
  exception when unique_violation then null;
  end;
  insert into sentence_mining_cards (user_id, video_id, transcript_line_id, target_word, sentence_jp, source_kind, source_ref)
    values ('5ca1ab1e-0000-4000-8000-00000000000a', '5ca1ab1e-0000-4000-8000-0000000000f1',
            '5ca1ab1e-0000-4000-8000-0000000000d2', '注文', 'x', 'selection', '注文');
  raise notice 'PASS 6 knowledge saves are idempotent, selection repeats';
end $$;

-- 7. Review Tomorrow as the learner: one sentence card per line, never later, null stays null, other lessons ignored.
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'uid_a', 'role', 'authenticated')::text, true) \g /dev/null
do $$
declare
  v_video uuid := '5ca1ab1e-0000-4000-8000-0000000000f1';
  v_l1 uuid := '5ca1ab1e-0000-4000-8000-0000000000d1';
  v_l2 uuid := '5ca1ab1e-0000-4000-8000-0000000000d2';
  v_targets jsonb := jsonb_build_array(jsonb_build_object('lineId', '5ca1ab1e-0000-4000-8000-0000000000d1', 'focusSpan', '雨'),
                                       jsonb_build_object('lineId', '5ca1ab1e-0000-4000-8000-0000000000d2'));
  v_due timestamptz := now() + interval '20 hours';
  v_n int;
begin
  v_n := schedule_review_tomorrow(v_video, v_targets, v_due);
  if v_n <> 2 then raise exception 'FAIL 7: first schedule wrote %', v_n; end if;
  if (select count(*) from sentence_mining_cards where source_kind = 'sentence' and next_review_at = v_due) <> 2 then
    raise exception 'FAIL 7: expected two sentence cards due at p_due';
  end if;
  if (select target_word from sentence_mining_cards where source_kind = 'sentence' and transcript_line_id = v_l1) <> '雨' then
    raise exception 'FAIL 7: focusSpan must become the card''s target word';
  end if;
  v_n := schedule_review_tomorrow(v_video, v_targets, v_due + interval '1 hour');
  if v_n <> 0 then raise exception 'FAIL 7: a repeat call that changed nothing counted % rows', v_n; end if;
  if (select count(*) from sentence_mining_cards where source_kind = 'sentence') <> 2
     or exists (select 1 from sentence_mining_cards where source_kind = 'sentence' and next_review_at <> v_due) then
    raise exception 'FAIL 7: a repeat call duplicated a card or pushed a due date later';
  end if;
  update sentence_mining_cards set next_review_at = now() + interval '30 days' where source_kind = 'sentence' and transcript_line_id = v_l1;
  update sentence_mining_cards set next_review_at = null where source_kind = 'sentence' and transcript_line_id = v_l2;
  v_n := schedule_review_tomorrow(v_video, v_targets, v_due);
  if v_n <> 1 then raise exception 'FAIL 7: pulling in one card and leaving a null one counted % rows', v_n; end if;
  if (select next_review_at from sentence_mining_cards where source_kind = 'sentence' and transcript_line_id = v_l1) <> v_due then
    raise exception 'FAIL 7: a card due in 30 days was not pulled in to tomorrow';
  end if;
  if (select next_review_at from sentence_mining_cards where source_kind = 'sentence' and transcript_line_id = v_l2) is not null then
    raise exception 'FAIL 7: a card with a null due date was changed';
  end if;
  v_n := schedule_review_tomorrow(v_video, jsonb_build_array(jsonb_build_object('lineId', '5ca1ab1e-0000-4000-8000-0000000000d4')), v_due);
  if v_n <> 0 or exists (select 1 from sentence_mining_cards where transcript_line_id = '5ca1ab1e-0000-4000-8000-0000000000d4') then
    raise exception 'FAIL 7: a line of another lesson produced a card';
  end if;
  begin
    perform schedule_review_tomorrow(v_video, v_targets, now() - interval '1 minute');
    raise exception 'FAIL 7: a due time in the past was accepted';
  exception when invalid_parameter_value then null;
  end;
  raise notice 'PASS 7 Review Tomorrow is idempotent, never later, lesson-scoped, counts only real writes';
end $$;
commit;

-- 8. lesson_reflections is readable by its owner only and writable by nobody but the service role.
insert into lesson_reflections (user_id, video_id, locale, analysis_fingerprint, evidence_fingerprint, schema_version,
  generator_version, status, content)
values (:'uid_a', '5ca1ab1e-0000-4000-8000-0000000000f1', 'vi', 'sgate-rls', 'sgate-evidence', 1, 1, 'ready', '{}');
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'uid_a', 'role', 'authenticated')::text, true) \g /dev/null
do $$
begin
  if (select count(*) from lesson_reflections) <> 1 then raise exception 'FAIL 8: owner sees % rows', (select count(*) from lesson_reflections); end if;
  begin
    insert into lesson_reflections (user_id, video_id, locale, analysis_fingerprint, evidence_fingerprint, schema_version,
      generator_version, status) values (auth.uid(), '5ca1ab1e-0000-4000-8000-0000000000f1', 'vi', 'sgate-forged', 'e', 1, 1, 'ready');
    raise exception 'FAIL 8: a learner wrote a reflection directly';
  exception when insufficient_privilege then null;
  end;
end $$;
commit;
begin;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'uid_b', 'role', 'authenticated')::text, true) \g /dev/null
do $$
begin
  if (select count(*) from lesson_reflections) <> 0 then raise exception 'FAIL 8: another learner sees A''s reflection'; end if;
end $$;
commit;
begin;
set local role anon;
do $$
begin
  begin
    if (select count(*) from lesson_reflections) <> 0 then raise exception 'FAIL 8: anon read a reflection'; end if;
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS 8 reflections are owner-read-only';
end $$;
commit;

-- 9. Grants: invoker functions are closed to anon, definer functions to every learner role; search_path pinned.
do $$
declare v_fn text;
begin
  if has_function_privilege('anon', 'lesson_summary_evidence(uuid,int)', 'execute')
     or has_function_privilege('anon', 'schedule_review_tomorrow(uuid,jsonb,timestamptz)', 'execute') then
    raise exception 'FAIL 9: anon can execute a learner function';
  end if;
  if not has_function_privilege('authenticated', 'lesson_summary_evidence(uuid,int)', 'execute') then
    raise exception 'FAIL 9: authenticated cannot read its own evidence';
  end if;
  foreach v_fn in array array['reflection_claim_lease(uuid,jsonb,int)', 'reflection_complete(uuid,uuid,jsonb,text,text)',
                              'reflection_fail(uuid,uuid,text,timestamptz)'] loop
    if has_function_privilege('authenticated', v_fn, 'execute') or has_function_privilege('anon', v_fn, 'execute') then
      raise exception 'FAIL 9: a learner role can execute %', v_fn;
    end if;
    if not has_function_privilege('service_role', v_fn, 'execute') then raise exception 'FAIL 9: service_role cannot execute %', v_fn; end if;
    if not exists (select 1 from pg_proc where oid = v_fn::regprocedure and prosecdef and 'search_path=public' = any (proconfig)) then
      raise exception 'FAIL 9: % is not a definer with search_path=public', v_fn;
    end if;
  end loop;
  raise notice 'PASS 9 grants and pinned search_path';
end $$;

-- 11. Reflection lease, single session: leader / follower / expired takeover / stale token refused / ready.
do $$
declare first record; again record; second record; ready record; stale_ok boolean; r lesson_reflections%rowtype;
begin
  select * into first from reflection_claim_lease('5ca1ab1e-0000-4000-8000-00000000000a', pg_temp.sgate_key('sgate-lease'), 30);
  if first.outcome <> 'leader' or first.attempts <> 1 then raise exception 'FAIL 11: first claim %/%', first.outcome, first.attempts; end if;
  select * into again from reflection_claim_lease('5ca1ab1e-0000-4000-8000-00000000000a', pg_temp.sgate_key('sgate-lease'), 30);
  if again.outcome <> 'follower' then raise exception 'FAIL 11: live lease gave %', again.outcome; end if;
  update lesson_reflections set lease_until = now() - interval '1 second' where id = first.entry_id;
  select * into second from reflection_claim_lease('5ca1ab1e-0000-4000-8000-00000000000a', pg_temp.sgate_key('sgate-lease'), 30);
  if second.outcome <> 'leader' or second.lease_token = first.lease_token or second.attempts <> 2 then
    raise exception 'FAIL 11: expired lease was not taken over with a new token (%, attempts %)', second.outcome, second.attempts;
  end if;
  stale_ok := reflection_complete(first.entry_id, first.lease_token, '{"by":"stale"}', 'm', 'p');
  select * into r from lesson_reflections where id = first.entry_id;
  if stale_ok or r.status <> 'pending' or r.content is not null then
    raise exception 'FAIL 11: stale leader changed the entry (ok=%, status=%)', stale_ok, r.status;
  end if;
  if not reflection_complete(second.entry_id, second.lease_token, '{"by":"second"}', 'm', 'p') then
    raise exception 'FAIL 11: current leader could not complete';
  end if;
  select * into ready from reflection_claim_lease('5ca1ab1e-0000-4000-8000-00000000000a', pg_temp.sgate_key('sgate-lease'), 30);
  if ready.outcome <> 'ready' or ready.content <> '{"by":"second"}'::jsonb or ready.model <> 'm' then
    raise exception 'FAIL 11: ready claim gave % %', ready.outcome, ready.content;
  end if;
  if reflection_fail(second.entry_id, second.lease_token, 'late', now() + interval '1 hour') then
    raise exception 'FAIL 11: a ready reflection was failed';
  end if;
  raise notice 'PASS 11 reflection lease state machine';
end $$;

-- 12. A failed reflection backs off until retry_after.
do $$
declare first record; again record;
begin
  select * into first from reflection_claim_lease('5ca1ab1e-0000-4000-8000-00000000000a', pg_temp.sgate_key('sgate-backoff'), 30);
  if not reflection_fail(first.entry_id, first.lease_token, 'provider_error', now() + interval '1 hour') then
    raise exception 'FAIL 12: leader could not fail its entry';
  end if;
  select * into again from reflection_claim_lease('5ca1ab1e-0000-4000-8000-00000000000a', pg_temp.sgate_key('sgate-backoff'), 30);
  if again.outcome <> 'backoff' or again.retry_after <= now() then
    raise exception 'FAIL 12: failed entry gave % (retry_after %)', again.outcome, again.retry_after;
  end if;
  raise notice 'PASS 12 failed reflection backs off';
end $$;

-- 10. Erasure: deleting the account removes the learner's reflections and cards (runs last: it deletes A).
do $$
begin
  if (select count(*) from lesson_reflections where user_id = '5ca1ab1e-0000-4000-8000-00000000000a') = 0
     or (select count(*) from sentence_mining_cards where user_id = '5ca1ab1e-0000-4000-8000-00000000000a') = 0 then
    raise exception 'FAIL 10 setup: A has nothing to erase';
  end if;
  delete from auth.users where id = '5ca1ab1e-0000-4000-8000-00000000000a';
  if exists (select 1 from lesson_reflections where user_id = '5ca1ab1e-0000-4000-8000-00000000000a')
     or exists (select 1 from sentence_mining_cards where user_id = '5ca1ab1e-0000-4000-8000-00000000000a') then
    raise exception 'FAIL 10: erasing the account left reflections or cards behind';
  end if;
  raise notice 'PASS 10 account erasure cascades';
end $$;

-- Cleanup.
delete from lesson_reflections where analysis_fingerprint like 'sgate-%';
delete from videos where youtube_video_id like 'summarygate-%';
delete from auth.users where email like 'summarygate-%@example.invalid';
