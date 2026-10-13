# Branch Run State

Branch `app-footer`, worktree `.worktrees/app-footer`, base master `44fc84f0`.

## Goal and scope

Port Figma Footer `203:13813` as `AppFooter` on the 13 outer app pages (spec F1), one scaled single-row
composition (L1: 24 · 230 · 24 · 330 · 24 · 361 · 24 at a 1017px footer), with a real per-account newsletter
opt-in (`users.newsletter_opt_in_at`, definer RPC, Settings toggle). Landing footer unchanged. Desktop-only.
Not in scope: the app navbar (own branch `app-chrome-refresh` once the owner's Figma frame exists), new
marketing/legal pages, mail sending.

## Authorities

- Spec `docs/superpowers/specs/2026-10-13-app-footer-design.md` — **approved by the owner 2026-10-13** after
  three review rounds (round 3 = one composition, space reallocated; O1 store badges as on the landing).
- Plan `docs/superpowers/plans/2026-10-13-app-footer.md` — 9 tasks, plan-time corrections P1–P6, Review Focus
  1–5. **Approved by the owner 2026-10-13; execution = subagent-driven.**
- `AGENTS.md`, `.codex/docs/workflow.md`, `docs/lessons.md` (L-011, L-044, L-051).
- SDD ledger (git-ignored, the recovery map with every ruling and deferred minor):
  `.superpowers/sdd/2026-10-13-app-footer/progress.md`. Briefs, reports and review packages sit beside it.

## Accepted commits

| Task | Status | Commit |
|---|---|---|
| Spec | approved | `1af6902d` … `6659e197` |
| Plan | approved | `b149c63e` |
| T1 column + RPC + `verify:db:footer` | complete, review clean | `9e576d9b` |
| T2 data layer + `PATCH /api/user/newsletter` | complete, review clean | `0d0916d7` |
| T3 copy en + vi | complete, review clean | `6d4eea37` |
| T4 `AppFooter`, islands, CSS, `<main id>` | complete after 1 fix round | `9d978674`, `6158b37f` |
| T5 placement on 13 pages + static pin | complete, review clean | `5dedb52e` |
| T6 Settings newsletter row | complete, review clean | `4a9a0be5` |
| T7 E2E + stale-cache product fix | complete after 1 fix round + review minors | `f6314d81`, `bdfe518d`, `9b0b378f` |
| T8 measure + L2d pinned | complete (Playwright Chromium, Chrome extension offline) | `e966bbd0` |
| Owner Chrome looks 1–3 (spec §R) | approved by the owner | next commit |
| T9 whole-branch gate | not started | — |

## Contracts and decisions

Spec F1–F6, L1–L3 (L2a–L2e), N1–N5, T1–T6, O1. Plan P1 API route not server action; P2 `router.refresh()`
not `revalidatePath`; P3 T2 static + runtime split; P4 art `/mascot/poses/sleeping.png`; P5 sign-in = reload
(middleware adds `redirectTo`); P6 email = session account email.

Controller rulings during execution (full list with costs in the ledger):
- `<footer data-app-footer>` has **no aria-label**: inside `<main>` it maps to generic and ARIA 1.2 prohibits
  the label; `role=contentinfo` would be non-conforming. **Spec §5 "one contentinfo per page" is therefore unmet
  — owner's call** (a real landmark needs a layout-level slot, i.e. an F2 change). `marketing.appFooter.ariaLabel`
  is now unused — delete it before merge.
- Back-to-top button floor raised 12 → 14px (spec L2 buttons ≥ 14px; the plan's 12px contradicted it).
- Footer island: no `key` remount; prop-sync state, an always-mounted `role="status"`, focus moves to "Manage in
  Settings" after a user-triggered save only.
- T8 runs without stopping; the owner's Chrome look comes after T9's gates and final review, server left on :3100.

## Verification

- `npm run verify:db:footer`: 8 PASS; mutations (anon EXECUTE grant, `now()` instead of `coalesce`) both FAIL
  the gate, restored (T1).
- Full vitest after T6's last edit: 661 files / 5531 tests green; typecheck clean; lint 0 errors.
- E2E `tests/e2e/app-footer.spec.ts` at `f6314d81`: 2 passed. Neighbours: 29 pass; `pronunciation.spec` :201/:226
  need the `shadowing-explore.spec` seed (not footer-related); `settings.spec` :87 flaky (passed on rerun).
- **L2d — FINAL after the owner's three Chrome looks (spec §R, owner approved look 3, 2026-10-13).** Measured in
  Playwright Chromium on a :3100 build (claude-in-chrome extension offline; the owner looked in their own Chrome).
  `--f = clamp(0.7px, 100cqi / 1380, 1.4px)` (frame's container); sections `374.66fr : 456.11fr : 293.23fr`, links
  and app `minmax(min-content, fr)`, section gap `40 * --f`. Type on shared tokens: footer link = page body at every
  width (12.4px at 1280, 14px at 1440 and 1920). Section widths (brand/links/app): en 1280 exp 252/378/292 · vi 1280
  exp 210/444/268 · en 1440 exp 291/424/325 · en 1920 coll 535/652/467. Footer height 636 (1280) … 858 (1920 coll).
  At every width (1280/1440/1920, nav expanded + collapsed, en + vi, a 70-char account email): one row (tops equal),
  no overflow, no element escapes its column, no page scroll-x. L2b unused. The T8 badge fixes (182px floor, prefix
  case) are superseded by §R5 (content-sized equal badges on one row).
- Superseded history: T8's first L2d (1017-based `--f`, footer links 14.5px) is in commit `e966bbd0`.

## Working tree and environment

- Owner: Claude

`node_modules` is a junction to `.worktrees/port-profile/node_modules`; `.env.local` copied from the main
checkout. Codex is gone (owner 2026-10-12). Serve on a port other than 3000; Playwright's config uses :3000 with
`reuseExistingServer`, so check :3000 is free before every E2E run. Docker Desktop + local Supabase were started
this session (migration `...046` applied). Machine RAM is tight: vitest `--minWorkers=1 --maxWorkers=2`.

⚠️ The demo seed's `-- --cleanup` (run before T7) **removed the demo learner** `demo.dashboard@korume.local` as
well as restoring the curriculum titles. Reseed it (without `--cleanup`) before T8's Chrome look; cleanup again
before any E2E.

## Blockers

None. Resolved 2026-10-13 (history below): root cause measured — a client navigation discards an in-flight
`router.refresh()` (Next 14.2 `action-queue.js`), so the pre-save prefetch entry is reused for 30s; fixed with the
tab-writes pattern (`lib/newsletter-tab-writes.ts`, keyed by account email, forgotten on a failed save).

**(History) T7 fix round 1 — possible product bug, root cause unknown.** Review found the flow test never exercised Review
Focus 3 (stale router cache): `/en/shadowing` is entered by `page.goto`, so removing Settings' `router.refresh()`
left it green. The fix seeds the cache by client navigation: subscribe in the footer → "Manage in Settings" →
`/settings` (switch on) → click AppNav "Lessons" → expect the footer to say "saved". **That step is RED even
without any mutation**: after the client navigation `/shadowing` shows the footer UNsubscribed. The attempted
spec change is saved as `.superpowers/sdd/2026-10-13-app-footer/task-7-fix1-attempt.patch` (not committed).

## Next actions

1. T9: full gates (vitest, typecheck, lint, footer + full E2E after the demo seed's `-- --cleanup`), whole-branch
   review on the most capable model, triage the ledger's deferred minors, then merge locally (owner: "finish the
   remaining tasks", 2026-10-13). Never push.
2. Owner calls still open (not blockers): §5 contentinfo landmark (layout-level slot); app-wide
   `staleTimes.dynamic: 0`; a type-normalization branch for the Dashboard + unported pages (L-052).
