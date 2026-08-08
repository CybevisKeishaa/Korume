# Korume (was Nihongo Cinema) — Project Status

Read this first each session. Product spec: `japanese-learning-app-spec.md` (**repo root** — moved
in from the parent folder and put under version control 2026-07-16; old references say `../`);
root rules: `CLAUDE.md`; agent workflow + 8-layer order + branching policy: `.claude/docs/workflow.md`.

## What this is
Learn Japanese through video shadowing/dictation + kanji/vocab/grammar/JLPT, cinematic UI.
8 layers, one per session; all 8 = finished product. Use `/build-layer <n>`.

## ✅ L9a Plans 1/3 AND 2/3 COMPLETE — both MERGED to master (Plan 1 `69f22e6`, Plan 2 `fcd35af`, 2026-07-18)

**Plan 2 (design system) merged `fcd35af` --no-ff same day** — full token system + semantic
colour tiers + 8 Radix/in-house primitives + living style guide `/[locale]/admin/style-guide`
+ enforcement tests (P8 lint fire-tested, §8 logical-properties scan, token contract,
middleware-composition guard). Post-merge: tsc 0 · **1293/1293 (174 files)**. Manual
style-guide browser pass STILL OWED (checklist in `mem:l9a_localization_run_state`).
Plan-1 details below unchanged:
**Branch `layer-9a-localization-architecture` merged & local branch deleted (user chose merge).
NOT pushed (origin/layer-9a-... still holds a stale pre-finish tip — prune when pushing).
Post-merge verify on master: tsc 0, 1229/1229.** All 8 tasks done + task-reviewed; final whole-branch review (opus):
READY TO MERGE = YES, 0 Critical/Important. Shipped: `lib/i18n/**` foundation (next-intl 4.13.2,
vi/en, prefix "always"), `app/`→`app/[locale]/`, Supabase-first middleware composition, locale-
stripped route protection + security matrix, all feature code on `@/lib/i18n/navigation`, ESLint
boundary (merged with AI-SDK guard, fire-tests). Zero user-visible change (shell still EN).
Baseline @ ceb7445: **unit 1229/162 files · build 52s · playwright 2/2 37s · tsc 0 · lint 0**.
Plans 2 (design system) & 3 (extraction + VN) both UNBLOCKED, not yet written.
**→ Load-bearing constructs, reuse patterns, and review-assigned follow-ups: `mem:l9a_localization_run_state`. READ THAT before Plans 2/3 or touching middleware/i18n.**
Spec `docs/superpowers/specs/2026-07-17-l9a-i18n-design-system-design.md`;
plan `docs/superpowers/plans/2026-07-17-l9a-localization-architecture.md`;
SDD ledger `.superpowers/sdd/progress.md` (gitignored, richer per-task detail).

## ▶ NEXT ACTION (updated 2026-08-08) — **Screen Registry Phase 1. C1 is merged; this is a NEW piece of work and it needs a plan.**

Spec **approved and committed**: `docs/superpowers/specs/2026-08-08-screen-registry-design.md` (`e861150`),
12 decisions R1–R13. **Nothing is implemented yet — the next step is `superpowers:writing-plans` against
that spec**, then execution.

The measurement that drives it: **44 routes in the repo vs ~56 live Figma frames, diverging in BOTH
directions.** Figma has Pricing/FAQ/Checkout/Onboarding/Pronunciation-library/FlashCard with no route;
the repo has community/peer-review/playlists/mining/jlpt-test/leaderboard/reading with no frame.

**The boundary the user set, and it is binding:** the registry is a **derived identity/structure index**,
never a second Figma. Phase 1 answers only
`Figma screen ↔ screenId ↔ route ↔ IA/nav ↔ implementation`, plus `kind`/`impl` and the declared
`repo-only` exceptions. **Phase 1 does NOT fix catalog, copy, data, components or responsive just because
the inventory surfaces them** — that is Phase 2 adjudication. Acceptance is **zero visual diff**, with the
derived `NAV_GROUPS` deep-equalling a snapshot of today's literal captured BEFORE the refactor.

**Frame this correctly or the whole thing goes wrong:** merging C1 does NOT mean "the repo is now correct
against the product". It means "the implementation meets C1's contract; the registry will now say where it
matches the product and where it diverges." So when the inventory finds Pricing/FAQ/Checkout designed but
unbuilt, that is a **reconciliation finding, not new scope**.

Open items carried forward:
- **⚑ Product question the user must answer before C2 touches ranking:** may "Popular" render fewer than
  `limit` lessons when RLS hides some, or must the strategy over-fetch and backfill? Two deferred
  `lib/data/lesson-ranking.ts` defects wait on that answer (unbounded read vs `max_rows = 1000`, and
  `.slice(0, limit)` running before the RLS-filtered `videos` read).
- Two copy items parked for the localization/copy pass: the hardcoded English `"Reduce motion"` label with
  no catalog key in either locale, and `"Chưa có gì ở đây"` opening 5 of 10 `vi/upcoming.json` entries
  while `/vi/roadmap` does the same job forward-lookingly.

<details><summary>(completed) Shadowing Hub Plan C1 — merged `bd7f574`, 2026-08-08</summary>

Read `mem:shadowing_hub_plan_c_run_state` for the full record.

Spec `docs/superpowers/specs/2026-08-07-shadowing-hub-plan-c-design.md` **LOCKED** at `22c9d18`
(17 decisions D1–D17 + a measured evidence appendix). Plan C was split into three sequential plans —
**C1 Foundation / C2 Shadowing Hub / C3 Explore Lessons** — because measurement showed it was three
screens' worth of work, not one. Only C1 is planned so far, deliberately: C2 and C3 get their plans
after the plan before them merges, so each is written against a real foundation.

**C1 MERGED at `bd7f574` (`--no-ff`), 2026-08-08.** Post-merge on master: tsc 0, unit 2064/2064 across
230 files. The branch was KEPT, matching this repo's convention of retaining merged feature branches.
Never record a commit count — run `git rev-list --count`; see
`mem:shadowing_hub_plan_c_run_state` correction 1 for why. All 11 tasks done;
all four human gates approved, D on 2026-08-08. Gate, controller-measured after round 1's fixes: tsc 0 ·
lint 0 errors / 77 warnings (mix unchanged) · unit **2064/2064 across 230 files** · build ✓ · Playwright
**13/13** · browser pass 6/6. Both earlier open items are closed: Checkpoint B was approved, and the
Vietnamese copy ruling landed when the user rewrote the catalogs themselves (`d7ac610`, `60abdef`).

**Round 1 of the whole-branch review returned CHANGES REQUIRED and was right — five for five.** Its two
blockers (a redirect rule swallowing `/api/videos`; eight protected routes missing from middleware) are
fixed at `b4d624b` and `65ebb4c`. Two ranking defects are deferred to C2 by user ruling, one of them
carrying a product question that must be answered before a fix shape is chosen.

**⚠️ A green C1 does NOT mean the product's IA is settled.** The 22 NAV rows, 9 empty-state routes and 6
seeded collections are **provisional**; confirming them is Screen Registry Phase 2 —
`docs/superpowers/specs/2026-08-08-screen-registry-design.md`, committed at `e861150`.

Everything else — the full commit list, decisions amended during execution, the carry-forward lessons,
the plan defects the controller authored, and the deferred minors — is in
`mem:shadowing_hub_plan_c_run_state`, which was itself corrected on 2026-08-08 after the review found it
stale.

</details>

<details><summary>(superseded) previous NEXT ACTION — screen-port workflow, merged `7277ac1`</summary>

## ▶ (done 2026-08-07) — **Screen-port workflow MERGED to master `--no-ff` at `7277ac1` (17 commits). Branch deleted, not pushed.**

Spec `docs/superpowers/specs/2026-08-07-screen-port-workflow-design.md`,
plan `docs/superpowers/plans/2026-08-07-screen-port-workflow.md`, 7 tasks (an 8th was dropped).
Post-merge verified ON MASTER: **unit 2007/2007 across 221 files · tsc 0 · lint 0 errors + 77
warnings (mix `54 no-non-null-assertion + 23 no-unused-vars`) · Playwright 8/8.**

**Delivered — the token half:** `Rule #0` (Figma pixels are not an API; every value maps to a semantic
token) is enforced by `components/ui/token-scale.test.ts`, and `token-scale-adoption.test.ts` bans raw
numeric Tailwind in `components/ui/**`. One typography step added, `hero` = `4rem/4.25rem`. Seven
primitives moved onto `--space-*`. `bg-inputBackground` → `bg-input-background`.

**Delivered — the chrome half:** `app/[locale]/(protected)/` owns the authenticated session's lifetime
and mounts `AmbientProvider`; `(app)` (nav visible) / `(focus)` (nav mounted, hidden by default) /
`(immersive)` (no nav landmark) sit beneath it. `/journal` is immersive; `videos/[id]/shadowing` and
`.../dictation` are focus. **URLs did not change** — route groups never enter the path.
`lib/auth/current-user.ts` exports `getCurrentUser()`, `cache()`-wrapped and `server-only`.

### Rules this branch established — they bind every screen port from here on
- **Rule #0: semantic tokens are the public design API; Figma is an authoring tool, not a runtime
  contract.** Never port a px value. Measured evidence: the design's dominant body size is 10px
  across 883 sites, ≈×1.4 off the shipped scale. That ratio is an observation about one snapshot,
  NOT an invariant — do not build on it.
- **Large Japanese glyphs are content presentation, not interface typography.** 104/128/150px are
  never tokenised; no `kanji-xl`.
- **Provider lifetime > layout lifetime.** A state owner must outlive every chrome change. Future
  session-scoped owners (AI conversation, study queue, draft journal, mining selection) belong in
  `(protected)`, not in a chrome group.
- **Route groups express chrome contracts, not feature categories.** `(learning)`/`(study)` would be
  wrong; features churn, chrome contracts do not.
- **Overlay is presentation, not navigation.** A Figma modal becomes a dialog/drawer component, never
  a `page.tsx`, unless the URL must be shareable or state-recoverable — and then it is justified in
  writing, per screen.
- **`figma-prompt-style.md` (repo root) is authoritative for INTENT and for nothing numeric.** Its
  colour and font sections match the code; every geometry number in it is approximate. Measured:
  sidebar 224 vs real 220, collapsed 62 vs 68, content 1500 vs 1180, and its radius scale lists 12px,
  which appears nowhere in the design.

### Still deferred, by decision
- **All shell geometry** (sidebar width, collapsed width, toolbar height, right column, content
  max-width, gutters). `components/ui/container.tsx` still has Tailwind defaults (`max-w-6xl`,
  `px-4/6/8`) that were never compared against the design. Measure against the LIVE Figma at the
  moment the first screen in a group is ported — the local bundle decays, proven within one day.
- **Avatar primitive** — the design has one (initial letter in a `rounded-full`), `components/ui/`
  does not.
- Widening the Rule #0 scan beyond `components/ui/**`; `collectPrimitives` in
  `token-scale-adoption.test.ts` drops directory prefixes (fails loudly, no subdirs today);
  `anchor-boundary.test.ts` still pre-declares `(app)/shadowing/[id]/…` paths that now belong under
  `(focus)`; `supabase db reset` is not wired into `test:e2e`, so a fresh machine needs it before the
  new e2e can reach its seeded video.
- **Task 8 was DROPPED, not deferred** (user, 2026-08-07): moving `requireUser` out of
  `lib/data/videos.ts`. The spec's rationale was measured false — protected layouts use
  `getCurrentUser()`, and `requireUser`'s 22 importers are all in `lib/data/**`. Do not re-derive
  this question from spec §5.5.

### Lessons worth carrying
Migrated to `docs/lessons.md`: L-003, L-010, L-011, L-012, L-013, L-018.

</details>

## ▶ (superseded 2026-08-07) — **Figma Make token + typography foundation MERGED at `86328bc`.** Kept because its lessons and its two open browser-pass items are still live.

Post-merge verified on master: **218 files / 1966 tests**, tsc 0. Branching history gains
`figma-token-foundation 86328bc`.

Spec `docs/superpowers/specs/2026-08-06-figma-make-token-typography-adoption-design.md` (`f728731`),
plan `docs/superpowers/plans/2026-08-06-figma-make-token-typography-foundation.md` (`99f8978`),
9 tasks via `superpowers:subagent-driven-development` in a worktree.

**Delivered:** dark-only Korume palette in `:root` (no `[data-theme]` blocks); primitives renamed off
the Japanese scheme to `void/paper/ink/slate/ember/sand/mint/coral`; indigo deleted; new `--secondary`,
`--danger-foreground`, `--input-background`; absolute 8/14/20/28 radius; re-valued elevation; five
`next/font` roles (Plus Jakarta Sans / Be Vietnam Pro / Noto Serif / IBM Plex Mono / Noto Sans JP);
ThemeToggle unmounted from the shell but retained in the admin style guide.

**Final state:** unit 1966/1966 · tsc 0 · lint 0 errors, 77 warnings (78 baseline, rule mix identical,
none new) · Playwright **6/6** · LCP warm **300ms → 220ms** · font bytes fetched on `/vi`
**169 KB → 82 KB** (only sans + jp preload).

### Lessons worth carrying (the SDD ledger is deleted; these are the parts that generalise)
Migrated to `docs/lessons.md`: L-003, L-011, L-020, L-021, L-022.

### Open, deliberately deferred
- ⚠️ **Not verified: `/dashboard` and `/admin/style-guide` in a browser.** Spec §6 asked for a dense
  real screen; both are auth-gated and account creation is not something the assistant may do. Only
  `/vi` and `/vi/login` were checked visually. **Ask the user to click through those two.**
- `bg-inputBackground` is camelCase where the repo otherwise uses kebab Tailwind classes. Parked for
  the component-verification spec (spec §1 step 3).
- `--slate-800` hue is 217° where its hex rounds to 218°; contrast figures quoted from hex comments
  run ~0.08 higher than the HSL the tests actually evaluate. Both pre-existing-style rounding nits.
- `theme-toggle.tsx` hardcodes an English `aria-label` in an i18n'd app (pre-existing, not this branch).

> **Superseded NEXT ACTION blocks moved to `mem:project_status_archive` (2026-08-07)** — this file had
> outgrown a single read. Nothing was deleted; the history is verbatim in that file.

## ⭐ L9b DECOMPOSITION — user-approved 2026-07-24 (4 sequential plans, brainstormed on Fable)
L9b was too large for one spec, so it was split. Order and rationale:
1. **Plan 1 — launch-blocker debt:** transcript-submit UI (backlog #14, CRITICAL — core loop dead-ends
   without it, scope pivoted to auto-fetch not user-paste) + GDPR delete-my-data (backlog #5, §2
   non-negotiable, owed since L1, now a 3-stage grace-period design) + small items (#6 persist voice
   pronunciation score, #4 badge icons). **BRAINSTORM IN PROGRESS — see NEXT ACTION above, spec not
   yet written.**
2. **Plan 2 — Companion Presence** = Companion Plan 2 of 3. **DONE, merged to master `61416bd`
   2026-07-30.**
3. **Plan 3 — missing feature UIs:** dictionary meanings on tap-to-lookup (#15), "add to flashcard" from
   reading (#8), particle highlighting (#16), listening drill (#9)? — scope to be brainstormed. **NOT STARTED.**
4. **Plan 4 — landing/cinematic + tutorial + Companion Plan 3** (adaptive voice, AI reflection).
   Tutorial deliberately AFTER Companion Presence: per `MASCOT.md` the companion is the tutorial's guide.
   **NOT STARTED.** Character Identity (Spec 2 — name/lore/art) should be brainstormed right before this.
Then → **L8** (PayOS billing) → **L9c** (polish + perf audit).

<details><summary>(historical) Plan 3 mid-execution snapshot — superseded by the COMPLETE line above</summary>

**L9a Plan 3 WAS BEING EXECUTED** on branch **`layer-9a-string-extraction`** (off master @ `e5893e9`)
via `superpowers:subagent-driven-development`. Tasks 1-10 + 6b + 11a–11e + 12–15 committed/reviewed clean;
gate then: tsc 0 · 1619 tests / 196 files · lint exit 0 / 80-23 / 0 new. (Tasks 16–19 landed after this.)
</details>

**Task 15 done `49553cc` + lint-fix `07cb3fa`** (`conversation` ns — AI voice module, most error-path-heavy so
far). ONE fix wave, but it was a GATE catch not a review finding: the feature commit shipped a lint ERROR
(`no-empty-function` in a test) that the controller's own gate re-run caught (impl's "0 new" claim was false)
— fixed via SendMessage. Review itself came back 0 Critical/Important. Load-bearing SCENARIOS 3-consumer label
rewire done right (shared `scenarioLabel(t,...)` helper, fallback chain preserved). Implementer found a THIRD
convention-#4 leak (conversation-app `friendlyErrorFrom`) → `common.errors.network` now = **7 surfaces**; also
reused `common.states.loading`. Three distinct honest 503 degrade paths (STT/TTS/Claude). Detail +2 carried
Minors in `mem:l9a_localization_run_state`.

**Task 14 done `ac29966`** (`reading` ns — 39 leaves; 2nd consecutive 0-fix-wave task). Import graph clean.
**The D8 content/chrome boundary was the risk and was drawn exactly right** — reading passages, their
translations, Japanese words, and furigana are CONTENT (not localized); only chrome extracted. NEW
Convention-4 instance found & fixed (`reading-quiz` `friendlyErrorFrom` leaked raw `body.error` to a
`role="alert"` node → now logged + translated fallback). `common.errors.network` now = 5 surfaces.
**Refined getTranslations rule:** wire a translator ONLY where chrome strings actually exist — `reading/[id]/
page.tsx` is a 12-line pass-through with zero chrome, correctly left unwired (a `t` there = dead code + lint
warning). The audit's "pages fetch data → async → getTranslations" premise was factually wrong (children own
the fetch); the implementer overrode it correctly. Full detail in `mem:l9a_localization_run_state`.

**Task 13 done `763c884`** (`jlpt` ns — 81 leaves, 107-line en+vi catalogs; the FIRST 0-fix-wave task of
the run — the implementer found & closed its own 2 wiring survivors before review). Convention-#2 audit was
CLEAN (no cross-module surprise). Handled the hotspot: `lib/jlpt-ui.ts`'s `SECTION_LABELS`/`PILLAR_LABELS`
(English maps = section/pillar NAMES) DELETED, all 5 call sites rewired to `t()`. **TWO NEW standing lessons
(full text in `mem:l9a_localization_run_state`):** (a) namespace wiring is a **5-step** list — `types/messages.d.ts`
`AppConfig.Messages` also needs the namespace or tsc fails; (b) use `useTranslations` for ALL synchronous
components (even without `"use client"`, if imported by a client component `getTranslations` hard-fails);
`await getTranslations` only for genuinely-async server components. N5–N1 + "JLPT" left untranslated as required.

**Task 12 done `5dde8c8` + error-path test `4f9b473`** (`mining` ns — 4 components + 2 pages, 18 leaves
all pinned; the plan list omitted `mining-review-session.tsx` a 5TH time, controller audited it in and
patched the plan doc; that file mirrors Task 7's `review-session.tsx`, reusing `common.srs.*` +
`common.states.error`; the LAST `Error.message`→DOM defect CLOSED; 1 fix wave added the error-path RTL
assertion). **Task 11e done `1795471` + `faca02f`** (`shadowing-recorder-panel`; 41 leaves; Azure
`errorType` enum mapped via exhaustive `Record`; 1 wiring survivor 発音/リズム closed). Details in
`mem:l9a_localization_run_state`.

Commits 2026-07-22: `23a8f84` (11b `dictation`) · `36534b0` (plan-doc file-list patch) · `da41411`
(11c `shadowing` + `common.player.*`) · `9c9b3bf` (11d capture). **The user made their own commit
`3e4b4a3` "[LongTNP]: mascot" mid-run** (deleted `.docx`, added `MASCOT.md`) — those files are handled,
stop excluding them.

**NEXT: Task 13** (`jlpt` namespace) — `app/[locale]/(app)/jlpt/{page,[id]/page}.tsx`,
`app/[locale]/(app)/jlpt-test/page.tsx`, `components/jlpt/*` (~965 LOC, 10 components). Timer `aria-live`
warnings → nest under `a11y`, ICU time args identical across locales; pillar names + pass/fail copy live
here; **N5–N1 level labels NOT translated**; JLPT stays "JLPT". **AUDIT the file list + import graph FIRST
(convention #2 — the plan list has been wrong 5×, incl. Task 12's missing `mining-review-session`).** Read
`mem:l9a_localization_run_state` top "⭐⭐ STANDING CONVENTIONS" block first.

**Task 11 was SPLIT into 11a-11e** (plan commit `087b342`) after measuring it at 3793 LOC = 6.9x Task 10.
11a–11e ✅ (Task 11 DONE) · 12 ✅ `5dde8c8`+`4f9b473` (`mining`). **Tasks 13-19 + a metadata sweep (Task 18)
remain**. Namespaces so far: `common`, `nav`, `auth`, `marketing`, `dashboard`, `kanji`, `vocab`, `grammar`,
`videos`, `dictation`, `shadowing`, `mining`, `jlpt`, `reading`, `conversation` (15 done).

**⚠ The plan's file lists have now been wrong FOUR times, and 11d's miss crossed MODULES:** translating
the `useRecorder` hook broke 13 tests in `components/conversation/` because `voice-recorder-button.tsx`
consumes it and no list mentioned that. **Grep the IMPORT GRAPH of whatever you translate, not just the
directory you were handed.**
The 2026-07-20 pause is long resolved (the Task 5 draft was verified in place and kept).
**Before resuming, read `mem:l9a_localization_run_state` "▶ Plan 3 EXECUTION IN PROGRESS" FIRST** —
it holds the patterns Tasks 9-19 must follow (two were Critical review findings), the three things
Tasks 6/6b/7/8 settled, the review lesson about mutation-testing pins, the backlog items no task
owns, and the debugging gotchas. Then the SDD ledger `.superpowers/sdd/progress.md` (gitignored;
reconstruct from `git log` if lost), which carries the per-task detail and the carry-forward defects.

**Cadence that is working (keep it):** one fresh implementer subagent per task (sonnet) → an
independent code-review (opus) → one fix wave → controller marks complete. Every task so far needed
exactly one fix wave and every finding was a real defect, not polish. The reviews have been worth
more than the implementations: the three highest-value catches of the run all came from reviewers
and all were invisible to a green test suite (ICU `#` silently reformatting 1234 → "1,234"; no
Vietnamese message ever being ICU-parsed in CI; raw `Error.message` reaching the DOM and making the
translated error string unreachable).
**SIX STANDING CONVENTIONS, binding for Tasks 13–19 (user-codified after Tasks 11–12, 2026-07-22) — full
text in `mem:l9a_localization_run_state` top block "⭐⭐ STANDING CONVENTIONS", put ALL in every implementer
AND reviewer brief:** (1) mutation in TWO layers → `docs/lessons.md` L-007; (2) audit the DEPENDENCY GRAPH
not the plan → `docs/lessons.md` L-023; (3) swap-proof render assertion for TYPE-INTERCHANGEABLE values →
`docs/lessons.md` L-008; (4) server-authored diagnostics NEVER reach the DOM — **defect class CLOSED after
Task 12** (5 instances all fixed; apply the rule to any NEW instance the audit finds, don't hunt); (5) Task
19 exit criterion — re-audit `common.*` consumer counts by surface (demote `common.player.*` to
`shadowing.*` if still single-surface); (6) proportionality → `docs/lessons.md` L-014. The original two are
(1)+(5B): (A) mutation's two-class separate-survivor-count reporting rule → `docs/lessons.md` L-007.
(B) When promoting into `common.*`, **record the actual consumer count, naming the unit** — importing
FILES vs consuming SURFACES differ, and P4 tests MODULES. Measured: `common.player.*` = 3 files but
**1 surface** (demotion candidate); `common.errors.network` = **2 consumers**, NOT the 28-places/8-modules
figure, which counts un-migrated raw English literals (a backlog, not consumers).

**Two ROADMAP additions decided during execution:**
1. **Task 6b (inserted, done)** — `lib/i18n/catalog.test.ts` now parses every message in every
   locale as a real ICU AST instead of matching regexes.
2. **A metadata sweep task (not yet written)** — 25 pages carry `export const metadata` in English;
   the user chose one dedicated task near the end over doing it piecemeal. **Module tasks LEAVE
   metadata in English.**

## ⭐ ROADMAP SEQUENCING — decided 2026-07-16 (read before choosing what to build next)
**User launch philosophy (explicit):** still in BUILD phase; publish ONLY after everything is
complete, polished, and fully-featured. There is NO near-term launch, paid-beta, or revenue goal.
This resolves the "L8 vs finish-L9" question decisively:

**Order = finish L9 first, do L8 (billing) near the very end, right before publish:**
1. **L9a — i18n + design system** (foundation; VN-first, replace English shell). Unblocks EVERYTHING
   visual + Companion Plans 2/3. Split into 3 plans: **Plan 1 localization architecture = ✅ DONE,
   MERGED `69f22e6` 2026-07-18** (see block above + `mem:l9a_localization_run_state`); **Plan 2
   design system = ✅ DONE, MERGED `fcd35af` 2026-07-18** (plan doc w/ execution addendum:
   `docs/superpowers/plans/2026-07-18-l9a-design-system.md`); **Plan 3 string extraction
   EN-verbatim + Vietnamese (spec Phase 2/3) — NOT WRITTEN, THE LAST L9a PLAN**. ←
   **NEXT ACTION: see ▶ NEXT ACTION block above (manual style-guide pass, then write Plan 3).**
2. **L9b — surfaces**: Companion Plan 2 → Plan 3, the missing feature UIs, landing/cinematic, tutorial.
   Fold the two launch-blocker debts in here (they count as "fully-featured"): **user transcript-submit
   UI** (backend done since L3, UI missing = core loop dead-ends) and **GDPR delete-my-data** (§2
   non-negotiable, owed since L1). Companion Plans 2/3 are HARD-BLOCKED on L9a.
3. **L8 — billing (PayOS)**: subscription + Founding price-lock + per-user Knowledge-Gen quota + auto
   kill-switch + Contextual Discovery UI nhúng vào L9b surfaces. Deferred to here because its conversion
   mechanism needs surfaces to exist, and cost-defense isn't urgent while AI is off in prod.
4. **L9c — polish + perf audit** on the final UI (why L9c was split out).

**HARD CONSTRAINT that overrides the order:** L8's per-user quota + auto kill-switch MUST land BEFORE
`ANTHROPIC_API_KEY` is added / AI is enabled for anyone (even mid-build end-to-end testing with other
people) — today only a manual ~$1-2 spend-cap exists. Reasoning behind all of the above is in this
session's discussion; flip to L8-first ONLY if the goal changes to open-paid/AI-to-real-users-soon.

## Stack
Next.js **14.2.35** App Router + TS strict + Tailwind. React **18.3.1**. Supabase
(Postgres + Auth + Storage) via `@supabase/ssr`. Zod. Motion: Lenis + Framer + GSAP.
AI: `@anthropic-ai/sdk` 0.111.0. Tests: Vitest+RTL (unit), Playwright (`tests/e2e`). Staying on
**Next 14** (revisit L8; don't silently bump — see `nextjs-14-pin-decision`).
**Fonts (since `86328bc`, five roles via `next/font/google`):** `--font-sans` Plus Jakarta Sans ·
`--font-display` Be Vietnam Pro · `--font-serif` Noto Serif · `--font-mono` IBM Plex Mono ·
`--font-jp` Noto Sans JP. **Only sans + jp preload**; the other three are `preload: false` +
`display:"swap"`. Outfit / Noto Serif JP / DM Mono were REJECTED — none has a `vietnamese` subset and
they had been assigned the headings and the Companion Diary prose in a VN-first app. `--font-jp`
stays a sans because it carries furigana at very small sizes, where mincho serifs break first.
⚠️ **`subsets: ["latin"]` does NOT suppress CJK** — Noto Sans JP still emits 373 unicode-range
`@font-face` rules and the browser fetches the needed slice. Verified in-browser. Also: **width
comparison cannot detect CJK fallback** (both real and fallback render full-width at exactly 1em) —
inspect `@font-face` unicode-ranges instead.

## Branching policy (user-set)
One branch per layer `layer-<n>-<slug>` off master; merge `--no-ff` ONLY after DoD (tests pass +
code-reviewer sign-off); never push unless asked. History: L1 `1d1628e`, L2 `618e1a4`,
L3 `d6c2138`, L4 `63b965f`, L5 `74514cd`, L6 `3fe741b`, L7 `01ae59d`, Spec A `201a9b4`,
Companion Core `9f09cf2`, L9a-Plan1 `69f22e6`, L9a-Plan2 `fcd35af`, L9a-Plan3 `d7b158c`,
Design-docs reconciliation `20d6eed`, Shadowing Hub Lesson Workspace Plan A `a6a7617` / Plan B
`b36c455`, Shadowing Practice Figma reconciliation `b56bba1`, Korume rebrand Plan A `69c4685` /
Plan B `44521bc`, Figma token + typography foundation `86328bc`, **Screen-port workflow `7277ac1`
(2026-08-07)**.

## Progress
**The layer-by-layer build log for L1–L7 lives in `mem:project_status_archive`** — it is a
completed-work record, not something a session needs in full. L1–L7 are all DONE and merged;
branch SHAs are in § Branching policy above. Only L8 (PayOS billing) and L9c (polish/perf) remain
unbuilt from the original 8 layers — see § ROADMAP SEQUENCING for why they are last.

## Key gotchas learned
- **Table GRANTs**: migration-created tables do NOT inherit Supabase default grants → queries as
  `authenticated` failed with 42501 until `20260712000006_grants.sql`. Every NEW table needs RLS
  enabled (default-privileges auto-grant DML to authenticated → table without RLS = open hole).
- Content is versioned reference data → lives in MIGRATIONS (not seed.sql) so `db push` deploys it.
- **RLS gates ROWS, not columns.** Column control = `revoke update ... ; grant update (<col>)`.
  **Layer 7 admin approval MUST use the service-role client** (authenticated has zero UPDATE on
  videos.status/title/etc.). For shared AI content the L4 pattern: SELECT-only policy + explicit
  revoke of write grants + service-role write path.
- **§2 & YouTube audio**: never extract/compare YouTube source audio; pitch reference = TTS of
  the transcript line TEXT; user contour = mic recording only.
- **Sentence mining stores NO media** (§2): card = text + `{video_id,start,end}`.
- **Azure short-audio format**: webm/opus is rejected — convert to 16kHz mono 16-bit PCM WAV
  client-side (`blobToWav16kMono`) before upload; keep stored recordings webm.
- **Claude API**: official SDK only, `claude-opus-4-8`, no temperature/top_p, `messages.parse` +
  `zodOutputFormat`, no prefills, typed error handling (RateLimitError/AuthenticationError/…).
- **Admin auth**: `users.is_admin` (DB) = source of truth; `ADMIN_EMAILS` = bootstrap-only, and
  the promotion fires ONLY inside `requireAdmin()` — any server gate for admin surfaces must call
  `requireAdmin()`, not `isAdmin()` (side-effect-free), or the first admin can never get in.
- **Consent-scoped payloads**: what a user opted into showing defines the response shape —
  leaderboard returns name/avatar/weeklyXp but NOT userId; peer-review authors never include email.
- jsdom quirks: Blob has no `arrayBuffer()` (use `@/test/blob-utils` `readBlobBytes` /
  `lib/audio/read-blob.ts`), no Web Audio (use `@/test/audio-context-mock`), no canvas 2D.
  Radix polyfills (ResizeObserver, pointer capture, scrollIntoView) live in `vitest.setup.ts`.
- **`cn()` + custom Tailwind scales (L9a-Plan2)**: `lib/utils.ts` uses `extendTailwindMerge`
  configured with every custom token scale. Plain twMerge misreads `text-body`/`text-caption`
  as COLOURS and silently strips them. **Any new scale added to tailwind.config.ts MUST also be
  added there** — `lib/utils.test.ts` is the guard. Also: dynamic class names (`shadow-${x}`)
  are never emitted by Tailwind static extraction — use literal maps.
- **Design tokens are DARK-ONLY since `86328bc`.** Values live in `:root`; there is **no
  `[data-theme]` block at all**, and `lib/design-tokens.test.ts` asserts the string is absent.
  `ThemeProvider` + `data-theme` + `components/ui/theme-toggle.tsx` are all retained on purpose, so
  light mode returns as ONE added block. The toggle is mounted only in the admin style guide.
  `color-scheme: dark` is declared in `:root` and pinned by test — without it the UA keeps rendering
  scrollbars, autofill, native `<select>`s and checkboxes in the light scheme.
- **Primitive names are `void / paper / ink / slate / ember / sand / mint / coral`** — the Japanese
  scheme (`vermilion`/`indigo`/`washi`/`sumi`) is gone, and indigo was deleted outright. Primitives
  are referenced in exactly THREE places: `app/globals.css`, `PRIMITIVE_TOKENS` in
  `lib/design-tokens.test.ts`, and `PRIMITIVE_COLORS` in `components/style-guide/token-sections.tsx`.
  A **fourth** location must stay in sync for semantics: `tailwind.config.ts`. A token present in
  three of four is the classic drift.
- **`-foreground` is for SOLID fills; `-strong` is for text on an alpha tint.** Pairing `-foreground`
  with `bg-<c>/<alpha>` is a real bug that shipped twice. And structural correctness is not enough —
  the pairing must actually measure ≥4.5:1. `--paper-50` on `--accent` is 1.98:1 and on `--danger`
  2.98:1, so **text on a warm fill is always `--ink-950`**.
- **Auditing colour usage needs MORE than one grep.** This bit twice in one branch:
  `bg-<c>/<alpha>` missed `notification-bell` (no alpha suffix), and `hover:bg-muted` missed
  `select.tsx`'s `data-[highlighted]:bg-muted` — the keyboard-nav indicator, i.e. CLAUDE.md §2 rule 5.
  Always sweep variants (`data-[…]`, `focus`, `focus-visible`, `group-hover`, `aria-*`, `peer-*`)
  AND hardcoded colours (`text-white`, `text-black`, `text-[#…]`) on solid fills.
- **`--muted` is a RECESSED surface (1.07:1 vs background), not a hover surface.** Hover uses
  `--secondary` (`--void-800`, 1.26:1). `bg-muted` as the resting colour of an unselected tab/pill
  with `hover:text-foreground` is a different, legitimate pattern — leave those alone.
- **Design-system boundaries (L9a-Plan2)**: `@radix-ui/*` imports only in `components/ui/**`
  (ESLint, fire-tested); the `components/ui/**` ESLint override RESTATES the whole
  no-restricted-imports rule minus Radix — editing one copy requires editing both. New ui
  primitives must use CSS logical properties (ps-/pe-/ms-/me-/text-start…) — auto-enforced by
  `components/ui/logical-properties.test.ts`.

## Deploy target (user-set)
**Self-hosted at `almostgone.vn`** — a single long-running Node instance (NOT Vercel/serverless).
Consequence: `lib/rate-limit.ts` in-memory sliding-window IS a real limiter here (state persists across
requests, no per-cold-start reset) — the "per-instance / resets" caveat only bites if we later scale to
multiple instances behind a load balancer (then → Redis). Cost-defense: user runs a low Anthropic Console
spend cap (~$1–2) = a manual global kill-switch (defense layer #1); it's a monthly org budget, near-real-time
(can slightly overshoot), and blunt (all-or-nothing app-wide, not per-user) — still need per-user Knowledge-Gen
quota (L8) before opening to real users. Supersedes spec's "Deploy: Vercel". Payments = PayOS (not Stripe).

## DB / running locally
Local Supabase (Docker) is the dev DB; `.env.local` points at it. Docker Desktop must be running
(`npx supabase start`). `npm run dev` → localhost:3000. Studio :54323. `npx supabase db reset`
re-applies migrations (**15 built** — Companion migration #15 `20260716000015_companion_memories`
merged 2026-07-16). Cloud move (still not done): create free project → swap 4
`.env.local` values → `supabase link` + `supabase db push`; add Google OAuth creds in dashboard.
Env keys (AUDITED 2026-07-14, see `mem:product_readiness_audit_2026-07-14`):
`ANTHROPIC_API_KEY` **NOT in .env.local** (earlier "set" claim stale) → all Claude features
degrade to "not configured". `AZURE_SPEECH_KEY` present but **INVALID — Azure returns 401**
(value looks like a GUID/resource-ID, not Key1/Key2) → TTS/STT/pronunciation all fail (502).
`ADMIN_EMAILS="admin@almostgone.vn"` added 2026-07-14 (bootstrap admin exists locally).

## Verify commands
`npx tsc --noEmit` · `npx vitest run` (**2007 unit / 221 files** @ 2026-08-07 post-screen-port-workflow
`7277ac1`; lint = exit 0 WITH **77** pre-existing warnings — long-standing debt, "clean" means
0 NEW, and compare the RULE MIX not the count: `54 no-non-null-assertion + 23 no-unused-vars`) ·
`npm run lint` ·
⚠️ **With a worktree present, `npm test` from the repo root scans it too** — `vitest.config.ts`
excludes `node_modules`, `.next`, `tests/e2e` but NOT `.worktrees/`. Pass `--exclude ".worktrees/**"`
or remove the worktree first. Still not fixed in config.
⚠️ **A worktree has NO `.env.local`** (gitignored, not copied). Without the full env, every
auth-dependent Playwright spec fails in a way that looks exactly like a code regression. Copy
`.env.local` from the main checkout before trusting an e2e run there, then remove the secrets.
`npm run build` (~52s) · `npx playwright test` (**8 e2e**, ~50s; kill any stale node on :3000 first —
reuseExistingServer picks it up, and it will silently test a stale build) · `npx supabase db reset`
(15 migrations). ⚠️ `tests/e2e/route-group-provider-identity.spec.ts` needs the seeded FREE-tier video
in `supabase/seed.sql`, so a fresh machine must run `db reset` before that spec can pass; nothing
wires the two together.
Known CPU-contention flakes (standalone-green): `pitch-contour.test.tsx`, `waveform.test.tsx`.
Component tests import render from **`@/test/render`** (NextIntlClientProvider, locale="en"). Shared test harness in
`test/` (`@/test/*`): media mocks, YouTube IFrame stub, Claude + Azure Speech + AudioContext
mocks, tone-buffer/transcript/URL fixtures, blob utils, `supabase-mock.ts` (chainable
query-builder mock for lib/data tests).

## Deferred follow-ups

**USER-FACING FEATURES đã hoãn nằm ở memory riêng `mem:feature_backlog_deferred` — PHẢI đọc nó
khi plan bất kỳ layer mới nào (user mandate 2026-07-14: không bỏ sót chức năng đã brainstorm).**
Mục dưới đây chỉ là engineering debt/nits.
From L1: GDPR delete-my-data; getUser() in middleware on all routes (perf); conditional
aria-describedby; users_update_own email/level column scope. From L2: `unique(word, reading)`
won't dedupe reading-less vocab (NULLs distinct) — matters when admin CMS adds entries; add CI
guard asserting RLS enabled on all public tables. From L3 (non-blocking nits): adaptive furigana
homograph false-hide + `Object.hasOwn`; mine popover outside-click dismiss + aria live-region;
radiogroup roving tabindex; mining duplicate-card dedup; `lib/rate-limit` unbounded map (Redis in
L8); `VideoRow` type duplication; Supabase-backed integration tests; difficulty scorer caching.
From L4 (review nits, non-blocking): persist voice-mode pronunciation score to
`conversation_messages.pronunciation_score` (column exists, deliberately unwired — best-effort
client-side only for now); human-review/publish gate for `source='ai_generated'` vocab examples
(candidate for L7 admin tools). From L5: "Add to flashcard" from reading passages is disabled —
`/api/mining` requires `lineId` FK into `transcript_lines` (video-only); generalizing the mining
schema (nullable lineId + source discriminator) is a future decision (fits F-010/F-014);
listening weakness links route to `/videos?level=` (no dedicated listening drill module yet);
site-wide i18n/VN-localization of the English shell = deliberate product decision, not per-module;
`jlpt_questions.question_type` free-form text (add check constraint if vocabulary stabilizes);
manual click-through of /jlpt + /reading in the browser not yet done (only unit/e2e-registration
coverage) — worth doing before real users. From L6: one intermittent unit-test failure observed
once (822/823, then 823/823 twice; test unidentified, reviewer found no time-fragile test in the
new code — watch for recurrence); markNotificationsRead maps DB errors to 400 (should split 500);
recommendations tokenizes ≤100 transcripts/request with no cache (revisit with catalog growth or
L3's deferred difficulty-cache); Supabase default grants give authenticated TRUNCATE/REFERENCES/
TRIGGER repo-wide (not exploitable via PostgREST, hardening candidate); badge iconUrl all null
(SVG fallback in UI — real icons = content task); srs_due notification producer unwired (needs
scheduler, pairs with push/email deliverer later); manual browser click-through of dashboard/bell/
recommendations not done (unit+build coverage only). From L7: ~~admin dialog focus trap~~ **REPAID in L9a-Plan2** (`components/admin/dialog.tsx` is
now a thin wrapper over `components/ui/dialog.tsx`, Radix focus trap); `stroke_order_svg` stored/rendered as raw SVG (fine while only admins write — needs
allowlist SVG sanitizer before less-trusted contributors); `users.email`/`created_at` still
client-writable (hardening migration candidate); no 'rejected' video status (reject = hard delete,
moderator reason logged not persisted) and no 'admin' transcript_source (admin-attached transcripts
stored as 'user_submitted') — both need a migration if wanted; CSV import is flat rows only (nested
kanji readings / test questions / passage questions via JSON create/update after import) and the
table doesn't auto-refresh post-import; admin content edit form only pre-fills fields present in
the list query (no GET-single endpoint); forum comment optimistic insert shows "You" until reload
(cosmetic); save-to-playlist overlay on /videos uses ARIA role="list" wrapper (revisit if
video-card gets a slot); community cursor pagination assumes distinct created_at at page
boundaries; admin stats count ids in JS not count:'exact' (fine at current scale); manual browser
click-through of /community, /playlists, /leaderboard, /admin not done (unit+build only).

## Parked

*(nothing currently parked — the one entry that lived here is resolved, see below)*

**~~Shadowing Hub Consolidation IA spec~~ — ✅ EXECUTED, no longer parked (corrected 2026-08-06).**
`docs/superpowers/specs/2026-07-29-shadowing-hub-consolidation-design.md` §6's 17-file change list was
carried out inside **Lesson Workspace Plan A (Docs)**, merged `a6a7617` (2026-07-31) — not as its own
branch, which is why this section wrongly still read "NOT yet executed" for a week. Proof: both
`docs/design/screens/screen-shadowing-hub.md` and `screen-shadowing-practice.md` exist.
The old "user deferred it to finish L9b first" note is historical only.
`mem:shadowing_hub_consolidation_status` has been rewritten to match.

## Working agreements
TDD-first, tests shown passing. code-reviewer signs off every non-trivial change before "done".
Data flows down schema→API→UI. Never download/proxy video (YouTube IFrame only). **Commit freely
without asking** (user granted standing permission 2026-07-13 — supersedes old "commit only when
asked"); push to remote still requires an explicit ask. Branch-per-layer + merge-to-master-when-done.
