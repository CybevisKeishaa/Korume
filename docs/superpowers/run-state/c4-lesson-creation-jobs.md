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

Checkpoints: `8a77112`, `c6f40de`.

Tasks 6 (learner/admin APIs), 7 (progress UI) and 8 (integration, browser,
docs) are not started.

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
- Node builtin aliasing in `next.config.mjs` has no environment escape hatch:
  ambient configuration must not be able to drop it from a production build.

## Verification

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

- **Task 2's live PostgreSQL gate has never run.** Reset, RLS and grants,
  atomic claim and recovery, finalize, and quota concurrency are all accepted
  at source level only. It is a final branch-acceptance gate and cannot be
  substituted by a source test. It was blocked by Docker access for every
  Codex session; it is not blocked now, and running it needs a local
  `supabase db reset`, which is destructive to local development data and
  therefore needs the owner's say-so.
- Task 5 fix round 2 is committed but has had no independent review. Claude
  wrote it, so the asymmetric review rule does not cover it.

## Next actions

1. Owner decision on running the live PostgreSQL gate (it resets the local DB).
2. Task 6 — replace the synchronous learner/admin import endpoints with job
   APIs that observe `LESSON_CREATION_WORKER_ENABLED` and return the
   disabled-worker `503`. Owner: whoever implements next.
3. Tasks 7 and 8 follow, then the mandatory whole-branch review.
