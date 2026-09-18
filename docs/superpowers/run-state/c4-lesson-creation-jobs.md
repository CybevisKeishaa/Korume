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
| 6 — learner/admin job APIs | `d4080ba` (schemas), `45d7684` (routes) | — | **unreviewed** |

Live database gate: `ed0a8f0`.
Checkpoints: `8a77112`, `c6f40de`, `bb72328`.

Tasks 7 (progress UI) and 8 (integration, browser, docs) are not started.

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
- Legacy synchronous callers stay until Task 6 switches the routes, so every
  intermediate commit compiles.
- `POST /api/videos/import` keeps its path and request body and now answers
  `202 { data: JobProjection }`. A `202` never means a lesson exists.
- A job read or retry is scoped to its requester, and a foreign job answers
  exactly as a missing one does (`404`, same body). Event history is read only
  after `getRequesterJob` has proven ownership — the events table carries no
  requester column and the store reads it through the service role.
- Enqueue refusal order: identity → rate limit → worker enabled → this
  learner's quota. A disabled worker must not answer "out of quota", and no
  job is recorded for a worker that will not run.
- `isLessonCreationWorkerEnabled()` in `lib/lesson-creation/env.ts` is the one
  home of the exact-`"true"` rule; `start.ts` and the enqueue APIs share it.
- The admin trio is scoped to the admin who requested the job, not to the admin
  role — a status endpoint, not a queue console. Admin jobs never consult the
  learner quota; `finalize_lesson_creation_job` applies it to learner origin only.
- `retry_lesson_creation_job`'s SQLSTATE 23505 (`job_not_retryable`) maps to
  `409`; every other database error is re-thrown, never swallowed as a conflict.
- The status route returns `{ job, events }` per design §8.1. Task 7 must mark
  completed lines from `events`, not from the current `step` — a retry resets
  the attempt, so an inferred step would be a wrong guess (design §9).
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

## Working tree and environment

- Owner: Claude
- Isolated worktree `.worktrees/c4-lesson-creation-jobs`, with its own
  dependencies installed. Clean at this checkpoint.
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

1. Task 7 — the durable progress UI in both importer surfaces. Both consumers
   still expect the old synchronous `201` body, so `VideoImportForm` and
   `hub-library-section` are the first thing it must migrate.
2. Task 8 — integration, browser acceptance, docs. It must also settle the one
   piece of dead code Task 6 created: `lib/data/lesson-creation.ts`
   (`createLesson`, `createLessonAsAdmin`) now has **no production caller** —
   the import route was its last one. Deleting it was deliberately left out of
   Task 6 to keep that diff to the API switch; AGENTS.md §6 forbids merging it
   as-is.
3. Then the mandatory whole-branch review, which must carry everything from
   `0cb3567` onward — Claude wrote and self-reviewed all of it.
