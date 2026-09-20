# C4 lesson-creation jobs — MERGED 2026-09-20

> **Current authority — supersedes every earlier copy of this file.**
> ⭐ **`c4-lesson-creation-jobs` is MERGED to `master` at `21a436b` (`--no-ff`),
> 2026-09-20.** 42 commits, 79 files, +8874/-803. The branch is **kept** per repo
> convention and **nothing is pushed**. This is history, not a resume point.

**The canonical record is `docs/superpowers/run-state/c4-lesson-creation-jobs.md`,
now on `master`.** It is capped at 200 lines by `scripts/verify-codex-protocol.ps1`
and sits at exactly 200 — trim before adding. PowerShell counts one line
differently from `wc -l`; validate with the script, not with `wc`.

⚠️ That script currently reports two violations, both **pre-existing and not
C4's**: `shadowing-explore-c3.md` and `shadowing-hub-plan-c2.md` are closed
run-states missing required headings.

## What shipped

The synchronous lesson-import path is GONE, replaced by a durable, idempotent
async job queue: typed contract, Postgres queue schema + RPCs, service-role
store, restartable pipeline/worker, explicit Node worker lifecycle, learner and
admin APIs, durable progress UI. `POST /api/videos/import` keeps its path and
body and now answers `202 { data: JobProjection }` — a `202` never means a lesson
exists.

## Merged-master gate, each command run and read on `21a436b`

tsc 0 · **vitest 3064/3064 over 324 files, exit 0** · lint 0 errors (80 baseline
warnings) · `next build` 0.

⚠️ **`npm test` from the MAIN CHECKOUT sweeps the worktrees and reports ~2195
files / 762 failures.** Not a regression — `vitest.config.ts:13` excludes
`"node_modules"`, a bare pattern that matches only the root one, so
`.worktrees/*/node_modules/**` is collected (identical at pre-merge master
`a55b8a4` and at the branch tip; the branch never touched that file). Until the
pattern becomes `**/node_modules/**`, measure master with
`--exclude "**/.worktrees/**"` or the number means nothing. **This is an open
repo-level defect, not C4's.**

The live database gate (`npm run verify:db:lesson-jobs`) and `playwright.c4`
were **exit 0 / 3/3 on `65c040b`** and deliberately NOT re-run on the last wave
— owner ruling 2026-09-20 — because it changed no executable SQL and no rendered
route. Re-run both on a fresh `npx supabase db reset --no-seed`; the gate refuses
its own PRECONDITION while earlier jobs remain.

## The two Criticals, and the lesson they cost

Both were the same harm through a different door, and **both times the comment
defending that door had just been written by me.** The rule fails a `queued` job
no live worker can reach. v1 guarded on "does anything hold a live lease right
now" — false by construction at the moment a pass asks, so a healthy worker
failed the head of its own backlog. v2 guarded on claim history but the pass
still swept *before* claiming, so the first pass after an outage longer than the
window failed the whole backlog and claimed nothing. Both reproduced against the
live database before being fixed.

**The generalised lesson: a guard whose subject is "is the system alive?" must
not be sampled at the one moment the system is idle by construction.**
See `mem:guard-sampled-when-idle` in Claude's own memory.

## Where the rule lives

`fail_stale_queued_lesson_creation_jobs(p_now, p_max_age_seconds, p_job_id)`,
called from **one place only**: `readFor` in `lib/data/lesson-creation-jobs.ts`,
scoped to the polled job, after the owner-scoped read has proven ownership. A
state-reconciling write on a `GET` — the owner accepted it over leaving the
learner unable to re-import.

- Age from `updated_at`, never `created_at`; `available_at <= p_now` also
  excludes a job inside its backoff. `attempt_count` untouched — the row never ran.
- Window is one TS constant (`STALE_QUEUED_JOB_SECONDS = 600` in `store.ts`),
  passed as an argument, so it has no second home in SQL.
- The TS wrapper REQUIRES a job id. SQL keeps a queue-wide form for the live gate
  and the deferred enqueue-path rule; no TypeScript may sweep.

Two facts the whole design rests on, both re-derived by the final review:
1. **A `running` event always implies a live lease** — written by `claim` (mints
   one) AND by `transition` (refuses without a live matching one; wrong token →
   `40001`). "Only `claim` writes `running`" is FALSE and was corrected in all
   four prose homes.
2. **`claim` can serve every row a sweep could have reached** — it accepts any
   `queued` row that is due with `attempt_count < 3`, and a `queued` row can never
   hold 3 (all five writers of `queued` require fewer).

## The four fix waves

| Commit | What |
| --- | --- |
| `2c03e9d` | whole-branch review I1/I2/I3 |
| `260a01a` | two lessons-evidence entries (L-003, L-001) |
| `83b7db1` | Critical C1 from the review of `2c03e9d`, + four Minors |
| `0cf4c74` | Minor M3 (a11y focus), ruled in rather than deferred |
| `65c040b` | Critical C-1 from the review of `83b7db1`, + I-1, I-2, nine Minors |
| `558785e` | Important + 5 Minors from the review of `65c040b` — **prose only**, plus the Hub 503 ladder |
| `7688cc2` | run-state: the wave-4 gate, and which two gates did not re-run |

**The final review (`0cf4c74..65c040b`) returned 0 Critical and no finding
against the code.** Its one Important was that three authority documents — the
design (which wins over the plan), the migration comment, and the run-state's
binding-rulings ledger — still told a maintainer the worker pass sweeps the
queue. Design §5 contradicted itself inside one paragraph. That is the exact
instruction that produced both Criticals, so it was fixed before merge.

## Owner rulings — all still binding

1. **A+C** on admin dedup onto a PRIVATE lesson. Home: design §6 rule 1, §8.2.
2. **Migrations are edited IN PLACE.** Home: AGENTS.md §6.
3. **One fresh whole-branch review** instead of per-wave reviews (L-012 recurses;
   L-011 is where it stops). Wave 4 merged without its own review on this ruling.
4. **The stale rule runs on the learner's status read — and ONLY there.**
5. **Enqueue-path sweep: follow-up, not this branch.** It is the only thing that
   would free a learner who closed the tab, since nothing polls that row.
6. **Minor M3 (a11y focus) ruled IN.**
7. **The DB gate and playwright are not re-run on wave 4** (2026-09-20).

## Open follow-ups this branch deliberately left

- **Enqueue-path sweep** (ruling 5 above).
- **`check (state <> 'queued' or attempt_count < 3)`** — would make the database
  hold the bound the no-sweep argument rests on, instead of it being inductive
  across five writers. Edits an applied migration; needs the live gate re-run.
- **One home for the retry routes' status ladder**, duplicated verbatim in the
  learner and admin routes (AGENTS.md §6).
- **The 23505 overload** in `retry_lesson_creation_job`. No spurious one is
  reachable today; the durable fix is a custom SQLSTATE.
- **A job stuck in `running` with an expired lease** has the same dead end,
  lease recovery being worker-only. Not a regression.

## Environment facts that cost time

- **`.env.local` is not in the worktree** (L-020). Copy from the main checkout
  before any e2e run, delete afterwards.
- Docker 28.5.1, container `supabase_db_nihongo-cinema`.
- `playwright.c4.config.ts` runs on port 3002, `reuseExistingServer: false`, sets
  `LESSON_CREATION_WORKER_ENABLED=true`, preloads the YouTube stub.

## Tooling traps paid for

- **A single apostrophe in a Bash heredoc breaks this harness.** The command is
  wrapped in single quotes somewhere upstream, so `learner's` inside a quoted
  heredoc produces `unexpected EOF while looking for matching '`. Write such
  files with the Write tool, or keep prose out of shell arguments entirely.
- **The harness collapses `\r\n` and `\d` in tool arguments.** Put literal text
  in a data file and have a script read it; never author escapes inline.
- **Git Bash `grep` strips `\r`.** A CRLF file looks LF through grep.
- **`git checkout -- <file>` destroys uncommitted work.** Copy the file, restore
  from the copy, compare hashes. Recorded as L-001 evidence.
- Committed blobs here are LF; working trees are CRLF. `git diff --check` may warn
  about one stray LF in the run-state — cosmetic, the blob is normalised.

## Method lessons this branch paid for

- **L-003 gained two entries.** A reviewer's *remedy* is a claim about the code as
  much as its finding is — twice here a correct finding came with a fix that could
  not work.
- **L-005 recurred, in my own test.** An `onRetry` that rejects is a shape neither
  consumer can produce.
- **L-040** — an early exit is not the rule; the rule lives where the lock is.
- New: **prose is load-bearing.** Three of this branch's findings were documents
  that stayed true to a design the code had already abandoned, and each one was a
  live instruction to re-introduce a Critical.

Related: `mem:project_status`, `mem:codex_long_task_protocol_run_state`,
`mem:dual_harness_workflow_run_state`.
