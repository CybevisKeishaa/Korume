-- Summary / Analysis mode (spec docs/superpowers/specs/2026-10-04-summary-analysis-design.md).

-- §3: everything Lesson Status, Saved Knowledge and the review targets need, aggregated here so no PostgREST
-- row read can be truncated by max_rows. Runs as the caller: RLS and auth.uid() scope every row.
create function lesson_summary_evidence(p_video uuid, p_mastery int) returns jsonb
language sql stable security invoker set search_path = public as $$
  with lesson_transcript as (
    select t.id from transcripts t where t.video_id = p_video order by t.created_at desc, t.id limit 1
  ), lines as (
    select tl.id from transcript_lines tl
    where tl.transcript_id = (select id from lesson_transcript) and btrim(coalesce(tl.text_jp, '')) <> ''
  ), sessions as (
    select s.transcript_line_id as line_id, s.pronunciation_score, s.pitch_score, s.created_at, s.id
    from shadowing_sessions s
    where s.user_id = auth.uid() and s.transcript_line_id in (select id from lines)
  ), latest_session as (
    select distinct on (line_id) line_id, pronunciation_score, pitch_score
    from sessions order by line_id, created_at desc, id desc
  ), attempts as (
    select d.transcript_line_id as line_id, d.accuracy_score, d.user_input, d.created_at, d.id
    from dictation_attempts d
    where d.user_id = auth.uid() and d.transcript_line_id in (select id from lines)
  ), latest_attempt as (
    select distinct on (line_id) line_id, accuracy_score, user_input
    from attempts order by line_id, created_at desc, id desc
  ), difficult as (
    select m.transcript_line_id as line_id from sentence_marks m
    where m.user_id = auth.uid() and m.kind = 'difficult' and m.transcript_line_id in (select id from lines)
  ), cards as (
    select c.id, c.source_kind, c.source_ref, c.srs_stage, c.last_reviewed_at, c.transcript_line_id
    from sentence_mining_cards c where c.user_id = auth.uid() and c.video_id = p_video
  ), per_line as (
    select l.id as line_id, ls.pronunciation_score, ls.pitch_score, la.accuracy_score, la.user_input,
      exists (select 1 from difficult d where d.line_id = l.id) as is_difficult
    from lines l
    left join latest_session ls on ls.line_id = l.id
    left join latest_attempt la on la.line_id = l.id
    where ls.line_id is not null or la.line_id is not null or exists (select 1 from difficult d where d.line_id = l.id)
  )
  select jsonb_build_object(
    'hasTranscript', exists (select 1 from lesson_transcript),
    'lineCount', (select count(*) from lines),
    'shadowedLines', (select count(distinct line_id) from sessions),
    'pronunciationMean', (select avg(pronunciation_score) from sessions where pronunciation_score is not null),
    'dictationMean', (select avg(accuracy_score) from attempts where accuracy_score is not null),
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
        'dictation', accuracy_score, 'dictationInput', user_input, 'difficult', is_difficult) order by line_id)
      from per_line), '[]'::jsonb),
    'saved', coalesce((select jsonb_agg(jsonb_build_object(
        'cardId', id, 'kind', source_kind, 'ref', source_ref, 'lineId', transcript_line_id) order by id)
      from cards where source_kind in ('vocabulary', 'expression') and transcript_line_id is not null), '[]'::jsonb)
  )
$$;
revoke all on function lesson_summary_evidence(uuid, int) from public, anon;
grant execute on function lesson_summary_evidence(uuid, int) to authenticated;

-- §6.2: one sentence card per target line, due at p_due unless it is already due sooner. Runs as the caller, so
-- RLS on sentence_mining_cards confines every write to the caller's own cards.
create function schedule_review_tomorrow(p_video uuid, p_targets jsonb, p_due timestamptz) returns int
language plpgsql security invoker set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_target jsonb;
  v_line record;
  v_count int := 0;
begin
  if v_user is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  if p_due <= now() or p_due > now() + interval '49 hours' then
    raise exception 'due time out of range' using errcode = '22023';
  end if;
  for v_target in select value from jsonb_array_elements(coalesce(p_targets, '[]'::jsonb)) loop
    select tl.id, tl.text_jp, tl.text_translation, tl.start_time, tl.end_time into v_line
    from transcript_lines tl join transcripts tr on tr.id = tl.transcript_id
    where tl.id = (v_target->>'lineId')::uuid and tr.video_id = p_video;
    if not found then continue; end if;
    insert into sentence_mining_cards (user_id, video_id, transcript_line_id, target_word, sentence_jp,
      sentence_translation, start_time, end_time, source_kind, source_ref, next_review_at)
    values (v_user, p_video, v_line.id, coalesce(nullif(btrim(v_target->>'focusSpan'), ''), v_line.text_jp),
      v_line.text_jp, v_line.text_translation, v_line.start_time, v_line.end_time, 'sentence', null, p_due)
    on conflict (user_id, transcript_line_id) where source_kind = 'sentence' do update
      set next_review_at = case when sentence_mining_cards.next_review_at is null then null
                                else least(sentence_mining_cards.next_review_at, excluded.next_review_at) end;
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;
revoke all on function schedule_review_tomorrow(uuid, jsonb, timestamptz) from public, anon;
grant execute on function schedule_review_tomorrow(uuid, jsonb, timestamptz) to authenticated;

-- §5.5: the personal Korume reflection. User-owned derived data: explicit owner, cascades with the user and the
-- lesson; shared knowledge_entries never holds personalized content.
create table lesson_reflections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  video_id uuid not null references videos (id) on delete cascade,
  locale text not null check (locale in ('vi', 'en')),
  analysis_fingerprint text not null,
  evidence_fingerprint text not null,
  schema_version int not null,
  generator_version int not null,
  status text not null check (status in ('pending', 'ready', 'failed')),
  lease_until timestamptz,
  lease_token uuid,
  content jsonb,
  model text,
  provider text,
  error_code text,
  failed_at timestamptz,
  retry_after timestamptz,
  attempts int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, video_id, locale, analysis_fingerprint, evidence_fingerprint, schema_version, generator_version)
);
create index lesson_reflections_latest_ready on lesson_reflections (user_id, video_id, locale, updated_at desc)
  where status = 'ready';
alter table lesson_reflections enable row level security;
create policy lesson_reflections_own_read on lesson_reflections for select to authenticated using (user_id = auth.uid());
revoke all on lesson_reflections from anon, authenticated;
grant select on lesson_reflections to authenticated;
grant all on lesson_reflections to service_role;

-- The knowledge_claim_lease state machine (migration 038), on this table: leader / follower / ready / backoff,
-- expired-lease takeover with a new token, and a stale token that can no longer complete or fail.
create function reflection_claim_lease(p_user uuid, p_key jsonb, p_lease_seconds int)
returns table (entry_id uuid, outcome text, lease_token uuid, content jsonb, retry_after timestamptz, attempts int,
  model text)
language plpgsql security definer set search_path = public as $$
declare
  v_entry lesson_reflections%rowtype;
  v_id uuid;
  v_token uuid;
  v_attempts int;
  v_lease timestamptz := now() + make_interval(secs => p_lease_seconds);
begin
  insert into lesson_reflections as r (user_id, video_id, locale, analysis_fingerprint, evidence_fingerprint,
    schema_version, generator_version, status, lease_until, lease_token)
  values (p_user, (p_key->>'videoId')::uuid, p_key->>'locale', p_key->>'analysisFingerprint',
    p_key->>'evidenceFingerprint', (p_key->>'schemaVersion')::int, (p_key->>'generatorVersion')::int,
    'pending', v_lease, gen_random_uuid())
  on conflict (user_id, video_id, locale, analysis_fingerprint, evidence_fingerprint, schema_version, generator_version)
    do nothing
  returning r.id, r.lease_token into v_id, v_token;
  if v_id is not null then
    return query select v_id, 'leader'::text, v_token, null::jsonb, null::timestamptz, 1, null::text;
    return;
  end if;

  select * into v_entry from lesson_reflections r
  where r.user_id = p_user and r.video_id = (p_key->>'videoId')::uuid and r.locale = p_key->>'locale'
    and r.analysis_fingerprint = p_key->>'analysisFingerprint' and r.evidence_fingerprint = p_key->>'evidenceFingerprint'
    and r.schema_version = (p_key->>'schemaVersion')::int and r.generator_version = (p_key->>'generatorVersion')::int
  for update;

  if v_entry.status = 'ready' then
    return query select v_entry.id, 'ready'::text, null::uuid, v_entry.content, null::timestamptz, v_entry.attempts,
      v_entry.model;
  elsif v_entry.status = 'failed' and v_entry.retry_after > now() then
    return query select v_entry.id, 'backoff'::text, null::uuid, null::jsonb, v_entry.retry_after, v_entry.attempts,
      null::text;
  elsif v_entry.status = 'failed' or v_entry.lease_until < now() then
    update lesson_reflections r
      set status = 'pending', lease_until = v_lease, lease_token = gen_random_uuid(), attempts = r.attempts + 1,
          updated_at = now()
      where r.id = v_entry.id
      returning r.lease_token, r.attempts into v_token, v_attempts;
    return query select v_entry.id, 'leader'::text, v_token, null::jsonb, null::timestamptz, v_attempts, null::text;
  else
    return query select v_entry.id, 'follower'::text, null::uuid, null::jsonb, null::timestamptz, v_entry.attempts,
      null::text;
  end if;
end $$;

create function reflection_complete(p_entry uuid, p_lease_token uuid, p_content jsonb, p_model text, p_provider text)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  update lesson_reflections
    set status = 'ready', content = p_content, model = p_model, provider = p_provider, lease_until = null,
        error_code = null, failed_at = null, retry_after = null, updated_at = now()
    where id = p_entry and lease_token = p_lease_token and status = 'pending';
  return found;
end $$;

create function reflection_fail(p_entry uuid, p_lease_token uuid, p_error_code text, p_retry_after timestamptz)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  update lesson_reflections
    set status = 'failed', error_code = p_error_code, failed_at = now(), retry_after = p_retry_after,
        lease_until = null, updated_at = now()
    where id = p_entry and lease_token = p_lease_token and status = 'pending';
  return found;
end $$;

revoke all on function reflection_claim_lease(uuid, jsonb, int) from public, anon, authenticated;
revoke all on function reflection_complete(uuid, uuid, jsonb, text, text) from public, anon, authenticated;
revoke all on function reflection_fail(uuid, uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function reflection_claim_lease(uuid, jsonb, int) to service_role;
grant execute on function reflection_complete(uuid, uuid, jsonb, text, text) to service_role;
grant execute on function reflection_fail(uuid, uuid, text, timestamptz) to service_role;
