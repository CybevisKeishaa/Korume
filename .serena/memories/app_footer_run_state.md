# app-footer — run state pointer (2026-10-13)

▶ **RESUME HERE next session.** Branch `app-footer`, worktree `.worktrees/app-footer`, base master `44fc84f0`,
tip `b149c63e`. NOT merged. Owner: Claude (Codex is gone).

Read in this order: this file → branch run state `docs/superpowers/run-state/app-footer.md` → spec
`docs/superpowers/specs/2026-10-13-app-footer-design.md` (APPROVED) → plan
`docs/superpowers/plans/2026-10-13-app-footer.md` (9 tasks, WRITTEN, awaiting owner review + execution method).

## Why this branch exists
Owner 2026-10-13: before the Certification port, do app chrome — footer + navbar.
- **Footer** = this branch. Figma Footer `203:13813` (file `IwFHZDZdHW7qsSFiNbWrkd`).
- **Navbar** = NOT started. Claude gave the owner a content list; the owner will have Figma draw it, then a
  separate branch `app-chrome-refresh`. List given: keep the left sidebar; icons per item; expanded ~240 /
  collapsed rail ~72 with tooltips (replaces the 24px ‹ › strip); user block at bottom (avatar, name, Free/Plus)
  with a menu Profile · Settings · Reduce motion · Sign out so the "Account" group leaves the list; bell stays
  (D9); optional real due-count badge on Review; Help link (FAQ/Quickstart); NOT search/⌘K (needs global-search),
  NOT an Upgrade CTA (no payment flow), NOT a theme toggle (dark only). Reason: 14 items + 5 group headers +
  logo + user block ≈ 730px vs the owner's 529px-tall viewport.

## Owner rulings (spec)
- F1: footer only on 13 outer pages — /shadowing, /shadowing/explore, /pronunciation (+ collections/[slug],
  paths), /kanji, /grammar, /conversation, /certification (list), /playlists (+[id]), /mining, /profile. NOT on
  /dashboard, /kanji/[id], focus routes, exam, review sessions, chat, settings, print, journal, auth, placeholders.
  Landing keeps its own footer (`components/marketing/site-footer.tsx`).
- L1/L2 (round 3): ONE composition, one row, never a variant: 24 · Brand 230 · 24 · Links 330 · 24 · App+Newsletter
  361 · 24 at a 1017px footer (1280 viewport, nav open), `--f = 100cqi/1017`; text ≥12px, links/buttons ≥14px.
  Links = 2 sub-columns: Explore (Home→/dashboard, Roadmap) | Support (Contact mailto) + Legal (Privacy, Terms as
  text). Cut: Pricing/FAQ/Blog/About/Careers/socials/support address/"A small note". Hide content only if measured
  (order: app body → tagline → mascot card).
- O1: store badges link to the stores' front pages (app not published) — same as landing.
- N: newsletter = real per-account opt-in, `users.newsletter_opt_in_at`, definer RPC `set_newsletter_opt_in`
  with `search_path=''`, Settings toggle in Privacy & data (#newsletter); copy says "saved", never "will send".
- F6: mascot art = `/mascot/poses/sleeping.png`, not the frame's captioned sheet crop.

## Next
1. Owner reviews the plan, picks execution (recommended subagent-driven).
2. Task 1: migration `20261013000046_app_footer_newsletter.sql` + `npm run verify:db:footer`.
3. Task 8 stops for the owner's Chrome look (serve on port 3100, never the main checkout).
