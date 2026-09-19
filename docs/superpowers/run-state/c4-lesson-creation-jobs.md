# Branch Run State

## Goal and scope

Branch: `c4-lesson-creation-jobs`; base: `c1a14e9`.

Replace the synchronous lesson-import path with a durable, idempotent
asynchronous job queue: typed contract, Postgres queue schema and RPCs, a
service-role store, a restartable pipeline/worker, an explicit Node worker
lifecycle, learner and admin APIs, and the progress UI.

C4 is a backend subsystem, not a Figma screen port. It is outside the
`shadowing-hub-plan-c` spec by that spec's own § Out of scope.

## Authorities

- `AGENTS.md`, `docs/lessons.md`, `.codex/docs/workflow.md`.
- Design: `docs/superpowers/specs/2026-09-13-lesson-creation-jobs-design.md`.
- Plan: `docs/superpowers/plans/2026-09-13-lesson-creation-jobs.md`.
  The design wins over the plan if they differ.
- Machine-local ledger `.superpowers/sdd/2026-09-13-lesson-creation-jobs/progress.md`
  carries dispatch, review, fix-round and ruling evidence. It is gitignored, so
  it is not branch-durable — this file is.
- Task 1 controls cite `L-001`, `L-004`, `L-011`, `L-026`, `L-028` by id only.

## Accepted commits

| Task | Implementation | Fix rounds | Review |
| --- | --- | --- | --- |
| 1 — typed job contract | `84236b6` | `b8c7648` | approved after R1 |
| 2 — queue schema and RPCs | `9ff79f9` | `6817f07` | approved after R1 |
| 3 — service-role store | `1a72ace` | `485ec28` | APPROVE after re-review |
| 4 — idempotent pipeline and worker pass | `bcb073a` | `fdcd5af` | APPROVE after R1 |
| 5 — Node worker lifecycle | `8c6fb4b` | `13267fc`, `0cb3567` | R1 approved; **R2 unreviewed** |
| 6 — learner/admin job APIs | `d4080ba` (schemas), `45d7684` (routes) | `19c0d09` | R1 CHANGES REQUIRED, all three closed |
| 7 — durable progress UI | `ba90db8` (copy), `002f993` (hook, component, both consumers) | — | covered by the whole-branch review |
| 8 — integration, browser, docs | `e20f2f9` (carried findings), `b4290d5` (e2e, docs, PostgREST fix) | — | covered by the whole-branch review |

Live database gate: `ed0a8f0`.
Checkpoints: `8a77112`, `c6f40de`, `bb72328`.

All eight tasks are implemented. The mandatory whole-branch review is the
remaining gate before merge.

## Contracts and decisions

- The store is the only TypeScript persistence boundary; worker code never
  writes SQL directly.
- `finalize_lesson_creation_job` extends the plan's three-argument signature
  with typed JSON payload and attempt/lease-fence arguments, in that order.
  SQL validates and persists atomically; all provider and network work stays
  outside the transaction.
- Default pipeline dedup goes through a narrow store helper proving the newest
  transcript header has at least one line. A header alone cannot satisfy
  finalization's studyable-transcript contract.
- The worker runs at most one recovered-and-claimed job per pass, on its own
  5s cadence, deliberately decoupled from the account-deletion scheduler.
- `LESSON_CREATION_WORKER_ENABLED` accepts exactly `"true"`, `"false"` or
  unset; unset is disabled. Startup validation rejects anything else.
- The synchronous path is GONE, not retired in place: `lib/data/lesson-creation.ts`
  and `lib/youtube/schema.ts` were deleted in `e20f2f9` once the routes switched,
  with their re-export chain. `lib/validation/lesson-creation.ts` is now the only
  home of the YouTube URL contract.
- `POST /api/videos/import` keeps its path and request body and now answers
  `202 { data: JobProjection }`. A `202` never means a lesson exists.
- A job read or retry is scoped to its requester, and a foreign job answers
  exactly as a missing one does (`404`, same body). Event history is read only
  `getRequesterJobWithEvents` is the single entry point: the events table
  carries no requester column and the store reads it through the service role,
  so the history read is not exported on its own and reading it without proving
  ownership is not expressible. It also caps history at the newest 60 rows.
- A 403 carries a `reason` (`quota_exceeded` or `not_admin`), mapped to copy by
  `lessonCreationRefusalMessage`. Each path has exactly one 403 source today, so
  a route could infer the message from the status — until a second reason
  appears and inherits the wrong words.
- Enqueue refusal order: identity → rate limit → worker enabled → this
  learner's quota. A disabled worker must not answer "out of quota", and no
  job is recorded for a worker that will not run.
- The advisory quota refusal fires **only where a charge is certain** — the
  video has no lesson row yet. A visible FREE/PLUS lesson, or a PRIVATE one
  the learner already holds, costs no quota (design §3 rules 3 and 4), so an
  exhausted learner must still reach it. An unheld PRIVATE lesson while
  exhausted is left to the worker's `quota_exceeded`. Finalize's three-clause
  predicate is deliberately NOT restated in TypeScript.
- Both retry endpoints carry their own per-user rate-limit budget: a retry
  resets `attempt_count` to 0 and so buys a fresh three-attempt budget of
  third-party calls.
- `isLessonCreationWorkerEnabled()` in `lib/lesson-creation/env.ts` is the one
  home of the exact-`"true"` rule; `start.ts` and the enqueue APIs share it.
- The admin trio is scoped to the admin who requested the job, not to the admin
  role — a status endpoint, not a queue console. Admin jobs never consult the
  learner quota; `finalize_lesson_creation_job` applies it to learner origin only.
- `retry_lesson_creation_job`'s SQLSTATE 23505 (`job_not_retryable`) maps to
  `409`; every other database error is re-thrown, never swallowed as a conflict.
- The status route returns `{ job, events }` per design §8.1, and
  `LessonCreationProgress` marks a stage complete ONLY from a durable event for
  a later stage — never from the current `step`, which a retry moves backwards.
  It reads only the current attempt: the tail from the last `queued` event,
  because retry resets `attempt_count` to 0 and the numbers repeat.
- **PostgREST renders a composite NULL as an all-null row, not as `null`.**
  `isAbsentRow` in the store decides absence for claim, retry and finalize. See
  Verification — the worker threw on every idle pass before this.
- Node builtin aliasing in `next.config.mjs` has no environment escape hatch:
  ambient configuration must not be able to drop it from a production build.

## Verification

- **Task 2's live PostgreSQL gate, 2026-09-19 (`ed0a8f0`) — cleared.** A full
  `supabase db reset` applied all 32 migrations on PostgreSQL 15.8, then
  `npm run verify:db:lesson-jobs` passed: grants, enqueue idempotency and the
  partial unique index, admin-origin enforcement, lease recovery (requeue at
  attempt 1, terminal at 3), the event trigger, RLS read isolation as the
  authenticated role, finalize's lease fence and atomicity, the success path,
  and the free-tier quota cap. Two sessions racing for one queued job produced
  exactly one claim, one NULL, and a job left at attempt 1 — a second claim
  would have made it 2 — and the loser returned in ~2s rather than waiting on
  the 5s holder, which is `skip locked` rather than lock contention.
  Mutation-checked twice: `using (true)` on the RLS policy reported 3 foreign
  rows, and re-granting UPDATE on the event table reported `service_role can
  still rewrite events: UPDATE`. One control was added after the RLS check was
  caught passing vacuously against a null `auth.uid()` (L-004).
- Baseline 2026-09-13: 2745 passing tests across 897 files, via
  `npm test -- --exclude '.worktrees/**' --reporter=json`.
- Tasks 1–5 each ran TDD red first, then focused green, typecheck, and
  `git diff --check`. Mutations for store ownership, durable reads, retry
  delay, terminal transitions and the worker-enabled gate each turned their
  focused checks red and were restored from checksum-verified copies.
- Task 5 fix round 1 (`13267fc`) was proved on build artefacts, not reasoning:
  `.next/server/instrumentation.js` carries the Node worker start and the
  `kuromoji` external, and `.next/server/edge-instrumentation.js` carries
  neither.
- Task 5 fix round 2 (`0cb3567`, 2026-09-19, Claude): `KORUME_DISABLE_NODE_ALIAS`
  was introduced by `13267fc` with no consumer anywhere — no test, no doc, no
  caller — leaving an ambient variable able to drop the `path`/`fs`/`zlib`
  aliases from a production Node build, which is the defect `13267fc` existed
  to fix. Removed, and pinned by a test that sets the variable and still
  expects the alias. Focused 30/30; the new assertion was mutation-checked by
  restoring the escape hatch (exactly one test red, 15 green) and the file was
  restored byte-for-byte, SHA-256
  `020F048105A105EA53E9574A5F3E5E0B3ADE4CA975F5F0F1D5E5AC53DECDB94E`.
- Task 6 (`45d7684`, 2026-09-19, Claude) ran red first: nine test files failed,
  six because the route and data modules did not exist and three on the absent
  `listJobEventsForOwnedJob` / `isLessonCreationWorkerEnabled`. Then focused
  207/207 over 15 files, full `npm test -- --exclude '.worktrees/**'`
  **2974/2974 over 323 files, exit 0**, `npm run typecheck` 0, `npm run lint`
  exit 0 with 80 baseline warnings and none in the new files.
- Task 6's non-disclosure mutation check ran **twice**, each restored from a
  copy verified by `git hash-object`
  (`dc72ac421f937848547af9a42f25c1cb0825d4dc`): answering `403` instead of
  `404` for a foreign read, and reading event history before proving
  ownership. Each turned exactly one test red — "cannot tell a foreign job
  from a missing one" (1 failed / 25 passed) — and the focused suite returned
  63/63 after restoring.
- Task 6 review R1 (`code-reviewer`, 2026-09-19): **CHANGES REQUIRED**, 3
  Important + 6 Minor, 0 Critical, no §2 non-negotiable breach, and it
  re-derived rather than trusted every numeric claim in `aefc6c4` (all held).
  All three Important findings are closed by `19c0d09`; the Minors are routed
  to Task 8 below. Its three mutation checks each restored from a copy verified
  by `git hash-object` (`78cecdde5471c81001e6a15c81c6d17f7dd8e7ec`): dropping
  the catalogue lookup turned 4 tests red, removing the retry limiter 2, and
  moving the advisory ahead of the worker gate 5. After it: focused 72/72,
  full `npm test` **2983/2983 over 323 files, exit 0**, tsc 0, lint 0 errors.
- **What no test in Task 6 proves.** Route tests mock the data layer, so they
  prove status/body/`Retry-After` mapping and the malformed-id short-circuit,
  nothing more. The data-layer tests mock the store, so they prove ordering and
  arguments but not that a query filters. The chain closes only at
  `store.test.ts` (query shape) plus the live gate `ed0a8f0` (real RLS/RPC).
  No test here drives an HTTP request against a real database — Task 8 owes it.

- Task 7 (`ba90db8`, `002f993`) ran red first: the hook and component test
  files failed to load because neither module existed; the EN pins were green
  from the start because the copy was committed before them (L-027). Then
  focused 235/235 over 22 files, full `npm test` 3029/3029 over 325 files.
  Mutation-checked, each restored from a `git hash-object`-verified copy:
  deriving completion from `job.step` turned the durable-event test red;
  refreshing the Hub on enqueue turned 3 red; removing the terminal-state stop
  turned 2 red. **A fourth attempt proved nothing and is recorded because of
  that**: a CRLF-blind `perl -0pi` silently failed to apply, and the line it
  printed back had always been there, so the suite was green because the
  mutation never existed. Caught by comparing file hashes, not output.
- **Task 8's browser acceptance found a defect no unit test could.** PostgREST
  renders a composite NULL as an object with every column null, not as `null`,
  so `data === null` never matched for claim/retry/finalize and the worker threw
  a ZodError on EVERY idle pass. The three unit tests that asserted the empty
  case were green because each fixture used a literal `null` the database never
  sends. Confirmed by hand before fixing —
  `POST /rest/v1/rpc/retry_lesson_creation_job` for a missing job returns
  `{"id":null,…,"completed_at":null}` — then fixed with `isAbsentRow` and
  re-tested with the real shape. The same browser run afterwards logs zero
  worker errors. Recorded as L-005 evidence.
- **Gate ordering, learned the same way.** The C4 acceptance leaves two jobs in
  `running` when Playwright kills its server; run afterwards on the same
  database, the DB gate's lease-recovery step requeued them and its two
  contending sessions each claimed a different job, failing with
  `one session must claim and one must skip` — which reads like a
  `skip locked` regression. Nothing was wrong. Diagnosed by querying the queue
  (2 running, 1 succeeded), not by re-running. The SQL now asserts it owns the
  queue; planting a foreign job proved the message fires (exit 1) and a clean
  queue passes (exit 0). Recorded as L-017 evidence.
- **Final gates, each run and read on `b4290d5`:** `npm test -- --exclude
  '.worktrees/**'` **3021/3021 over 324 files, exit 0** · `npm run typecheck` 0 ·
  `npm run lint` exit 0, 80 baseline warnings, none in new files ·
  `npm run build` exit 0 · `git diff --check` clean ·
  `npm run verify:db:lesson-jobs` exit 0 on a freshly reset database with
  `PRECONDITION PASS` and `CONTENTION PASS` · `npx playwright test
  --config=playwright.c4.config.ts` **3/3**, zero server errors. The vitest
  count falls from 3029 because `lib/data/lesson-creation.test.ts` was deleted
  with the module it covered.
- The e2e's YouTube seam is `tests/e2e/fixtures/youtube-stub.cjs`, a
  `node --require` preload named only in `playwright.c4.config.ts`'s webServer
  command. Nothing that ships gains a test branch, and an unknown video id makes
  the stub throw rather than fall through to the network.
## Working tree and environment

- Owner: Claude
- Isolated worktree `.worktrees/c4-lesson-creation-jobs`, with its own
  dependencies installed. Clean at this checkpoint.
- `.env.local` is NOT in this worktree (L-020). It was copied from the main
  checkout for the browser run and **deleted again afterwards**; copy it back
  before any e2e or auth-dependent run, and remove it when done.
- The Codex shell that ran Tasks 1–5 had no `npm` on PATH and invoked it
  through an explicit nvm path; that is a property of that shell, not of the
  branch.
- Docker **is** available in the current session (`docker info` → 28.5.1), so
  the gate below is no longer environmentally blocked.

## Blockers

- None blocking implementation. Task 2's live PostgreSQL gate — the branch's
  one long-standing blocker — ran on 2026-09-19 with the owner's approval and
  passed; see Verification and `ed0a8f0`.
- Review debt: Task 5 fix round 2 (`0cb3567`), the live gate (`ed0a8f0`) and
  everything from Task 6 onward are being written by Claude, so the asymmetric
  review rule does not cover them. The whole-branch review must carry them.

## Next actions

1. **The mandatory whole-branch review** (AGENTS.md §9, L-011) over
   `c1a14e9..HEAD` — 29 commits, 73 files, +7247/-783. It must carry everything
   from `0cb3567` onward, which Claude wrote and self-reviewed, and it must
   construct the restart, concurrent-enqueue, retry-storm and
   worker-disabled-with-queued-rows sequences by hand: no test covers those end
   to end.
2. Fix wave for whatever it finds, TDD, then a review of that wave (L-012).
3. Only then merge. One item is deliberately NOT in this branch and must not
   block it: **the 23505 overload.** `retry_lesson_creation_job` raises the
   system unique-violation code for a business rule. No spurious 23505 is
   reachable today and `isNotRetryableRejection` documents exactly why, but the
   durable fix is a custom SQLSTATE — it changes an applied migration and needs
   the live gate re-run, so it is a follow-up.

## Owner decision needed

**May an admin job that dedups onto an existing PRIVATE lesson report
`succeeded`?** Surfaced by Task 6's review; it is a pre-existing property of
Task 2's migration (lines 270-278), not a defect this task introduced, but the
admin status endpoint is what makes it visible. Finalize marks such a job
`succeeded` against that lesson id and never applies `requested_library_access`,
so `GET /api/admin/lesson-creation-jobs/:id` reports "ready" for catalogue work
that published nothing — and hands the admin the UUID of another user's private
lesson. The migration comment states the non-publishing rule deliberately; what
is missing is any way for the admin to learn it happened. Needs an answer before
an admin UI is built on this projection.
