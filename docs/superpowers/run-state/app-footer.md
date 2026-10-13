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
| T8 measure + L2d pinned | complete (Playwright Chromium, Chrome extension offline) | this commit |
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
- **L2d (T8, measured 2026-10-13 in Playwright Chromium on a :3100 build — the claude-in-chrome extension was not
  connected; the owner's Chrome look is the cross-check):** floor = 1280x529 nav expanded → footer **1056.9px**,
  `--f` **1.039**; `--f` clamp kept `0.9px … 1.6px` (ceiling reached at 1920). Sections (L1 230:330:361 within ±1px
  everywhere): 1280 exp 239/343/375 · 1280 coll 284/408/446 (f 1.235) · 1440 exp 270/387/423 (f 1.172) · 1440 coll
  320/459/503 (f 1.392) · 1920 exp 379/544/595 · 1920 coll 435/624/683 (f 1.6, L2a). **L2b unused at the floor**
  (0 reducible elements hidden). Every viewport + `vi` 1280 + a 70-char email: tops equal, overflow empty, no
  one-line element wraps, badges side by side, smallest text 12px, no page scroll-x, email ellipsis with pill intact.
- T8 fixes: (1) badge prefix case now follows the frame — "Download on the" mixed, only "GET IT ON" caps
  (`--caps` modifier); both in caps were 126px in a 94px text column. (2) `.app-footer__badge` basis
  `max(164 * --f, 182px)`: at the 12px text floor "Download on the" needs 104px; it now fits **exactly (104/104)** at
  1280 nav expanded — zero slack, check by eye. 164f wins from `--f` ≈ 1.11 up, so 1440+ is unchanged.
  (3) The empty always-mounted `role=status` adds **no gap** (margin collapses through: next element moves 0px).

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

1. Owner's Chrome look at `http://localhost:3100/vi/shadowing` (demo learner) — in progress 2026-10-13; check the
   App Store badge text at 1280 nav expanded (zero slack). Apply feedback as numbers within L1.
2. T9: full gates (vitest, typecheck, lint, full E2E after the demo seed's `-- --cleanup`), whole-branch review on
   the most capable model, triage the ledger's deferred minors (incl. deleting `marketing.appFooter.ariaLabel`),
   lessons. Merge only on the owner's word.
