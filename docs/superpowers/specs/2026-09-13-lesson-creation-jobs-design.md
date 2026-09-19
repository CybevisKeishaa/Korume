# C4 Lesson Creation Jobs — Design

> **Status:** Approved by the product owner on 2026-09-13. This is the
> canonical design for C4; it extends the Create Lesson contract in
> `docs/superpowers/specs/2026-07-31-shadowing-hub-lesson-workspace-design.md`.

## 1. Goal

C4 replaces the request-bound Create Lesson pipeline with a durable,
asynchronous job system. A learner or administrator submits a YouTube URL,
receives a job immediately, and sees only progress that has been persisted.
The existing single long-running Node deployment runs an internal worker; a
process restart, a transient provider failure, or two people submitting the
same video must not lose work or create duplicate study content.

This is a reliability change, not a change to Korume's content or media
policy. Video continues to play only through the official YouTube IFrame
Player API. The system stores video identifiers, metadata, captions,
transcript data, and learning data; it never downloads, proxies, or stores
video bytes.

## 2. Scope and non-goals

### In scope

- A PostgreSQL-backed queue for both learner and administrator lesson creation.
- Durable step/state transitions, leases, restart recovery, bounded retry, and
  idempotent reruns.
- A single Node-internal worker, started from `instrumentation.ts` only when
  explicitly enabled by environment configuration.
- Learner and admin enqueue/status/retry API contracts.
- Polling UI for the Hub importer, the legacy video importer, and unavailable
  lesson retry controls.
- Truthful user-facing step labels and accessible pending/failed/retry states.
- Deterministic database, worker, API, and UI tests.

### Out of scope

- AI transcript generation, manual transcript editing, a generic job dashboard,
  WebSockets/SSE, and estimated completion times.
- Changing monthly quota product rules, library access rules, promotion, or
  C3 Explore catalogue behavior.
- A second process, managed queue, Redis, hosted scheduler, or serverless
  worker platform.
- Downloading/re-hosting any platform video or changing the official-player
  playback architecture.

## 3. Existing contracts retained

`lib/data/lesson-creation.ts` is currently synchronous. Its externally
observable rules remain true after C4:

1. Parse and validate a YouTube URL before beginning durable work.
2. Find existing lessons through the service-role client, because RLS hides a
   private lesson from a user who does not yet hold its library row.
3. A visible `FREE`/`PLUS` lesson is returned without creating a library row or
   consuming a personal-create quota.
4. A private lesson becomes available to a requester only after a complete,
   studyable transcript exists and the requester has the required library row.
5. A no-caption attempt never creates a studyable lesson or consumes a
   successful personal-creation slot.
6. `user_lesson_library` remains the source of truth for library membership and
   the existing monthly quota calculation. C4 may recheck it atomically, but
   may not silently redefine which historical library rows count.

The old synchronous function is removed only after all its consumers have
moved to the enqueue contract; admin creation uses the same worker pipeline,
not a second implementation.

## 4. Durable data model

Migration C4 introduces these private operational tables and types.

### 4.1 `lesson_creation_jobs`

Each row is a requested creation, owned by its requesting authenticated user.
It contains:

- `id uuid primary key`.
- `requester_user_id uuid not null references users(id) on delete cascade`.
- `origin lesson_creation_origin not null` (`learner` or `admin`) and
  `requested_library_access lesson_access_level not null`. Learner jobs always
  request `PRIVATE`; admin jobs request `FREE` or `PLUS`.
- `youtube_video_id text not null`, parsed before insertion. The raw submitted
  URL is not retained because it is no longer needed after parsing.
- `state lesson_creation_job_state not null` (`queued`, `running`,
  `succeeded`, `failed`), `step lesson_creation_step not null`, and
  `available_at timestamptz not null default now()`.
- `attempt_count integer not null default 0`, `lease_expires_at timestamptz`,
  `lesson_id uuid references videos(id) on delete set null`, and timestamp
  columns for creation, update, and completion.
- `public_error_code lesson_creation_error_code nullable`. It is a stable,
  translated-safe category rather than a provider exception, URL, credential,
  or stack trace.

The steps are `deduplicating`, `fetching_metadata`, `fetching_transcript`,
`enriching_furigana`, `persisting`, `ready`, and `failed`. `ready` only occurs
after the final durable lesson/library result exists; `failed` only occurs when
the job is terminal. The state/step pair is constrained so impossible pairs
cannot be written.

There is a partial unique index on `(requester_user_id, youtube_video_id)` for
active rows (`queued` and `running`). Re-submitting the same video while an
active job exists returns that job rather than starting duplicate work. Jobs
from different requesters may coexist: each is independently entitled to its
own final library result, while the worker's service-role deduplication and
the unique `videos.youtube_video_id` constraint arbitrate the shared lesson.

### 4.2 `lesson_creation_job_events`

This append-only audit is the durable progress record. Each event stores job
id, attempt number, the transition's state/step, optional public error code,
and `created_at`. Service-role code is its only writer. It preserves a failed
attempt when a user retries instead of overwriting the reason with a later
attempt.

`lesson_creation_jobs` is the current projection for reads; events are the
history used to audit retries and recoverability. No raw external error is
stored in either table.

### 4.3 Access and lifecycle

RLS is enabled on both tables. An authenticated requester may `SELECT` only
their own jobs and events. There are no client write policies: enqueue,
retry, claims, transitions, and final persistence happen through server code
and narrowly scoped security-definer RPCs. The requester FK cascades during
the existing delete-all-data flow, so jobs and events do not outlive a user.

## 5. State machine, leases, and retry

The legal lifecycle is:

```
queued -> running -> succeeded
                  -> queued (transient failure / retry delay)
                  -> failed (permanent failure or exhausted attempts)
failed -> queued  (explicit requester retry)
running -> queued (expired lease after worker interruption)
```

`available_at` makes a queued job ineligible until its retry delay expires.
A database claim operation selects one eligible queued job with row locking,
sets `running`, increments `attempt_count`, assigns a short lease, and appends
an event in the same transaction. It neither keeps a database transaction open
while calling YouTube nor trusts process memory as ownership.

The worker extends the lease around each durable step transition. Startup and
each tick requeue expired running jobs; a recovery consumes an attempt and the
same maximum-attempt policy as an ordinary retry. The first implementation is
intentionally single-concurrency per process. Claiming remains atomic so a
future second process cannot execute the same row concurrently.

Transient failures use bounded exponential backoff and retain their public
error category. Permanent failures include malformed input discovered before
enqueue, unavailable metadata, no supported transcript, and final quota
refusal. The exact retryable provider-error allowlist lives in one worker
classification module. There are three total execution attempts; an explicit
user retry starts a new numbered attempt sequence on the same job and appends
events, rather than deleting evidence of the earlier failure.

## 6. Pipeline idempotency and quota safety

The worker executes the following persisted pipeline. Every step begins by
reading current durable state and may safely run again after an interruption.

1. **Deduplicate.** Service-role lookup checks `youtube_video_id`. Published
   lessons finish immediately; existing complete private lessons continue only
   to the final requester-membership decision.

   An **admin** job deduping onto a `PRIVATE` lesson is refused instead
   (owner ruling, 2026-09-19). Persist never republishes a row it deduped onto,
   so such a job would otherwise end `succeeded` having published nothing, and
   would report another learner's lesson id as its result. It ends `failed`
   with `existing_private_lesson` and no lesson id. The refusal is authoritative
   **inside the persist operation's advisory lock** — the enqueue and pipeline
   checks below are early exits, and the row can appear after either has passed.
   Retry stays available: an admin may publish the lesson by other means, or the
   learner may delete it, and the condition then clears.
2. **Fetch metadata.** A new lesson obtains oEmbed metadata. Metadata failure
   is terminal and no video row is created.
3. **Fetch transcript.** The supported caption provider returns captions or a
   truthful no-caption outcome. No video media data is requested or retained.
4. **Enrich furigana.** Furigana remains best effort per caption line; a line
   may carry `null` furigana without making a usable transcript fail.
5. **Persist.** A security-definer database operation writes or reuses the
   video/transcript/transcript-lines result as one idempotent outcome, then
   makes the requester's library/quota decision under a per-user lock. It
   records the job's final lesson and transition atomically.

The persist operation is deliberately the only point that can add a successful
private library row for a new personal creation. It rechecks the current plan
and quota while holding the user's lock, preventing several concurrently
finishing jobs from all seeing the same remaining slot. An advisory quota check
at enqueue may give a quick, honest `403` when the user is already exhausted;
the final locked check remains authoritative. Work may therefore be performed
for a concurrently submitted job that later loses the final slot, but a quota
race cannot create more successful rows than the contract permits.

Transcript persistence is atomic from the application's perspective: a job
cannot be marked ready after only a transcript header or only some lines have
been written. A restart before that database operation repeats it safely; a
restart after it finds the complete persisted transcript and proceeds to the
same final result. This eliminates the old synchronous pipeline's partial
transcript window.

## 7. Node worker and configuration

`instrumentation.ts` remains the sole startup site. A new
`LESSON_CREATION_WORKER_ENABLED` environment spec accepts only `"true"`,
`"false"`, or unset (unset means deliberately disabled in local/test/build
contexts). Invalid near-miss values fail startup. Production on almostgone.vn
sets it to `true`.

When enabled, `startLessonCreationWorker()` uses a `Symbol.for` process guard,
per the established scheduler pattern, performs immediate recovery/claim work,
then runs an unref'd short polling interval with an overlap guard. It logs a
structured pass result (claimed, succeeded, requeued, failed, recovered) and
catches top-level errors so one bad pass cannot crash the application. It does
not share the account-deletion scheduler's feature switch or cadence: lesson
creation is user-visible work and must not wait for a deletion-oriented
one-minute tick.

When disabled, enqueue endpoints return `503` before recording a job. The UI
shows a generic try-again-later state rather than presenting an indefinitely
pending lesson. The enabled flag is never inferred from `NODE_ENV` or the
presence of another credential.

## 8. API contracts

### 8.1 Learner

`POST /api/videos/import` remains the public learner entry point to avoid
breaking existing forms. It validates JSON and the YouTube URL, authenticates
the requester, performs the advisory quota/active-job decision, and returns
`202 { data: JobProjection }` for a newly queued or already-active job. It no
longer blocks on metadata or captions and no longer returns a lesson `201`.

`GET /api/lesson-creation-jobs/:id` returns the requester's current projection
and its safe event history. It returns `401` when anonymous and `404` when the
job is absent or belongs to someone else, avoiding an ownership oracle.

`POST /api/lesson-creation-jobs/:id/retry` accepts only a terminal failed job
owned by the requester, clears the current public error, queues a new attempt,
and returns `202`. It returns `409` for jobs that are already active or
succeeded.

Synchronous validation/auth/rate-limit responses remain explicit (`400`,
`401`, `403`, `429`, `503`). Job-time failures are represented in the status
projection instead of pretending that a `202` means a lesson was created.

### 8.2 Admin

The admin Create Lesson endpoint validates the same URL, requires the existing
admin guard, accepts only `FREE` or `PLUS` requested access, and enqueues the
same job with `origin = admin`. It returns the same job projection and uses the
same status/retry machinery; it never calls a special synchronous transcript
path. Admins can read/retry only jobs they requested through the admin route.

It answers `409` when an existing `PRIVATE` lesson already occupies the video,
with its own message rather than the `503` copy: "temporarily unavailable" would
tell the admin to wait, and this condition does not clear on its own. The check
is a courtesy ahead of §6's authoritative one, not a substitute for it.

All API input has Zod validation. Service-role credentials remain server-only;
no worker control or database RPC is callable from the browser.

## 9. User experience and accessibility

The Hub importer, generic `VideoImportForm`, and unavailable-card retry action
enqueue once and poll the returned job while it remains active. They map
durable technical steps to the approved learner language:

| Durable work | Learner presentation |
| --- | --- |
| `deduplicating`, `fetching_metadata` | Preparing lesson |
| `fetching_transcript` | Finding transcript |
| `enriching_furigana`, `persisting` | Building lesson |
| `ready` | Ready to study |

The UI marks completed lines only after the matching durable event is visible.
It shows no percentage and no ETA: no worker measurement is authoritative
enough to make either promise. On success it refreshes server data and sends
the learner to the lesson. On failure it retains the accessible error status
and exposes a keyboard-operable retry action. Polling stops on terminal state,
unmount, and a replaced job id. Reduced-motion preference affects only
decoration; progress and retry remain fully usable without animation.

All new copy is localized in both supported message catalogs. Pending controls
preserve an accessible name, status updates use an appropriate live region,
and errors never rely on colour alone.

## 10. Verification strategy

Implementation follows TDD and mutation checks.

- Migration/RPC tests prove RLS ownership, active-job deduplication, legal
  transitions, atomic claim exclusivity, lease recovery, and per-user quota
  serialization. Pattern-derived collections assert non-empty expected size.
- Worker tests use a deterministic clock and providers to prove normal
  completion, no-caption failure, transient backoff, exhausted retry, explicit
  retry history, restart after each step, and idempotent final persistence.
- API tests prove request validation, auth/ownership non-disclosure, disabled
  worker `503`, response shapes, and the admin/learner shared pipeline.
- React tests prove step rendering, polling cleanup, failure/retry, keyboard
  use, live status, and reduced-motion behavior. Browser coverage verifies the
  learner path against the local Supabase fixture.
- Guard tests are mutation-checked by reading the temporary mutation back,
  observing the focused test turn red, and restoring from a verified copy.

The branch completion gate runs typecheck, lint, the full Vitest scope excluding
`.worktrees/**`, migration reset/integration coverage, a production build, the
scoped Playwright path, `git diff --check`, task review, whole-branch review,
and a `docs/lessons.md` evidence pass.

## 11. Documentation impact

The implementation updates the 2026-07-31 lesson-workspace design's C2
addendum to replace its temporary client-only Building wording with this
durable C4 contract. It updates the Shadowing Hub screen documentation and
the environment example with the explicit worker switch. Operational lessons
belong only in `docs/lessons.md`, with evidence from this branch.
