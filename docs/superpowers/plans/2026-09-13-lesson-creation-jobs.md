# C4 Lesson Creation Jobs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (\`- [ ]\`) syntax for tracking.

**Goal:** Replace synchronous learner/admin lesson creation with durable PostgreSQL jobs run by an explicitly enabled internal Node worker.

**Architecture:** PostgreSQL owns current job state, append-only transition history, lease claims, and final quota serialization. A guarded internal Node worker runs an idempotent caption pipeline; APIs enqueue/read/retry jobs and importer UI polls only the caller-owned durable projection.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, PostgreSQL/Supabase migrations and RLS, Zod, Vitest/RTL, Playwright.

**Spec:** \`docs/superpowers/specs/2026-09-13-lesson-creation-jobs-design.md\`

## Global Constraints

- Never download, re-host, proxy, or store video bytes; use only video IDs, metadata, captions, and the official YouTube IFrame Player API.
- Keep service-role credentials and worker control server-side; validate every API input with Zod.
- User job reads are owner-only; a foreign job and missing job both produce 404.
- \`LESSON_CREATION_WORKER_ENABLED\` permits only exact \`true\`, \`false\`, or unset; unset is deliberately disabled.
- Preserve existing \`user_lesson_library\` quota semantics; serialize its final decision. No-caption work never creates a successful personal-library row.
- Never render a percentage or ETA. Use only durable step events; retain keyboard access, live status, WCAG AA, and reduced-motion behaviour.
- Write tests red first. Mutation-check guards by reading the mutation back, observing focused red, then restoring from a verified copy.
- In this linked worktree, full Vitest commands use \`--exclude '.worktrees/**'\`.
- Do not alter C3 Explore contracts, the account-deletion scheduler switch, or user-owned root-worktree files.

---

## File structure

| File | Responsibility |
| --- | --- |
| \`supabase/migrations/20260913000032_lesson_creation_jobs.sql\` | Queue/event schema, RLS, indexes, and security-definer RPCs. |
| \`lib/lesson-creation/types.ts\` | Job state/step/error constants, parsers, and API-safe projection. |
| \`lib/lesson-creation/store.ts\` | Service-role RPC/query boundary. |
| \`lib/lesson-creation/pipeline.ts\` | Idempotent dedup → metadata → captions → furigana → persistence work. |
| \`lib/lesson-creation/worker.ts\` | One-at-a-time claimed execution, retry classification, lease recovery. |
| \`lib/lesson-creation/env.ts\`, \`start.ts\` | Explicit env contract and process-safe worker lifecycle. |
| \`app/api/videos/import/route.ts\` and job/admin routes | Learner/admin enqueue, status, and retry APIs. |
| \`components/video/use-lesson-creation-job.ts\` | Poll lifecycle and cleanup. |
| \`components/video/lesson-creation-progress.tsx\` | Accessible durable-progress presentation. |
| \`components/video/video-import-form.tsx\`, \`components/shadowing/hub-library-section.tsx\` | Consumers migrated from synchronous import. |
| \`docs/superpowers/run-state/c4-lesson-creation-jobs.md\` | Canonical state for this branch. |

### Task 1: Establish C4 run-state and typed domain contract

**Files:**
- Create: \`docs/superpowers/run-state/c4-lesson-creation-jobs.md\`
- Create: \`lib/lesson-creation/types.ts\`
- Test: \`lib/lesson-creation/types.test.ts\`

**Consumes:** the approved C4 design and existing \`lesson_access_level\`.

**Produces:** the one canonical \`LessonCreationJobProjection\` parser used by store, routes, worker, and UI.

- [ ] **Step 1: Write the failing domain-contract test.**

\`\`\`ts
expect(LESSON_CREATION_JOB_STATES).toEqual(["queued", "running", "succeeded", "failed"]);
expect(isTerminalJobState("succeeded")).toBe(true);
expect(isTerminalJobState("queued")).toBe(false);
expect(lessonCreationJobProjectionSchema.safeParse(validProjection).success).toBe(true);
expect(lessonCreationJobProjectionSchema.safeParse({ ...validProjection, state: "ready" }).success).toBe(false);
\`\`\`

- [ ] **Step 2: Run it to confirm red.**

Run: \`npm test -- lib/lesson-creation/types.test.ts --reporter=dot\`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Add the branch run-state.**

Record branch name, approved spec/plan paths, the measured baseline command, the task checklist, and the requirement to read this run-state before every resume. Cite lessons by id rather than restating them.

- [ ] **Step 4: Implement the canonical types/parsers.**

\`\`\`ts
export const LESSON_CREATION_JOB_STATES = ["queued", "running", "succeeded", "failed"] as const;
export const LESSON_CREATION_STEPS = [
  "deduplicating", "fetching_metadata", "fetching_transcript",
  "enriching_furigana", "persisting", "ready", "failed",
] as const;
export interface LessonCreationJobProjection {
  id: string; state: LessonCreationJobState; step: LessonCreationStep;
  attemptCount: number; lessonId: string | null;
  publicErrorCode: LessonCreationErrorCode | null; updatedAt: string;
}
\`\`\`

Build Zod parsers from those constants; database-only lease/requester fields must not be exposed by the projection.

- [ ] **Step 5: Verify and commit.**

Run: \`npm test -- lib/lesson-creation/types.test.ts --reporter=dot; npm run typecheck\`

\`\`\`bash
git add docs/superpowers/run-state/c4-lesson-creation-jobs.md lib/lesson-creation/types.ts lib/lesson-creation/types.test.ts
git commit -m "feat(shadowing): define lesson creation job contract"
\`\`\`

### Task 2: Add durable schema, RLS, and atomic RPCs

**Files:**
- Create: \`supabase/migrations/20260913000032_lesson_creation_jobs.sql\`
- Create: \`supabase/migrations/20260913000032_lesson_creation_jobs.test.ts\`

**Consumes:** Task 1 state/step values and existing user, video, transcript, library, subscription schema.

**Produces:** \`lesson_creation_jobs\`, append-only events, RLS, claim/recovery/transition/finalize RPCs.

- [ ] **Step 1: Write failing migration contract tests.**

Gather the C4 migration by its exact filename; assert its collection is non-empty and has length one. Assert it defines both tables, enables RLS, contains requester-only reads, a partial active-job unique index, \`FOR UPDATE SKIP LOCKED\`, requester-row quota locking, and no forbidden downloader/media-byte identifier.

- [ ] **Step 2: Confirm red.**

Run: \`npm test -- supabase/migrations/20260913000032_lesson_creation_jobs.test.ts --reporter=dot\`

Expected: FAIL because the migration path is absent.

- [ ] **Step 3: Implement schema and RPCs.**

Create \`lesson_creation_jobs\` with requester FK cascade, origin/access, canonical YouTube id, state/step, attempt count, availability, lease, optional lesson id, safe error code, and timestamps. Create append-only \`lesson_creation_job_events\`; add terminal-pair checks, due/lease indexes, and a partial unique active index on \`(requester_user_id, youtube_video_id)\`.

Implement security-definer functions with an explicit search path:

\`\`\`sql
enqueue_lesson_creation_job(p_requester uuid, p_origin lesson_creation_origin,
  p_access lesson_access_level, p_youtube_video_id text)
claim_lesson_creation_job(p_now timestamptz, p_lease_seconds integer)
transition_lesson_creation_job(p_job_id uuid, p_expected_state lesson_creation_job_state,
  p_step lesson_creation_step, p_available_at timestamptz, p_error lesson_creation_error_code)
finalize_lesson_creation_job(p_job_id uuid, p_lesson_id uuid, p_requester uuid)
retry_lesson_creation_job(p_job_id uuid, p_requester uuid)
recover_expired_lesson_creation_jobs(p_now timestamptz)
\`\`\`

Claim increments attempts and appends its event atomically. Finalize locks the requester, preserves current quota semantics, creates only rightful membership, and writes terminal state/event atomically. No RPC calls an external provider or holds a transaction over a network request.

- [ ] **Step 4: Apply/read back and mutation-check.**

Run: \`npm exec -- supabase db reset; npm exec -- supabase db diff --local\`

Query tables/functions after reset. Copy the migration, remove the active-state index predicate, read that changed source line, observe focused red, then restore from the verified copy and rerun green. Repeat for the requester RLS predicate.

- [ ] **Step 5: Commit.**

\`\`\`bash
git add supabase/migrations/20260913000032_lesson_creation_jobs.sql supabase/migrations/20260913000032_lesson_creation_jobs.test.ts
git commit -m "feat(shadowing): add durable lesson creation queue"
\`\`\`

### Task 3: Implement the queue store

**Files:**
- Create: \`lib/lesson-creation/store.ts\`
- Create: \`lib/lesson-creation/store.test.ts\`
- Modify: \`test/supabase-mock.ts\`

**Consumes:** Task 1 parsers and Task 2 RPCs.

**Produces:** a provider-free persistence boundary; no API/UI/YouTube logic.

- [ ] **Step 1: Write failing store tests.**

Cover active/new enqueue mapping, malformed RPC rows, requester-owned lookup, foreign lookup returning \`null\`, terminal-only retry, claim, transition, finalize, and expired-lease recovery. Each test asserts the exact RPC name and argument object.

- [ ] **Step 2: Confirm red.**

Run: \`npm test -- lib/lesson-creation/store.test.ts --reporter=dot\`

Expected: FAIL for the missing store and mock \`rpc\`.

- [ ] **Step 3: Extend the mock narrowly and implement the store.**

Add \`rpc(name, args)\` recording to \`test/supabase-mock.ts\`; an unregistered RPC must throw. Implement:

\`\`\`ts
enqueueLessonCreation(input): Promise<EnqueueResult>
getRequesterJob(jobId, requesterId): Promise<LessonCreationJobProjection | null>
retryRequesterJob(jobId, requesterId): Promise<RetryResult>
claimNextLessonCreationJob(now): Promise<ClaimedLessonCreationJob | null>
transitionClaimedJob(input): Promise<void>
finalizeClaimedJob(input): Promise<FinalizeOutcome>
recoverExpiredLessonCreationJobs(now): Promise<number>
\`\`\`

Create a service client per operation, parse every returned row, and throw database errors instead of converting them to an empty queue.

- [ ] **Step 4: Mutation-check ownership, verify, and commit.**

Temporarily omit requester scope from \`getRequesterJob\`, read it back, observe the foreign-owner test red, restore from verified copy, then run the focused suite green.

\`\`\`bash
git add lib/lesson-creation/store.ts lib/lesson-creation/store.test.ts test/supabase-mock.ts
git commit -m "feat(shadowing): add lesson creation job store"
\`\`\`

### Task 4: Build an idempotent pipeline and worker pass

**Files:**
- Create: \`lib/lesson-creation/pipeline.ts\`
- Create: \`lib/lesson-creation/pipeline.test.ts\`
- Create: \`lib/lesson-creation/worker.ts\`
- Create: \`lib/lesson-creation/worker.test.ts\`
- Modify: \`lib/data/lesson-creation.ts\`, \`lib/data/lesson-creation.test.ts\`

**Consumes:** Task 3 store, existing \`parseVideoId\`, oEmbed, caption provider, furigana, and library helpers.

**Produces:** the only code path that calls metadata/caption providers and persists complete transcript results.

- [ ] **Step 1: Write failing deterministic pipeline/worker tests.**

Inject a clock and provider dependencies. Cover public/private dedup, new metadata-caption-furigana success, no-caption terminal failure, one transient failure with backoff, exhausted retry, and restart after each durable step. Assert that no fixture contains a video download/media-byte URL.

- [ ] **Step 2: Confirm red.**

Run: \`npm test -- lib/lesson-creation/pipeline.test.ts lib/lesson-creation/worker.test.ts --reporter=dot\`

Expected: FAIL for missing modules.

- [ ] **Step 3: Define injected pipeline dependencies and advance durably.**

\`\`\`ts
export interface LessonCreationDependencies {
  findExistingLesson(youtubeVideoId: string): Promise<VideoRow | null>;
  fetchOembed(youtubeVideoId: string): Promise<{ title: string; thumbnailUrl: string }>;
  fetchCaptions(youtubeVideoId: string): Promise<CaptionResult | null>;
  toFurigana(text: string): Promise<unknown>;
}
\`\`\`

Re-read durable state before every step. Furigana failure is logged per line and yields \`null\`, never a failed usable transcript. Persist a complete transcript as one idempotent database outcome, then finalise exactly once.

- [ ] **Step 4: Implement worker semantics.**

\`\`\`ts
export const MAX_LESSON_CREATION_ATTEMPTS = 3;
export function retryDelayMs(attempt: number): number;
export async function runLessonCreationPass(now: Date, deps?: LessonCreationDependencies): Promise<LessonCreationPassResult>;
\`\`\`

Recover leases, claim at most one job, classify only explicit transient provider/database conditions as retryable, and return \`claimed\`, \`succeeded\`, \`requeued\`, \`failed\`, and \`recovered\` counts. A job failure cannot crash the process; invalid store data must not be silently accepted.

- [ ] **Step 5: Mutation-check, verify, and commit.**

Remove a durable-state re-read, confirm restart coverage red; set retry delay to zero, confirm backoff coverage red; restore both from copies and rerun focused green.

\`\`\`bash
git add lib/lesson-creation lib/data/lesson-creation.ts lib/data/lesson-creation.test.ts
git commit -m "feat(shadowing): process lesson creation jobs asynchronously"
\`\`\`

### Task 5: Start the internal worker exactly once per Node process

**Files:**
- Create: \`lib/lesson-creation/env.ts\`, \`lib/lesson-creation/env.test.ts\`
- Create: \`lib/lesson-creation/start.ts\`, \`lib/lesson-creation/start.test.ts\`
- Modify: \`instrumentation.ts\`, \`.env.local.example\`

**Consumes:** Task 4 pass and existing env/scheduler lifecycle patterns.

**Produces:** explicit, observable, guarded worker startup.

- [ ] **Step 1: Write failing env/start tests.**

Test legal values; reject \`1\`, \`TRUE\`, \`yes\`; disabled mode makes no interval and logs its variable; enabled mode immediately passes and creates one unref'd interval; repeat start creates one interval; an overlapping tick does not claim again.

- [ ] **Step 2: Confirm red.**

Run: \`npm test -- lib/lesson-creation/env.test.ts lib/lesson-creation/start.test.ts --reporter=dot\`

Expected: FAIL for missing modules.

- [ ] **Step 3: Implement explicit env and lifecycle.**

\`\`\`ts
export const lessonCreationWorkerEnvSchema = z.object({
  LESSON_CREATION_WORKER_ENABLED: z.enum(["true", "false"]).optional(),
});
export function startLessonCreationWorker(): void;
export function resetLessonCreationWorkerForTests(): void;
\`\`\`

Register the env spec before \`validateEnv()\` in Node-only \`instrumentation.ts\`. Use \`Symbol.for("korume.lesson-creation-worker.started")\`, an unref'd short interval, immediate pass, overlap boolean, and structured logging. Do not change \`SCHEDULER_ENABLED\` or reuse its deletion cadence.

- [ ] **Step 4: Verify/mutation-check/commit.**

Replace the exact-true gate with unconditional start, read it back, observe disabled test red, restore, then run focused tests plus \`npm run typecheck\`.

\`\`\`bash
git add lib/lesson-creation/env.ts lib/lesson-creation/env.test.ts lib/lesson-creation/start.ts lib/lesson-creation/start.test.ts instrumentation.ts .env.local.example
git commit -m "feat(shadowing): start internal lesson creation worker"
\`\`\`

### Task 6: Replace synchronous learner/admin endpoints with job APIs

**Files:**
- Create: \`lib/validation/lesson-creation.ts\`, \`lib/validation/lesson-creation.test.ts\`
- Modify/Create: \`app/api/videos/import/route.ts\`, \`route.test.ts\`
- Create: \`app/api/lesson-creation-jobs/[id]/route.ts\`, \`route.test.ts\`
- Create: \`app/api/lesson-creation-jobs/[id]/retry/route.ts\`, \`route.test.ts\`
- Create: \`app/api/admin/lesson-creation-jobs/route.ts\`, \`route.test.ts\`
- Create: \`app/api/admin/lesson-creation-jobs/[id]/route.ts\`
- Create: \`app/api/admin/lesson-creation-jobs/[id]/retry/route.ts\`

**Consumes:** Tasks 1, 3, and 5.

**Produces:** owner-safe \`202 { data: JobProjection }\` interfaces.

- [ ] **Step 1: Write failing API tests.**

Learner: malformed JSON/URL 400, anonymous 401, rate limit 429 with \`Retry-After\`, advisory quota 403, disabled worker 503, new/active enqueue 202. Status: foreign and missing both 404. Retry: failed 202; queued/running/succeeded 409. Admin: existing guard, Zod-reject \`PRIVATE\`, forced \`origin: "admin"\`, shared queue shape.

- [ ] **Step 2: Confirm red.**

Run: \`npm test -- lib/validation/lesson-creation.test.ts app/api/videos/import/route.test.ts app/api/lesson-creation-jobs --reporter=dot\`

Expected: FAIL because current import returns synchronous 201 data and routes are absent.

- [ ] **Step 3: Implement schemas and routes.**

\`\`\`ts
export const enqueueLessonCreationSchema = z.object({ youtubeUrl: z.string().trim().url() });
export const adminEnqueueLessonCreationSchema = enqueueLessonCreationSchema.extend({
  libraryAccess: z.enum(["FREE", "PLUS"]),
});
\`\`\`

Keep learner \`POST /api/videos/import\` but return 202 job projection. Validate UUID params. Never accept requester/origin/state/attempt from the client. Status/retry lookup obtains identity first and maps foreign/missing identically. Admin status/retry stays scoped to the requesting admin, not all admin jobs.

- [ ] **Step 4: Mutation-check non-disclosure and commit.**

Return 403 for a foreign status temporarily, read back, observe foreign/missing equivalence test red, restore, and rerun focused green.

\`\`\`bash
git add lib/validation/lesson-creation.ts lib/validation/lesson-creation.test.ts app/api/videos app/api/lesson-creation-jobs app/api/admin/lesson-creation-jobs
git commit -m "feat(shadowing): expose lesson creation job APIs"
\`\`\`

### Task 7: Render durable accessible progress in both importer surfaces

**Files:**
- Create: \`components/video/use-lesson-creation-job.ts\`, \`use-lesson-creation-job.test.tsx\`
- Create: \`components/video/lesson-creation-progress.tsx\`, \`lesson-creation-progress.test.tsx\`
- Modify: \`components/video/video-import-form.tsx\`, \`video-import-form.test.tsx\`
- Modify: \`components/shadowing/hub-library-section.tsx\`, \`hub-library-section.test.tsx\`
- Modify: \`messages/en/videos.json\`, \`messages/vi/videos.json\`, affected pin tests

**Consumes:** Task 1 projection and Task 6 endpoints.

**Produces:** one polling lifecycle and one presentational mapping, used by both existing importers.

- [ ] **Step 1: Write failing hook/UI tests.**

Use fake timers/fetch. Prove 202 begins polling; only durable \`step\` alters completed UI; polling stops at terminal state/unmount/job-id change; no UI contains percentage/ETA; failure exposes keyboard retry; live-region update works; reduced motion does not hide state or change polling.

- [ ] **Step 2: Confirm red.**

Run: \`npm test -- components/video/use-lesson-creation-job.test.tsx components/video/lesson-creation-progress.test.tsx components/video/video-import-form.test.tsx components/shadowing/hub-library-section.test.tsx --reporter=dot\`

Expected: FAIL because current forms navigate after synchronous 201 data.

- [ ] **Step 3: Add copy before pins and implement shared UI.**

Add matching EN/VI state/error/retry/worker-unavailable copy, then update pins per L-027.

\`\`\`ts
export function useLessonCreationJob(jobId: string | null, options: {
  onSucceeded(job: LessonCreationJobProjection): void;
}): LessonCreationJobPollingState;
export function LessonCreationProgress(props: {
  job: LessonCreationJobProjection; onRetry(): Promise<void>;
}): JSX.Element;
\`\`\`

Use cleanup via timer plus \`AbortController\`; \`role="status"\` for durable non-error transitions and \`role="alert"\` for terminal errors. Map technical step to approved learner labels; do not animate required information.

- [ ] **Step 4: Migrate consumers, mutation-check, and commit.**

Both surfaces enqueue and display the returned job; success refreshes and routes via \`lessonId\`; failure stays in context. Remove polling cleanup, read it back, prove unmount test red; hard-code \`ready\` for a transcript fixture, prove truthfulness test red; restore both, rerun green.

\`\`\`bash
git add components/video components/shadowing/hub-library-section.tsx components/shadowing/hub-library-section.test.tsx messages/en/videos.json messages/vi/videos.json messages
git commit -m "feat(shadowing): show durable lesson creation progress"
\`\`\`

### Task 8: Integration, browser acceptance, documentation, and whole-branch gate

**Files:**
- Create: \`tests/e2e/lesson-creation-jobs.spec.ts\`
- Modify: \`supabase/seed.sql\`
- Modify: \`docs/superpowers/specs/2026-07-31-shadowing-hub-lesson-workspace-design.md\`
- Modify: \`docs/design/screens/screen-shadowing-hub.md\`
- Modify: \`docs/superpowers/run-state/c4-lesson-creation-jobs.md\`
- Modify: \`docs/lessons.md\` only when new evidence belongs in an existing entry.

**Consumes:** Tasks 1–7.

**Produces:** database/browser evidence and a review-ready branch.

- [ ] **Step 1: Write the failing browser acceptance.**

Seed an authenticated learner and deterministic caption-provider seam. Submit URL, observe Preparing → transcript/building → Ready, then route to owned lesson. In a no-caption case, reach failure and activate Retry with keyboard. Assert no progress text contains \`%\`, \`ETA\`, or estimated-time language.

- [ ] **Step 2: Confirm red, apply/read back fixture, then implement the deterministic seam.**

Run: \`npm exec -- playwright test tests/e2e/lesson-creation-jobs.spec.ts --config=playwright.c3.config.ts\`

Apply \`npm exec -- supabase db reset\`, read the fixture rows/tables/functions back, start only a fresh worker-enabled local server, and stop only its recorded PID after browser verification. Never call a real YouTube endpoint.

- [ ] **Step 3: Reconcile documents and run final gates.**

Update older C2 wording and Hub screen docs to state C4 durable per-step progress/no ETA. Then run:

\`\`\`bash
npm test -- --exclude '.worktrees/**' --reporter=json --outputFile scratch/c4-final-vitest.json
npm run typecheck
npm run lint
npm run build
git diff --check
npm exec -- supabase db reset
npm exec -- playwright test tests/e2e/lesson-creation-jobs.spec.ts --config=playwright.c3.config.ts
\`\`\`

Read the Vitest JSON, database rows/functions, browser result, and working tree. Record commands, not stale totals, in run-state.

- [ ] **Step 4: Whole-branch review, fix wave, lessons, commit.**

Review \`c1a14e9..HEAD\` against C4, constructing restart and concurrent-enqueue sequences. TDD every accepted review fix, re-review the fix wave, and restore any mutation from a verified copy rather than git checkout/stash. Merge evidence into an existing lesson only when warranted.

\`\`\`bash
git add tests/e2e/lesson-creation-jobs.spec.ts supabase/seed.sql docs/superpowers/specs/2026-07-31-shadowing-hub-lesson-workspace-design.md docs/design/screens/screen-shadowing-hub.md docs/superpowers/run-state/c4-lesson-creation-jobs.md docs/lessons.md
git commit -m "test(shadowing): verify lesson creation jobs end to end"
\`\`\`
