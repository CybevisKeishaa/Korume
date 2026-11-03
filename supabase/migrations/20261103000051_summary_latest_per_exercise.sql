-- Ultra review (PR #1, 2026-11-03): Summary's per-line Listening state is the line's latest attempt of any status
-- per EXERCISE (Chép chính tả = typing + word_bank, Điền từ = cloze), as practice_stats and the navigator read it.
-- 049 kept one per FORMAT, so an older Word Bank Show answer (or weak score) kept a line in Review after a later
-- good typed attempt. Only latest_attempt changes; the entry still names the format of that latest attempt.
-- Additive (AGENTS.md §6 from 049): a function redefinition, no table or data change.
create or replace function lesson_summary_evidence(p_video uuid, p_mastery int) returns jsonb
language sql stable security invoker set search_path = public as $$
  with lesson_transcript as (
    select t.id from transcripts t where t.video_id = p_video order by t.created_at desc, t.id limit 1
  ), lines as (
    select tl.id, tl.start_time from transcript_lines tl
    where tl.transcript_id = (select id from lesson_transcript) and btrim(coalesce(tl.text_jp, '')) <> ''
  ), sessions as (
    select s.transcript_line_id as line_id, s.pronunciation_score, s.pitch_score, s.created_at, s.id
    from shadowing_sessions s
    where s.user_id = auth.uid() and s.transcript_line_id in (select id from lines)
  ), latest_scored as (
    select distinct on (line_id) line_id, pronunciation_score
    from sessions where pronunciation_score is not null order by line_id, created_at desc, id desc
  ), latest_pitch as (
    select distinct on (line_id) line_id, pitch_score
    from sessions where pitch_score is not null order by line_id, created_at desc, id desc
  ), progress as (
    select p.last_watched_position as watched from user_video_progress p
    where p.user_id = auth.uid() and p.video_id = p_video
  ), attempts as (
    select d.transcript_line_id as line_id, d.format, d.status, d.accuracy_score, d.user_input, d.created_at, d.id,
           case d.format when 'cloze' then 'cloze' else 'dictation' end as exercise,
           dictation_attempt_helped(d.easy_mode, d.hinted_units) as helped
    from dictation_attempts d
    where d.user_id = auth.uid() and d.transcript_line_id in (select id from lines)
  ), latest_attempt as (
    select distinct on (line_id, exercise) line_id, format, status, accuracy_score, user_input, helped
    from attempts order by line_id, exercise, created_at desc, id desc
  ), latest_submitted as (
    select distinct on (line_id, exercise) line_id, exercise, accuracy_score, helped
    from attempts where status = 'submitted' order by line_id, exercise, created_at desc, id desc
  ), difficult as (
    select m.transcript_line_id as line_id from sentence_marks m
    where m.user_id = auth.uid() and m.kind = 'difficult' and m.transcript_line_id in (select id from lines)
  ), cards as (
    select c.id, c.source_kind, c.source_ref, c.srs_stage, c.last_reviewed_at, c.transcript_line_id
    from sentence_mining_cards c where c.user_id = auth.uid() and c.video_id = p_video
  ), per_line as (
    select l.id as line_id, ls.pronunciation_score, lp.pitch_score,
      (select jsonb_agg(jsonb_build_object('format', la.format, 'status', la.status, 'score', la.accuracy_score,
                                           'input', la.user_input, 'helped', la.status = 'submitted' and la.helped)
                         order by la.format)
       from latest_attempt la where la.line_id = l.id) as listening,
      exists (select 1 from difficult d where d.line_id = l.id) as is_difficult
    from lines l
    left join latest_scored ls on ls.line_id = l.id
    left join latest_pitch lp on lp.line_id = l.id
    where ls.line_id is not null or lp.line_id is not null or exists (select 1 from latest_attempt la where la.line_id = l.id)
      or exists (select 1 from difficult d where d.line_id = l.id)
  )
  select jsonb_build_object(
    'hasTranscript', exists (select 1 from lesson_transcript),
    'lineCount', (select count(*) from lines),
    'reachedLine', (select count(*) from lines where (select watched from progress) > 0 and start_time <= (select watched from progress)),
    'pronunciationMean', (select avg(pronunciation_score) from latest_scored),
    'dictation', (select jsonb_build_object('mean', avg(accuracy_score), 'done', count(*), 'selfDone', count(*) filter (where not helped))
                  from latest_submitted where exercise = 'dictation'),
    'cloze', (select jsonb_build_object('mean', avg(accuracy_score), 'done', count(*), 'selfDone', count(*) filter (where not helped))
              from latest_submitted where exercise = 'cloze'),
    'completed', exists (select 1 from user_video_progress p
                         where p.user_id = auth.uid() and p.video_id = p_video and p.completed_at is not null),
    'cards', jsonb_build_object(
      'total', (select count(*) from cards),
      'mastered', (select count(*) from cards where srs_stage >= p_mastery),
      'reviewedAny', exists (select 1 from cards where last_reviewed_at is not null),
      'vocabularyRefs', (select count(distinct source_ref) from cards where source_kind in ('vocabulary', 'selection')),
      'expressionRefs', (select count(distinct source_ref) from cards where source_kind = 'expression'),
      'knowledgeRemembered', (select count(distinct source_ref) from cards
                              where source_kind in ('vocabulary', 'selection', 'expression') and srs_stage >= p_mastery),
      'knowledgeReviewedAny', exists (select 1 from cards
                                      where source_kind in ('vocabulary', 'selection', 'expression') and last_reviewed_at is not null)),
    'lines', coalesce((select jsonb_agg(jsonb_build_object(
        'lineId', line_id, 'pronunciation', pronunciation_score, 'pitch', pitch_score,
        'listening', coalesce(listening, '[]'::jsonb), 'difficult', is_difficult) order by line_id)
      from per_line), '[]'::jsonb),
    'saved', coalesce((select jsonb_agg(jsonb_build_object(
        'cardId', id, 'kind', source_kind, 'ref', source_ref, 'lineId', transcript_line_id) order by id)
      from cards where source_kind in ('vocabulary', 'expression') and transcript_line_id is not null), '[]'::jsonb)
  )
$$;
revoke all on function lesson_summary_evidence(uuid, int) from public, anon;
grant execute on function lesson_summary_evidence(uuid, int) to authenticated;
