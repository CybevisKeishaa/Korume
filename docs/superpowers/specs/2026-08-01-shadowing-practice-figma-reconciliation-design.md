# Shadowing Practice Figma Reconciliation — Design

> **Status:** Approved by user (Trần Nguyễn Phi Long / Keishaa) on 2026-08-01, brainstormed in
> conversation. Ready for `superpowers:writing-plans`.
> **Relationship to existing specs:**
> - **Amends** `docs/design/screens/screen-shadowing-practice.md` (Approved) — retires the View Mode
>   axis, restructures the fourth Learning Mode into Listening Practice, adds two Sentence Actions.
> - **Amends** `docs/design/patterns/study-modes.md` (Approved) — the § Available Study Modes mapping
>   table and § Mode Selection section were written against View Mode's existence
>   (`docs/superpowers/specs/2026-07-31-shadowing-hub-lesson-workspace-design.md` §6.1/§6.4); this
>   spec retires that axis outright rather than renaming it again.
> - **Amends** `docs/design/screens/navigation-system.md` (Approved) — reverses its § Purpose
>   statement that the Nav Column is "not a place where Companion or Gamification speak," for
>   Gamification only. This is the highest-blast-radius decision in this spec: it touches all 14 nav
>   destinations, not just Shadowing.
> - **Does not touch** `docs/design/screens/screen-shadowing-hub.md` — every Figma idea evaluated
>   against the Hub screen was rejected (see §4). Listed here only so a future reader knows the Hub
>   was considered and deliberately left alone, not overlooked.
> **Trigger:** User shared a Figma file
> (`https://www.figma.com/design/IwFHZDZdHW7qsSFiNbWrkd/Untitled`) containing two reference frames —
> a Shadowing Hub mockup (node `5:1718`) and a `ShadowingDetailPage` mockup (node `19:2`) — built as
> illustrative reference, not final design, and asked for a selective reconciliation against the
> already-Approved screen docs: keep what's good, drop what conflicts, and fold in a few new ideas
> the user had already sketched on top of the Figma reference (new practice sub-modes, transcript
> hover controls). Both frames were inspected via `get_metadata`/name-search only — full
> `get_design_context` was never pulled, since the structural-name survey was sufficient to resolve
> every decision below through conversation.

---

## 0. Decisions at a glance

| # | Area | Decision |
|---|---|---|
| 1 | Learning Mode axis | `Shadowing / Pronunciation / Listening Practice / Summary`. Listening Practice is a new parent mode with 3 nested sub-modes (Dictation / Fill-in-the-blank / Translation). |
| 2 | View Mode axis | Retired entirely. "Three-Layer Model" → **"Two-Layer Model"** (Learning Mode + Reading Settings; Analysis remains a cross-cutting utility, not an axis). Shadowing gets one fixed presentation, same as the other three modes. |
| 3 | Sentence Actions | Two additions: a furigana quick-toggle (shortcut to the existing global Reading Settings furigana setting) and "Practice this sentence" (deep-link into Pronunciation mode). |
| 4 | Study Atmosphere | No change. Stays Practice-only, all 6 existing options. Figma's Hub-side "Cozy Atmosphere"/"Soft Study Mode" buttons are rejected, not adopted. |
| 5 | Utility Drawer tabs | No change. Figma's alternate labels ("Quiet AI," "Reading Settings") are cosmetic mockup wording, not a rename request. |
| 6 | Nav Column | Gains a Gamification exception: a compact streak indicator + a single "Rain Sound" ambient toggle, in the nav footer, on **all 14 nav destinations**. Requires amending `navigation-system.md` § Purpose. |

---

## 1. Learning Mode axis: Listening Practice

`screen-shadowing-practice.md` § Learning Modes currently lists four sibling modes: Shadowing,
Pronunciation, Dictation, Summary. This spec keeps four modes but replaces Dictation with a parent
mode, **Listening Practice**, that hosts three nested sub-modes. Route shape:

```
/shadowing/[id]/listening              → defaults to Dictation sub-mode
/shadowing/[id]/listening/fill-blank
/shadowing/[id]/listening/translation
```

This nesting is the same pattern View Mode used inside Shadowing ("exists only inside X"), just
one level down: the sub-mode selector exists only inside Listening Practice, and does not appear as
its own row in the Learning Mode tab bar.

### 1.1 Dictation (sub-mode, unchanged)

Identical to the current Dictation Learning Mode description: transcript hidden until Check, video
loops only the current line's clip (`start_time → end_time`), Play → blank input → Check → accuracy +
which words/kana/kanji were wrong + correction hint, against `dictation_attempts.accuracy_score` /
`user_input`.

### 1.2 Fill-in-the-blank (sub-mode, new)

Transcript is shown, but the sentence's most important words (content words, not particles) are
blanked. Learner fills the missing words → Check → accuracy scored against the blanked tokens.
Reuses the same clip-looping behavior as Dictation (current line only). No new schema: writes to
`dictation_attempts` with `practice_type = 'fill_blank'` (see §1.4).

### 1.3 Translation (sub-mode, new)

Transcript shown in Japanese. Learner writes a natural Vietnamese translation → Check. Translation
attempts participate in the existing Lite → Deep evaluation pipeline and share the same quota/fallback
behavior as Analysis (`business-model.md` §2/§3.1 cascade — no new gating mechanism, no new AI
integration pattern). Writes to `dictation_attempts` with `practice_type = 'translation'`.

### 1.4 Schema note

All three sub-modes reuse the existing `dictation_attempts` table plus one new discriminator column,
`practice_type` (`dictation | fill_blank | translation`), rather than three separate tables. This
follows the same "no new schema unless the shape actually differs" principle the current doc already
applies to Pronunciation (reuses `shadowing_sessions` columns). All three sub-modes are the same
shape — text input, scored against a transcript line — so one table with a discriminator is correct,
not three near-identical tables. Dictation and Fill-in-the-blank compute `accuracy_score`
deterministically (token/kana match against the transcript line); Translation's `accuracy_score`
comes from the AI cascade result (§1.3) — the column means "how accurate was this attempt" in both
cases, just filled by a different method depending on `practice_type`.

### 1.5 Companion, Shared Context & Progress

No change to `screen-shadowing-practice.md` § Shared Context & Progress or § Companion in substance,
but both sections name the four Learning Modes explicitly and must be updated:
`Shadowing, Pronunciation, Listening Practice, Summary` (was `..., Dictation, ...`). Per-sentence
Learning Status's existing single "dictation accuracy score" signal is generalized to three
`practice_type`-keyed accuracy scores (dictation / fill_blank / translation) — same per-sentence
rows, no new table.

### 1.6 Analysis is unaffected

Analysis remains exactly what the current doc says: a per-sentence utility triggered by text
selection, not a Learning Mode, not a View Mode, not a tab. Nothing in this spec changes it. (An
earlier point of confusion during brainstorming — briefly calling the fourth tab "Analysis" — was
corrected by the user to mean Summary; recorded here so a future reader doesn't rediscover the same
confusion.)

---

## 2. View Mode retired

`screen-shadowing-practice.md` § Three-Layer Model described three axes (Learning Mode, View Mode,
Reading Settings) plus the Analysis utility. This spec removes the View Mode axis outright:

- Section renamed **"Two-Layer Model"**: `Learning Mode` + `Reading Settings`, with Analysis still
  called out as "a per-sentence utility, not a mode at any layer."
- The entire `# View Mode (inside Shadowing only)` section (Reading / Normal / Immersion) is deleted.
  Shadowing now renders with one fixed presentation, the same way Pronunciation, Listening Practice,
  and Summary already do — no in-mode display-style switcher.
- The display behavior View Mode used to control (larger text + more visible sentences in Reading;
  Japanese-only + minimal chrome in Immersion) is **not** preserved as new Reading Settings toggles.
  It is dropped. This was an explicit call after the user asked what View Mode was for and, once
  explained, decided it added complexity without enough value to keep.

### 2.1 Propagation to `study-modes.md`

- § Available Study Modes: the existing "superseded" note and its old-name → new-home mapping table
  assumed View Mode was the new home for Reading/Shadowing/Immersion Mode. Since View Mode itself is
  now retired, the table is rewritten: those three old names have no new home — their functionality
  is retired, full stop. Analysis Mode's mapping (→ the Analysis utility) is unaffected and stays as
  written.
- § Mode Selection: currently describes View Mode's compact segmented control
  (`Reading / Normal / Immersion`). This section is removed — there is no longer a mode-selection UI
  to describe inside Shadowing. The document's cross-reference to Review Mode as "a separate
  workspace reached by navigating away from the Lesson entirely" is unaffected and stays.
- § Adaptive Mode: two of its three "workspace adapts" examples reference View Mode
  (`... emphasizes View Mode → Reading`, `... resembles View Mode → Normal`) and must be removed. The
  third example (extended grammar exploration → surfaces the Analysis utility) is unaffected by this
  spec and stays.

---

## 3. New Sentence Actions

`screen-shadowing-practice.md` § Sentence Actions currently lists: Replay, Bookmark, Save difficult
sentence, Vocabulary, Grammar, Mining, AI explanation. Two additions:

- **Furigana quick-toggle** — a shortcut to the existing global Reading Settings furigana setting
  (Always / Adaptive / Hidden). Flipping it from the hover toolbar changes the same global setting;
  there is no new per-sentence furigana state. Purely a convenience affordance so the learner doesn't
  have to open Reading Settings to toggle furigana mid-sentence.
- **Practice this sentence** — opens Pronunciation mode with the target sentence pre-selected and
  playback positioned at that sentence. This is the same cross-mode position sync § Shared Context &
  Progress already documents (switching Learning Mode never resets position); this action is simply a
  one-click shortcut into it from a specific sentence, rather than switching modes first and scrolling
  to find the sentence again.

"Repeat sentence," requested during brainstorming, is already covered by the existing Replay action —
no doc change needed for it.

---

## 4. Study Atmosphere and Utility Drawer — confirmed unchanged

Two Figma details were evaluated and rejected, recorded here so they aren't re-litigated later:

- **Study Atmosphere** stays exactly as currently documented in `screen-shadowing-practice.md` §
  Study Atmosphere (6 options, Practice-only). Figma's Hub-side "Cozy Atmosphere" / "Soft Study Mode"
  buttons — which would have duplicated this concept on the Hub screen with a different, narrower
  set of options — are not adopted. `screen-shadowing-hub.md` is not touched by this spec.
- **Utility Drawer tabs** stay exactly as currently documented (Vocabulary / Grammar / Mining / Notes
  / AI / Settings). Figma's mockup used slightly different labels ("Quiet AI," "Reading Settings")
  but this reads as incidental mockup wording, not a deliberate rename request — confirmed with the
  user.

---

## 5. Nav Column Gamification exception

The Figma reference embeds a night-streak indicator and a "Rain Sound: On" toggle inside its
persistent left sidebar, on both frames. That sidebar is not a Hub- or Practice-specific component —
it is the app's single global navigation component (`components/layout/app-nav.tsx`, documented in
`navigation-system.md`), shared across all 14 `NAV_ITEMS` destinations. `screen-shadowing-hub.md`
itself doesn't describe this nav in its own layout (its ASCII layout diagram has no left column at
all) precisely because it's inherited global chrome, not a Hub-specific element — confirming this
widget request is a navigation-system change, not a screen-specific one.

This surfaced a real conflict: `navigation-system.md` § Purpose currently states the Nav Column "is
not a place where Companion or Gamification speak" — an Approved architectural invariant, not a
stray sentence. Adding the streak indicator there requires deliberately reversing that statement, not
just adding new content next to it. Confirmed explicitly with the user: reverse it, for Gamification
only, and edit both § Purpose and § Gamification & Navigation so they stop contradicting each other.

### 5.1 What ships

- **Streak indicator** — reuses the existing Gamification Layer streak data (`design-reconciliation.md`
  §3); no new schema. A compact indicator only (e.g. flame + day count), not the fuller
  session/goal/hours detail the Shadowing Hub's own "Current Session & This Week's Record" rail
  already shows — the two are intentionally different levels of detail (nav = glance, Hub = detail),
  not a duplication to resolve.
- **Ambient Sound toggle** — a single "Rain Sound" on/off control. Not a multi-sound picker; the
  Figma reference and the user's request both describe exactly one sound. Adding more sounds later is
  a future decision, not something this spec should speculatively build room for.
- **Placement** — Nav footer, alongside the existing `ThemeToggle`, `ReduceMotionToggle`, and
  sign-out controls (`navigation-system.md` § Settings Entry Point, "Nav footer controls").
- **Scope** — all 14 nav destinations, since there is exactly one Nav Column component. This is not
  scoped to Shadowing.

### 5.2 What does not change

- Companion's ban from the Nav Column is untouched — this exception is Gamification-only.
  `navigation-system.md` § Companion & Navigation stays exactly as written.
- The Nav Column's other architecture (Layout Regions, Navigation States, Nav vs. Drawer Boundary,
  Accessibility) is unaffected.

---

## 6. File change list

| File | Change |
|---|---|
| `docs/design/screens/screen-shadowing-practice.md` | §1–§3 above: Learning Modes rewrite (Listening Practice + 3 sub-modes), Two-Layer Model rename, View Mode section deleted, Sentence Actions additions, Companion/Shared-Context mode-name updates. |
| `docs/design/patterns/study-modes.md` | §2.1 above: § Available Study Modes mapping table rewrite, § Mode Selection section removed, § Adaptive Mode examples trimmed. |
| `docs/design/screens/navigation-system.md` | §5 above: § Purpose amendment, § Gamification & Navigation formalized, § Settings Entry Point nav-footer-controls list updated. |

`docs/design/screens/screen-shadowing-hub.md` — confirmed no change (§4).

---

## 7. Out of scope / deferred

- Actual implementation (component code, `dictation_attempts.practice_type` migration, Nav Column
  streak/ambient-sound UI) is not part of this spec — it is docs-only, matching the repo's established
  spec → plan → implementation sequence for design decisions. A `superpowers:writing-plans` pass
  should follow approval of this spec, scoped to executing the file changes in §6.
- This spec does not revisit Plan C (Hub UI) or Plan D (Lesson Workspace UI) sequencing from
  `mem:project_status` — it only updates the design docs those plans will be built against.
- Fill-in-the-blank's exact blanking heuristic (which words count as "important") and Translation's
  exact AI prompt/rubric are implementation details for the eventual backend plan, not a docs
  decision.
