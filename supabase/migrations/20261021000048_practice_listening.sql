-- Practice modes B2: Listening (spec docs/superpowers/specs/2026-10-15-shadowing-practice-modes-design.md §5.3, §6.2, §7, §7.1).
-- The read functions below live here, not in 043/045/047: their bodies read columns this file adds (plan P3).
alter table dictation_attempts
  add column format text check (format in ('word_bank', 'typing')),
  add column status text check (status in ('submitted', 'revealed', 'unscored')),
  add column hint_unit text check (hint_unit in ('chunk', 'grapheme4')),
  add column hinted_units int[] not null default '{}',
  add column chunk_order int[],
  add column chunker_version smallint,
  add column chunk_snapshot text[];

-- D21: every legacy attempt was typed; a scored one was submitted, an unscored one is legacy-only.
update dictation_attempts
   set format = 'typing', status = case when accuracy_score is null then 'unscored' else 'submitted' end;

alter table dictation_attempts
  alter column format set not null,
  alter column status set not null,
  -- submitted ⇔ scored; so revealed (and legacy unscored) carry no score.
  add constraint dictation_attempts_score_status check ((status = 'submitted') = (accuracy_score is not null)),
  add constraint dictation_attempts_word_bank_order check (format <> 'word_bank' or chunk_order is not null or status = 'revealed');

-- §5.3: a CHECK cannot tell an old row from a new one; only legacy rows may be (or stay) unscored.
create function dictation_attempts_no_new_unscored() returns trigger
  language plpgsql set search_path = public
as $$
begin
  if new.status = 'unscored' and (tg_op = 'INSERT' or old.status is distinct from 'unscored') then
    raise exception 'dictation_attempts: unscored is legacy-only' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger dictation_attempts_no_new_unscored before insert or update on dictation_attempts
  for each row execute function dictation_attempts_no_new_unscored();

create index idx_dictation_line_format on dictation_attempts (user_id, transcript_line_id, format, created_at desc);

-- D25: learners read their rows (RLS dictation_own) but only the server writes them.
revoke insert, update on dictation_attempts from authenticated, anon;

-- §3.6: one aggregate for the stat strip and the navigator. score = latest valid scored; state = latest of any kind.
-- Listening (R1/R2): per format, score = latest submitted attempt, state = latest attempt of any status.
create or replace function practice_stats(p_video uuid, p_mode text, p_review_below numeric) returns jsonb
language plpgsql stable security invoker set search_path = public as $$
begin
  if p_mode in ('word_bank', 'typing') then
    return (
      with lesson_transcript as (
        select t.id from transcripts t where t.video_id = p_video order by t.created_at desc, t.id limit 1
      ), lines as (
        select tl.id from transcript_lines tl
        where tl.transcript_id = (select id from lesson_transcript) and btrim(coalesce(tl.text_jp, '')) <> ''
      ), attempts as (
        select d.transcript_line_id as line_id, d.status, d.accuracy_score, d.created_at, d.id
        from dictation_attempts d
        where d.user_id = auth.uid() and d.format = p_mode and d.transcript_line_id in (select id from lines)
      ), latest_scored as (
        select distinct on (line_id) line_id, accuracy_score as score
        from attempts where status = 'submitted' order by line_id, created_at desc, id desc
      ), latest_any as (
        select distinct on (line_id) line_id, status from attempts order by line_id, created_at desc, id desc
      )
      select jsonb_build_object(
        'lineCount', (select count(*) from lines),
        'scoredLines', (select count(*) from latest_scored),
        'mean', (select avg(score) from latest_scored),
        'lines', coalesce((select jsonb_agg(jsonb_build_object(
            'lineId', a.line_id,
            'state', case a.status when 'revealed' then 'revealed' when 'unscored' then 'unscored'
                          else (case when ls.score < p_review_below then 'needs_review' else 'scored' end) end,
            'score', ls.score) order by a.line_id)
          from latest_any a left join latest_scored ls on ls.line_id = a.line_id), '[]'::jsonb))
    );
  end if;
  if p_mode <> 'pronunciation' then raise exception 'practice_stats: unknown mode %', p_mode using errcode = '22023'; end if;
  return (
    with lesson_transcript as (
      select t.id from transcripts t where t.video_id = p_video order by t.created_at desc, t.id limit 1
    ), lines as (
      select tl.id from transcript_lines tl
      where tl.transcript_id = (select id from lesson_transcript) and btrim(coalesce(tl.text_jp, '')) <> ''
    ), sessions as (
      select s.transcript_line_id as line_id, s.pronunciation_score, s.created_at, s.id
      from shadowing_sessions s where s.user_id = auth.uid() and s.transcript_line_id in (select id from lines)
    ), latest_scored as (
      select distinct on (line_id) line_id, pronunciation_score as score
      from sessions where pronunciation_score is not null order by line_id, created_at desc, id desc
    ), latest_any as (
      select distinct on (line_id) line_id, pronunciation_score is null as unscored
      from sessions order by line_id, created_at desc, id desc
    )
    select jsonb_build_object(
      'lineCount', (select count(*) from lines),
      'scoredLines', (select count(*) from latest_scored),
      'mean', (select avg(score) from latest_scored),
      'lines', coalesce((select jsonb_agg(jsonb_build_object(
          'lineId', a.line_id,
          'state', case when a.unscored then 'unscored'
                        when ls.score < p_review_below then 'needs_review' else 'scored' end,
          'score', ls.score) order by a.line_id)
        from latest_any a left join latest_scored ls on ls.line_id = a.line_id), '[]'::jsonb))
  );
end $$;
revoke all on function practice_stats(uuid, text, numeric) from public, anon;
grant execute on function practice_stats(uuid, text, numeric) to authenticated;

-- Summary / Analysis §3 (spec docs/superpowers/specs/2026-10-04-summary-analysis-design.md): everything Lesson
-- Status, Saved Knowledge and the review targets need, aggregated here so no PostgREST row read can be truncated by
-- max_rows. Runs as the caller: RLS and auth.uid() scope every row. Listening (B2 §6.2): one mean per format over
-- each line's latest submitted attempt (R1); per line, the latest attempt of any status per format (R2).
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
    select d.transcript_line_id as line_id, d.format, d.status, d.accuracy_score, d.user_input, d.created_at, d.id
    from dictation_attempts d
    where d.user_id = auth.uid() and d.transcript_line_id in (select id from lines)
  ), latest_attempt as (
    select distinct on (line_id, format) line_id, format, status, accuracy_score, user_input
    from attempts order by line_id, format, created_at desc, id desc
  ), latest_submitted as (
    select distinct on (line_id, format) line_id, format, accuracy_score
    from attempts where status = 'submitted' order by line_id, format, created_at desc, id desc
  ), difficult as (
    select m.transcript_line_id as line_id from sentence_marks m
    where m.user_id = auth.uid() and m.kind = 'difficult' and m.transcript_line_id in (select id from lines)
  ), cards as (
    select c.id, c.source_kind, c.source_ref, c.srs_stage, c.last_reviewed_at, c.transcript_line_id
    from sentence_mining_cards c where c.user_id = auth.uid() and c.video_id = p_video
  ), per_line as (
    select l.id as line_id, ls.pronunciation_score, lp.pitch_score,
      (select jsonb_agg(jsonb_build_object('format', la.format, 'status', la.status, 'score', la.accuracy_score,
                                           'input', la.user_input) order by la.format)
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
    'wordBankMean', (select avg(accuracy_score) from latest_submitted where format = 'word_bank'),
    'typingMean', (select avg(accuracy_score) from latest_submitted where format = 'typing'),
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

-- Mission hints: modality activity in the practice window, with the video practised last.
-- Listening (P9): distinct lines with a submitted attempt, both formats; revealed never counts (D11).
create or replace function practice_activity(p_since timestamptz)
  returns table (type text, outcomes int, last_at timestamptz, last_video_id uuid)
  language sql stable security invoker set search_path = public
as $$
  -- The fallback lesson must still be openable today (M2): a lapsed PLUS lesson is skipped for an older one.
  select 'shadow_lines', count(distinct transcript_line_id)::int, max(created_at),
    (array_agg(video_id order by created_at desc) filter (where video_id is not null and can_open_lesson(video_id, auth.uid())))[1]
  from shadowing_sessions where user_id = auth.uid() and created_at >= p_since
  union all
  select 'dictation_lines', count(distinct transcript_line_id)::int, max(created_at),
    (array_agg(video_id order by created_at desc) filter (where video_id is not null and can_open_lesson(video_id, auth.uid())))[1]
  from dictation_attempts where user_id = auth.uid() and created_at >= p_since and status = 'submitted';
$$;
revoke execute on function practice_activity(timestamptz) from public, anon;
grant execute on function practice_activity(timestamptz) to authenticated;

-- D4 (plan P4): Listening and Pronunciation accuracy per study-date window, with evidence counts.
-- Listening is Typing, submitted only (D20).
create or replace function weekly_skill_windows(p_tz text, p_w1_from date, p_w0_from date, p_to date)
  returns table (skill text, win int, attempts int, mean numeric)
  language sql stable security invoker set search_path = public
as $$
  with ev as (
    select 'listening' as skill, (created_at at time zone p_tz)::date as d, accuracy_score::numeric as s
    from dictation_attempts where user_id = auth.uid() and format = 'typing' and status = 'submitted'
    union all
    select 'pronunciation', (created_at at time zone p_tz)::date, pronunciation_score
    from shadowing_sessions where user_id = auth.uid() and pronunciation_score is not null
  )
  select skill, case when d >= p_w0_from then 0 else 1 end, count(*)::int, round(avg(s), 2)
  from ev where d >= p_w1_from and d <= p_to group by 1, 2;
$$;
revoke execute on function weekly_skill_windows(text, date, date, date) from public, anon;
grant execute on function weekly_skill_windows(text, date, date, date) to authenticated;

-- D3: each family/metric over its last p_dates study dates WITH evidence. Listening is Typing, submitted only (D20).
create or replace function weakness_scores(p_tz text, p_dates int) returns table (family text, metric text, attempts int, score numeric)
  language sql stable security invoker set search_path = public
as $$
  with ev as (
    select 'listening' as fam, 'accuracy' as met, created_at as at, accuracy_score::numeric as s
      from dictation_attempts where user_id = auth.uid() and format = 'typing' and status = 'submitted'
    union all select 'reading', 'score', completed_at, score from user_reading_attempts where user_id = auth.uid()
    union all select 'pronunciation', 'accuracy', created_at, pronunciation_score from shadowing_sessions
      where user_id = auth.uid() and pronunciation_score is not null
    union all select 'pronunciation', 'pitch', created_at, pitch_score from shadowing_sessions
      where user_id = auth.uid() and pitch_score is not null
    union all select 'pronunciation', 'rhythm', created_at, rhythm_score from shadowing_sessions
      where user_id = auth.uid() and rhythm_score is not null
  ),
  ranked as (
    select fam, met, s, dense_rank() over (partition by fam order by (at at time zone p_tz)::date desc) as r from ev
  )
  select fam, met, count(*)::int, round(avg(s), 2) from ranked where r <= p_dates group by fam, met;
$$;
revoke execute on function weakness_scores(text, int) from public, anon;
grant execute on function weakness_scores(text, int) to authenticated;
