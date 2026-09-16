# C4 lesson-creation jobs — paused checkpoint 2026-09-16

> **Current authority — this block supersedes every operational-status claim
> below.** The retained 2026-09-13 record is historical context only; in
> particular, its assertion that Task 5 was merely ready and the C4 worktree
> was clean is no longer true.

## Current status

- Worktree: `.worktrees/c4-lesson-creation-jobs`; branch:
  `c4-lesson-creation-jobs`; base `c1a14e9`.
- Tasks 1–4 are completed and independently task-reviewed. Task 2's local
  PostgreSQL reset/RLS/concurrency proof remains a final branch gate blocked
  by Docker access; source tests are not a substitute.
- Task 5's original lifecycle implementation is committed as `8c6fb4b`
  (`feat(shadowing): start internal lesson creation worker`). The instrumentation
  bundle fix is committed as `13267fc` (`fix(shadowing): isolate lesson worker
  instrumentation bundle`). Together they supply the explicit
  `LESSON_CREATION_WORKER_ENABLED` contract, a separate 5-second unref'd immediate
  tick, process startup guard, overlap guard, and Node-only bundle boundaries.
- Task 5 is **PAUSED, not accepted**. An independent review found that the
  `instrumentation.ts` import graph could pull `kuromoji` and Node builtins
  into a non-Node bundle. This was a real `npm run build` blocker that focused
  tests and typecheck did not catch.

## Current uncommitted Task 5 follow-up

The C4 worktree intentionally has these remaining uncommitted changes:

- `next.config.mjs` removes the environment escape hatch that could disable the
  Node instrumentation aliases.
- `next.config.test.ts` adds regression coverage proving that the escape hatch
  cannot disable those aliases.

The pipeline import deferral and `lib/node-builtins/{path,fs,zlib}.cjs` shims are
already committed in `13267fc`.

The implementer report
`.superpowers/sdd/2026-09-13-lesson-creation-jobs/task-5-report.md` records
the boundary regression as RED (14 pass, 1 fail), then 29 focused tests green,
typecheck/lint green, and a successful `npm run build` (121 static pages),
with server/edge instrumentation artifact read-back. Treat this as
implementer-provided evidence only: the report predates the committed
`13267fc` fix, and the two remaining follow-up config/test edits have not yet
received independent re-review or been committed.

## Required resume sequence

1. Read `AGENTS.md`, `docs/lessons.md`,
   `docs/superpowers/run-state/c4-lesson-creation-jobs.md`, this current block,
   Task 5's plan section, and its dependency graph.
2. Inspect every uncommitted config/source/shim change; re-run focused Task 5
   + `next.config.test.ts`, typecheck, lint, `npm run build`, `git diff --check`,
   and server/edge artifact read-back.
3. Commit the verified fix in the C4 worktree and obtain independent Task 5
   re-review. Do not dispatch Task 6 until it is approved.
4. Preserve the Task 2 database runtime gate and whole-branch review as final
   acceptance gates.

## Operational notes

- Use `%LOCALAPPDATA%\\nvm\\v24.14.1\\npm.cmd`; bare `npm` is
  absent from this shell.
- Root-worktree untracked `.agents/`, `.serena/`, and `docs/mobile/` are
  user-owned and outside C4 scope.

---

# Historical 2026-09-13 checkpoint (superseded)

## Resume authority

- Worktree: `.worktrees/c4-lesson-creation-jobs`
- Branch: `c4-lesson-creation-jobs`, clean and currently ahead of `origin/c4-lesson-creation-jobs` by 2 commits.
- Approved design: `docs/superpowers/specs/2026-09-13-lesson-creation-jobs-design.md`
- Implementation plan: `docs/superpowers/plans/2026-09-13-lesson-creation-jobs.md`
- Canonical branch run-state: `docs/superpowers/run-state/c4-lesson-creation-jobs.md`
- Machine-local SDD ledger: `.superpowers/sdd/2026-09-13-lesson-creation-jobs/progress.md`

Before resuming, read `AGENTS.md`, `docs/lessons.md`, the run-state, this memory, the cited plan task, and its direct dependency graph. Do not touch user-owned root-worktree files or merge/push without explicit user approval.

## Completed and reviewed

- `84236b6 feat(shadowing): define lesson creation job contract`
- `b8c7648 fix(shadowing): validate lesson creation job projections`
  - Task 1 is fully reviewed and re-reviewed. `lib/lesson-creation/types.ts` owns strict public projection parsing, exact state/step/error tuples, UUID/timestamp validation, requester/lease exclusion, and terminal pairs.
- `9ff79f9 feat(shadowing): add durable lesson creation queue`
- `6817f07 fix(shadowing): preserve lesson creation finalization invariants`
  - Task 2 source-level review and R1 re-review approved. Finalize has the approved extension after its first three planned parameters: lease token plus typed JSON content payload, to satisfy atomic persistence. It performs the final learner-private quota decision before content writes and repairs the newest transcript header playback reads.
  - Source tests passed 9/9 and TypeScript passed. Mandatory local PostgreSQL reset/RLS/concurrency execution is still blocked by Docker access and remains a final branch gate; never claim it passed.
- `1a72ace feat(shadowing): add lesson creation job store`
  - Task 3 has implemented and committed the service-role store. Report: `.superpowers/sdd/2026-09-13-lesson-creation-jobs/task-3-report.md`.
  - Reported evidence: 42 store plus 6 existing tests passed (48), typecheck/lint/diff check passed, and requester-scope mutation turned 3 tests red then restored from a verified SHA-256 copy.
  - Task 3 has NOT yet received its independent task review. This is the immediate next action.

## Exact next sequence

1. Read `docs/lessons.md` before opening the Task 3 report.
2. Generate the Task 3 review package from base `6817f07` to head `1a72ace`, dispatch an independent code reviewer, and write its verdict into the SDD ledger. Fix/re-review if required.
3. Only then dispatch Task 4 (pipeline and worker pass), then Tasks 5-8 sequentially with the existing SDD workflow.
4. Before final branch acceptance, obtain runtime database evidence: local Supabase reset, migration application/readback, RLS/grants, atomic claim/recovery/finalize/quota concurrency coverage. Docker was inaccessible in this session; source assertions are not a substitute.
5. Run the required whole-branch review and final verification before proposing merge. Record an actual lesson only if new evidence merits an existing `docs/lessons.md` entry.

## Environment and process notes

- `npm` is absent from PATH. Use `%LOCALAPPDATA%\nvm\v24.14.1\npm.cmd` with escalation when sandbox cannot traverse NVM.
- Git stage/commit in the linked worktree needs escalation due the `.git/worktrees/.../index.lock` permission boundary.
- SDD helper scripts need Git Bash with `PATH=/mingw64/bin:/usr/local/bin:/usr/bin:/bin`.
- All task artifacts/reports are under the gitignored `.superpowers/sdd/2026-09-13-lesson-creation-jobs/` directory.
- No workers are active at this checkpoint. Task 2's original database agent exhausted its usage quota after its R1 implementation; the controller independently ran the final focused 9/9 test/typecheck and committed `6817f07`.
