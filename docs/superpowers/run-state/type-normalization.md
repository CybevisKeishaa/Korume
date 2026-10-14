# Branch Run State

Branch `type-normalization`, worktree `.worktrees/type-normalization`, base master `c648bff0`.

- Owner: Claude

## Goal and scope

One type scale on the learner app (spec S/M), uniform zoom 1.0 -> 1.25 between 1440 and 1920, source scan +
browser gate (G1-G4), before/after review for the owner (V1-V5). Out: admin, marketing/landing, auth,
immersive, print sheet, navbar.

## Authorities

- `AGENTS.md`, `.codex/docs/workflow.md`, `docs/lessons.md` (L-004, L-051, L-052).

## Contracts and decisions

- Spec `docs/superpowers/specs/2026-10-14-type-normalization-design.md` — approved by the owner 2026-10-14.
- Plan `docs/superpowers/plans/2026-10-14-type-normalization.md`.
- Owner-approved screens: Profile (Task 5), shadowing (Task 6), footer (Task 9, V5). Rulings still open: see Open owner calls.

## Accepted commits

| Task | Status | Commit |
|---|---|---|
| 1 | done | ca284bbe |
| 3 | accepted | c77628ab |
| 4 | Dashboard on tokens + base text-body | `4f8e8c19` accepted |
| 5 | Profile on tokens (spec M1) | `a279dde0` + fix `775105bc` accepted |
| 6 | Shadowing, player, summary, Korume, mining on tokens (spec M1) | `65826082` + fix `ccca47c0` accepted |
| 7 | JLPT, certification, learning on tokens (spec M1) | `fb232855` accepted |
| 8 | Reading, conversation, kanji, vocab, grammar on tokens (spec M1) | `d217d314` + fix `cf5c5906` accepted |
| 9 | Community, companion, layout, ui, footer on tokens; PENDING_MIGRATION empty (spec M1, M4, G1) | `af229231` accepted |
| 10 | Browser gate G4 (`tests/e2e/typography.spec.ts`) + gate findings fixed | `cab236b3` accepted |
| 12 | Run state on the protocol template | `e933a57c` |
| 12 | L-051/L-052 + AGENTS.md rule (spec R1-R3) | `d720dd0c` |
| final review | Clip check per entry, JP sentences body-lg, meta caption, overlays on body, gate asserts XL and route-error (I1-I5) | `82113a17` |

## Verification

- Task 3 mutation (settings-row.tsx text-body -> text-sm, file confirmed changed): red line `components/settings/settings-row.tsx:50  text-sm`; restored from .mutbak, green again.
- Task 4: 16 Dashboard rules moved to tokens (roles per brief table; no unlisted hits). Mutation (dash-title -> calc(11 * var(--d)), grep count of that string 1 -> 2 so sed changed the file): red `app/globals.css:1695  .dashboard-layout .dash-title { font-size: calc(11 * var(--d)) }`; restored from .mutbak, green. Dashboard E2E 6/6 passed incl. the fold test at 1280x529 (no overshoot).

- Task 10 (G4 gate): mutation per Ruling P1 (sed `.dashboard-layout .dash-title` font-size -> 19px, grep count 1 confirmed, rebuilt): `-g 1440` red with `dashboard · type · h3.dash-display.dash-title "Ba lời hẹn nhỏ" · 19px / 28px` (and "Một kiểu tiến bộ lặng lẽ"); restored from .mutbak, rebuilt. Full gate on the final build: 7/7 passed (all 44 routes at 1280/1440/1920, Dashboard nav collapsed x3, extra-large display scale at 1920).
- Task 10 gate findings fixed (same commit): footer rules that set a `--text-*` size but inherited the parent line-height (`.app-footer__logo-tile`, `__wordmark`, `__tagline`, `__word-tile-jp`, `__word-tile-en`, `__newsletter-heading`, `__purpose/__message/__newsletter-done`, `__copyright`, `__top`) now carry the same token's `--leading-*` (M1: the token carries its line-height; G1 cannot see a missing declaration); `components/lesson-summary/next-lesson-card.tsx` title `break-words` (summary hscroll 2007/2294/2999 px at 1280/1440/1920 from an unbreakable seeded title; not a type change); `vocab/print` sheet marked `data-type-exempt="vocab-print-sheet"` + allowlist entry (spec P1/G2; its physical-unit kanji tiles clipped 33x39 in 33x33); gate tooling: a menulist `<select>` (Chromium computes line-height `normal`) is judged by size only, and the clip check skips elements under a scope-`all` marker (G2: the gate skips an allowlisted element).
- Task 10 measured in empty state (seedLearner): achievements, challenges, companion, review, roadmap, statistics, weekly-report (placeholder pages), community/peer-review, korume/chat, playlists/[id], pronunciation/collections/[slug] (first slug `advanced-expression` has no lessons); partly empty: certification (recent attempts), leaderboard (0 XP), vocab/[id] (no example sentences), pronunciation/paths (no saved path).

## Baseline / measurements

- Capture `.superpowers/typography/baseline-v1/`: 144 PNG (132 route + 3 nav-collapsed + 9 out-of-scope), `ratios.json`, `log.txt`.
- log.txt: `every route captured`
- baseline-v1 was captured before CAPTURE_TIME became required (it used the real clock); Task 11 recaptures both sides with one CAPTURE_TIME.

- Task 3 work list (lib/typography-scan.test.ts, step 3 red): 442 unique file:line violations (planning dry-run said 443; same tree) -> .superpowers/typography/work-list-v1.txt (git-ignored). 51 are app/globals.css rules; 391 are TSX. Every violation falls under a prefix of the brief PENDING list; none added, none deleted.

## Working tree and environment

- Master baseline build: `.worktrees/type-baseline` @ c648bff0, served on :3101 (`E2E_ROUTE_ERROR=1`), left running for Task 11.
- Branch build served on :3100 for captures; worktree .worktrees/type-normalization.

- Cleanup confirmed: 0 `e2e_typography` users left in auth.users.

- Task 10 local DB: one orphan `e2e_typography_86d2502d...` user (created 11:23 local by the dead second T10 dispatch) is left in auth.users with its seed rows; every Task 10 run of this session cleaned up after itself.

## Blockers

None. Owner calls are listed under Open owner calls.

## Open owner calls
- Task 5 (Profile, owner-approved screen, 38 hits in 13 files): visible changes at 1440 (density unit 1): page H1 text-3xl 30 -> text-title 28 (profile-page, edit-profile); h2 text-2xl 24 -> text-heading 20 (korumeship, learning-journey, edit-profile form title); identity Name text-2xl 24 -> text-heading-lg 24 (same); avatar initial text-5xl 48 -> text-display 40; goal quote text-xl 20 / text-lg 18 + leading-relaxed -> text-body-lg 16 (personal-goal, edit-preview); edit-preview card titles text-xl 20 / text-lg 18 -> text-heading 20; today memory JP text-2xl 24 -> text-heading-lg 24, title text-lg 18 -> text-body-lg 16; Profile chips (achievements, favourite sources; CHIP in card-styles.ts) 14 -> 12 at 1440 (text-sm -> text-caption, spec M1 chips); other text-sm 14 -> text-body 14 (same); Ask owner: should the featured Japanese memory line (todays-memory-card, text-heading-lg 24, unchanged) stay heading-lg while the title branch is body-lg 16?; text-xs 12 -> text-caption 12 (same).
- Task 6 (shadowing/player/mining, owner-approved shadowing screen; ~70 hits in 17 files), visible at 1440: text-sm 14 -> text-body 14 (same); text-xs 12 -> text-caption 12 (same); Japanese lines text-lg 18 / text-base 16 -> text-body-lg 16 (dictation result, mining deck list, review reading/translation; 18 -> 16); mining review card JP and completion text-2xl 24 -> text-heading-lg 24 (same, leading-relaxed dropped); page H1 mining deck text-2xl 24, mining review text-xl 20, dictation text-2xl 24 -> text-title 28 (bigger); dictation accuracy text-lg 18 -> text-body-lg 16; video-summary-panel h3 (summary.heading) text-sm 14 -> text-heading 20 at 1440 (measured change by role; owner rules on the visual cost in the compact side panel); mine-line-control "Mine" trigger text-xs 12 -> text-body 14 (button role); Korume answer blocks lost leading-relaxed (1.625 -> body-lg leading); lesson-summary hero lost leading-tight; allowlist: furigana-rt-player, stroke-order-glyph (text-7xl fallback tile).

- Task 7 (JLPT/learning/certification; certification not owner-approved, port next), visible at 1440: page H1s certification, JLPT pre-start, results, test runner (text-2xl 24 / text-xl 20 -> text-title 28, bigger); section h2/h3 text-lg 18 -> text-heading 20 (results panel x3, certification recent attempts, test-card title); JLPT question-card h2 (question N of M) text-base 16 -> text-heading 20 and vocab-examples h3 text-sm 14 -> text-heading 20 (by role, compact panels grow); pre-start figures text-lg 18 -> text-heading 20; score figure text-3xl 30 -> text-heading-lg 24 (smaller); timer text-lg 18 -> text-heading-lg 24 (bigger); review-session front text-4xl 36 -> text-display 40, completion text-2xl 24 -> text-heading-lg 24, JP sub/back text-lg 18 -> text-body-lg 16; passages/stems text-base 16 -> text-body-lg 16 (leading-relaxed dropped); results question stem text-sm 14 -> text-body-lg 16. No allowlist entries.
- Task 8 (reading/conversation/kanji/vocab/grammar), visible at 1440: page H1s (reading, conversation, kanji, kanji review, vocab, vocab review, grammar, reading detail) text-2xl 24 / text-xl 20 -> text-title 28 (bigger); section/card headings text-lg 18 / text-sm 14 -> text-heading 20 (conversation past sessions, scenario title, start heading, corrections panel h3 14->20, reading-body h2 14->20, reading detail quiz h2); reading passage text-lg leading-loose (18/2.0) -> text-body-lg 16/26 (smaller, tighter); kanji grid tile glyph text-4xl 36 -> text-display 40; reading-list filter pills text-sm 14 -> text-caption 12 (pill rule); vocab/kanji detail p text-lg 18 -> text-body-lg 16; conversation Play button text-xs 12 -> text-body 14; `vocab/[id]` h1 word 36px kept as allowlisted specimen (`vocab-detail-glyph`), alternative is `text-display` 40. Allowlist: furigana-rt-reading, kanji-detail-glyph, vocab-detail-glyph, six reading-* CSS rules (scope all: size multiplier + leading preference).
- Task 9 (community/companion/layout/ui/footer; PENDING_MIGRATION now empty), visible at 1440: page H1s (community, peer-review, leaderboard, playlists, forum thread, playlist detail, journal) text-2xl 24 -> text-title 28 (bigger); mobile-app-handoff h1 text-4xl 36 -> text-title 28 (smaller); forum comments / leaderboard h2 text-lg 18 -> text-heading 20; leaderboard weekly XP figure text-3xl 30 -> text-display 40 (bigger), its unit span text-base 16 -> text-body 14; peer-review JP lines text-lg 18 -> text-body-lg 16; app-nav wordmark (font-jp text-lg 18 bold) -> text-heading 20 (navbar waits for Figma; judge there); text-sm 14 -> text-body 14 and text-xs 12 -> text-caption 12 (same). Notification bell badge and ui Card title lost leading-none (size unchanged; Card title line-height 1.0 -> 28px, so CardTitle in landing/login/admin changes line-height only; Card, ui primitive, is the only components/ui change). FOOTER (V5, owner-approved screen): all unitless line-heights (1.5/1.8/1.15/1.3/1.2/1) replaced by the matching --leading-<token> (body 22, caption 18, body-lg 26, heading-lg 32 at unit 1), so footer lines are slightly taller/shorter than before (e.g. note and body copy 1.8 -> 18/22 px lines, tighter; chip 1 -> 26); .app-footer__chip-z 0.7em stays as allowlist footer-snore-z (marker data-type-exempt on the span in app-footer.tsx). Scan hardened: SIZE_CLASS also catches text-[.9rem]; no new hits.
- Task 9 / Task 10 footer (owner-approved screen, V5), EVERY footer line box that moved at unit 1 (sizes unchanged): T9 replaced the unitless line-heights 1.5/1.8/1.15/1.3/1.2/1 by the token leading (body 22, caption 18, body-lg 26, heading-lg 32): note and body copy 1.8 -> 18/22 px lines (tighter); `.app-footer__chip` 1 -> 26 (the snore z, `.app-footer__chip-z`, shifts with it); caption pills 16 -> 18 px line box (taller). T10 (G4) gave nine rules their own token leading where they inherited the parent line-height: `__logo-tile`, `__wordmark` (heading 20 on 28), `__tagline` (body-lg 16 on 26), `__word-tile-jp` (body-lg 16 on 26), `__word-tile-en`, `__newsletter-heading`, `__purpose`/`__message`/`__newsletter-done`, `__copyright` (caption 12 on 18), `__top`. No route is unmeasurable.
- Task 4 (Dashboard, owner-approved screen), MEASURED at T11 (computed font-size/line-height, baseline c648bff0 -> branch, px): `.dash-h1` 1280 30.5 -> 24.9, 1440 34.3 -> 28, 1920 48.2 -> 35; `.dash-title-lg` 25.1 -> 21.3, 28.3 -> 24, 39.7 -> 30; `.dash-title` 19.7 -> 17.8, 22.2 -> 20, 31.2 -> 25; `.dash-quote` 17.9 -> 14.2, 20.2 -> 16, 28.3 -> 20. Buttons grow: `.dash-btn` 10.5 -> 12.4 / 14 / 17.5 (1280/1440/1920; box 89x34 -> 97x34, 95x38 -> 109x38, 131x54 -> 142x52), `.dash-btn--sm` 10 -> 11 / 12 / 15 (box 77x26 -> 82x26, 79x29 -> 90x29, 104x41 -> 116x40). Page height at 1440: 1488 -> 1540 (taller), at 1920: 2060 -> 2032 (shorter). Body, meta and eyebrow grow at the same time. OPEN CHOICE: `.dash-title-lg` on heading-lg (24/32 at 1440, as now) or on display (40/48, allowed by M1).
- T11 capture (one CAPTURE_TIME 2026-10-14T06:23:21Z, baseline :3101 then branch :3100, both runs passed): baseline 144 PNG, after 144 PNG, baseline-v1 144 PNG (same count, nothing to explain). Report: `.superpowers/typography/review/report.html`; images `.superpowers/typography/review/{baseline,after}/<name>.png`; ratios in each `ratios.json`.
- V4 ratio table (baseline -> after; `controlHeightPx` is the first main button on each page, so it is NOT comparable across pages): 
  | page@width | bodyPx | iconPx | controlHeightPx | cardPaddingPx | bodyPerCardWidth | iconPerBody | controlPerBody | paddingPerBody |
  |---|---|---|---|---|---|---|---|---|
  | dashboard@1440 | 14 -> 14 | 11.11 -> 11.11 | 15 -> 18 | 28.28 -> 28.28 | 0.02 -> 0.02 | 0.79 -> 0.79 | 1.07 -> 1.29 | 2.02 -> 2.02 |
  | dashboard@1920 | 14 -> 17.5 | 15.58 -> 15.06 | 19.13 -> 22.5 | 39.67 -> 38.35 | 0.01 -> 0.02 | 1.11 -> 0.86 | 1.37 -> 1.29 | 2.83 -> 2.19 |
  | settings@1440 | 14 -> 14 | 16 -> 16 | 40 -> 40 | 24 -> 24 | 0.01 -> 0.01 | 1.14 -> 1.14 | 2.86 -> 2.86 | 1.71 -> 1.71 |
  | settings@1920 | 14 -> 17.5 | 16 -> 20 | 40 -> 50 | 24 -> 30 | 0.01 -> 0.02 | 1.14 -> 1.14 | 2.86 -> 2.86 | 1.71 -> 1.71 |
- Out-of-scope captures (V5/M4): `out-landing__{1280,1440,1920}.png` and `out-login__{1280,1440,1920}.png` are byte-identical before/after. `out-admin__1280.png` 910 -> 917 px tall and `out-admin__1440.png` 904 -> 912 (CardTitle `leading-none` removal; 1920 unchanged at 1080 viewport height). The Dialog/Popover `text-body` change has no capture (no overlay is open in any image). Other pages whose height changed visibly: `settings__1920.png` 2659 -> 3354 (taller, body grows to 17.5), `dashboard__1280.png` 1341 -> 1376, `dashboard__1440.png` 1488 -> 1540, `dashboard__1920.png` 2060 -> 2032, `settings-privacy__1280.png` 712 -> 745.
- Mobile handoff (`components/layout/mobile-app-handoff.tsx`, h1 36 -> 28 below 1024px): measured 36px on baseline, 28px on branch at 390 wide; images `.superpowers/typography/review/baseline/mobile-vi__390.png` and `.../after/mobile-vi__390.png` (`/vi`, anonymous).
- 1920 glance (unported-page rem boxes vs grown type): looked at `after/dashboard__1920.png`, `conversation__1920.png`, `focus-shadowing-id__1920.png`: bell badge, nav items, Dashboard `.dash-btn`/`--sm` buttons (Hoc tiep, Xem lai bai, Luyen ngay), JLPT badge, play buttons - no overlap or cramp seen. Not all 144 images were inspected; the report lists the rest.
- Final review wave, visible at 1440 (unit 1; at 1280 body/caption/body-lg are 12.44/10.67/14.22): (I3) pure metadata rows body 14 -> caption 12: forum-post-item byline, forum-thread post and comment bylines, peer-review-queue shared-by row, playlist-detail owner, journal-view date, reading-list and reading-detail word count, vocab/[id] part of speech, and `todays-memory-card` date (Profile, owner-approved: owner call). Left on body by role: subtitles, empty/loading, descriptions, notes, errors. (I2) Japanese sentences body 14 -> body-lg 16: chat message bubble, vocab example `sentence_jp`, corrections original/corrected, journal `lineTextJp` (master 16, branch 14, now 16), grammar `ex.jp`, and the shadowing pin-dialog line (owner-approved screen). (I5) Dialog and Popover content now `text-body`: overlay text was the browser default 16/24 off the scale, now 14/22 at 1440 (12.44 at 1280) - a shrink inside every dialog and popover (landing, admin, Shadowing popovers); the pin dialog is covered by a gate step, other overlays are not opened by the gate. (m1) reading-list level pills caption 12 -> body 14 (replaces the Task 8 pill shrink; matches level-tabs).

## Next actions

1. T11 before/after capture (both sides with one CAPTURE_TIME).
2. STOP for owner review of the before/after.
3. Final whole-branch review, then fixes.
4. Merge only on the owner's word.
