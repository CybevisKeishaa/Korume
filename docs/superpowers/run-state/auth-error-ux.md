# Branch Run State

Branch `auth-error-ux`.

## Goal and scope

Restyle Login/Register onto a shared auth shell, add email verification by 6-digit code and
password reset, add a standalone 404 and an in-shell route-error surface. Seven tasks, one commit
each, one `codex exec` dispatch per task, Claude review between tasks.

## Authorities

- Spec: `docs/superpowers/specs/2026-09-21-auth-error-ux-design.md` (owner-approved 2026-09-21)
- Plan: `docs/superpowers/plans/2026-09-21-auth-error-ux.md`
- Task packets: `<main checkout>/.superpowers/sdd/2026-09-21-auth-error-ux/task-N-brief.md`
- Rules: `AGENTS.md`, `docs/lessons.md`, `.codex/docs/workflow.md` §8

## Accepted commits

- `979b0f7` spec · `d913c81` spec owner-review fixes · plan + this run state (the commit that adds
  this file)
- `f8d565f` Task 1 mascot pose module. Claude re-ran: `components/mascot` 18/18, tsc 0, lint 0,
  full suite 326 files / 3143 tests exit 0 (baseline 324 / 3125 + 2 / 18). Mutation check by Codex:
  worry->sulking turns the pin test red (2 failed), restore green.
- `13a6739` Task 2 auth shell, per-flow forms, confirm password (one Claude fix wave: a missed e2e
  migration, the narrow layout made dead by `MobileAppHandoff`, heading outline, formatting).
  Claude re-ran: tsc 0, lint 0, full suite 328 files / 3148 tests exit 0; Playwright `--workers=1`
  14/17 - `auth-layout`, `auth-locale-round-trip`, `journal`, `review`, both
  `route-group-provider-identity`, `shadowing-explore` x4, `shadowing-hub` x4 pass;
  `lesson-creation-jobs` x3 fail only because it needs `playwright.c4.config.ts` (YouTube stub),
  and its registration step passed. Parallel runs hit a local-Supabase `JWT issued at future`
  clock-skew flake; run auth e2e with `--workers=1`.
- `6031351` Task 3 `OtpInput`. Claude re-ran: focused 9/9, tsc 0, lint 0, full suite 329 files /
  3157 tests exit 0. Codex mutation checks: suppressing `onComplete` -> 2 red; truncation -> 1 red.
  **Deferred to Task 4 (first item of its packet):** `aria-invalid={Boolean(errorId)}` marks all six
  boxes invalid whenever a parent passes `errorId`; replace with an explicit `invalid` prop. Deferred
  because nothing consumes `OtpInput` until Task 4 (L-014).

## Contracts and decisions

Owner rulings 2026-09-21 are spec §2. The ones most likely to be broken by accident:

- No Apple, no GitHub, no ToS/legal/help links, no OTP expiry text (spec §3).
- `register` works with confirmations on **and** off (spec §4.1); local stays off.
- `/reset-password` is NOT in `AUTH_ROUTES` (spec §4.2).
- The route-error surface sets no `data-density` and never rebuilds the shell (spec §6.3).
- Every commit stands alone: nothing links or redirects to a route before that route exists.
- **Commit procedure (owner ruling 2026-09-21):** Codex's Windows `workspace-write` sandbox denies
  writes to `.git`, so Codex cannot commit. Codex implements, verifies and edits this file, but does
  not commit. Claude reviews the diff, re-runs the checks, commits the task with Codex as
  co-author, then commits the run-state update. The sandbox is not bypassed.

## Verification

Spec corrections made during execution (all committed): §5.1 floor is 1024 px (`8afa8a5`);
plan Task 2 Step 3 red reason (`56a917c`); spacing constraint defers to the token guard (`28c916a`).

Per task: the task's own tests red → green, `npx tsc --noEmit` 0, `npm run lint` 0 errors, full
`npm test -- --reporter=dot > <file>` exit 0 (read the file), and the task's named Playwright specs.
Baseline on `master` at branch point: `npm test` 324 files / 3125 tests (recorded from the
desktop-density-scale merge gate; re-measure before relying on it).

## Working tree and environment

- Worktree: `.worktrees/auth-error-ux`, branch `auth-error-ux` off `master` `4535064`.
- `.env.local` copied from the main checkout; `node_modules` installed with `npm ci`.
- Docker Desktop + local Supabase were left running by the previous session; check with
  `npx supabase status` before any Playwright run.
- Never build or serve from the main checkout; the owner's dev server uses its `.next`.

- Owner: Codex

## Blockers

- **Paused 2026-09-22 00:46 at the owner's request.** Codex hit its usage limit while reading for
  Task 4 ("try again at 3:41 AM"); it wrote nothing - the worktree was verified clean at `83d055e`.
  Owner chose to wait for Codex rather than have Claude implement.

## Next actions

**Resume here (next session):** Task 4 has NOT started. The packet
`.superpowers/sdd/2026-09-21-auth-error-ux/task-4-brief.md` (main checkout, gitignored) and the
prompt pattern are ready. Re-dispatch: `codex exec -C <worktree> -s workspace-write -o <last.md> -
< <prompt file>` run detached (`nohup ... &`), prompt = the Task 3 prompt with 3 -> 4 and spec
sections "3, 4, 4.1-4.4 and 5.3". Wait on the `-o` file; do NOT detect exit by grepping `codex` in
`tasklist` - the `codex-windows-sandbox-ser` service always matches, which hid the usage-limit
stop for 30 minutes. Also grep the log for `usage limit`.

1. Codex: Task 4 (`task-4-brief.md`). Implement and verify; leave uncommitted; set
   `- Owner: Claude` in this file when ready.
2. Claude: review, re-verify, commit Task 4, then dispatch Task 5.
3. After Task 7: Claude whole-branch review, spec §8.2 measurement, spec §8.3 hand round trips,
   owner review in their Chrome, merge `--no-ff`.
4. Owner, by hand, before production: paste `supabase/templates/confirmation.html` into the
   Supabase dashboard's *Confirm signup* template (spec §4.4).
