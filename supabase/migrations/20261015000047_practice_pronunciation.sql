-- Practice modes B1: Pronunciation (spec docs/superpowers/specs/2026-10-15-shadowing-practice-modes-design.md §4, §6.1, §7).

alter table shadowing_sessions
  add column assessment jsonb check (assessment is null or (jsonb_typeof(assessment) = 'object' and assessment ? 'v')),
  add column scoring_claim uuid,
  add column scoring_started_at timestamptz;

-- D25: learners read their rows (RLS shadowing_own) but only the server writes them.
revoke insert, update on shadowing_sessions from authenticated, anon;

-- §4.5 lease: a claim is a fresh token; only its holder can finish or release.
create function claim_pronunciation_scoring(p_user uuid, p_session uuid)
  returns table (claim uuid, video_id uuid, transcript_line_id uuid, recording_url text)
  language sql security definer set search_path = public
as $$
  update shadowing_sessions s
     set scoring_claim = gen_random_uuid(), scoring_started_at = now()
   where s.id = p_session and s.user_id = p_user and s.pronunciation_score is null
     and (s.scoring_claim is null or s.scoring_started_at < now() - interval '90 seconds')
  returning s.scoring_claim, s.video_id, s.transcript_line_id, s.recording_url;
$$;

create function finish_pronunciation_scoring(p_session uuid, p_claim uuid, p_pronunciation numeric, p_rhythm numeric, p_assessment jsonb)
  returns boolean language plpgsql security definer set search_path = public
as $$
declare v_rows int;
begin
  update shadowing_sessions
     set pronunciation_score = p_pronunciation, rhythm_score = p_rhythm, assessment = p_assessment,
         scoring_claim = null, scoring_started_at = null
   where id = p_session and scoring_claim = p_claim and pronunciation_score is null;
  get diagnostics v_rows = row_count;
  return v_rows = 1;
end $$;

create function release_pronunciation_scoring(p_session uuid, p_claim uuid)
  returns boolean language plpgsql security definer set search_path = public
as $$
declare v_rows int;
begin
  update shadowing_sessions set scoring_claim = null, scoring_started_at = null
   where id = p_session and scoring_claim = p_claim;
  get diagnostics v_rows = row_count;
  return v_rows = 1;
end $$;

revoke all on function claim_pronunciation_scoring(uuid, uuid) from public, anon, authenticated;
revoke all on function finish_pronunciation_scoring(uuid, uuid, numeric, numeric, jsonb) from public, anon, authenticated;
revoke all on function release_pronunciation_scoring(uuid, uuid) from public, anon, authenticated;
grant execute on function claim_pronunciation_scoring(uuid, uuid) to service_role;
grant execute on function finish_pronunciation_scoring(uuid, uuid, numeric, numeric, jsonb) to service_role;
grant execute on function release_pronunciation_scoring(uuid, uuid) to service_role;

-- §3.6: one aggregate for the stat strip and the navigator. score = latest valid scored; state = latest of any kind.
create function practice_stats(p_video uuid, p_mode text, p_review_below numeric) returns jsonb
language plpgsql stable security invoker set search_path = public as $$
begin
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
