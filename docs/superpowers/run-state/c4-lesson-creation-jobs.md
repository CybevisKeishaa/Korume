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

All eight tasks are implemented, the whole-branch review has run, and this wave
closes its three Important findings. What remains is under Next actions.

## Contracts and decisions

- The store is the only TypeScript persistence boundary; worker code never writes SQL.
- `finalize_lesson_creation_job` adds a typed JSON payload plus attempt/lease-fence
  arguments; it validates and persists atomically, with no provider work inside.
- Pipeline dedup proves the newest transcript header has a line: a header alone is
  not studyable.
- The worker runs at most one recovered-and-claimed job per pass on a 5s cadence,
  decoupled from the account-deletion scheduler, and never sweeps stale rows.
- `LESSON_CREATION_WORKER_ENABLED` accepts exactly `"true"`, `"false"` or unset;
  unset is disabled, and enqueue AND retry both answer `503` then.
- The synchronous path is GONE, not retired in place: `lib/data/lesson-creation.ts`
  and `lib/youtube/schema.ts` were deleted in `e20f2f9` with their re-export chain.
  `lib/validation/lesson-creation.ts` is the only home of the YouTube URL contract.
- `POST /api/videos/import` keeps its path and request body and now answers
  `202 { data: JobProjection }`. A `202` never means a lesson exists.
- A job read or retry is scoped to its requester, and a foreign job answers
  exactly as a missing one does (`404`, same body). `getRequesterJobWithEvents`
  is the single entry point for history: the events table carries no requester
  column and the store reads it as service role, so reading history without
  first proving ownership is not expressible. It caps history at 60 rows.
- A 403 carries a `reason` (`quota_exceeded` or `not_admin`), mapped to copy by
  `lessonCreationRefusalMessage`, so a second reason cannot inherit wrong words.
- Enqueue and retry share one refusal order: identity → rate limit → worker enabled
  → quota. A disabled worker must not answer "out of quota", and no job is recorded
  (or re-queued) for a worker that will not run it.
- The advisory quota refusal fires **only where a charge is certain** — no lesson
  row yet (design §3 rules 3-4). Finalize's predicate is not restated in TS.
- Both retry endpoints carry a per-user rate-limit budget: a retry resets
  `attempt_count` to 0, buying a fresh three-attempt budget of provider calls.
- `isLessonCreationWorkerEnabled()` in `lib/lesson-creation/env.ts` is the one
  home of the exact-`"true"` rule; `start.ts` and the enqueue APIs share it.
- The admin trio is scoped to the admin who requested the job, not to the role — a
  status endpoint, not a queue console. Admin jobs never consult the learner quota.
- `retry_lesson_creation_job`'s SQLSTATE 23505 (`job_not_retryable`) maps to
  `409`; every other database error is re-thrown, never swallowed as a conflict.
- The status route returns `{ job, events }` per design §8.1, and it is also where
  the stale-queued rule is applied. `LessonCreationProgress` marks a stage complete
  ONLY from a durable event for a later stage — never from the current `step`,
  which a retry moves backwards — and reads only the current attempt: the tail from
  the last `queued` event, because retry resets `attempt_count` to 0.
- **PostgREST renders a composite NULL as an all-null row, not as `null`.**
  `isAbsentRow` decides absence for claim, retry and finalize; before it, the
  worker threw on every idle pass.
- Node builtin aliasing in `next.config.mjs` has no environment escape hatch.

## Verification

**Current gate state, every command run and read:** vitest **3064/3064 over 324
files, exit 0** (`--reporter=dot`, L-035) · `npx tsc --noEmit` 0 · `npm run lint`
0 errors, 80 baseline warnings · `npm run build` 0 · `git diff --check` clean.
⚠️ `verify:db:lesson-jobs` (exit 0, `PRECONDITION` through `F5a`–`F5h` plus
`CONTENTION`) and playwright (3/3) were measured on `65c040b` and **NOT re-run on
wave 4** — owner ruling 2026-09-20: wave 4 changed no executable SQL and no
rendered route, every `supabase/` edit being a comment, checked by filtering the
diff. Re-run both on a fresh reset before trusting them again.
Four mutation checks, each restored by hash: the rejected instantaneous guard
turns **`F5g`** red; dropping `available_at` turns **`F5d`** red (it did NOT before
wave 3 — the false green I-2 named); an un-named focus flag turns M-4 red; and
dropping the status read in `retryCaptionFetch` turns wave 4's 503 test red.

⚠️ `waveform.test.tsx` and `pitch-contour.test.tsx` (`components/video-player`,
untouched by this branch) flake under parallel load on canvas call counts, and
both pass 14/14 in isolation. **Re-run before believing a failure in either.**

Per-wave evidence — red-first runs, mutation checks and their restored hashes,
superseded gate counts — is in the commit messages. This file carries the current
state (`.codex/docs/workflow.md` §5). Reviews and what each closed:

| Review of | Verdict | Closed by |
| --- | --- | --- |
| Task 6 | CHANGES REQUIRED, 3 Important | `19c0d09` |
| whole branch @ `226d4a4` | 0 Critical, 6 Important, 9 Minor | `226d4a4` |
| `226d4a4` | 1 Critical, 3 Important, 9 Minor | `9e1b04d` |
| `3c73987` | 1 Critical, 3 Important, 5 Minor | `509ca76` |
| whole branch @ `813d6b7` | 0 Critical, 3 Important, 9 Minor | `2c03e9d` (I1–I3) |
| `813d6b7..260a01a` | **1 Critical**, 3 Important, 7 Minor | `83b7db1`, `0cf4c74` |
| `260a01a..0cf4c74` | **1 Critical**, 2 Important, 9 Minor | `65c040b` |
| `0cf4c74..65c040b` | 0 Critical, 1 Important (prose), 5 Minor | `558785e` |

Two findings changed how this subsystem is built, and both live outside this
file: the admin-dedup rule is design §6 rule 1 and §8.2, the
**edit-migrations-in-place** convention is AGENTS.md §6. Method lessons paid for:
`docs/lessons.md` L-005, L-017, L-040 — this branch is L-040's own evidence.

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

- None blocking implementation. Task 2's live gate — the one long-standing
  blocker — ran 2026-09-19 with the owner's approval and passed (`ed0a8f0`).
- `scripts/verify-codex-protocol.ps1` is green on this file; keep it under the
  200-line cap, which PowerShell counts one line differently from `wc -l`. Its
  other findings all belong to merged branches' run states (shadowing Explore C3
  and Hub Plan C2), not to this one.
- Review debt: none. The wave-3 review closed the last item.
- **Sweep on the enqueue path — RULED 2026-09-20: follow-up, not this branch.** It
  is now the only thing that would free a learner who closed the tab, since the
  worker pass no longer sweeps; nothing polls that row, so it waits.

## Next actions

1. **The third fix wave is REVIEWED, 2026-09-20 — 0 Critical, 0 code findings.**
   It re-derived both load-bearing facts: the `attempt_count < 3` bound holds
   across all five writers of `queued`, so `claim` serves every row the sweep
   could have reached; and a `running` event implies a live lease (`claim` OR
   `transition`, not `claim` alone). Its one Important was prose — three
   authority docs still described the removed sweep; a fourth wave closed it.
2. Then `git merge --no-ff` (`.codex/docs/workflow.md` §7). Do not push unless
   the owner asks.
3. Follow-ups, not blockers. **M3 is CLOSED** — ruled in 2026-09-20, the staleness
   rule routes more jobs through that retry UI. Deliberately NOT in this branch:
   **the 23505 overload**, where `retry_lesson_creation_job` raises the system
   unique-violation code for a business rule (no spurious one is reachable today,
   and `isNotRetryableRejection` documents why; the durable fix is a custom
   SQLSTATE, changing an applied migration and needing the live gate re-run).
   Two more from the wave-3 review: a `check (state <> 'queued' or attempt_count
   < 3)` to hold the no-sweep bound in the database, and one home for the status
   ladder the two retry routes duplicate.
4. A sibling of I2, **not fixed and not a regression**: a job stuck in `running`
   with an expired lease has the same dead end, lease recovery being worker-only.
   With the worker running it recovers next tick; with it off, not at all.

## Owner decisions taken

**May an admin job that dedups onto an existing PRIVATE lesson report
`succeeded`? — RULED 2026-09-19: no. Options A + C.** A distinct terminal outcome
(A) plus an early refusal at enqueue (C), rejecting the alternative of applying
the requested access level, which would have republished a learner's private
lesson and refunded the quota slot it had consumed.

**That rule's home is the design, §6 rule 1 and §8.2.** Of its three layers only
the refusal inside `pg_advisory_xact_lock` is a guarantee (`L-040`).

**Where does the "queued job the worker can no longer reach" rule run? — RULED
2026-09-19: on the status read AND each worker pass. SUPERSEDED 2026-09-20: the
status read ONLY — the pass does not sweep at all.** The review proposed the pass
alone; `recover_expired_lesson_creation_jobs` has one caller, so with the worker
stopped — the case that strands the rows — it would never run. The read path costs
a write on a `GET`, accepted over leaving the learner unable to re-import.
**Liveness is read from the `running`-event history, not the lease set** — the
guard comment in the migration says why the lease-set version was wrong.

**Migrations are edited in place** — ruled 2026-09-19, now AGENTS.md §6.
