# app-chrome-refresh — MERGED (2026-10-15)

⭐ **MERGED + owner-approved in Chrome** → master `aea3e1da` (not pushed; owner pushes by hand). Branch + worktree
`.worktrees/app-chrome-refresh` kept. History, not a resume point.

Delivered: AppNav 240/72 on `--nav-u` with owner logo art (`public/mascot/logo/nav-wordmark.png` expanded,
`nav-emblem.png` collapsed), `korume_nav` cookie, live review-due badge, AccountMenu (profile, settings, reduce motion,
sign out), rail tooltips (hover + focus, hoverable), `GET /api/nav/summary` (private, no-store) + `useNavSummary`
(401 clears via flushSync then reloads once), `/help` placeholder, zero-due review -> `/kanji`.

Gates: vitest 5603 green, typecheck/lint/verify:protocol; Playwright 178 pass + 4 pre-existing master reds
(landing-page :287/:608/:700, summary :29). Whole-branch Opus review: I1 (nav avatar ignored avatar_path) and I2
(E6 never hit the hook 401 path) fixed; re-review clean. Run state: `docs/superpowers/run-state/app-chrome-refresh.md`.

Owner accepted: pronunciation-search card lower bound 12rem (~192px, measured 196) with the wider nav.
Deferred: M9 — transient Supabase Auth error -> 401 -> one page reload (R11).
Next: Certification port.
