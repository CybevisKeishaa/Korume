# C4 lesson-creation jobs — checkpoint 2026-09-19

> **Current authority — this block supersedes BOTH blocks below.** The
> 2026-09-16 block is now wrong on all three of its headline claims: Task 5 is
> not paused, no follow-up is uncommitted, and the Docker gate is not blocked.
> Both older blocks are retained as historical record only.

**The canonical record is `docs/superpowers/run-state/c4-lesson-creation-jobs.md`
on the branch.** It was rewritten on 2026-09-19 to the nine required headings
and now carries the per-task commit table, contracts, verification and blockers.
This memory is a pointer plus resume instructions; do not restate branch facts
here (run-state README; `docs/lessons.md` L-028).

## What changed on 2026-09-19 (session run by Claude, Codex was rate-limited)

1. **Task 5 is COMPLETE**, not paused: `8c6fb4b` + fix round 1 `13267fc` +
   fix round 2 `0cb3567`. Both the run-state and the SDD ledger had recorded
   Task 5 as "the next task to pick up" while Git showed it implemented and
   fix-reviewed — a resuming session would have reimplemented it (L-026).
   Corrected in `bb72328`.
2. **The uncommitted follow-up is committed** as `0cb3567`. It removes
   `KORUME_DISABLE_NODE_ALIAS`, which `13267fc` had introduced with **no
   consumer anywhere** — no test, no doc, no caller — leaving an ambient
   variable able to drop the `path`/`fs`/`zlib` aliases from a production Node
   build, i.e. re-creating the defect `13267fc` existed to fix. Pinned by a
   test that sets the variable and still expects the alias; mutation-checked.
3. **Task 2's live PostgreSQL gate is CLEARED** (`ed0a8f0`). It had never run
   once, because Docker was unavailable to every Codex session. With the
   owner's approval a full `supabase db reset` applied all 32 migrations on
   PostgreSQL 15.8 and every gate passed. It is now repeatable:
   **`npm run verify:db:lesson-jobs`** (`supabase/tests/lesson-creation-jobs.sql`
   + `scripts/verify-lesson-creation-gate.ps1`), self-fixturing and
   self-cleaning, including a two-session contention check. Mutation-checked
   twice. Full evidence is in the run-state's Verification section.
4. **Task 6 is STARTED**: `d4080ba` adds `lib/validation/lesson-creation.ts`
   (+ test, 15/15, red first). It deliberately follows `importVideoSchema`'s
   `parseVideoId` contract rather than the plan's `z.string().url()`, which
   would have rejected the bare eleven-character id `/api/videos/import`
   accepts today — the design wins over the plan where they differ.

## Resume here

Task 6 remains, minus the schemas already committed. Per the plan's Task 6
section: `POST /api/videos/import` returns `202 { data: JobProjection }`;
learner status + retry routes; the admin trio. Then Task 7 (progress UI,
persisted labels only, a11y + reduced-motion), Task 8 (integration, browser,
docs), then the mandatory whole-branch review.

Task 6's own mutation check is non-optional: a foreign job id and a missing
job id must both return **404**, proving the API does not disclose that
another learner's job exists.

## Review debt — read before accepting anything

Everything from `0cb3567` onward (`0cb3567`, `bb72328`, `ed0a8f0`, `2b2e463`,
`d4080ba`) was **written and self-reviewed by Claude alone**. The asymmetric
review rule (2026-09-19 dual-harness design, D4a) assumes Codex implements and
Claude reviews, which did not hold here. When Codex returns, the first thing to
give it is a **whole-branch review**, not more implementation.

## Environment (differs from the Codex sessions that ran Tasks 1–5)

- Bare `npm` **works** in this shell; the `%LOCALAPPDATA%\nvm\...\npm.cmd`
  workaround below was a property of the Codex shell, not of the branch.
- **Docker is available** (28.5.1). Local Supabase is up; DB container is
  `supabase_db_nihongo-cinema`, DB on `127.0.0.1:54322`.
- A fresh worktree has no dependencies: run `npm ci` in it first, or kuromoji
  dictionary tests fail with ENOENT for reasons unrelated to the change.
- Branch state at checkpoint: 21 commits ahead of `master`, working tree clean,
  `npm test` 2882/2882 across 315 files, typecheck 0, lint 0.

## One thing that went wrong here, worth not repeating

The first version of the RLS check passed **vacuously**: the user id was read
after `set local role authenticated`, that role cannot read `public.users`, so
`auth.uid()` was null and `requester_user_id <> auth.uid()` evaluated to NULL
for every row — the count came back 0 and the isolation check "passed" while
measuring nothing. The committed gate now asserts `auth.uid() is not null`
first. Same disease as `docs/lessons.md` L-004.

---

# Historical 2026-09-16 checkpoint (SUPERSEDED — see above)

Its three headline claims are all false as of 2026-09-19: Task 5 is complete,
not paused; the `next.config.mjs` / `next.config.test.ts` follow-up is
committed as `0cb3567`; and the Task 2 database gate is cleared, not blocked.
Its description of *what* Task 5 delivers (the explicit
`LESSON_CREATION_WORKER_ENABLED` contract, a separate 5-second unref'd
immediate tick, process startup guard, overlap guard, and Node-only bundle
boundaries) remains accurate.

The rest of that block, and the 2026-09-13 block beneath it, are kept only as
provenance for how the branch reached Task 5. Read
`docs/superpowers/run-state/c4-lesson-creation-jobs.md` instead: it carries the
same facts, current, and versioned with the code.

Related: `mem:project_status`, `mem:codex_long_task_protocol_run_state`.
