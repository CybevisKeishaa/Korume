# C4 Lesson Creation Jobs — Run State

## Authority and scope

- Branch: `c4-lesson-creation-jobs`; base: `c1a14e9`.
- Design: `docs/superpowers/specs/2026-09-13-lesson-creation-jobs-design.md`.
- Plan: `docs/superpowers/plans/2026-09-13-lesson-creation-jobs.md`.
- This file is the canonical lifecycle record for the branch. Read it before
  resuming or dispatching a task; the design wins over the plan if they differ.

## Pre-flight

- Isolated worktree: `.worktrees/c4-lesson-creation-jobs`.
- Baseline: `npm test -- --exclude '.worktrees/**' --reporter=json --outputFile scratch/c4-baseline-vitest.json` reported 2745 passing tests across 897 files on 2026-09-13. Node runs from the explicit nvm path because it is absent from this shell's PATH.
- Root-worktree untracked files are user-owned and out of scope. This worktree began clean after the design and plan commits.

## Task ledger pointer

The machine-local SDD ledger at `.superpowers/sdd/2026-09-13-lesson-creation-jobs/progress.md` carries dispatch, review, fix-round, and ruling evidence. Do not duplicate lessons here; `docs/lessons.md` is their only home.

## Status

Tasks 1–3 are complete and task-reviewed. Task 2's required live PostgreSQL
reset/RLS/concurrency gate remains blocked by Docker access and is a final
branch-acceptance gate, not a substituteable source-test result. The next
owned task is Task 4 (idempotent pipeline and one claimed worker pass).

## Resume protocol

Before any resume or dispatch, read `AGENTS.md`, `docs/lessons.md`, this
run-state, the cited task-plan section, and its direct dependency graph. Cite
lessons by id only; the applicable Task 1 controls include `L-001`, `L-004`,
`L-011`, `L-026`, and `L-028`.

## Task ledger

### Task 1 — typed lesson-creation job contract

- Owner: backend-engineer.
- Inputs: approved C4 design and existing `lesson_access_level` migration.
- Output: the canonical `LessonCreationJobProjection` parser for store, routes,
  worker, and UI; it excludes requester and lease fields.
- Checklist:
  - [x] Add the test before the implementation and confirm it is red.
  - [x] Define canonical state, step, error, projection, and parser types.
  - [x] Run the focused contract test and strict TypeScript check.
  - [x] Read changed state back, run `git diff --check`, and commit the owned files.
- TDD red command: `npm test -- lib/lesson-creation/types.test.ts --reporter=dot`
  (run through the explicit nvm npm executable because `npm` is absent from
  this shell's PATH).
- Green verification: `npm test -- lib/lesson-creation/types.test.ts --reporter=dot`
  and `npm run typecheck` (both run through that explicit executable).

### Task 2 — durable queue schema and RPCs

- Owner: database-engineer.
- Commits: `9ff79f9`, `6817f07`.
- Review: task review and its R1 re-review approved.
- Runtime caveat: source-level migration tests and TypeScript verification are
  accepted, but the real PostgreSQL reset, RLS/grants, atomic claim/recovery,
  finalize, and quota-concurrency evidence remains a final branch gate.

### Task 3 — provider-free lesson-creation store

- Owner: backend-engineer.
- Commits: `1a72ace`, review-fix `485ec28`.
- Output: the service-role store is the only TypeScript persistence boundary;
  it maps the Task 2 RPC contract, parses public and worker-private rows, and
  scopes requester lookups by both job and requester.
- Evidence: the store's ownership mutation was read back, turned its focused
  checks red, then restored from a checksum-verified copy. The review fix's
  inherited-RPC regression was red before `Object.hasOwn`; its terminal
  transition assertion was mutation-checked by nulling `p_error`, observing
  focused red, and restoring from the verified copy. Focused tests, typecheck,
  lint, and `git diff --check` were re-run after the fix.
- Review: independent review returned APPROVE WITH NITS; the two focused fixes
  are committed and the required re-review returned APPROVE.
