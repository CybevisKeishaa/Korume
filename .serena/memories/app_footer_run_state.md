# app-footer — run state pointer (2026-10-13, session paused)

▶ **RESUME HERE next session.** Branch `app-footer`, worktree `.worktrees/app-footer`, base master `44fc84f0`,
tip `19c1e7b4`. NOT merged. Owner: Claude (Codex is gone). Execution: subagent-driven (owner's choice).

Read in this order: this file → branch run state `docs/superpowers/run-state/app-footer.md` (accepted commits,
rulings, blocker, next actions) → SDD ledger `.superpowers/sdd/2026-10-13-app-footer/progress.md` (git-ignored;
every ruling + deferred minor; resume at the first task without a `complete` line) → spec + plan only as needed.

## Where it stands
- T1–T6 complete and reviewed: migration `...046` (`users.newsletter_opt_in_at`, definer RPC
  `set_newsletter_opt_in`, `verify:db:footer`), data layer + `PATCH /api/user/newsletter`, copy, `AppFooter` +
  islands + CSS, placement on 13 pages, Settings row `#newsletter`. Full vitest 5531/5531 green after T6.
- **T7 E2E BLOCKED in fix round 1.** Committed spec `f6314d81` passes 2/2 but does not exercise Review Focus 3.
  The cache-seeding fix (footer subscribe → Manage → /settings → AppNav "Lessons" client nav) shows the footer
  UNSUBSCRIBED on /shadowing even unmutated → probable product bug, root cause unknown. Attempt saved as
  `.superpowers/sdd/2026-10-13-app-footer/task-7-fix1-attempt.patch`.

## Next
1. systematic-debugging of the stale footer after client nav (worktree build on :3100, new Chrome tab). Candidates
   to MEASURE: stale Next 14.2 router-cache/prefetch entry for /shadowing; Next fetch data cache on
   `getNewsletterState`'s Supabase read.
2. Re-apply the T7 patch; must pass unmutated and go RED with Settings' `router.refresh()` removed.
3. T8 Chrome measure (reseed demo learner first — the `--cleanup` before T7 DELETED it), T9 gates + whole-branch
   review, owner's Chrome look, merge only on the owner's word.

## Owner decisions pending (surface at the end)
- Spec §5 "one contentinfo per page" is unmet: the footer sits inside `<main>`, so it has no aria-label (ARIA
  prohibits it there). A real landmark needs a layout-level slot (F2 change).
- Navbar: waiting for the owner's Figma frame → branch `app-chrome-refresh`.
