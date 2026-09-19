-- C4: durable metadata/caption work. All provider work happens before RPC calls.
-- Rollback: stop the worker, export jobs/events if retention is required, then run
-- the DOWN block below. It removes C4 operational history, never lesson content.
create type public.lesson_creation_origin as enum ('learner', 'admin');
create type public.lesson_creation_job_state as enum ('queued', 'running', 'succeeded', 'failed');
create type public.lesson_creation_step as enum ('deduplicating', 'fetching_metadata', 'fetching_transcript', 'enriching_furigana', 'persisting', 'ready', 'failed');
create type public.lesson_creation_error_code as enum ('metadata_unavailable', 'transcript_unavailable', 'quota_exceeded', 'temporary_failure', 'existing_private_lesson');

create table public.lesson_creation_jobs (
  id uuid primary key default gen_random_uuid(),
  requester_user_id uuid not null references public.users(id) on delete cascade,
  origin public.lesson_creation_origin not null,
  requested_library_access public.lesson_access_level not null,
  youtube_video_id text not null check (youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'),
  state public.lesson_creation_job_state not null default 'queued',
  step public.lesson_creation_step not null default 'deduplicating',
  attempt_count integer not null default 0 check (attempt_count between 0 and 3),
  available_at timestamptz not null default now(),
  lease_expires_at timestamptz,
  lease_token uuid,
  lesson_id uuid references public.videos(id) on delete set null,
  public_error_code public.lesson_creation_error_code,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  check ((origin = 'learner' and requested_library_access = 'PRIVATE') or
         (origin = 'admin' and requested_library_access in ('FREE', 'PLUS'))),
  check ((state = 'succeeded') = (step = 'ready')),
  check ((state = 'failed') = (step = 'failed')),
  check ((state = 'running') = (lease_expires_at is not null and lease_token is not null)),
  check (state = 'running' or (lease_expires_at is null and lease_token is null)),
  check ((state in ('succeeded', 'failed')) = (completed_at is not null)),
  check (state <> 'failed' or public_error_code is not null),
  check (state <> 'succeeded' or public_error_code is null)
);
create unique index lesson_creation_jobs_active
  on public.lesson_creation_jobs (requester_user_id, youtube_video_id)
  where state in ('queued', 'running');
create index lesson_creation_jobs_due on public.lesson_creation_jobs (available_at, created_at) where state = 'queued';
create index lesson_creation_jobs_leases on public.lesson_creation_jobs (lease_expires_at) where state = 'running';
create index lesson_creation_jobs_requester on public.lesson_creation_jobs (requester_user_id, created_at desc);

create table public.lesson_creation_job_events (
  id bigint generated always as identity primary key,
  job_id uuid not null references public.lesson_creation_jobs(id) on delete cascade,
  attempt_count integer not null check (attempt_count between 0 and 3),
  state public.lesson_creation_job_state not null,
  step public.lesson_creation_step not null,
  public_error_code public.lesson_creation_error_code,
  created_at timestamptz not null default now(),
  check ((state = 'succeeded') = (step = 'ready')),
  check ((state = 'failed') = (step = 'failed'))
);
create index lesson_creation_job_events_history on public.lesson_creation_job_events (job_id, id);
-- Claims only: `fail_stale_queued_lesson_creation_jobs` asks "was a worker alive
-- inside the window?", and a `running` event is the only record of one acting.
create index lesson_creation_job_events_claims on public.lesson_creation_job_events (created_at)
  where state = 'running';
alter table public.lesson_creation_jobs enable row level security;
alter table public.lesson_creation_job_events enable row level security;
create policy lesson_creation_jobs_read on public.lesson_creation_jobs for select to authenticated
  using (requester_user_id = auth.uid());
create policy lesson_creation_job_events_read on public.lesson_creation_job_events for select to authenticated
  using (exists (select 1 from public.lesson_creation_jobs j
    where j.id = job_id and j.requester_user_id = auth.uid()));
revoke all on public.lesson_creation_jobs, public.lesson_creation_job_events from anon, authenticated;
grant select on public.lesson_creation_jobs, public.lesson_creation_job_events to authenticated;
grant select, insert, update, delete on public.lesson_creation_jobs to service_role;
grant select, insert on public.lesson_creation_job_events to service_role;
revoke update, delete, truncate on public.lesson_creation_job_events from service_role;
grant usage, select on sequence public.lesson_creation_job_events_id_seq to service_role;

-- Trigger owns event appends, including enqueue, explicit retry and crash recovery.
create function public.record_lesson_creation_job_event() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.lesson_creation_job_events(job_id, attempt_count, state, step, public_error_code)
  values (new.id, new.attempt_count, new.state, new.step, new.public_error_code);
  return new;
end;
$$;
create trigger lesson_creation_jobs_event after insert or update on public.lesson_creation_jobs
  for each row execute function public.record_lesson_creation_job_event();

create function public.enqueue_lesson_creation_job(p_requester uuid, p_origin public.lesson_creation_origin,
  p_access public.lesson_access_level, p_youtube_video_id text)
returns public.lesson_creation_jobs language plpgsql security definer set search_path = '' as $$
declare j public.lesson_creation_jobs;
begin
  -- Same lock order as retry/finalize; resolves active dedup without exception races.
  perform 1 from public.users where id = p_requester for update;
  if not found then raise exception 'requester_not_found' using errcode = 'P0002'; end if;
  if p_origin = 'admin' and not exists (select 1 from public.users where id = p_requester and is_admin) then
    raise exception 'admin_required' using errcode = '42501';
  end if;
  select * into j from public.lesson_creation_jobs
    where requester_user_id = p_requester and youtube_video_id = p_youtube_video_id and state in ('queued', 'running');
  if found then return j; end if;
  insert into public.lesson_creation_jobs(requester_user_id, origin, requested_library_access, youtube_video_id)
    values (p_requester, p_origin, p_access, p_youtube_video_id) returning * into j;
  return j;
end;
$$;

create function public.claim_lesson_creation_job(p_now timestamptz, p_lease_seconds integer)
returns public.lesson_creation_jobs language plpgsql security definer set search_path = '' as $$
declare j public.lesson_creation_jobs;
begin
  if p_now is null or p_lease_seconds is null or p_lease_seconds not between 1 and 600 then
    raise exception 'invalid_lease' using errcode = '22023';
  end if;
  select * into j from public.lesson_creation_jobs
    where state = 'queued' and available_at <= p_now and attempt_count < 3
    order by available_at, created_at, id for update skip locked limit 1;
  if not found then return null; end if;
  update public.lesson_creation_jobs set state = 'running', step = 'deduplicating',
    attempt_count = attempt_count + 1, lease_token = gen_random_uuid(),
    lease_expires_at = p_now + make_interval(secs => p_lease_seconds), updated_at = p_now,
    public_error_code = null where id = j.id returning * into j;
  return j;
end;
$$;

-- p_available_at is non-null only for a transient requeue; p_error without it
-- makes a terminal failure. Ordinary steps renew the lease. Never accepts ready.
create function public.transition_lesson_creation_job(p_job_id uuid, p_expected_state public.lesson_creation_job_state,
  p_step public.lesson_creation_step, p_available_at timestamptz, p_error public.lesson_creation_error_code,
  p_lease_token uuid, p_lease_seconds integer default 120)
returns public.lesson_creation_jobs language plpgsql security definer set search_path = '' as $$
declare j public.lesson_creation_jobs;
begin
  select * into j from public.lesson_creation_jobs where id = p_job_id for update;
  if not found then return null; end if;
  if p_expected_state is distinct from 'running' or j.state <> 'running' or
    j.lease_token is distinct from p_lease_token or j.lease_expires_at <= clock_timestamp() then
    raise exception 'stale_claim' using errcode = '40001';
  end if;
  if p_step is null or p_step = 'ready' or p_lease_seconds is null or p_lease_seconds not between 1 and 600 or
    (p_error is null and (p_step = 'failed' or p_available_at is not null)) or
    (p_available_at is not null and p_error is distinct from 'temporary_failure') then
    raise exception 'invalid_transition' using errcode = '22023';
  end if;
  update public.lesson_creation_jobs set
    state = case when p_error is null then 'running'::public.lesson_creation_job_state
      when p_available_at is not null and attempt_count < 3 then 'queued' else 'failed' end,
    step = case when p_error is null then p_step
      when p_available_at is not null and attempt_count < 3 then 'deduplicating' else 'failed' end,
    public_error_code = p_error, available_at = coalesce(p_available_at, available_at),
    lease_expires_at = case when p_error is null then clock_timestamp() + make_interval(secs => p_lease_seconds) end,
    lease_token = case when p_error is null then lease_token end,
    completed_at = case when p_error is not null and (p_available_at is null or attempt_count >= 3) then now() end,
    updated_at = now() where id = j.id returning * into j;
  return j;
end;
$$;

create function public.retry_lesson_creation_job(p_job_id uuid, p_requester uuid)
returns public.lesson_creation_jobs language plpgsql security definer set search_path = '' as $$
declare j public.lesson_creation_jobs;
begin
  perform 1 from public.users where id = p_requester for update;
  select * into j from public.lesson_creation_jobs where id = p_job_id and requester_user_id = p_requester for update;
  if not found then return null; end if;
  if j.state <> 'failed' or exists (select 1 from public.lesson_creation_jobs
    where requester_user_id = p_requester and youtube_video_id = j.youtube_video_id and state in ('queued', 'running')) then
    raise exception 'job_not_retryable' using errcode = '23505';
  end if;
  update public.lesson_creation_jobs set state = 'queued', step = 'deduplicating', attempt_count = 0,
    public_error_code = null, completed_at = null, available_at = now(), updated_at = now()
    where id = j.id returning * into j;
  return j;
end;
$$;

create function public.recover_expired_lesson_creation_jobs(p_now timestamptz)
returns integer language plpgsql security definer set search_path = '' as $$
declare recovered integer;
begin
  with expired as (select id from public.lesson_creation_jobs
    where state = 'running' and lease_expires_at <= p_now for update skip locked)
  update public.lesson_creation_jobs j set
    state = case when attempt_count < 3 then 'queued'::public.lesson_creation_job_state else 'failed' end,
    step = case when attempt_count < 3 then 'deduplicating'::public.lesson_creation_step else 'failed' end,
    -- The category is retained on a requeue, deliberately. The event trigger
    -- copies this column into the append-only history, and lease recovery fires
    -- exactly when the worker died without writing a terminal transition — so
    -- this event is the only record of why the attempt ended. Design §5:
    -- "retain their public error category", "rather than deleting evidence of
    -- the earlier failure". A reader must gate on `state`, as the only one does.
    public_error_code = 'temporary_failure', lease_expires_at = null, lease_token = null,
    available_at = p_now, updated_at = p_now, completed_at = case when attempt_count >= 3 then p_now end
    from expired where j.id = expired.id;
  get diagnostics recovered = row_count;
  return recovered;
end;
$$;
-- Review finding I2. A `queued` job outlives the worker whenever the process is
-- stopped or dies after the row was recorded: `claim` never reaches it, lease
-- recovery above only touches `running`, `retry` refuses anything but `failed`,
-- and `enqueue` keeps returning it as the active job for that video — so the
-- learner cannot re-import it either. Design §7 forbids presenting an
-- indefinitely pending lesson; this is the rule that ends one.
--
-- The window alone must not decide it. A single-concurrency worker makes a job
-- wait a long time behind others while being perfectly healthy, which is exactly
-- why the client-side poll budget was removed, so the age test is paired with a
-- condition no number can express: has the WORKER acted lately?
--
-- That question is answered by the one act only the worker performs — claiming.
-- `claim` is the sole writer of `state = 'running'`, and the event trigger records
-- every one, so a `running` event inside the window means a worker was alive
-- inside the window. A live lease is the same fact seen directly, and is kept as
-- the cheap index-backed half.
--
-- An instantaneous "does anything hold a live lease" test is NOT enough, and was
-- the first version of this guard: `runLessonCreationPass` sweeps between its
-- recovery and its claim, which is precisely when a single-concurrency worker
-- holds no lease, so a healthy worker working through a backlog would fail the
-- head of its own queue — the exact outcome the pairing exists to prevent.
-- Reviewed 2026-09-20; reproduced against a live database before this fix.
--
-- The claim-event signal is also what keeps this sweep from blocking itself: the
-- sweeper writes a `failed` event and never a `running` one, so ending one
-- stranded job does not read as progress and leave the next learner waiting
-- another full window.
--
-- `updated_at`, not `created_at`: a transient requeue touches it, so a job that
-- is being retried on schedule is never stale. `attempt_count` is left alone —
-- the row never ran, so it owes no attempt, and `retry` resets the counter anyway.
--
-- p_job_id narrows it to one row (the learner's own status read, after that read
-- has proven ownership); null sweeps the queue (each worker pass). Both callers
-- share this one definition of "stale".
create function public.fail_stale_queued_lesson_creation_jobs(p_now timestamptz,
  p_max_age_seconds integer, p_job_id uuid default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare ended integer;
begin
  if p_now is null or p_max_age_seconds is null or p_max_age_seconds not between 60 and 86400 then
    raise exception 'invalid_stale_window' using errcode = '22023';
  end if;
  if exists (select 1 from public.lesson_creation_jobs
    where state = 'running' and lease_expires_at > p_now)
    or exists (select 1 from public.lesson_creation_job_events
      where state = 'running'
        and created_at > p_now - make_interval(secs => p_max_age_seconds)) then
    return 0;
  end if;
  with stale as (select id from public.lesson_creation_jobs
    where state = 'queued' and available_at <= p_now
      and updated_at <= p_now - make_interval(secs => p_max_age_seconds)
      and (p_job_id is null or id = p_job_id) for update skip locked)
  update public.lesson_creation_jobs j set
    state = 'failed', step = 'failed', public_error_code = 'temporary_failure',
    lease_expires_at = null, lease_token = null,
    available_at = p_now, updated_at = p_now, completed_at = p_now
    from stale where j.id = stale.id;
  get diagnostics ended = row_count;
  return ended;
end;
$$;


-- Payload: {title, thumbnail_url: string|null, source: "youtube_caption",
-- lines: [{start_time, end_time: number|null, text_jp,
-- text_translation: string|null, furigana_json: JSON|null}]}. Null reuses a
-- studyable lesson. The server validates/sanitizes caption content before RPC.
create function public.finalize_lesson_creation_job(p_job_id uuid, p_lesson_id uuid, p_requester uuid,
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
  --
  -- This is the AUTHORITATIVE half of the rule. The enqueue refusal and the
  -- pipeline's early exit both run before this advisory lock, so a learner can
  -- create the PRIVATE row after either has passed; only here is it race-free.
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

-- Explicit signatures prevent accidentally granting a future overload.
revoke all on function public.record_lesson_creation_job_event(),
  public.enqueue_lesson_creation_job(uuid, public.lesson_creation_origin, public.lesson_access_level, text),
  public.claim_lesson_creation_job(timestamptz, integer),
  public.transition_lesson_creation_job(uuid, public.lesson_creation_job_state, public.lesson_creation_step, timestamptz, public.lesson_creation_error_code, uuid, integer),
  public.retry_lesson_creation_job(uuid, uuid), public.recover_expired_lesson_creation_jobs(timestamptz),
  public.fail_stale_queued_lesson_creation_jobs(timestamptz, integer, uuid),
  public.finalize_lesson_creation_job(uuid, uuid, uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.enqueue_lesson_creation_job(uuid, public.lesson_creation_origin, public.lesson_access_level, text),
  public.claim_lesson_creation_job(timestamptz, integer),
  public.transition_lesson_creation_job(uuid, public.lesson_creation_job_state, public.lesson_creation_step, timestamptz, public.lesson_creation_error_code, uuid, integer),
  public.retry_lesson_creation_job(uuid, uuid), public.recover_expired_lesson_creation_jobs(timestamptz),
  public.fail_stale_queued_lesson_creation_jobs(timestamptz, integer, uuid),
  public.finalize_lesson_creation_job(uuid, uuid, uuid, uuid, jsonb) to service_role;

/* DOWN (manual, destructive only to C4 job/event history; export first):
drop function public.enqueue_lesson_creation_job(uuid, public.lesson_creation_origin, public.lesson_access_level, text);
drop function public.claim_lesson_creation_job(timestamptz, integer);
drop function public.transition_lesson_creation_job(uuid, public.lesson_creation_job_state, public.lesson_creation_step, timestamptz, public.lesson_creation_error_code, uuid, integer);
drop function public.retry_lesson_creation_job(uuid, uuid);
drop function public.recover_expired_lesson_creation_jobs(timestamptz);
drop function public.fail_stale_queued_lesson_creation_jobs(timestamptz, integer, uuid);
drop function public.finalize_lesson_creation_job(uuid, uuid, uuid, uuid, jsonb);
drop table public.lesson_creation_job_events;
drop table public.lesson_creation_jobs;
drop function public.record_lesson_creation_job_event();
drop type public.lesson_creation_error_code, public.lesson_creation_step, public.lesson_creation_job_state, public.lesson_creation_origin;
*/
