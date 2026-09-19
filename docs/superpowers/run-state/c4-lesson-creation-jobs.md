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
- `finalize_lesson_creation_job` extends the plan's three-argument signature with
  typed JSON payload and attempt/lease-fence arguments, in that order. SQL
  validates and persists atomically; provider work stays outside the transaction.
- Default pipeline dedup goes through a narrow store helper proving the newest
  transcript header has a line: a header alone is not studyable.
- The worker runs at most one recovered-and-claimed job per pass, on its own
  5s cadence, deliberately decoupled from the account-deletion scheduler.
- `LESSON_CREATION_WORKER_ENABLED` accepts exactly `"true"`, `"false"` or
  unset; unset is disabled. Startup validation rejects anything else.
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
  `lessonCreationRefusalMessage`. Each path has one 403 source today, so a route
  could infer it from the status — until a second reason inherits wrong words.
- Enqueue refusal order: identity → rate limit → worker enabled → this
  learner's quota. A disabled worker must not answer "out of quota", and no
  job is recorded for a worker that will not run.
- The advisory quota refusal fires **only where a charge is certain** — no lesson
  row yet (design §3 rules 3-4). Finalize's predicate is not restated in TS.
- Both retry endpoints carry a per-user rate-limit budget: a retry resets
  `attempt_count` to 0, buying a fresh three-attempt budget of third-party calls.
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
- Node builtin aliasing in `next.config.mjs` has no environment escape hatch.

## Verification

**Current gate state, every command run and read on this wave:** vitest
**3057/3057 over 324 files, exit 0** (`--reporter=dot`, L-035) · `npx tsc
--noEmit` 0 · `npm run lint` 0 errors, 80 baseline warnings · `npm run build` 0
· `git diff --check` clean · `npm run verify:db:lesson-jobs` **exit 0 on a
freshly reset database**, `PRECONDITION` through the new `F5a`–`F5f` plus
`CONTENTION` · `npx playwright test --config=playwright.c4.config.ts` **3/3**.
The `F5a` live-lease guard was mutation-checked against the live database:
neutralised → `F5a` red, restored by hash → green again.

⚠️ `components/video-player/waveform.test.tsx` and `pitch-contour.test.tsx`
flake under parallel load (`expected 0 to be greater than 0` on canvas calls).
Neither file is touched by this branch — `git diff --name-only master..HEAD`
matches nothing under `video-player` — and both pass 14/14 in isolation.
**Re-run before believing a failure in either.**

Per-task and per-wave evidence — the red-first runs, the mutation checks and
their restored hashes, the superseded gate counts — is in the commit messages,
which is where Git already keeps it. This file carries the current state
(`.codex/docs/workflow.md` §5). Reviews and what each closed:

| Review of | Verdict | Closed by |
| --- | --- | --- |
| Task 6 | CHANGES REQUIRED, 3 Important | `19c0d09` |
| whole branch @ `226d4a4` | 0 Critical, 6 Important, 9 Minor | `226d4a4` |
| `226d4a4` | 1 Critical, 3 Important, 9 Minor | `9e1b04d` |
| `3c73987` | 1 Critical, 3 Important, 5 Minor | `509ca76` |
| whole branch @ `813d6b7` | 0 Critical, 3 Important, 9 Minor | this wave (I1–I3) |

Two findings changed how this subsystem is built, and both now live outside
this file: the admin-dedup rule is design §6 rule 1 and §8.2, and the
**edit-migrations-in-place** convention is AGENTS.md §6. Three method lessons it
paid for are `docs/lessons.md` L-005, L-017 and L-040 — this branch is L-040's
own evidence.

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
- `scripts/verify-codex-protocol.ps1` is green on this file; keep it under the
  200-line cap, which PowerShell counts one line differently from `wc -l`. Its
  other findings all belong to merged branches' run states (shadowing Explore C3
  and Hub Plan C2), not to this one.
- Review debt: one item — this fix wave, unreviewed. Everything through
  `813d6b7` is reviewed and closed.

## Next actions

1. **Review this fix wave** — the whole-branch review's three Important items,
   closed together. It edits an applied migration, so a reviewer should confirm
   the live gate was re-run on a fresh reset rather than take Verification's
   word, and should check the one judgement call in it: the staleness rule is
   applied on the learner's status read, which is a write on a `GET`.
2. Then `git merge --no-ff` (`.codex/docs/workflow.md` §7). Do not push unless
   the owner asks.
3. Nine Minors are follow-ups, not blockers. **M3** is the only one with an
   accessibility cost (the Hub's "Try again" is unmounted on retry, so focus
   lands on `document.body`); M2 and M7 are near-free. Also deliberately NOT in
   this branch: **the 23505 overload** — `retry_lesson_creation_job` raises the
   system unique-violation code for a business rule. No spurious 23505 is
   reachable today and `isNotRetryableRejection` documents why; the durable fix
   is a custom SQLSTATE, which changes an applied migration and needs the live
   gate re-run.
4. A sibling of I2 found while closing it, **not fixed and not a regression**: a
   job stuck in `running` with an expired lease has the same dead end, because
   `recover_expired_lesson_creation_jobs` is also worker-only. With the worker
   running it recovers on the next tick; with the worker off it does not.

## Owner decisions taken

**May an admin job that dedups onto an existing PRIVATE lesson report
`succeeded`? — RULED 2026-09-19: no. Options A + C.** The owner chose a
distinct terminal outcome (A) plus an early refusal at enqueue (C), rejecting
the alternative of applying the requested access level, which would have
republished a learner's private lesson and retroactively refunded the quota
slot it had consumed.

**The rule's home is the design, §6 rule 1 and §8.2 — not this file.** Worth
repeating only because a reader meets the code first: of the three layers, only
the refusal inside `pg_advisory_xact_lock` is a guarantee — the `409` at enqueue
and the pipeline's early exit both run before that lock (`L-040`).

**Where does the "queued job the worker can no longer reach" rule run? — RULED
2026-09-19: on the learner's status read AND each worker pass.** The review
proposed the worker pass alone; that was checked and found insufficient, because
`recover_expired_lesson_creation_jobs` is called only from
`runLessonCreationPass`, so with the worker stopped — the case that strands the
rows — it would never run. The read path costs a write on a `GET`; the owner
accepted that over leaving the learner unable to re-import.

**Migrations are edited in place** — ruled 2026-09-19, now AGENTS.md §6.
