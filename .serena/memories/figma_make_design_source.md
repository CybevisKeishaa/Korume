# Figma Make design source — the real UI source of truth (probed 2026-08-05)

> ⚠️ **The local bundle at `C:\Users\tplon\Downloads\Design Shadowing Page UI` is a STALE SNAPSHOT.**
> Proven 2026-08-06, after ONE day: its `src/styles/fonts.css` imports only Plus Jakarta Sans + DM Mono,
> while the user reports the live project now also loads Noto Serif JP. **Treat the live Figma Make
> project as authoritative and re-verify any value before relying on it.** This is the concrete
> evidence behind the rule against committing snapshots into the repo.
>
> ✅ **Agenda A/B (style drift → tokens, palette, fonts) is BUILT AND MERGED** — spec
> `docs/superpowers/specs/2026-08-06-figma-make-token-typography-adoption-design.md` (`f728731`),
> plan `.../plans/2026-08-06-figma-make-token-typography-foundation.md`, merged `--no-ff` at
> **`86328bc` (2026-08-07)**. It supersedes the primitive-naming and font paragraphs below —
> corrections are marked inline. Post-merge: 218 files / 1966 tests, tsc 0, lint 77 warnings.
> **Agenda C (per-screen divergence) is still deferred and still handled lazily, one screen at a time.**
>
> ✅ **ALSO DONE (2026-08-07, `7277ac1`): the screen-port workflow** — spec
> `docs/superpowers/specs/2026-08-07-screen-port-workflow-design.md`. It closed steps 3–4 of the
> user's sequence: the `components/ui/**` primitives are now genuinely on the token scales (only 5 of
> 13 were, and button/card/input used none of it), and the chrome architecture exists —
> `app/[locale]/(protected)/` owns the session lifetime and mounts `AmbientProvider`, with `(app)` /
> `(focus)` / `(immersive)` beneath it. **A ported screen now has a chrome contract to declare and a
> token vocabulary that is enforced by test.** Read `mem:project_status` § NEXT ACTION for the five
> rules that bind every port, and `mem:plan_c_hub_ui_inputs` before building the Hub.
>
> ⚠️ **Rule #0 supersedes any instinct to copy values out of this bundle.** Measured here: the
> design's dominant body size is **10px** across 883 sites, roughly ×1.4 off the shipped scale, and
> its radii are six values inside a 12px band rather than a scale. The bundle is read and compared
> against — never transcribed.
>
> **What the token layer now gives a ported screen** (read before porting anything):
> semantic names are unchanged shadcn (`bg-primary`, `text-muted-foreground`, …) so imports don't
> change; ONE ember accent `#ff8a3d`; `--secondary` `#20242c` for secondary CTAs and for **hover**;
> warm sand `--accent` `#e8a05d` for tags/status only, never a CTA; radius 8/14/20/28; elevation is
> deliberately almost invisible because **depth comes from the surface ladder**
> `--background #0b0d11 → --card #171a20 → --secondary #20242c`, not from shadow.
> ⚠️ The design's orange glow `shadow-[0_0_12px_#FF8A3D]` was **deliberately NOT adopted** — it
> contradicts the Design DNA's own "No neon" rule, and per the one-directional rule the fix belongs
> in Figma. It is an open category-C ruling for the porting spec.
>
> **NOT verified and owed by a human:** `/dashboard` and `/admin/style-guide` were never opened in a
> browser — both are auth-gated and the assistant may not create accounts or enter passwords. Only
> `/vi` and `/vi/login` were visually checked. Spec §6 asked for a dense real screen; that is still
> outstanding, and it is exactly the check that would have caught the `--muted` hover problem earlier.

Supersedes the earlier assumption that `docs/design/` screens + PNG exports (`public/demo/image.png`,
`image1.png`) were the only design input. There is a **Figma Make code bundle** that is a far better
source than anything reachable through the Figma MCP.

## Where things are

- **Figma Make project (still being developed by the user — NOT finished as of 2026-08-05):**
  https://www.figma.com/make/F4YT6PojqSDf8mYNe1ZuZH/Design-Shadowing-Page-UI
- **Downloaded code bundle (local, outside the repo):** `C:\Users\tplon\Downloads\Design Shadowing Page UI`
- **Figma *design* file** (user copied the Make output into it): file key `IwFHZDZdHW7qsSFiNbWrkd`,
  titled "Kurome" — 29 top-level frames, ONE page (`0:1`).

## ⚠ Do NOT use the Figma MCP route for UI work — it is strictly worse

Verified by probe, not assumption:
- **Code Connect is unavailable**: Figma returns "You need a Dev or Full seat on an Organization or
  Enterprise plan". The account is `longtnphs176220@fpt.edu.vn`, **student tier** team.
- Even with a plan upgrade it would be useless: the design file has **0 components, 0 instances,
  0 variables** (only 8510 `frame` + 2880 `text` nodes). `get_variable_defs` returns `{}`.
- The file was **imported from HTML**, not hand-built: node names are HTML tags (`Paragraph`,
  `Heading 2`, `Article`, `Section`), with import-tool artifacts (`Container:margin`,
  `WeeklyCardMargin`, `Icon:transform`, `Container1..N`, `Text1..N`), max depth 38, sub-pixel widths
  (`297.75px`, `border-[0.8px]`).
- `get_design_context` DOES return Auto Layout (flex/grid/gap), not absolute positioning — but every
  value is hardcoded arbitrary (`bg-[#171a20] text-[9px] rounded-[22px]`), which would fail L9a
  Plan 2's token-contract test and P8 lint rule.
- Practical limit: one 339x211 card produced ~80 lines. A full 1536x2745 screen would blow context —
  if ever used, pull **section by section**, never a whole screen.

## The bundle's three quality tiers (this is the useful part)

| Tier | What | Verdict |
|---|---|---|
| **A. `src/imports/pasted_text/`** — 21 files, ~180KB | The original **design prompts in prose**: `shadowing-practice.md` (19KB), `nihongo-cinema-spec.md` (24KB), `lesson-workspace.md` + `-1.md`, `korume-dictation-workspace.md`, `korume-lesson-summary.md`, `shadowing-detail-design.md`, `kanji-*`, `pronunciation-*`, `companion-home-*`, `onboarding-welcome.md`, `about-philosophy.md`, `nihongo-cinema-roadmap.txt` | **Highest value.** Design intent in words. Contains an explicit "Korume Design DNA" section. NOT YET READ — read before porting any screen. |
| **B. `src/app/components/*.tsx`** | Real screens, real semantics (`<main>/<header>/<section>/<aside>`, lucide icons, data arrays, useState). `ShadowingDetailPage.tsx` 1006 LOC (NOT YET READ), `ShadowingPage.tsx`, `CompanionHomeScreen.tsx`, `KanjiInspectorModal.tsx`, `LearningRoadmapScreen.tsx`, `AuthScreen.tsx`, … Written as dense one-liners but structurally sound. | **Good reference.** Adapt, never paste. |
| **C. `src/imports/*/index.tsx`** | Figma-import junk: `PronunciationLibrary` 4545 LOC, `KanjiLibrary` 4393, `PronunciationDetail` 3785, `Pricing` 2605, `Homepage` 2064, `Sidebar-1..4`, `WeeklyCardMargin`, `Container`, `svg-*.ts` | **Ignore.** Same garbage as the Figma re-export. |

⚠ `PronunciationLibrary`, `KanjiLibrary`, `PronunciationDetail`, `Pricing`, `Homepage` exist **only in
tier C** — their tier-B files are thin wrappers. Those screens have no clean source.

## Brand name — RESOLVED: "Korume" is correct

grep over the whole bundle: **0 hits** for `Kurome`/`Kurume`. The Figma design file's title "Kurome"
is just a **typo in the file name**. Positive evidence: `App.tsx:329` says "…and **Korume** will
transform it…", and the newest prompts are `korume-dictation-workspace.md` / `korume-lesson-summary.md`
with a "Korume Design DNA" heading. Six files still say "Nihongo Cinema" (`AuthScreen`,
`CompanionHomeScreen`, `CompanionHomeContent`, `ProfileOverviewScreen`, `WelcomeSetupScreen`) — the
Make project is **mid-rebrand too**, same as the repo was before Plan A. **No rework needed on the
Korume rebrand; Plan B Task 1 (`f8690c8`) stands.**

## The three kinds of divergence (user-approved framing, 2026-08-05)

Different cost, different treatment — do not conflate.

### A. Style drift *within* the bundle — cheap, mechanical. **User: OK, normalize to tokens.**
Components use **zero** tokens: `grep bg-card|bg-background|text-muted-foreground|bg-primary` over
`src/app/components/` → 0 hits. `theme.css` defines tokens nothing consumes. Measured drift:
- **6 distinct oranges, 331 uses:** `#ff8a3d` (96, = the theme token) vs `#f28c52` (71),
  `#ffb067` (69), `#f28a45` (62), `#f6a36a` (21), `#ff8a4c` (12)
- **Card bg:** `#171a20` (61) plus near-miss one-offs `#171a1f`, `#0e1013`, `#0f1014`, `#0f1217`,
  `#15181f`, `#12151b`, `#1a1f28`, `#1b2029`
Fix = one hex→token lookup table. Cheap because `theme.css` already supplies the semantic target names.

### B. Bundle palette vs repo palette — **DECIDED 2026-08-05: follow the Figma style.**
User's reasoning: 29 screens already exist with internal consistency, whereas the current app screens
"chưa có gì, thậm chí là rất xấu, chưa có trang trí gì cả". So the Figma palette **wins over** the
shipped L9a Plan 2 light-first palette.

| | Repo `app/globals.css` | Figma Make `src/styles/theme.css` |
|---|---|---|
| Default | **Light-first** (`--background: var(--washi-50)`, `--card: var(--white)`) + dark block | **Dark-only** (`#0b0d11` / `#171a20`); `.dark` identical to `:root` |
| Primary | `var(--vermilion-500)` (朱) | `#ff8a3d` |
| Accent | `var(--indigo-600)` (藍) | `#ff8a3d` (same as primary) |
| Radius | `0.75rem` (12px) | `20px` (cards `rounded-[22px]`) |
| Format | HSL triplets, **Tailwind v3** + `tailwind.config.ts` | hex, `@theme inline`, **Tailwind v4** |
| Extra | `--font-jp`, `--space-*` scale, primitive tier | `--sidebar-*`, `--chart-1..5`, `--switch-background` |

⚠️ **SUPERSEDED 2026-08-06 by `docs/superpowers/specs/2026-08-06-figma-make-token-typography-adoption-design.md`
(committed `f728731`). Read that spec, not the paragraph below.** The user overruled the "keep the
Japanese names" half: `#ff8a3d` is a warm orange, not 朱色, and indigo 藍 is deleted from the system
outright as contradicting the Korume DNA. Primitives are renamed to neutral material names
(`void / paper / ink / slate / ember / sand / mint / coral`). **The cost warning below was simply
wrong** — measured, primitive names appear in exactly TWO places (`app/globals.css` and the
`PRIMITIVE_TOKENS` array in `lib/design-tokens.test.ts`); `components/style-guide/style-guide.tsx`
and every component reference them ZERO times. Renaming forfeits no enforcement whatsoever.

(historical) **Cheapest implementation path (agreed): keep the two-tier architecture AND the Japanese primitive
names — only re-VALUE the primitive tier from the Figma palette.** The semantic tiers match
name-for-name (both follow the shadcn convention: `--background`, `--foreground`, `--card`,
`--card-foreground`, `--muted`, `--muted-foreground`, `--border`, `--input`, `--ring`, `--primary`,
`--primary-foreground`, `--accent`, `--accent-foreground`). Re-valuing only the primitive tier keeps
L9a Plan 2's enforcement tests (token contract, P8 lint, logical-properties scan) meaningful, keeps
the style guide `/[locale]/admin/style-guide` structural, requires no component import changes, and
makes the radius change a one-liner. Replacing the naming scheme instead would forfeit all of that
for nothing.

✅ **RESOLVED 2026-08-06 (this was the deferred "quyết khi làm token" decision): dark-only values in
`:root`, NO light block written, but the `data-theme` mechanism + `ThemeProvider` + the `ThemeToggle`
component and its tests are all RETAINED. Only the mount points change — removed from `app-nav.tsx`
and `site-header.tsx`, KEPT in `style-guide.tsx` (the admin surface is where a future light palette
would be previewed). Restoring light mode later = writing one block of values.** Original framing below.

(historical) **Still open (user chose "hoãn — quyết khi làm token", 2026-08-05): light mode.** Figma is dark-only;
the repo ships both plus a **ThemeToggle already live in the app-nav footer**. Options were: drop light
mode entirely (ThemeToggle becomes dead UI and must be removed), or keep a derived light mode (risk:
no one has checked the 29 screens in light). **Dark-first is locked; the light-mode question is
deferred to the token-writing task.** WCAG AA (CLAUDE.md §2 rule 5) applies either way.

**Fonts — ⚠️ THE CLAIM BELOW IS WRONG, corrected 2026-08-06.** The repo does NOT run on `system-ui`
placeholders: `app/[locale]/layout.tsx:14-19` loads **Inter** (`--font-sans`) + **Noto Sans JP**
(`--font-jp`) via `next/font/google`. The `system-ui` in `globals.css` is only the pre-`next/font`
fallback. **Also: the design prompts name NO font at all** — grep of
`Jakarta|Outfit|M PLUS|Noto|Inter|DM Mono|Mincho|Gothic` over all 21 tier-A `*.md` returns 0 hits, so
the bundle's faces were the Make generator's choice, not design intent. **And three of them cannot
render Vietnamese** (checked against Next's own `font-data.json`): Outfit, Noto Serif JP, DM Mono all
lack the `vietnamese` subset — fatal in a VN-first app where they were assigned the headings and the
whole Diary prose. Decided roles: `--font-sans` Plus Jakarta Sans · `--font-display` **Be Vietnam Pro**
(replaces Outfit) · `--font-serif` **Noto Serif** (replaces Noto Serif JP) · `--font-mono` **IBM Plex
Mono** (replaces DM Mono) · `--font-jp` **Noto Sans JP unchanged** (it carries furigana at tiny sizes,
where mincho serifs break first).

(historical, INCORRECT) **Fonts:** repo has `--font-sans: system-ui` and `--font-jp: system-ui` — both placeholders, never set.
Design uses `Plus Jakarta Sans` (Latin) + `M PLUS Rounded 1c` (Japanese glyphs like 話) + `DM Mono` +
`Outfit`. Proposal (not yet ratified): adopt Plus Jakarta Sans → `--font-sans`, M PLUS Rounded 1c →
`--font-jp`. **Bug in the bundle:** `src/styles/fonts.css` imports ONLY Plus Jakarta Sans + DM Mono, so
`font-['Outfit']` and `font-['M_PLUS_Rounded_1c']` silently fall back — the user's own Make preview is
already wrong at those spots, meaning a correct port will look *better* than the original.

### C. Divergence from `docs/design/` — the expensive one. **NOT mechanical; needs per-conflict rulings.**
**User disclosed (2026-08-05): the screens were designed from `docs/product/business-model.md` only,
without cross-checking the other docs, with deliberate personal modifications and additions.**

Three conflicts already visible from just TWO files read (`HomeDashboardContent.tsx`,
`PronunciationLibraryContent.tsx`) — the real extent is unknown until tier A is read:
1. `HomeDashboardContent.tsx` has a **fixed floating "AI Sensei" button** (`fixed bottom-7 right-7`,
   Bot icon, "Ask AI Sensei" popover), AI Sensei cards throughout, and a Daily Reflection mood picker
   stating *"AI uses this information to personalize tomorrow's lesson."* → hits the **Companion
   Learning Loop Boundary** (`design-reconciliation.md` §4/§6) that Plan A just narrowed, and the
   read-time journal logic.
2. `PronunciationLibraryContent.tsx` makes **"Learning Paths" / "Practice by Situation" / "Practice by
   Goal" / "JLPT Speaking"** first-class content types — `docs/product/domain-model.md` (canonical
   glossary, created `b9873ab`) has only Video / Lesson / My Lessons / Library / Collection / Learning
   Mode / View Mode / Analysis. Paths/Situations/Goals would be **new domain concepts**.
3. A **Roadmap / "Personal Roadmap" with missions** is designed, while Plan B's out-of-scope list
   (spec §7) treats Roadmap as unbuilt.

**Why this is the dangerous category in this repo specifically:** `docs/design/` has an explicit
Authority Order in `design-reconciliation.md`, and Plan A spent an entire plan reconciling it — its
final whole-branch review caught **3 Important findings that were all cross-file contradictions**
invisible to per-task review. Two silently-disagreeing sources of truth is this project's most
expensive failure mode to date.

**Key framing (user-endorsed): "Figma Make wins" is a perfectly valid ruling.** The user designed these
after understanding the business model better than the docs did. The goal is NOT to defend the docs —
it is that every divergence gets one recorded decision so only ONE source of truth remains. A ruling
may be "Figma Make is right, amend the docs", "the docs are right, amend the design", or "both are
right at different scopes".

## Sequencing — decided 2026-08-05, driven by "Figma is still in progress"

Because the user is **still designing**, B and C get **opposite** treatment:
- **Lock B (tokens/palette) NOW.** It is the stable "Design DNA" shared by all 29 existing screens and
  every future one — chosing it early does not go stale, and everything else depends on it.
- **Defer C (per-screen divergence adjudication), do it lazily** — immediately before building each
  individual screen, one screen at a time. Auditing all 29 against `docs/design/` now guarantees rework.

⚠ **Do NOT copy `src/imports/pasted_text/` into the repo and treat it as canonical.** The user is still
adding to it, so a snapshot decays — and a stale snapshot posing as canonical IS the two-sources-of-truth
failure mode Plan A just cleaned up. If copied, stamp it `snapshot as of <date>` and record where to
re-fetch.

**Order agreed:** finish Plan B first, THEN open a `superpowers:brainstorming` + spec pass for the
Figma Make adoption, with A/B/C above as the agenda.

✅ **GATE CLEARED (2026-08-06): Plan B is EXECUTED and MERGED to master `--no-ff` at `44521bc`.** The
Figma Make brainstorm is now the next action. Nothing in Plan B touched colour or tokens, so every
decision recorded above still stands unchanged.

**What Plan B left for ported screens to sit inside** (read before porting anything):
- `components/layout/app-nav.tsx` now exports **`NAV_GROUPS`** (grouped, `as const`) with `NAV_ITEMS`
  re-derived as its flat view. Four groups render today — LEARN (8), STUDY (4), PROGRESS (1),
  ACCOUNT (1) = the 14 shipped destinations. **INSIGHTS renders nothing** (all 3 rows unbuilt), which
  matters because several Figma screens show it populated.
- Three destination renames are live: `videos`→`lessons`, `conversation`→`speaking`,
  `journal`→`journey`. **The routes did NOT change** — `lessons` still points at `/videos`. Any ported
  screen linking to the Hub must use `/videos`; the `/shadowing` rename is Plan C's call.
- The Nav Column has a **visibility toggle**, visible by default, session-scoped (`useState(true)`,
  not persisted). Group headings are `hidden md:block` — deliberately suppressed on mobile.
- `/videos` page copy now reads **"Lessons"** (EN) / **"Bài học"** (VI), not "Videos".
- ⚠️ Any label rename in a ported screen must sweep **`tests/e2e/`** by hand: `vitest.config.ts`
  excludes `tests/e2e`, so `npm test` cannot catch a broken Playwright selector. This exact gap
  produced Plan B's only Critical finding.

## Stack alignment (bundle → repo)

**Matches:** React **18.3.1** (exact), Radix UI, Tailwind, `cva`, `tailwind-merge`, `lucide-react`,
`motion` v12 (= Framer Motion), shadcn/ui patterns. `src/app/components/ui/**` is stock shadcn → map onto
the repo's existing 8 L9a-Plan-2 primitives, do **not** copy shadcn in.

**Real gaps:**
1. **Tailwind v4 → v3.** Bundle: `tailwindcss 4.1.12`, `@tailwindcss/vite`, `@import 'tailwindcss'`,
   `@theme inline`. Repo: Next 14 + Tailwind v3 + `tailwind.config.ts`. Tokens must be hand-translated
   out of `@theme` into v3 config.
2. **Vite + `react-router` 7** → anything routing-related must be rewritten for App Router. Screens are
   mostly presentational so the blast radius is small.
3. Fonts — see B above.

**Non-issue:** `@mui/material` + `@mui/icons-material` + `@emotion/*` are in `package.json` but
`grep -rl '@mui|@emotion' src/` → **0 files**. Dead dependencies; do not carry them over.

## Screen coverage

29 frames, covering far more than shadowing: Shadowing Hub / Shadowing Practice / Shadowing Detail,
Pronunciation + Dictation + Summary (in-shadowing modes), Kanji library + inspect, FlashCard learn,
Pronunciation library + detail, Conversation practice (+ library, + create popup), Companion home,
Roadmap, Login, Profile, Edit profile, Pricing, FAQ, Homepage ×2, QuickStart, Generate sensei,
Generate done. This covers most of the ~18 screens spec §7 recorded as unreviewed.
- **Dead frames, skip:** `Unuse` (5:1718), `Pricing-remove` (71:2).
- **`Shadowing hub after changes` (149:2) is 1536px wide** while everything else is 1278px — it is the
  **newest iteration** and the one Plan C should build against.
