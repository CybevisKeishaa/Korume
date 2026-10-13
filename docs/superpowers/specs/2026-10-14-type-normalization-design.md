# Type Normalization — design

- **Status:** design approved in conversation by the owner on 2026-10-14, section by section (1/4 scale, 2/4
  migration, 3/4 guards, 4/4 order), with the owner's additions folded in. Awaiting written-spec review.
- **Branch:** `type-normalization`, worktree `.worktrees/type-normalization`, base `master` at **`c648bff0`**.
- **Why:** lesson L-052 found three type systems in one app — shared `--text-*` tokens (Settings, Shadowing,
  Pronunciation, footer), fixed Tailwind sizes on unported pages, and the Dashboard's own `--d` scale. The owner
  compares screens, not frames; every port so far had to be corrected by eye. This branch makes one type scale the
  only one, and makes a drift fail CI, before Certification and the remaining ports start.
- **Not in this branch:** the navbar (`app-chrome-refresh`, waits for the owner's Figma), any redesign of an
  approved screen, motion, admin, marketing/landing, auth, immersive, print output.

Decision IDs (S, M, G, V, P, R, O) are stable. Plans, reviews and commits cite them.

---

## 1. Owner rulings (conversation, 2026-10-14)

- **Scope:** the learner app — every page under `app/[locale]/(protected)/(app)` and `(focus)` and the components
  they render, Dashboard included. Out: marketing/landing, auth, `(immersive)`, print sheets, admin.
- **Reference:** the owner opened `/dashboard` and `/settings` side by side and chose **Settings**: the current
  `--text-*` scale is the standard; the Dashboard moves onto it. No second type system.
- **Wide screens:** above 1440 the whole app **zooms uniformly** — type, spacing, sidebar, controls, icons
  together — to **1.25x at 1920**, held above. At and below 1440 the curve is unchanged.
- **Guard approach A:** a source scan in vitest + a measurement gate in Playwright + before/after screenshots for
  the owner. Not: removing Tailwind's default scale (B), not an ESLint plugin (C).
- **Approved screens are not redesigned.** When the migration changes an approved screen's layout noticeably
  (taller cards, lost fold, new wraps), the measurements and before/after images go to the owner, who decides.
  The implementer never shrinks type back or reworks a design on their own.

## 2. Scale (S)

- **S1 — One curve.** `--density-unit` in `app/globals.css :root` becomes

  ```css
  --density-unit: calc(
    clamp(0.0555556rem, min(100vw / 1440, 0.015625rem + 100vw / 1920), 0.078125rem)
    * var(--display-scale, 1)
  );
  ```

  Below 1440 the first term is the smaller one, so the curve is today's (0.889 at 1280, 1.0 at 1440). From 1440
  to 1920 the second, gentler line takes over (1.0 → 1.25); above 1920 the `0.078125rem` cap holds. Both bounds
  and the intercept are `rem`, so a reader's larger default font size still raises the unit (WCAG 1.4.4, as
  today). Display scale still multiplies the result. `[data-density="reference"]` is untouched.

  | Viewport | 1280 | 1440 | 1680 | 1920 | 2560 |
  |---|---|---|---|---|---|
  | unit (px) | 0.889 | 1.0 | 1.125 | 1.25 | 1.25 |

  1920 / 1.25 = 1536, the canvas every app frame in the Figma file is drawn on.

- **S2 — The pinned scale.** The seven tokens keep their authored values (`caption 12/18` with floors 11/16.5,
  `body 14/22`, `body-lg 16/26`, `heading 20/28`, `heading-lg 24/32`, `title 28/36`, `display 40/48`). Computed
  from S1 at a 16px root and Display scale 1, size / line-height in px, tolerance ±0.05px:

  | Token | 1280 | 1440 | 1920 |
  |---|---|---|---|
  | `caption` | 11 / 16.5 | 12 / 18 | 15 / 22.5 |
  | `body` | 12.44 / 19.56 | 14 / 22 | 17.5 / 27.5 |
  | `body-lg` | 14.22 / 23.11 | 16 / 26 | 20 / 32.5 |
  | `heading` | 17.78 / 24.89 | 20 / 28 | 25 / 35 |
  | `heading-lg` | 21.33 / 28.44 | 24 / 32 | 30 / 40 |
  | `title` | 24.89 / 32 | 28 / 36 | 35 / 45 |
  | `display` | 35.56 / 42.67 | 40 / 48 | 50 / 60 |

  This table is written as literal numbers in the tests (G1, G4). It is the authority: a test that only compares
  rendered text with whatever the tokens currently resolve to would stay green if both were wrong.

- **S3 — What S1 changes.** At ≤1440: nothing for pages already on tokens. Above 1440: every density-scaled page
  grows uniformly (by design). Tests that pin the old curve (`lib/design-tokens.test.ts`,
  `tests/e2e/display-scale.spec.ts`, `components/layout/two-column-shell.test.tsx`,
  `lib/preferences/appearance-script.ts` and any other pin found by grepping `100vw / 1440` and `0.0625rem`) are
  updated to S1 and S2, not loosened.

## 3. Migration (M)

- **M1 — By role, not by nearest number.**

  | Role | Token | Typical old class |
  |---|---|---|
  | Page H1 | `text-title` | `text-2xl`, `text-3xl`, `.dash-h1` |
  | Large figure / emphasis | `text-display` or `text-heading-lg` | `text-4xl`, `.dash-title-lg` |
  | Card / section heading | `text-heading` | `text-xl`, `text-lg` used as a heading, `.dash-title` |
  | Body, buttons, links, inputs | `text-body` | `text-sm`, `.dash-btn` |
  | Emphasised body, Japanese sentences in body | `text-body-lg` | `text-base`, `text-lg` used as content, `.dash-quote` |
  | Meta, chips, secondary labels, eyebrows | `text-caption` | `text-xs`, `.dash-meta/.dash-small/.dash-link/.dash-eyebrow`, `.dashboard-chip` |

  Raw `leading-*` classes (17 today) go: the token class carries its line-height. Where a role genuinely needs a
  different line-height (a one-line glyph badge), it is an allowlist entry (G2), not a raw class.

- **M2 — Base size.** Text with no size class inherits the browser's 16px today. The `(app)` and `(focus)`
  layout roots set `text-body` (size and line-height). Marketing, auth and immersive keep their own bases.

- **M3 — Dashboard.** `--d` keeps every LAYOUT and ART size (padding, gaps, radii, icons, bars, heatmap cells,
  avatar box). Every `font-size` and `line-height` in the `.dashboard-*` / `.dash-*` rules moves to the token
  (M1); the classes keep letter-spacing, weight, colour and font family. No property is ever written in both
  `--d` and `--density-unit`, so nothing scales twice (G1 enforces it). Expected effect at 1280: body 11.5 →
  12.44px, so cards grow taller; the fold rule "header + Continue/Mission row inside 1280x529" may fail. If it
  does, the fix is spacing inside the cards in `--d`, never smaller type — and the numbers go to the owner first.
  The `globals.css` comment that says the Dashboard's type is written in `--d` is corrected.

- **M4 — Shared primitives.** `components/ui` is in scope and also renders on out-of-scope surfaces. At
  reference density the sizes are identical (`text-sm` 14 = `text-body` 14, `text-xs` 12 = `caption` 12,
  `text-base` 16 = `body-lg` 16), but line-heights change (e.g. 20 → 22). V1 therefore also captures the
  landing, login and one admin page, so that side effect is shown rather than assumed.

- **M5 — Order.** One commit per cluster, scan re-run after each: Dashboard → Profile →
  shadowing / shadowing-workspace / pronunciation / video / video-player / speech / lesson-summary →
  conversation / reading / jlpt / kanji / learning / vocab → community / companion / korume / mascot / study-time /
  settings / layout / ui / errors and anything left.

## 4. Guards (G)

- **G1 — Source scan (vitest, every CI run).** Walks the files under `app/[locale]/(protected)/(app)`,
  `app/[locale]/(protected)/(focus)` and `components/**`, minus the declared out-of-scope directories
  `components/admin`, `components/auth`, `components/marketing`, `components/vocabulary-print`,
  `components/style-guide`, and test files. Red on:
  - `text-(xs|sm|base|lg|xl|2xl…9xl)`, `text-[…]` with a length, raw `leading-*`;
  - inline `fontSize` / `lineHeight` in `style`;
  - in `app/globals.css`, any `font-size` or `line-height` declaration in a rule whose selector belongs to the
    learner app (all rules except the declared out-of-scope selector prefixes — landing/marketing, `.vp-*` print
    sheet, admin, style guide) that is not `var(--text-*)` / `var(--leading-*)` / `inherit`, and in particular
    any value containing `--d`, `--f` or `cqi`.

  It reports every violation as `file:line  match`, so its first red run is the migration's work list.

- **G2 — Allowlist.** One file, each entry `{ file, selector or component, pattern, reason }`. Allowed reasons
  are content presentation, not interface type: large kanji/glyph displays, pitch/pronunciation glyph art, the
  print sheet, and furigana `<rt>` (ruby annotation is smaller than its base text by definition; today in
  `components/reading/reading-body.tsx` and `components/video-player/furigana-text.tsx`). **Never a whole page or directory.** G1 also fails when an entry matches nothing (a stale entry is
  removed, not kept). The browser gate (G4) skips an allowlisted element only through a `data-type-exempt`
  attribute set on that element, named by the same entry.

- **G3 — Proof the scan bites.** Two mutations, run and recorded in the run state: plant `text-sm` in one page →
  G1 red; plant `font-size: calc(11 * var(--d))` in a Dashboard rule → G1 red. Restore from a `.mutbak` beside
  the file, never with `git checkout --`.

- **G4 — Browser gate (Playwright, 1280x529 / 1440x900 / 1920x1080, nav expanded).** For every page in P1:
  1. **Pinned scale:** read `--text-*`/`--leading-*` from `:root` and assert they equal the S2 table (±0.05px).
  2. **Every text:** every visible element with a direct non-blank text node, outside `data-type-exempt`, has a
     computed `font-size` + `line-height` pair that is one of the S2 pairs for that viewport. This catches text
     inheriting the 16px default, which G1 cannot see.
  3. **No clipping:** buttons, nav/sidebar labels and `[lang="ja"]` elements have
     `scrollWidth <= clientWidth + 1` and are not clipped vertically; the page has no horizontal scroll. Only
     exception: a deliberate `text-overflow: ellipsis` whose element carries the full text in `title` or
     `aria-label`.
  A page that cannot be reached or measured (auth, missing data, route error) fails the run with its reason; it
  is never skipped silently.

## 5. Visual review (V)

- **V1 — Baseline first.** Before any product change, a screenshot script captures every P1 page from a master
  build: 1280x529 full page, 1440x900, 1920x1080; Dashboard also with the nav collapsed. Plus landing, login and
  one admin page (M4).
- **V2 — Stable captures.** Same seeded data (P2), `document.fonts.ready` awaited, `prefers-reduced-motion:
  reduce` emulated, clock frozen (`page.clock`) at one fixed instant, cursor parked, same nav state per shot.
- **V3 — After + report.** The same script on the branch build. Output: one HTML page, before | after per page
  and viewport, with a pixel-difference % as an **indicator only** — a correct type change moves many pixels
  without breaking anything. At 1920 every page differs by design (S1); the report says so at the top.
- **V4 — Ratio table (report, not a self-graded gate).** On Dashboard and Settings at 1440 and 1920: body
  font-size against card inline-size, icon size, control block-size and card padding. The numbers go to the
  owner; no threshold is set by the implementer.
- **V5 — Owner decides.** Any approved screen whose layout changed noticeably is listed with its measurements and
  images. The owner rules; the implementer does not adjust a design or shrink type to make a diff smaller.

## 6. Pages (P)

- **P1 — Locked list (44 routes).** Dynamic segments are resolved from the seed (P2).
  - `(app)`: achievements · certification · certification/[id] · challenges · community · community/[id] ·
    community/peer-review · companion · conversation · dashboard · e2e-route-error · grammar · kanji ·
    kanji/[id] · kanji/review · korume/chat · leaderboard · mining · mining/review · playlists ·
    playlists/[id] · profile · profile/edit · pronunciation · pronunciation/collections/[slug] ·
    pronunciation/paths · reading · reading/[id] · review · roadmap · settings · settings/privacy ·
    settings/privacy/memory · shadowing · shadowing/explore · statistics · vocab · vocab/[id] · vocab/print ·
    vocab/review · weekly-report
  - `(focus)`: shadowing/[id] (workspace) · shadowing/[id]/dictation · shadowing/[id]/summary
  - `vocab/print`: its page chrome is in scope; the printable sheet (`.vp-*`, physical units) is an allowlist
    entry, not a page exclusion. `e2e-route-error` renders the shared route-error panel and stays in.
  A route added to the app after this spec is in scope by default (G1 walks directories, not this list); G4 and
  V gain it when the plan's route list is updated.
- **P2 — Data.** One seeded learner with enough data for every P1 page (the Dashboard demo seed extended as
  needed), ids for each dynamic segment recorded by the seed. `--cleanup` before any other E2E suite. A page the
  seed cannot populate is reported in V3 and G4 as "measured in empty state" or "not measured: reason".

## 7. Rules for later ports (R)

- **R1 — L-051** is amended: the frame's unit (`--d`-style, `cqi`) scales LAYOUT and ART only; type is always
  the shared tokens. Its evidence line about the Dashboard's type in `--d` is marked superseded by this branch.
- **R2 — L-052** is widened from "shared components" to "every screen", pointing at G1 and G4 as the proof.
- **R3 — Repository rule.** The repo has no port checklist file, and this branch does not invent one: `AGENTS.md`
  (read by both harnesses before any work) gains one rule — "interface type uses the `--text-*` tokens only
  (L-052); the typography scan (G1) and gate (G4) must stay green" — and G1 is what enforces it. Certification is
  the first port under it.

## 8. Order (O)

1. V1 baseline from master (script + stable capture + seed), before any product change.
2. S1 + S2/S3: curve, pinned table in unit and E2E tests, old pins updated.
3. G1 + G2 + G3: scan (red: the work list), allowlist, two mutations.
4. M2: base `text-body` on the `(app)` and `(focus)` layouts.
5. M1/M3/M4 per cluster (M5), one commit each, scan re-run; G1 green at the end.
6. G4 browser gate.
7. V3 after-captures + V4 ratio table → owner review (V5).
8. Whole-branch `code-reviewer` review, fixes, re-review, full vitest after the last edit; R1–R3; owner's Chrome
   look; merge `--no-ff` only on the owner's word.

## 9. Acceptance

- G1 green with no out-of-list exclusion; G3's two mutations recorded red.
- G4 green on all 44 routes at all three viewports, or each failure listed with its reason and accepted by the
  owner.
- V3 report and V4 table delivered; every noticeably changed approved screen ruled on by the owner.
- `npm run verify:protocol`, `tsc`, lint and the full vitest suite green after the last edit; existing E2E
  suites no worse than master (pre-existing reds: landing :287/:608/:700, summary :29).
