# Korume Rebrand & Shadowing Hub/Practice Figma Reconciliation — Design

> **Status:** Approved by user (Trần Nguyễn Phi Long) on 2026-08-05, brainstormed in conversation.
> Ready for `superpowers:writing-plans`.
> **Relationship to existing specs:**
> - **Amends** `CLAUDE.md` §1 (product identity), `README.md`, `japanese-learning-app-spec.md` (title +
>   throughout), `docs/product/business-model.md`, `MASCOT.md` — the product/mascot rebrand.
> - **Amends** `docs/design/screens/navigation-system.md` — replaces the flat, ungrouped 14-item
>   `NAV_ITEMS` model (§ Navigation Inventory) with a 5-group structure, adds a visibility toggle,
>   renames three destinations.
> - **Amends** `docs/design/screens/screen-shadowing-practice.md` § Companion — narrows the Learning
>   Loop Boundary from "all four Learning Modes" to "Shadowing mode only." Also drops "72% complete"
>   from the Header's forbidden-but-apparently-drawn progress indicators (keeps the sentence counter).
> - **Amends** `docs/design/design-reconciliation.md` §6 (Anchor Availability table) to match the
>   narrowed boundary.
> - **Confirms unchanged (Figma idea rejected)**: `screen-shadowing-practice.md` § Two-Layer Model /
>   § Learning Modes — the 4-mode tab bar (Shadowing / Pronunciation / Listening Practice / Summary)
>   stays exactly as locked by `2026-08-01-shadowing-practice-figma-reconciliation-design.md`. The
>   Figma mockup reviewed in this spec still shows the pre-2026-08-01 8-tab flat design (Reading /
>   Shadowing / Listening / Pronunciation / Dictation / Immersion / Mining / Review) — it predates that
>   reconciliation and needs correcting in Figma, not the other way around.
> - **Amends** `docs/design/screens/screen-shadowing-hub.md` § Collections — collection ordering
>   (editorial before computed) and a new pattern note for filter-pill shortcuts. **My Lessons stays
>   exactly as currently specified** (own section, second position, right after Continue Learning) —
>   evaluated and confirmed unchanged, not touched by this spec.
> **Trigger:** User has drawn ~20 UI screens in a Figma file
> (`https://www.figma.com/design/IwFHZDZdHW7qsSFiNbWrkd/Kurome`) and asked for a review of the two
> screens with active changes — Shadowing Hub (node `90:1985`) and Shadowing Practice (node
> `105:3088`) — against the already-Approved screen docs, to catch mistakes before implementation.
> Both frames were inspected via `get_metadata` (full node-name text dump) and `get_screenshot`; no
> `get_design_context` pull was needed since the structural/text survey was sufficient to resolve
> every decision below through conversation. The review surfaced one much larger idea mid-conversation
> — the user wants the product renamed **Korume** (Figma's file name, and already the mascot's
> internal engineering codename since `docs/superpowers/specs/2026-07-30-korume-3d-mascot-base-design.md`)
> — which this spec now also locks as a decision, separate from the Figma screen review that triggered it.

---

## 0. Decisions at a glance

| # | Area | Decision |
|---|---|---|
| 1 | Product & Companion name | Rename product **Nihongo Cinema → Korume**, everywhere it currently appears in *living* docs and *runtime* strings. The Companion character is also officially named **Korume** — closes the deferred Character Identity decision (Companion System spec Spec 2). Historical dated artifacts (specs, plans, journals, migrations, memory snapshots) are **not** rewritten — see §1.3. |
| 2 | Nav Column structure | Replace the flat, ungrouped 14-item `NAV_ITEMS` list with **5 named groups** (LEARN / STUDY / INSIGHTS / PROGRESS / ACCOUNT), matching Figma. Nav becomes **toggleable** (show/hide via edge affordance) rather than always-fixed. Three items renamed: `shadowing`→**Lessons**, `conversation`→**Speaking**, `journal`→**Journey**. Community and Leaderboard — omitted from the current Figma draft by oversight, confirmed by the user, already saved to `mem:figma-nav-redesign-community-leaderboard-gap` — are placed in the STUDY group. The Companion nav item ("Sensei" in the current Figma label) is renamed **Korume** for character-name consistency with #1. |
| 3 | Shadowing Practice Learning Mode tabs | **No change.** The 4-mode Two-Layer Model locked by `2026-08-01-shadowing-practice-figma-reconciliation-design.md` stands. The Figma frame reviewed here is stale (pre-dates that reconciliation) and must be redrawn to match the doc — Reading/Immersion (retired View Mode) and Dictation/Mining/Review (never valid as top-level Learning Mode tabs) are dropped from the tab row. |
| 4 | Companion Learning Loop Boundary (Lesson Workspace only) | Narrowed from "Not Supported across all four Learning Modes" to **"Not Supported in Shadowing mode only."** Pronunciation, Listening Practice, and Summary move from Not Supported to **Planned**. Rationale: Shadowing is continuous video playback requiring full attention; the other three modes are already broken into discrete per-sentence or read-only units, so a Companion presence doesn't compete with an in-progress continuous action the way it would during Shadowing. Scope is limited to the Lesson Workspace's four Learning Modes — Review, SRS review, JLPT, Grammar, Vocab, Kanji, Conversation are untouched, still Not Supported. |
| 5 | Shadowing Hub — Collection order | Editorial collections (e.g. Popular Lessons) may render **before** the three computed collections (Continue Learning / My Lessons / Recently Added), matching Figma. Reverses the current doc's "computed collections always prepended" ordering rule. |
| 6 | Shadowing Hub — Filter pills | Kept, but documented as **quick collection shortcuts** (a compact horizontal jump into the same Collection model), not a parallel traditional-filter system — preserves the "Collections replace traditional filters... not a filter menu" principle since the pill labels already read as Collection names (Business, Travel, Anime, …), not technical filter criteria. |
| 7 | Shadowing Hub — My Lessons | **No change.** Confirmed to stay exactly as currently specified: its own section, always visible, second position (right after Continue Learning), distinct from Recently Added. |
| 8 | Shadowing Practice — Header | Drop **"72% complete"** (a lesson-level progress percentage) from the header shown in the Figma mockup — conflicts with the existing "No progress indicators" rule. **Keep "Sentence 3 / 18"** (position within the transcript) — read as orientation context, not a progress indicator, and explicitly requested by the user. |

---

## 1. Product & Companion rebrand: Nihongo Cinema → Korume

### 1.1 What changes

Every **current, living** reference to "Nihongo Cinema" as the product name becomes "Korume." The
Companion/mascot character is also officially named **Korume** — the product and its companion share
one name, by the user's explicit choice. This closes the Character Identity half of the Companion
System spec (`docs/superpowers/specs/2026-07-16-companion-system-design.md`), deliberately deferred
since 2026-07-16 so art/naming would never block engineering — see `mem:project_status`. "Korume" was
already in use internally as the mascot's 3D-asset engineering codename
(`docs/superpowers/specs/2026-07-30-korume-3d-mascot-base-design.md`,
`docs/superpowers/plans/2026-07-30-korume-3d-mascot-base.md`); this spec promotes that codename to the
official, product-facing name for both the product and the character.

### 1.2 Scope — a repo-wide audit found 60 files referencing "Nihongo Cinema"

A `grep -r "Nihongo Cinema"` at spec-writing time returned 60 files, spanning five distinct
categories that must be treated differently:

1. **Core identity docs** (rename): `CLAUDE.md` §1, `README.md`, `japanese-learning-app-spec.md`
   (title + body), `docs/product/business-model.md`, `MASCOT.md`.
2. **Living design governance/pattern docs** (rename): `docs/design/README.md`, `docs/design/PLAYBOOK.md`,
   `docs/design/screens/screen-architecture.md`, `adaptive-layouts.md`, `workspace-patterns.md`,
   `learning-surfaces.md`, `screen-states.md`, `screen-search.md`, `screen-review.md`,
   `screen-dashboard.md`, `screen-shadowing-practice.md`, and the patterns docs
   (`transcript-patterns.md`, `companion-patterns.md`, `overlays-and-drawers.md`, `video-patterns.md`,
   `reading-patterns.md`, `feedback-patterns.md`, `microcopy-guidelines.md`), plus
   `docs/features/README.md`. `docs/design/nihongo_page_playbook.md`'s **filename itself** embeds the
   old brand — flagged for the execution plan to decide whether to `git mv` it (not decided here, kept
   out of scope, see §7).
3. **Operational/tooling docs** (rename — these are current instructions, not history):
   `.claude/docs/workflow.md`, `.claude/commands/build-layer.md`, `.claude/commands/new-module.md`,
   `.claude/agents/{backend-engineer,tech-lead,frontend-engineer,code-reviewer,ai-engineer,test-engineer,database-engineer,motion-engineer}.md`.
4. **Runtime/i18n and tests — user-visible, requires code work, not a docs pass**:
   `app/[locale]/layout.tsx` (site metadata), `messages/en/{common,marketing}.json` and
   `messages/vi/{common,marketing}.json` (live catalog strings), `messages/en/common.pin.test.ts`
   (literal-pin test — will fail the moment the catalog string changes, must be updated in the same
   commit per the L9a catalog-mutation convention, `mem:l9a_localization_run_state`),
   `test/messages.test.ts`, `tests/e2e/home.spec.ts` (asserts the string is on the rendered page),
   `tailwind.config.ts` (a comment reference, low risk, verify at execution time).
5. **Historical / immutable — explicitly NOT rewritten**: every dated file under
   `docs/superpowers/specs/**` and `docs/superpowers/plans/**` (they are point-in-time decision
   records, the same way a merged git commit message isn't rewritten after the fact — this spec itself
   will be one of these once merged), `docs/product/nhat_ky_y_tuong_san_pham.md` (a product idea
   journal, same reasoning), `supabase/migrations/20260712000001_schema.sql` (a migration is an
   immutable, already-applied execution log — this project's own DB convention, `mem:project_status` §
   Key gotchas, never touches applied migrations), and `.serena/memories/**` (point-in-time snapshots;
   simply start writing "Korume" in new memories going forward, don't retroactively edit old ones).
   `docs/reference/GRAND_PLAYBOOK.md` needs a one-time read at execution time to classify it into
   category 2 or 5 — not classified here.

### 1.3 Why the historical/living split matters

This project already has a working convention for exactly this split — dated specs and plans are
never edited after merge (e.g. `2026-07-29-shadowing-hub-consolidation-design.md` still says "Video
Library" throughout, even though that concept was renamed weeks ago; nobody goes back and fixes it,
because it's a record of what was decided at that time). Applying the same rule here avoids a
60-file mechanical edit turning into a much larger, riskier rewrite of history that the project has
never done before and that would make old specs harder to read as "what did we actually decide, and
when."

### 1.4 Companion-naming ripple

Every place `companion-patterns.md`, `screen-shadowing-hub.md`, or any screen doc currently describes
the Companion generically (never by name, per the Character Swap Invariant in the Companion System
spec) is unaffected — those docs deliberately never hardcoded a name and don't need to change. Only
places that had started using an unofficial name need reconciling: the Figma Hub mockup's "Hikari" and
the Figma nav's "Sensei" both become **Korume** (see §2 for the nav item specifically). No design doc
currently commits to "Hikari" in writing, so there is no doc edit for that half.

---

## 2. Nav Column: 5-group restructure

### 2.1 What changes

`navigation-system.md` § Navigation Inventory currently mandates: *"The shipped navigation
(`components/layout/app-nav.tsx`, `NAV_ITEMS`) is a single ordered list, no grouping, no nesting"* —
14 items. This spec replaces that with 5 named groups, matching the structure drawn in the Figma
Shadowing Practice frame (`105:3088`):

| Group | Items |
|---|---|
| LEARN | Dashboard, **Lessons** (was `shadowing` — Shadowing Hub entry point), Kanji, Vocabulary, Grammar, Reading, **Speaking** (was `conversation`), JLPT |
| STUDY | Review, Mining, Playlists, Challenges, **Community**, **Leaderboard** |
| INSIGHTS | **Korume** (was "Sensei" in the Figma draft — renamed for character-name consistency, §1.4), Roadmap, Weekly Report |
| PROGRESS | **Journey** (was `journal`), Statistics, Achievements |
| ACCOUNT | Profile, Settings |

Notes on items with no current shipped equivalent — **Roadmap**, **Weekly Report**, **Statistics**,
**Achievements**, **Settings** — these are new nav-level entries surfaced by the Figma redesign.
"Roadmap" already exists as a built screen (`docs/design/screens` — top-level Figma frame `64:2061`).
"Weekly Report" maps to the L8/business-model.md §8 "sample weekly report" backlog item
(`mem:feature_backlog_deferred` #13), not yet built. "Settings" maps to the `/settings` route already
planned by L9b Plan 1 (GDPR delete-my-data work, `mem:l9b_plan1_launch_blocker_debt_status`) —
`navigation-system.md` § Settings Entry Point already anticipates this nav entry "most naturally
placed near `profile`" once built; this spec locks that placement into the ACCOUNT group. Whether
Statistics/Achievements are new screens or existing data re-surfaced (e.g. from `/dashboard` or
`/leaderboard`) is **not decided by this spec** — flagged for the execution plan (§7).

Community and Leaderboard are current, fully-shipped nav items (`/community`, `/leaderboard`) that the
reviewed Figma frame omitted. Per the user (2026-08-05) this was an oversight, not a removal decision
— already recorded in `mem:figma-nav-redesign-community-leaderboard-gap`. This spec places them in
STUDY, the closest thematic fit to their existing shipped neighbors (Review, Mining, Playlists,
Challenges).

### 2.2 Visibility toggle

The nav becomes toggleable (show/hide via a small edge affordance) rather than an always-fixed 240px
column. This is consistent with — not a new contradiction of — `navigation-system.md` § Navigation
States, which already documents a "Collapsed / Icon rail" state as **Planned**, and with
`screen-shadowing-practice.md` § Sidebar, which already mandates the nav hidden-by-default inside the
Lesson Workspace specifically. This spec generalizes the toggle to be available product-wide, not just
inside Lessons; the exact default (visible vs. hidden) outside the Lesson Workspace is **not decided
here** — flagged for the execution plan.

### 2.3 What does not change

- **Layout Regions** (Nav Column vs. Content Region), **Nav vs. Drawer Boundary**, **Companion &
  Navigation** (no anchor may render inside the Nav Column — still true, the INSIGHTS group's
  "Korume" item is a navigation *link* to the Companion surface, not a rendered Companion anchor
  itself), and **Accessibility** requirements are all unaffected and must hold under the new grouped
  structure — landmark + `aria-label`, `aria-current`, native link semantics, same as today.
- **Gamification & Navigation**'s streak indicator + Rain Sound toggle (added by
  `2026-08-01-shadowing-practice-figma-reconciliation-design.md`) are unaffected — still nav-footer
  content, present regardless of grouping.

---

## 3. Shadowing Practice Learning Mode tabs — confirmed unchanged (Figma is stale)

The Figma Shadowing Practice frame (`105:3088`) draws an 8-item flat tab row: Reading, Shadowing,
Listening, Pronunciation, Dictation, Immersion, Mining, Review. Comparing against
`screen-shadowing-practice.md` § Two-Layer Model / § Learning Modes (as locked by
`2026-08-01-shadowing-practice-figma-reconciliation-design.md`):

- **Reading** and **Immersion** are 2 of the 3 values of the **View Mode axis, retired outright** by
  that spec (§2) — not renamed, removed. Their presence in this Figma frame means the frame predates
  that reconciliation and was never updated afterward.
- **Dictation** as a tab separate from **Listening** contradicts the current model, where Dictation is
  the default *sub-mode* nested inside Listening Practice (`/shadowing/[id]/listening`), not a sibling
  top-level tab.
- **Mining** belongs in the Utility Drawer (collapsed by default), not the top-level tab row.
- **Review** is explicitly excluded from this model by `docs/product/domain-model.md` § Explicitly not
  part of this model: *"Review — a separate surface entirely, not a Learning Mode or View Mode inside
  a Lesson."*
- **Summary**, one of the 4 real Learning Modes, is missing from the row entirely.

**Decision: the design docs are correct as written; no doc change.** The Figma frame needs to be
redrawn with exactly 4 tabs — Shadowing / Pronunciation / Listening Practice / Summary — before it is
used as an implementation reference.

---

## 4. Companion Learning Loop Boundary — narrowed inside the Lesson Workspace

### 4.1 Current rule

`screen-shadowing-practice.md` § Companion currently reads: *"✕ Not Supported, across all four
Learning Modes (Shadowing, Pronunciation, Listening Practice, Summary) — each is an active
acquisition loop (`design-reconciliation.md` §4, Learning Loop Boundary), Companion is Dormant
throughout. This is structurally enforced: no `CompanionAnchor` may mount anywhere in the
`/shadowing/[id]/**` route group (L9b scan test)."* It also records that Summary Mode was explicitly
considered as a Companion touchpoint and rejected, to keep the architecture boundary simple as future
Learning Modes are added.

### 4.2 New rule

**Not Supported narrows to Shadowing mode only** (`/shadowing/[id]`, the continuous-playback,
transcript-first experience — the one mode where the video plays continuously and the learner's
attention needs to stay uninterrupted). **Pronunciation, Listening Practice, and Summary move to
Planned** (architecture allows a Companion anchor, not yet built — the same category already used for
e.g. Shadowing Hub non-empty state).

**Rationale, as given by the user:** Pronunciation and Listening Practice are already broken into
discrete per-sentence units (record → score → next; play → check → next) rather than continuous
playback — a Companion presence between units doesn't interrupt an in-progress action the way it would
during continuous Shadowing playback. Summary is read-only aggregation, not a playback experience at
all. This is a narrower, attention-based distinction than the original "all four modes are equally an
active acquisition loop" reasoning — the original reasoning is explicitly superseded for these three
modes, not merely refined.

This reopens the "Summary Mode... explicitly considered and rejected" decision recorded in
`docs/superpowers/specs/2026-07-31-shadowing-hub-lesson-workspace-design.md` §0.5/§6.8. That spec's
concern — keeping the boundary simple so future Learning Modes never need to touch Companion's
architecture — is not invalidated by this change (the boundary is still a clean per-mode list, just
with different values), but a future reader comparing the two specs must treat this one as the current
truth for Summary Mode's Companion status.

### 4.3 Scope discipline

This change applies **only** to the four Learning Modes inside a Lesson (the `/shadowing/[id]/**`
route group). It does **not** loosen the boundary for Review, SRS review, JLPT, Grammar, Vocab, Kanji,
or Conversation — `design-reconciliation.md` §6's row for those stays exactly as written, Not
Supported. The Shadowing Hub's own Companion status (Available/Planned depending on empty vs.
non-empty state) is also unaffected — this spec does not touch it.

### 4.4 `design-reconciliation.md` §6 table change

The current single row —

> `Shadowing Practice / Pronunciation / Listening Practice / Summary / Review / SRS review / JLPT / Grammar / Vocab / Kanji / Conversation | Not Supported | Active acquisition loop (§4)`

— splits into two:

> `Shadowing Practice | Not Supported | Active acquisition loop, continuous video playback requiring full attention (§4)`
>
> `Pronunciation / Listening Practice / Summary (inside a Lesson) | Planned | Architecture allows it; not yet built. Each is a discrete per-sentence or read-only unit, not continuous playback (§4)`
>
> `Review / SRS review / JLPT / Grammar / Vocab / Kanji / Conversation | Not Supported | Active acquisition loop (§4)` (unchanged)

---

## 5. Shadowing Hub: Collection order and filter pills

### 5.1 Collection order

`screen-shadowing-hub.md` § Collections currently mandates: *"Three computed (virtual) collections are
always prepended, in this order: Continue Learning / My Lessons / Recently Added. Then editorial
collections follow in their stored order."* This spec relaxes the "always prepended" rule: editorial
collections (e.g. "Popular Lessons") may render before the computed collections, matching the Figma
Hub layout's actual order (Popular Lessons → Continue Learning → Recently Added → Recommended For
You). The three computed collections keep their *relative* order to each other; only their position
relative to editorial collections is no longer fixed-first.

### 5.2 Filter pills

The Figma Hub shows a pill/chip row (All, Conversation, Business, Travel, Restaurant, Daily Life,
Anime, Podcast, News, Office, Cafe) directly under Search. Read literally against the existing text —
*"Collections replace traditional filters... Instead of technical categories, present meaningful
groups... Not a filter menu"* — this looked like a regression back to a traditional filter bar.
Resolution: the pill labels are not technical filter criteria (resolution, duration, date) — they are
the same kind of names the doc already uses as Collection examples (Anime, Slice of Life, …). This
spec documents the pills as **quick collection shortcuts**: a compact, always-visible horizontal jump
into the Collection grid below, not a second, competing categorization system. `screen-shadowing-hub.md`
§ Collections gains a short note describing this pattern.

### 5.3 My Lessons — confirmed unchanged

Re-evaluated after an earlier back-and-forth in this conversation where "Recently Added" was
briefly proposed as a replacement. **Confirmed final: My Lessons stays its own section**, exactly as
currently specified — always visible, second position (immediately after Continue Learning), distinct
from Recently Added. No doc change. The Figma Hub mockup is missing this section and should be updated
to include it, consistent with the now-shipped Create Lesson backend (Plan B) it depends on.

---

## 6. Shadowing Practice Header: drop the completion percentage

`screen-shadowing-practice.md` § Header lists exactly what the header contains and states *"No
progress indicators."* The Figma mockup adds two: "72% complete" and "Sentence 3 / 18." Resolution:
**"72% complete" is dropped** (a clear progress indicator, conflicts as written). **"Sentence 3 / 18"
is kept** — read as positional/orientation context (which sentence the learner is on, not how much of
the lesson remains), and the user explicitly asked to keep it. No further doc wording change needed;
the existing "No progress indicators" line already accommodates this reading without contradiction
once "72% complete" is gone.

---

## 7. Out of scope / deferred

- **Actual implementation** (file edits, `components/layout/app-nav.tsx` restructure, i18n catalog +
  pin-test updates, `components/companion/anchor-boundary.test.ts` scope narrowing to just
  `/shadowing/[id]` exactly, Figma redraws) is not part of this spec — it is docs-only, matching the
  repo's established spec → plan → implementation sequence. Given the rebrand alone touches ~40 living
  files across docs/code/i18n/tests (§1.2), this likely needs its own dedicated execution pass (or
  passes), similar in shape to Plan A (Docs) of the Shadowing Hub Lesson Workspace spec — a
  `superpowers:writing-plans` pass should follow approval of this spec.
- **Whether to `git mv docs/design/nihongo_page_playbook.md`** to a Korume-named file is not decided —
  flagged for the execution plan.
- **Classification of `docs/reference/GRAND_PLAYBOOK.md`** (living doc vs. historical) is not
  determined here — read it fresh at execution time.
- **Statistics / Achievements nav items** — whether these are new screens or a re-surfacing of existing
  Dashboard/Leaderboard data is not decided.
- **Nav visibility toggle's default state** outside the Lesson Workspace (visible vs. hidden on first
  load) is not decided.
- This spec does not revisit Plan C (Hub UI) or Plan D (Lesson Workspace UI) sequencing from
  `mem:project_status` — it only updates the design docs and identity those plans will be built
  against, and the rebrand should logically land before either plan starts (both would otherwise need
  a second pass to pick up the new name).
- The remaining ~18 Figma screens the user has drawn were not reviewed in this pass — only Shadowing
  Hub and Shadowing Practice, the two the user flagged as changed. Company-wide "Korume" branding in
  those other screens (headers, footers, etc.) is a natural follow-up review once the rebrand lands,
  not part of this spec.
