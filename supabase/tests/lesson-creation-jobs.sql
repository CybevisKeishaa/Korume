-- Live PostgreSQL acceptance gate for the lesson-creation job queue
-- (migration 20260913000032_lesson_creation_jobs.sql).
--
-- Source tests cannot stand in for this: the Supabase mock models no RLS
-- (docs/lessons.md L-005), and neither grants, partial unique indexes,
-- SECURITY DEFINER search_path, nor `for update skip locked` exist outside a
-- real server. Run it with `npm run verify:db:lesson-jobs`, which also runs
-- the two-session contention check this single-session file cannot express.
--
-- The script creates its own fixtures and removes them again, so it is
-- repeatable against a database that already holds data.
--
-- PRECONDITION, enforced below: no lesson-creation job may exist that this gate
-- did not create. The contention check claims from the shared queue and the
-- recovery check requeues expired leases, so a job left behind by another run
-- — the C4 browser acceptance abandons two in `running` when Playwright kills
-- its server — hands the two contending sessions different jobs to claim, and
-- the gate then fails with a confusing "one must claim and one must skip".
-- Run the gate BEFORE the browser acceptance, or reset the database between.

\set ON_ERROR_STOP on
\timing off

-- ---------------------------------------------------------------------------
-- Precondition: a queue this gate does not own makes its results meaningless.
-- ---------------------------------------------------------------------------
do $$
declare foreign_jobs bigint;
begin
  select count(*) into foreign_jobs from public.lesson_creation_jobs j
    where not exists (select 1 from auth.users u
      where u.id = j.requester_user_id and u.email like 'c4gate-%@example.invalid');
  if foreign_jobs > 0 then
    raise exception 'PRECONDITION FAIL  % lesson-creation job(s) this gate does not own are present; run `npx supabase db reset --no-seed` first', foreign_jobs;
  end if;
  raise notice 'PRECONDITION PASS  queue holds no job this gate does not own';
end $$;

-- ---------------------------------------------------------------------------
-- Fixture: three users owned by this gate alone.
-- ---------------------------------------------------------------------------
do $$
declare spec record;
begin
  delete from auth.users where email like 'c4gate-%@example.invalid';
  -- Also here, not only in teardown: a gate that raises skips its teardown, and
  -- a surviving video with a studyable transcript silently changes what the
  -- next run measures — F2's finalize would dedup instead of validating content
  -- and the failure would read as a regression in an unrelated gate.
  delete from public.videos where youtube_video_id like 'C4GATE%';
  for spec in select * from (values
    ('c4gate-a@example.invalid', false),
    ('c4gate-b@example.invalid', false),
    ('c4gate-admin@example.invalid', true)) as t(email, is_admin)
  loop
    insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
    values (gen_random_uuid(), '00000000-0000-0000-0000-000000000000', 'authenticated',
      'authenticated', spec.email, crypt('password123', gen_salt('bf')), now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{"name":"C4 gate"}'::jsonb);
    update public.users set is_admin = spec.is_admin where email = spec.email;
  end loop;

  if (select count(*) from public.users where email like 'c4gate-%@example.invalid') <> 3 then
    raise exception 'fixture failed: the auth trigger did not mirror three users';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- G1  Grants. authenticated reads only; event history is append-only.
-- ---------------------------------------------------------------------------
do $$
declare extra text; n int;
begin
  select string_agg(privilege_type, ',' order by privilege_type) into extra
  from information_schema.role_table_grants
  where grantee = 'authenticated' and table_schema = 'public'
    and table_name in ('lesson_creation_jobs', 'lesson_creation_job_events')
    and privilege_type <> 'SELECT';
  if extra is not null then raise exception 'G1 authenticated holds extra grants: %', extra; end if;

  select count(*) into n from information_schema.role_table_grants
  where grantee = 'authenticated' and table_schema = 'public'
    and table_name in ('lesson_creation_jobs', 'lesson_creation_job_events')
    and privilege_type = 'SELECT';
  if n <> 2 then raise exception 'G1 control failed: expected 2 SELECT grants, found %', n; end if;

  select count(*) into n from information_schema.role_table_grants
  where grantee = 'anon' and table_schema = 'public'
    and table_name in ('lesson_creation_jobs', 'lesson_creation_job_events');
  if n <> 0 then raise exception 'G1 anon holds % grants, expected 0', n; end if;

  -- The migration's contract is narrow: it revokes what could rewrite history.
  -- REFERENCES/TRIGGER survive from Supabase's default service_role grant and
  -- are deliberately not asserted here (docs/lessons.md L-031).
  select string_agg(privilege_type, ',' order by privilege_type) into extra
  from information_schema.role_table_grants
  where grantee = 'service_role' and table_schema = 'public'
    and table_name = 'lesson_creation_job_events'
    and privilege_type in ('UPDATE', 'DELETE', 'TRUNCATE');
  if extra is not null then raise exception 'G1 service_role can still rewrite events: %', extra; end if;

  select count(*) into n from information_schema.role_table_grants
  where grantee = 'service_role' and table_schema = 'public'
    and table_name = 'lesson_creation_job_events' and privilege_type in ('SELECT', 'INSERT');
  if n <> 2 then raise exception 'G1 control failed: service_role lacks append/read (found %)', n; end if;

  raise notice 'G1 PASS  authenticated select-only, anon none, events append-only';
end $$;

-- ---------------------------------------------------------------------------
-- G2/G3  Enqueue deduplicates, and the partial unique index enforces it.
-- ---------------------------------------------------------------------------
do $$
declare uid_a uuid; j1 public.lesson_creation_jobs; j2 public.lesson_creation_jobs;
  n int; blocked boolean := false;
begin
  select id into strict uid_a from public.users where email = 'c4gate-a@example.invalid';
  j1 := public.enqueue_lesson_creation_job(uid_a, 'learner', 'PRIVATE', 'C4GATEAAAAA');
  j2 := public.enqueue_lesson_creation_job(uid_a, 'learner', 'PRIVATE', 'C4GATEAAAAA');
  if j1.id is null then raise exception 'G2 control failed: first enqueue returned no job'; end if;
  if j1.id <> j2.id then raise exception 'G2 duplicate active job: % vs %', j1.id, j2.id; end if;
  select count(*) into n from public.lesson_creation_jobs
   where requester_user_id = uid_a and youtube_video_id = 'C4GATEAAAAA';
  if n <> 1 then raise exception 'G2 expected exactly 1 row, found %', n; end if;

  begin
    insert into public.lesson_creation_jobs(requester_user_id, origin, requested_library_access, youtube_video_id)
    values (uid_a, 'learner', 'PRIVATE', 'C4GATEAAAAA');
  exception when unique_violation then blocked := true;
  end;
  if not blocked then raise exception 'G3 a second active row was accepted'; end if;
  raise notice 'G2/G3 PASS  enqueue is idempotent and the partial unique index holds';
end $$;

-- ---------------------------------------------------------------------------
-- G4  Admin origin requires an admin requester.
-- ---------------------------------------------------------------------------
do $$
declare uid_a uuid; uid_admin uuid; denied boolean := false; j public.lesson_creation_jobs;
begin
  select id into strict uid_a from public.users where email = 'c4gate-a@example.invalid';
  select id into strict uid_admin from public.users where email = 'c4gate-admin@example.invalid';
  begin
    perform public.enqueue_lesson_creation_job(uid_a, 'admin', 'FREE', 'C4GATEBBBBB');
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'G4 a non-admin enqueued an admin job'; end if;
  j := public.enqueue_lesson_creation_job(uid_admin, 'admin', 'FREE', 'C4GATEBBBBB');
  if j.id is null then raise exception 'G4 control failed: admin enqueue returned no job'; end if;
  raise notice 'G4 PASS  admin origin denied for a learner, allowed for an admin';
end $$;

-- ---------------------------------------------------------------------------
-- G5/G6  Lease recovery, and the append-only event trail behind it.
-- ---------------------------------------------------------------------------
do $$
declare uid_b uuid; j_retry uuid; j_dead uuid; recovered int; st text; stp text;
  comp timestamptz; n int;
begin
  select id into strict uid_b from public.users where email = 'c4gate-b@example.invalid';

  insert into public.lesson_creation_jobs(requester_user_id, origin, requested_library_access,
    youtube_video_id, state, step, attempt_count, lease_expires_at, lease_token)
  values (uid_b, 'learner', 'PRIVATE', 'C4GATECCCCC', 'running', 'fetching_metadata', 1,
    now() - interval '1 minute', gen_random_uuid()) returning id into j_retry;

  insert into public.lesson_creation_jobs(requester_user_id, origin, requested_library_access,
    youtube_video_id, state, step, attempt_count, lease_expires_at, lease_token)
  values (uid_b, 'learner', 'PRIVATE', 'C4GATEDDDDD', 'running', 'fetching_metadata', 3,
    now() - interval '1 minute', gen_random_uuid()) returning id into j_dead;

  recovered := public.recover_expired_lesson_creation_jobs(now());
  if recovered <> 2 then raise exception 'G5 recovered %, expected 2', recovered; end if;

  select state::text, step::text into st, stp from public.lesson_creation_jobs where id = j_retry;
  if st <> 'queued' or stp <> 'deduplicating' then
    raise exception 'G5 attempt 1 became %/%, expected queued/deduplicating', st, stp;
  end if;
  -- A requeued job is healthy and must carry no public error code.
  if exists (select 1 from public.lesson_creation_jobs
    where id = j_retry and public_error_code is distinct from 'temporary_failure') then
    -- Review of `226d4a4`, finding I3, ruled 2026-09-19: M4 is reverted. The
    -- event trigger copies `public_error_code` from the row it is writing, so
    -- blanking it on requeue also blanks the append-only history — and lease
    -- recovery fires exactly when the worker died without writing a terminal
    -- transition, making that event the ONLY record of why the attempt ended.
    -- Design §5 ("retain their public error category", "rather than deleting
    -- evidence of the earlier failure") forbids that. The projection concern M4
    -- cited is unreachable: the sole reader gates on `state === 'failed'`.
    raise exception 'G5 requeued job lost its public_error_code';
  end if;
  raise notice 'G5a PASS  requeued job retains its transient category';

  select state::text, step::text, completed_at into st, stp, comp
    from public.lesson_creation_jobs where id = j_dead;
  if st <> 'failed' or stp <> 'failed' or comp is null then
    raise exception 'G5 attempt 3 became %/% completed_at=%, expected a terminal failure', st, stp, comp;
  end if;

  select count(*) into n from public.lesson_creation_job_events e
    join public.lesson_creation_jobs j on j.id = e.job_id
   where j.requester_user_id = uid_b;
  if n = 0 then raise exception 'G6 no event rows recorded - the trigger is not firing'; end if;
  raise notice 'G5/G6 PASS  requeued at attempt 1, terminal at attempt 3, % events recorded', n;
end $$;

-- ---------------------------------------------------------------------------
-- G7  RLS read isolation, exercised as the authenticated role.
-- ---------------------------------------------------------------------------
select id as uid_a from public.users where email = 'c4gate-a@example.invalid' \gset

begin;
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', :'uid_a', 'role', 'authenticated')::text, true) \gset discard_
do $$
declare mine int; foreign_rows int;
begin
  -- A null auth.uid() makes `<> auth.uid()` NULL for every row, the count comes
  -- back 0, and the check passes while measuring nothing (L-004).
  if auth.uid() is null then raise exception 'G7 control failed: auth.uid() is null'; end if;
  select count(*) into mine from public.lesson_creation_jobs;
  select count(*) into foreign_rows from public.lesson_creation_jobs
   where requester_user_id is distinct from auth.uid();
  if mine = 0 then raise exception 'G7 control failed: the learner sees no rows at all'; end if;
  if foreign_rows <> 0 then raise exception 'G7 the learner sees % foreign rows', foreign_rows; end if;
  raise notice 'G7a PASS  learner sees % own rows and 0 foreign rows', mine;
end $$;
commit;

begin;
set local role anon;
do $$
declare denied boolean := false; n int;
begin
  begin
    select count(*) into n from public.lesson_creation_jobs;
  exception when insufficient_privilege then denied := true;
  end;
  if not denied and n <> 0 then raise exception 'G7 anon read % rows', n; end if;
  raise notice 'G7b PASS  anon is refused (denied=%)', denied;
end $$;
commit;

-- ---------------------------------------------------------------------------
-- G8  service_role may append events, never rewrite them.
-- ---------------------------------------------------------------------------
begin;
set local role service_role;
do $$
declare blocked_update boolean := false; blocked_delete boolean := false; n int;
begin
  select count(*) into n from public.lesson_creation_job_events;
  if n = 0 then raise exception 'G8 control failed: no events exist to rewrite'; end if;
  begin
    update public.lesson_creation_job_events set step = 'ready' where true;
  exception when insufficient_privilege then blocked_update := true;
  end;
  begin
    delete from public.lesson_creation_job_events where true;
  exception when insufficient_privilege then blocked_delete := true;
  end;
  if not blocked_update then raise exception 'G8 service_role UPDATED an event row'; end if;
  if not blocked_delete then raise exception 'G8 service_role DELETED an event row'; end if;
  raise notice 'G8 PASS  service_role blocked from update and delete over % rows', n;
end $$;
commit;

-- ---------------------------------------------------------------------------
-- F1-F3  finalize: lease fencing, atomicity, success, and the free quota cap.
-- ---------------------------------------------------------------------------
do $$
declare
  uid_b uuid; tok uuid := '11111111-2222-3333-4444-555555555555'; job uuid;
  st text; stp text; err text; lesson uuid; att int; tok_after uuid; done boolean;
  raised text; n int;
  good jsonb := jsonb_build_object(
    'title', 'C4 gate lesson', 'thumbnail_url', null, 'source', 'youtube_caption',
    'lines', jsonb_build_array(jsonb_build_object(
      'start_time', 0, 'end_time', 2, 'text_jp', 'こんにちは',
      'text_translation', 'Hello', 'furigana_json', null)));
begin
  select id into strict uid_b from public.users where email = 'c4gate-b@example.invalid';
  delete from public.lesson_creation_jobs where requester_user_id = uid_b;

  insert into public.lesson_creation_jobs(requester_user_id, origin, requested_library_access,
    youtube_video_id, state, step, attempt_count, lease_expires_at, lease_token)
  values (uid_b, 'learner', 'PRIVATE', 'C4GATETTTTT', 'running', 'persisting', 1,
    now() + interval '10 minutes', tok) returning id into job;

  raised := null;
  begin
    perform public.finalize_lesson_creation_job(job, null, uid_b, gen_random_uuid(), good);
  exception when others then raised := sqlerrm;
  end;
  if raised is distinct from 'stale_claim' then
    raise exception 'F1 a foreign lease token raised %, expected stale_claim', coalesce(raised, '<nothing>');
  end if;

  raised := null;
  begin
    perform public.finalize_lesson_creation_job(job, null, uid_b, tok, null);
  exception when others then raised := sqlerrm;
  end;
  if raised is distinct from 'invalid_content' then
    raise exception 'F2 null content raised %, expected invalid_content', coalesce(raised, '<nothing>');
  end if;
  select state::text, step::text, attempt_count, lease_token into st, stp, att, tok_after
    from public.lesson_creation_jobs where id = job;
  if st <> 'running' or stp <> 'persisting' or att <> 1 or tok_after <> tok then
    raise exception 'F2 a refused finalize mutated the row: %/% attempt=%', st, stp, att;
  end if;
  if (select count(*) from public.videos where youtube_video_id = 'C4GATETTTTT') <> 0 then
    raise exception 'F2 a refused finalize created a video row';
  end if;
  raise notice 'F1/F2 PASS  lease fenced, invalid content refused with no partial write';

  perform public.finalize_lesson_creation_job(job, null, uid_b, tok, good);
  select state::text, step::text, lesson_id, public_error_code::text into st, stp, lesson, err
    from public.lesson_creation_jobs where id = job;
  if st <> 'succeeded' or stp <> 'ready' or lesson is null or err is not null then
    raise exception 'F3a valid finalize gave %/% lesson=% err=%', st, stp, lesson, err;
  end if;
  select count(*) into n from public.transcript_lines l
    join public.transcripts t on t.id = l.transcript_id where t.video_id = lesson;
  if n <> 1 then raise exception 'F3a expected 1 transcript line, found %', n; end if;
  if (select count(*) from public.user_lesson_library where user_id = uid_b and lesson_id = lesson) <> 1 then
    raise exception 'F3a the lesson did not reach the learner library';
  end if;
  raise notice 'F3a PASS  valid finalize succeeded and granted library membership';

  insert into public.videos(youtube_video_id, title, added_by_user_id, library_access)
  values ('C4GATEQ0001', 'q1', uid_b, 'PRIVATE'), ('C4GATEQ0002', 'q2', uid_b, 'PRIVATE');
  insert into public.user_lesson_library(user_id, lesson_id)
    select uid_b, id from public.videos where youtube_video_id in ('C4GATEQ0001', 'C4GATEQ0002');
  select count(*) into n from public.user_lesson_library ull
    join public.videos v on v.id = ull.lesson_id
   where ull.user_id = uid_b and v.added_by_user_id = uid_b and v.library_access = 'PRIVATE';
  if n <> 3 then raise exception 'F3b fixture failed: learner holds % private lessons, expected 3', n; end if;

  insert into public.lesson_creation_jobs(requester_user_id, origin, requested_library_access,
    youtube_video_id, state, step, attempt_count, lease_expires_at, lease_token)
  values (uid_b, 'learner', 'PRIVATE', 'C4GATEUUUUU', 'running', 'persisting', 1,
    now() + interval '10 minutes', tok) returning id into job;

  perform public.finalize_lesson_creation_job(job, null, uid_b, tok, good);
  select state::text, step::text, public_error_code::text, completed_at is not null
    into st, stp, err, done from public.lesson_creation_jobs where id = job;
  if st <> 'failed' or stp <> 'failed' or err <> 'quota_exceeded' or not done then
    raise exception 'F3b over-quota finalize gave %/% err=%', st, stp, err;
  end if;
  if (select count(*) from public.videos where youtube_video_id = 'C4GATEUUUUU') <> 0 then
    raise exception 'F3b a quota refusal still created a lesson';
  end if;
  raise notice 'F3b PASS  over-quota finalize failed terminally and wrote no lesson';
end $$;

-- ---------------------------------------------------------------------------
-- F4  Owner ruling 2026-09-19. An admin job requests FREE/PLUS; finalize never
--     republishes a row it deduped onto, so landing on a learner's PRIVATE
--     lesson must refuse rather than report `succeeded`. The lesson is given a
--     studyable transcript on purpose: without the refusal the function reaches
--     its success fallthrough, which is the defect being pinned.
-- ---------------------------------------------------------------------------
do $$
declare uid_admin uuid; uid_b uuid; job uuid; tok uuid := gen_random_uuid();
  lesson uuid; transcript uuid; st text; stp text; err text; reported uuid; access text;
begin
  select id into strict uid_admin from public.users where email = 'c4gate-admin@example.invalid';
  select id into strict uid_b from public.users where email = 'c4gate-b@example.invalid';

  insert into public.videos(youtube_video_id, title, added_by_user_id, library_access)
  values ('C4GATEPRIV1', 'a learner private lesson', uid_b, 'PRIVATE') returning id into lesson;
  insert into public.transcripts(video_id, source, language)
  values (lesson, 'youtube_caption', 'ja') returning id into transcript;
  insert into public.transcript_lines(transcript_id, start_time, end_time, text_jp)
  values (transcript, 0, 1.5, 'これは勉強です');

  insert into public.lesson_creation_jobs(requester_user_id, origin, requested_library_access,
    youtube_video_id, state, step, attempt_count, lease_expires_at, lease_token)
  values (uid_admin, 'admin', 'FREE', 'C4GATEPRIV1', 'running', 'persisting', 1,
    now() + interval '10 minutes', tok) returning id into job;

  perform public.finalize_lesson_creation_job(job, lesson, uid_admin, tok, null);
  select state::text, step::text, public_error_code::text, lesson_id
    into st, stp, err, reported from public.lesson_creation_jobs where id = job;
  if st <> 'failed' or stp <> 'failed' or err <> 'existing_private_lesson' then
    raise exception 'F4 admin dedup onto a PRIVATE lesson gave %/% err=%', st, stp, err;
  end if;
  if reported is not null then
    raise exception 'F4 the refusal disclosed a private lesson id';
  end if;
  select library_access::text into access from public.videos where youtube_video_id = 'C4GATEPRIV1';
  if access <> 'PRIVATE' then
    raise exception 'F4 the refusal published the learner lesson as %', access;
  end if;
  if exists (select 1 from public.user_lesson_library where lesson_id = lesson and user_id = uid_admin) then
    raise exception 'F4 the refusal granted the admin a personal library row';
  end if;
  raise notice 'F4 PASS  admin dedup onto a private lesson refused, disclosed nothing, published nothing';
end $$;

-- ---------------------------------------------------------------------------
-- F4b  The race F4 cannot reach, and the whole reason this rule lives in SQL.
--
--     F4 above passes a non-null `p_lesson_id` — the path `pipeline.ts` has
--     already short-circuited before finalize is called. Here the pipeline
--     found NOTHING, fetched captions, and calls finalize with
--     `p_lesson_id = null` and full content, while a learner created the
--     PRIVATE row in between. Both the enqueue check and the pipeline check ran
--     before the advisory lock and both saw an empty catalogue. Only this
--     refusal is race-free, and it must beat every content write (L-040).
-- ---------------------------------------------------------------------------
do $$
declare uid_admin uuid; uid_b uuid; job uuid; tok uuid := gen_random_uuid();
  lesson uuid; transcript uuid; st text; stp text; err text; reported uuid; access text;
  lines_before int; lines_after int;
  good jsonb := jsonb_build_object(
    'title', 'C4 gate race lesson', 'thumbnail_url', null, 'source', 'youtube_caption',
    'lines', jsonb_build_array(jsonb_build_object(
      'start_time', 0, 'end_time', 2, 'text_jp', 'これは割り込みです',
      'text_translation', 'This is the interleaving', 'furigana_json', null)));
begin
  select id into strict uid_admin from public.users where email = 'c4gate-admin@example.invalid';
  select id into strict uid_b from public.users where email = 'c4gate-b@example.invalid';

  -- The learner's lesson, created AFTER the admin job was enqueued and claimed.
  insert into public.videos(youtube_video_id, title, added_by_user_id, library_access)
  values ('C4GATERACE1', 'a learner private lesson', uid_b, 'PRIVATE') returning id into lesson;
  insert into public.transcripts(video_id, source, language)
  values (lesson, 'youtube_caption', 'ja') returning id into transcript;
  insert into public.transcript_lines(transcript_id, start_time, end_time, text_jp)
  values (transcript, 0, 1.5, 'これは学習者のものです');
  select count(*) into lines_before from public.transcript_lines where transcript_id = transcript;

  insert into public.lesson_creation_jobs(requester_user_id, origin, requested_library_access,
    youtube_video_id, state, step, attempt_count, lease_expires_at, lease_token)
  values (uid_admin, 'admin', 'FREE', 'C4GATERACE1', 'running', 'persisting', 1,
    now() + interval '10 minutes', tok) returning id into job;

  -- p_lesson_id null: the pipeline believed it was creating a brand-new lesson.
  perform public.finalize_lesson_creation_job(job, null, uid_admin, tok, good);

  select state::text, step::text, public_error_code::text, lesson_id
    into st, stp, err, reported from public.lesson_creation_jobs where id = job;
  if st <> 'failed' or stp <> 'failed' or err <> 'existing_private_lesson' then
    raise exception 'F4b admin finalize racing a new PRIVATE lesson gave %/% err=%', st, stp, err;
  end if;
  if reported is not null then
    raise exception 'F4b the refusal disclosed a private lesson id';
  end if;
  select library_access::text into access from public.videos where youtube_video_id = 'C4GATERACE1';
  if access <> 'PRIVATE' then
    raise exception 'F4b the refusal published the learner lesson as %', access;
  end if;
  select count(*) into lines_after from public.transcript_lines where transcript_id = transcript;
  if lines_after <> lines_before then
    raise exception 'F4b the refusal wrote content: % transcript lines, expected %', lines_after, lines_before;
  end if;
  raise notice 'F4b PASS  refusal beat the content write on the unlocked-check race';
end $$;

-- ---------------------------------------------------------------------------
-- F5  Review finding I2, 2026-09-19. A `queued` job that outlives the worker
-- must end; a queue that is merely busy must never be mistaken for a dead one;
-- and once ended, the learner must be able to get the lesson another way.
--
-- Only a live server shows any of this: the rule turns on `for update skip
-- locked`, on a partial unique index deciding whether a fresh enqueue is even
-- allowed, and on the event trigger appending the terminal row.
-- ---------------------------------------------------------------------------
do $$
declare uid_b uuid; j_stale uuid; j_fresh uuid; j_second uuid; j_live uuid; j_new uuid;
  j_backlog uuid; j_next uuid; j_backoff uuid;
  ended int; st text; stp text; err text; comp timestamptz; attempts int;
  events_before int; events_after int; expired int; window_refused boolean := false;
begin
  select id into strict uid_b from public.users where email = 'c4gate-b@example.invalid';

  -- Untouched for an hour: what the worker leaves behind when it is stopped.
  insert into public.lesson_creation_jobs(requester_user_id, origin, requested_library_access,
    youtube_video_id, state, step, attempt_count, available_at, created_at, updated_at)
  values (uid_b, 'learner', 'PRIVATE', 'C4GATESTAL1', 'queued', 'deduplicating', 0,
    now() - interval '1 hour', now() - interval '1 hour', now() - interval '1 hour')
  returning id into j_stale;

  -- Touched a minute ago: inside the window, and none of this may reach it.
  insert into public.lesson_creation_jobs(requester_user_id, origin, requested_library_access,
    youtube_video_id, state, step, attempt_count, available_at, created_at, updated_at)
  values (uid_b, 'learner', 'PRIVATE', 'C4GATEFRSH1', 'queued', 'deduplicating', 0,
    now() - interval '1 minute', now() - interval '1 minute', now() - interval '1 minute')
  returning id into j_fresh;

  insert into public.lesson_creation_jobs(requester_user_id, origin, requested_library_access,
    youtube_video_id, state, step, attempt_count, available_at, created_at, updated_at)
  values (uid_b, 'learner', 'PRIVATE', 'C4GATESTAL2', 'queued', 'deduplicating', 0,
    now() - interval '1 hour', now() - interval '1 hour', now() - interval '1 hour')
  returning id into j_second;

  -- F5a  A live lease anywhere means someone IS working: a single-concurrency
  -- worker makes a healthy job wait behind others, and the window alone would
  -- read that queue as dead.
  insert into public.lesson_creation_jobs(requester_user_id, origin, requested_library_access,
    youtube_video_id, state, step, attempt_count, lease_expires_at, lease_token)
  values (uid_b, 'learner', 'PRIVATE', 'C4GATELIVE1', 'running', 'fetching_metadata', 1,
    now() + interval '1 minute', gen_random_uuid()) returning id into j_live;

  ended := public.fail_stale_queued_lesson_creation_jobs(now(), 600, j_stale);
  if ended <> 0 then
    raise exception 'F5a ended % job(s) while a live lease existed, expected 0', ended;
  end if;
  select state::text into st from public.lesson_creation_jobs where id = j_stale;
  if st <> 'queued' then raise exception 'F5a a busy queue lost a job: %', st; end if;
  raise notice 'F5a PASS  a live lease anywhere holds the sweep off';

  -- F5b  With nothing holding a lease, the stale job ends. Only F5a's own row is
  -- expired: a queue-wide update standing in for this would silently neuter a
  -- future gate inserted above F5 that means to leave a live lease behind.
  update public.lesson_creation_jobs set lease_expires_at = now() - interval '1 minute'
    where id = j_live;
  get diagnostics expired = row_count;
  if expired <> 1 then raise exception 'F5b expected to expire 1 lease, expired %', expired; end if;
  -- The claim history must also fall outside the window, or the guard below reads
  -- F5a's own insert as a worker that acted recently. Scoped to this gate's own
  -- rows — every job owned by a `c4gate-%` user, which the PRECONDITION makes the
  -- whole queue — rather than every row in the table, for the same reason F5b's
  -- lease expiry above is scoped: an unscoped update would silently neuter a
  -- future gate that depends on event recency.
  update public.lesson_creation_job_events e set created_at = now() - interval '1 hour'
    where e.state = 'running' and exists (select 1 from public.lesson_creation_jobs j
      join public.users u on u.id = j.requester_user_id
      where j.id = e.job_id and u.email like 'c4gate-%@example.invalid');

  select count(*) into events_before from public.lesson_creation_job_events where job_id = j_stale;
  ended := public.fail_stale_queued_lesson_creation_jobs(now(), 600, j_stale);
  if ended <> 1 then raise exception 'F5b ended % job(s), expected 1', ended; end if;

  select state::text, step::text, public_error_code::text, completed_at, attempt_count
    into st, stp, err, comp, attempts from public.lesson_creation_jobs where id = j_stale;
  if st <> 'failed' or stp <> 'failed' or err <> 'temporary_failure' or comp is null then
    raise exception 'F5b stale job became %/% err=% completed_at=%', st, stp, err, comp;
  end if;
  -- The row never ran, so it owes no attempt.
  if attempts <> 0 then raise exception 'F5b the sweep spent an attempt: %', attempts; end if;
  select count(*) into events_after from public.lesson_creation_job_events where job_id = j_stale;
  if events_after <= events_before then
    raise exception 'F5b no event recorded for the terminal transition (% -> %)', events_before, events_after;
  end if;
  raise notice 'F5b PASS  stale queued job ended terminal and retryable after % lease(s) expired', expired;

  -- F5c  Inside the window, nothing happens.
  ended := public.fail_stale_queued_lesson_creation_jobs(now(), 600, j_fresh);
  select state::text into st from public.lesson_creation_jobs where id = j_fresh;
  if ended <> 0 or st <> 'queued' then
    raise exception 'F5c a job touched a minute ago was ended (% row(s), state %)', ended, st;
  end if;
  raise notice 'F5c PASS  a job inside the window is left alone';

  -- F5d  The queue-wide form (no job id). No TypeScript calls it — the worker pass
  -- must not sweep — but the SQL keeps it for this gate and for the deferred
  -- enqueue-path rule, so it is exercised here. The count IS asserted: earlier
  -- gates leave queued rows behind, yet every one is written through
  -- `enqueue`/`recover` with `updated_at = now()`, so none of them is stale.
  --
  -- A row that is stale by age but NOT yet due proves the `available_at` filter is
  -- doing something. Without it this gate stayed green while that filter was
  -- deleted, which is how a redundant-looking clause loses its only cover.
  insert into public.lesson_creation_jobs(requester_user_id, origin, requested_library_access,
    youtube_video_id, state, step, attempt_count, available_at, created_at, updated_at)
  values (uid_b, 'learner', 'PRIVATE', 'C4GATEBKOF1', 'queued', 'deduplicating', 1,
    now() + interval '1 hour', now() - interval '1 hour', now() - interval '1 hour')
  returning id into j_backoff;

  ended := public.fail_stale_queued_lesson_creation_jobs(now(), 600, null);
  if ended <> 1 then raise exception 'F5d queue-wide sweep ended %, expected 1', ended; end if;
  select state::text, public_error_code::text into st, err
    from public.lesson_creation_jobs where id = j_second;
  if st <> 'failed' or err <> 'temporary_failure' then
    raise exception 'F5d the queue-wide sweep left % (err %)', st, err;
  end if;
  select state::text into st from public.lesson_creation_jobs where id = j_backoff;
  if st <> 'queued' then
    raise exception 'F5d a job still inside its retry backoff was ended (state %)', st;
  end if;
  raise notice 'F5d PASS  the queue-wide form ends the stale row and spares the not-yet-due one';

  -- F5e  The point of all of it: the learner is no longer stuck. An ended job is
  -- retryable, and a fresh import of the same video is allowed again — both were
  -- impossible while the row sat in `queued`, because retry refuses anything but
  -- `failed` and enqueue returns the active row rather than making a new one.
  if (public.retry_lesson_creation_job(j_stale, uid_b)).state::text <> 'queued' then
    raise exception 'F5e retry did not requeue an aged-out job';
  end if;
  select id into j_new
    from public.enqueue_lesson_creation_job(uid_b, 'learner', 'PRIVATE', 'C4GATESTAL2');
  if j_new = j_second then
    raise exception 'F5e enqueue handed back the aged-out job instead of a new one';
  end if;
  raise notice 'F5e PASS  an aged-out job is retryable and its video re-importable';

  -- F5f  The window belongs to the caller, and an implausible one is refused
  -- rather than quietly applied.
  begin
    perform public.fail_stale_queued_lesson_creation_jobs(now(), 0, null);
  exception when others then
    if sqlstate <> '22023' then raise; end if;
    window_refused := true;
  end;
  if not window_refused then raise exception 'F5f a zero-second window was accepted'; end if;
  raise notice 'F5f PASS  an out-of-range window is refused';

  -- F5g  The case the first version of this rule got wrong, and the reason the
  -- guard reads the `running`-event history rather than the instantaneous lease
  -- set. The sweep then ran BETWEEN the recovery and the claim of a pass, so a
  -- healthy single-concurrency worker held no lease at that moment; with only a
  -- live-lease test, a backlog older than the window was failed wholesale — head
  -- first, because `claim` is FIFO. Reviewed and reproduced live, 2026-09-20.
  insert into public.lesson_creation_jobs(requester_user_id, origin, requested_library_access,
    youtube_video_id, state, step, attempt_count, available_at, created_at, updated_at)
  values (uid_b, 'learner', 'PRIVATE', 'C4GATEBKLG1', 'queued', 'deduplicating', 0,
    now() - interval '1 hour', now() - interval '1 hour', now() - interval '1 hour')
  returning id into j_backlog;

  -- The worker claimed ANOTHER job 30 seconds ago and is between jobs right now:
  -- no lease is held, and the queue is plainly moving. The event belongs to a
  -- different row on purpose — attached to `j_backlog` itself it would also pass a
  -- guard that only ever looked at the polled job's own history, and so would not
  -- show the clause is queue-wide.
  insert into public.lesson_creation_job_events(job_id, attempt_count, state, step, created_at)
  values (j_live, 1, 'running', 'fetching_metadata', now() - interval '30 seconds');

  ended := public.fail_stale_queued_lesson_creation_jobs(now(), 600, j_backlog);
  select state::text into st from public.lesson_creation_jobs where id = j_backlog;
  if ended <> 0 or st <> 'queued' then
    raise exception 'F5g a live worker lost the head of its own backlog (ended %, state %)', ended, st;
  end if;
  raise notice 'F5g PASS  a recent claim keeps a healthy backlog intact';

  -- F5h  And the sweep must not block itself. Ending one stranded job writes a
  -- `failed` event, never a `running` one, so the next learner's poll is not told
  -- the queue is moving and made to wait another full window.
  update public.lesson_creation_job_events e set created_at = now() - interval '1 hour'
    where e.state = 'running' and exists (select 1 from public.lesson_creation_jobs j
      join public.users u on u.id = j.requester_user_id
      where j.id = e.job_id and u.email like 'c4gate-%@example.invalid');
  insert into public.lesson_creation_jobs(requester_user_id, origin, requested_library_access,
    youtube_video_id, state, step, attempt_count, available_at, created_at, updated_at)
  values (uid_b, 'learner', 'PRIVATE', 'C4GATENEXT1', 'queued', 'deduplicating', 0,
    now() - interval '1 hour', now() - interval '1 hour', now() - interval '1 hour')
  returning id into j_next;

  ended := public.fail_stale_queued_lesson_creation_jobs(now(), 600, j_backlog);
  if ended <> 1 then raise exception 'F5h the first stranded job survived (%)', ended; end if;
  ended := public.fail_stale_queued_lesson_creation_jobs(now(), 600, j_next);
  if ended <> 1 then
    raise exception 'F5h the sweeper read its OWN write as queue progress (ended %)', ended;
  end if;
  raise notice 'F5h PASS  ending one stranded job does not strand the next';
end $$;

-- ---------------------------------------------------------------------------
-- Teardown. Deleting the auth users cascades to public.users and to the jobs.
-- ---------------------------------------------------------------------------
delete from public.videos where youtube_video_id like 'C4GATE%';
delete from auth.users where email like 'c4gate-%@example.invalid';

do $$
begin
  if (select count(*) from public.users where email like 'c4gate-%@example.invalid') <> 0 then
    raise exception 'teardown failed: gate users survive';
  end if;
  if (select count(*) from public.videos where youtube_video_id like 'C4GATE%') <> 0 then
    raise exception 'teardown failed: gate videos survive';
  end if;
end $$;

\echo 'lesson-creation job queue: all single-session gates passed'
