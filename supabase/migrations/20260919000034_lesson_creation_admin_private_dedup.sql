-- The authoritative half of the owner's A+C ruling (2026-09-19).
--
-- An admin job asks for FREE/PLUS. This function never publishes a lesson it
-- deduped onto, so a job landing on a PRIVATE one used to fall through to
-- `succeeded` with another learner's lesson id attached, reporting catalogue
-- work that never happened. It now refuses instead.
--
-- The refusal lives here, not only at enqueue or in the pipeline: both of those
-- run before this function's advisory lock, so a learner can create the PRIVATE
-- row after either has passed. This is the only race-free point.
--
-- CREATE OR REPLACE preserves the function's ownership and privileges, so the
-- service_role grant from 20260913000032 still stands.
create or replace function public.finalize_lesson_creation_job(p_job_id uuid, p_lesson_id uuid, p_requester uuid,
  p_lease_token uuid, p_content jsonb default null)
returns public.lesson_creation_jobs language plpgsql security definer set search_path = '' as $$
declare j public.lesson_creation_jobs; v public.videos; chosen_transcript_id uuid; monthly_count bigint;
begin
  perform 1 from public.users where id = p_requester for update;
  select * into j from public.lesson_creation_jobs where id = p_job_id and requester_user_id = p_requester for update;
  if not found then return null; end if;
  if j.state = 'succeeded' then return j; end if;
  if j.state <> 'running' or j.lease_token is distinct from p_lease_token or j.lease_expires_at <= clock_timestamp() then
    raise exception 'stale_claim' using errcode = '40001';
  end if;
  -- Serializes shared lesson/transcript creation, including different requesters.
  perform pg_advisory_xact_lock(hashtextextended(j.youtube_video_id, 0));
  select * into v from public.videos where youtube_video_id = j.youtube_video_id for update;
  if p_lesson_id is not null and (v.id is null or v.id <> p_lesson_id) then
    raise exception 'lesson_mismatch' using errcode = '22023';
  end if;
  -- Owner ruling 2026-09-19. An admin job requests FREE/PLUS, and dedup never
  -- republishes an existing row, so there is nothing this job can truthfully
  -- report as done. Refuse before any content write, and leave lesson_id null:
  -- the requester must not be handed another learner's private lesson id.
  -- No `v.id is not null` guard: with no row `v` is all-null, so the comparison
  -- is null and the branch is not taken.
  if j.origin = 'admin' and v.library_access = 'PRIVATE' then
    update public.lesson_creation_jobs set state = 'failed', step = 'failed',
      public_error_code = 'existing_private_lesson', lease_expires_at = null, lease_token = null,
      completed_at = now(), updated_at = now()
      where id = j.id returning * into j;
    return j;
  end if;
  -- Refuse before any content write: creator visibility must not let a failed
  -- creation become studyable through the ordinary C3 library-add path.
  if j.origin = 'learner' and (v.id is null or v.library_access = 'PRIVATE') and not exists (
    select 1 from public.user_lesson_library where user_id = p_requester and lesson_id = v.id) then
    if not exists (select 1 from public.subscriptions s where s.user_id = p_requester and s.plan <> 'free' and s.status = 'active') then
      select count(*) into monthly_count from public.user_lesson_library ull join public.videos counted_video on counted_video.id = ull.lesson_id
        where ull.user_id = p_requester and counted_video.added_by_user_id = p_requester and counted_video.library_access = 'PRIVATE'
        and ull.added_at >= date_trunc('month', timezone('utc', now())) at time zone 'UTC';
      if monthly_count >= 3 then
        update public.lesson_creation_jobs set state = 'failed', step = 'failed', public_error_code = 'quota_exceeded',
          lease_expires_at = null, lease_token = null, completed_at = now(), updated_at = now()
          where id = j.id returning * into j;
        return j;
      end if;
    end if;
  end if;
  -- Match getTranscript: newest header, without filtering language or lines.
  select t.id into chosen_transcript_id from public.transcripts t
    where t.video_id = v.id order by t.created_at desc limit 1 for update;
  if not exists (select 1 from public.transcript_lines l where l.transcript_id = chosen_transcript_id) then
    if p_content is null or jsonb_typeof(p_content) <> 'object' or
      jsonb_typeof(p_content->'title') is distinct from 'string' or length(btrim(p_content->>'title')) = 0 or
      p_content->>'source' is distinct from 'youtube_caption' or
      jsonb_typeof(p_content->'lines') is distinct from 'array' then
      raise exception 'invalid_content' using errcode = '22023';
    end if;
    if jsonb_array_length(p_content->'lines') = 0 or exists (
      select 1 from jsonb_array_elements(p_content->'lines') line where
        jsonb_typeof(line) <> 'object' or jsonb_typeof(line->'start_time') is distinct from 'number' or
        jsonb_typeof(line->'text_jp') is distinct from 'string' or length(btrim(line->>'text_jp')) = 0 or
        (line->>'start_time')::numeric < 0 or
        (line->>'end_time' is not null and (jsonb_typeof(line->'end_time') <> 'number' or
          (line->>'end_time')::numeric < (line->>'start_time')::numeric)) or
        (line->>'text_translation' is not null and jsonb_typeof(line->'text_translation') <> 'string')
    ) or (p_content->>'thumbnail_url' is not null and jsonb_typeof(p_content->'thumbnail_url') <> 'string') then
      raise exception 'invalid_content' using errcode = '22023';
    end if;
    if v.id is null then
      insert into public.videos(youtube_video_id, title, thumbnail_url, added_by_user_id, library_access)
        values (j.youtube_video_id, p_content->>'title', p_content->>'thumbnail_url',
          case when j.origin = 'learner' then p_requester end, j.requested_library_access)
        on conflict (youtube_video_id) do nothing returning * into v;
      if v.id is null then select * into v from public.videos where youtube_video_id = j.youtube_video_id for update; end if;
    end if;
    -- Recheck the selected header after resolving a video uniqueness race.
    select t.id into chosen_transcript_id from public.transcripts t
      where t.video_id = v.id order by t.created_at desc limit 1 for update;
    if not exists (select 1 from public.transcript_lines l where l.transcript_id = chosen_transcript_id) then
      if chosen_transcript_id is null then
        insert into public.transcripts(video_id, source, language) values (v.id, 'youtube_caption', 'ja') returning id into chosen_transcript_id;
      else
        -- Repair the header playback actually selects, retaining older history.
        update public.transcripts set source = 'youtube_caption', language = 'ja' where id = chosen_transcript_id;
      end if;
      insert into public.transcript_lines(transcript_id, start_time, end_time, text_jp, text_translation, furigana_json)
        select chosen_transcript_id, l.start_time, l.end_time, l.text_jp, l.text_translation, l.furigana_json
        from jsonb_to_recordset(p_content->'lines') as l(start_time numeric, end_time numeric,
          text_jp text, text_translation text, furigana_json jsonb);
    end if;
  end if;
  if j.origin = 'learner' and v.library_access = 'PRIVATE' and not exists (
    select 1 from public.user_lesson_library where user_id = p_requester and lesson_id = v.id) then
    insert into public.user_lesson_library(user_id, lesson_id) values (p_requester, v.id) on conflict do nothing;
  end if;
  -- Reached only by a job that published or reused a lesson it may report. An
  -- admin dedup onto a PRIVATE lesson returned above and never arrives here.
  update public.lesson_creation_jobs set state = 'succeeded', step = 'ready', lesson_id = v.id,
    public_error_code = null, lease_expires_at = null, lease_token = null, completed_at = now(), updated_at = now()
    where id = j.id returning * into j;
  return j;
end;
$$;
