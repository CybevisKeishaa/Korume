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

-- practice_stats: defined in 20261021000048_practice_listening.sql (it reads B2 columns).
