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
- `9c8c081` Task 4 OTP slice (`/verify-email`, `verifyEmail`/`resendCode`, template, redirects;
  Item 0 `OtpInput` `invalid` prop). Codex stopped with 1 red: the plan omitted the registry, and
  `screen-registry.routes` T1 caught the unregistered route. Claude fix wave: the existing
  `email-otp` entry (`335:306`) now claims `/verify-email` (convert, never add - T1 wants exactly one
  entry); e2e fixes (Playwright has no `locator.paste`, so a real `ClipboardEvent` is dispatched;
  `auth-layout` looks up each route's submit label; alert scoped to `main` past Next's route
  announcer). Claude re-ran: tsc 0, lint 0, full suite 331 files / 3180 tests, 1 red =
  `pitch-contour` known flake, 8/8 alone; Playwright `--workers=1` `auth-verify-email`,
  `auth-layout`, `auth-locale-round-trip`, both `route-group-provider-identity` pass.
  **Carry to Task 5:** the registry's `reset-password` entry (`333:210`, `route: null`) needs the
  same conversion, and every new page needs its e2e run by Claude before commit.
- `57529e9` Task 5: password-reset schemas/actions/forms/pages, auth route and
  registry conversion, login link, and unrun e2e coverage. TDD red: schema 2, actions 7, forms
  missing-suite, reset page missing-suite, route 2, login 1, a11y 1, registry T1 1. Green:
  focused 36 files / 305 tests; tsc 0; lint 0 errors; full 335 files / 3197 tests. Mutation:
  adding `/reset-password` to `AUTH_ROUTES` made 2 route tests red; restored green. Playwright
  was written but not run per the packet. Claude fix wave: registry comments moved back above
  their own entries; the reset-link confirmation is a `role="status"` live region. Claude re-ran:
  tsc 0, lint 0, full 335 files / 3197 tests exit 0; Playwright `--workers=1` 6/6 first run
  (`auth-password-reset`, `auth-layout`, `auth-verify-email`, `auth-locale-round-trip`, both
  `route-group-provider-identity`). Codex used ~232k tokens (Task 4: ~265k) after the prompt
  stopped reading all of `docs/lessons.md`.
  **Owner check at the end:** forgot-password card eyebrow and heading are both "Account
  recovery" (story copy follows frame `333:210`); confirm or pick a heading.
- `51fd8d5` Task 6: standalone localized 404 and catch-all, errors catalogs, and
  `error404` registry conversion. TDD red: components 3 missing-module suites; registry T1 1 red
  (`/[...rest]`). Green: focused 36 files / 446 tests; tsc 0; lint 0 errors (85 existing warnings);
  full 338 files / 3202 tests. Mutations: density -> `mutated` 1 red; `<code>` -> `<span>` 2 red;
  both restored green. Derived catch-all route: `"/[...rest]"`, chrome `null`; registry counts unchanged.
  E2E written, not run per packet. Claude fix wave: `BackButton` props stop declaring
  `className` twice; e2e asserts the 404 status in both locales. Claude re-ran: tsc 0, lint 0, full
  338 files / 3202 tests exit 0; Playwright `--workers=1`: `not-found`, `route-rename-redirects`,
  `auth-layout`, `auth-password-reset` pass. `landing-page` 20/25: the 3 master-known reds (h1, §3
  keyboard, §3 thumbnail - desktop-density-scale run state) still red with Task 6's two route
  files moved out, so not caused here; 2 `page.goto` timeouts pass 2/2 alone. Codex ~212k tokens.

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

- None. Task 7 packet written 2026-09-22 and dispatched to Codex (plan Task 7 Step 3 corrected first: `e2e-route-error/`, not the private `__e2e/`, plus one registry row).

## Next actions

**Resume here:** Task 6 accepted at `51fd8d5`. Claude writes `task-7-brief.md` (route-error
boundaries; spec §6.2-6.4; check whether the registry `error-boundary` entry `337:2055` needs
anything - `error.tsx` is not a `page.tsx`, so T1 likely does not fire), then dispatches with the
Task 6 prompt (6 -> 7, Task 7 spec sections, named lessons only). Wait on the `-o` file, or
`grep -E "^ERROR: You.ve hit your usage limit"` in the log.

1. Claude: write the Task 7 packet, set `- Owner: Codex`, dispatch.
2. Codex: Task 7; leave uncommitted; set `- Owner: Claude` when ready.
3. Claude: review, re-verify, commit Task 7.
4. Then: Claude whole-branch review, spec §8.2 measurement, spec §8.3 hand round trips (include the
   reset email through Mailpit: `additional_redirect_urls` lists the bare `/auth/callback` while
   `redirectTo` carries `?next=`), owner review in their Chrome, merge `--no-ff`.
5. Owner, by hand, before production: paste `supabase/templates/confirmation.html` into the
   Supabase dashboard's *Confirm signup* template (spec §4.4).
