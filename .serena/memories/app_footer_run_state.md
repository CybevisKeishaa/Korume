# app-footer — run state pointer (HISTORY: merged 2026-10-14)

⭐ **MERGED → master `2d7a5a27`** (branch tip `38f3ff50`, base `44fc84f0`; not pushed — the owner pushes). Branch
and worktree `.worktrees/app-footer` kept. Owner approved the footer in Chrome after three looks.

Full record: branch run state `docs/superpowers/run-state/app-footer.md` (commits, rulings, L2d, T9 results) and the
spec `docs/superpowers/specs/2026-10-13-app-footer-design.md` §R (owner revisions superseding L1/L2/F3/F6/O1). SDD
ledger `.superpowers/sdd/2026-10-13-app-footer/progress.md` (git-ignored, in the worktree).

## What shipped
- `users.newsletter_opt_in_at` + definer RPC + `verify:db:footer`; `PATCH /api/user/newsletter`; Settings row.
- `AppFooter` on the 13 outer app pages: layout `--f = 100cqi / 1380`, type on `--text-*` tokens, every frame
  label a link (`PLACEHOLDER = "/"` until each page exists), badges on one row, mascot card (CTA, ことば gloss, snore).
- T7: a client navigation discards an in-flight `router.refresh()` (Next 14.2 action-queue) → stale prefetch entry
  for 30s; fixed with email-keyed tab writes (`lib/newsletter-tab-writes.ts`), forgotten on a failed save.

## Open owner calls (not blockers)
- Spec §5 "one contentinfo per page" unmet (footer inside `<main>`; needs a layout-level slot).
- App-wide `experimental.staleTimes.dynamic: 0` (Next 15 default) would close the stale-cache class everywhere.
- Type-normalization branch (L-052): Dashboard `--d` and the unported fixed-14px pages.
- Navbar → `app-chrome-refresh` once the owner's Figma frame exists.
