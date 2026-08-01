# Shadowing Practice Figma Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Execute the design decisions in `docs/superpowers/specs/2026-08-01-shadowing-practice-figma-reconciliation-design.md` by editing the three Approved design docs it amends.

**Architecture:** This is a docs-only plan — no application code changes. Each task edits one design doc (or one cohesive group of sections within a doc) via exact text replacement, then verifies the edit with `grep` (there is no test runner for markdown prose). Tasks are ordered so that later tasks' verification greps can assume earlier tasks' renames already landed.

**Tech Stack:** Markdown files under `docs/design/`. No code, no build step, no test framework involved.

## Global Constraints

- **Docs only.** No file under `app/`, `lib/`, `components/`, or any `.ts`/`.tsx` file may be touched by this plan. If a task seems to need a code change, stop — it's out of scope (spec §7).
- **No new schema in the docs.** All three Listening Practice sub-modes (Dictation/Fill-in-the-blank/Translation) reuse the existing `dictation_attempts` table plus a `practice_type` discriminator column — never describe a new table.
- **Preserve each file's existing tone and `Status: Approved` header** — these are living, Approved docs, not drafts. Do not add a new Status line; only the body sections named in each task change.
- **Exact strings matter.** Every `old_string`/`new_string` block below must match the file's current content byte-for-byte before editing — if a match fails, stop and re-read the current file section rather than guessing at the surrounding text.
- **`docs/design/screens/screen-shadowing-hub.md` is not touched anywhere in this plan** (spec §4) — no task should modify it.

---

### Task 1: `screen-shadowing-practice.md` — Learning Modes → Listening Practice restructure

**Files:**
- Modify: `docs/design/screens/screen-shadowing-practice.md` (the `# Learning Modes` section)

**Interfaces:**
- Consumes: nothing from other tasks (first task in the plan).
- Produces: the canonical four-mode list `Shadowing / Pronunciation / Listening Practice / Summary` and the route table, which Task 3 (Companion/Shared Context wording) and the Task 6 verification grep both depend on.

- [ ] **Step 1: Replace the `# Learning Modes` section**

Open `docs/design/screens/screen-shadowing-practice.md` and find this exact block (it starts right after the `---` following `# Learning Philosophy` and its layout diagrams, `# Learning Modes` heading):

```markdown
# Learning Modes

Route shape: shared layout + nested segments, one Lesson hosting four sibling workspaces:

| Route | Learning Mode |
|---|---|
| `/shadowing/[id]` | Shadowing (default) |
| `/shadowing/[id]/pronunciation` | Pronunciation |
| `/shadowing/[id]/dictation` | Dictation |
| `/shadowing/[id]/summary` | Summary |

**Shadowing** — everything else in this document: continuous-playback, transcript-first workspace,
View Modes live here.

**Pronunciation** — same lesson, same transcript, re-framed per-sentence: the video stops behaving
as continuous playback and becomes one exercise per line. Replay a clip cut purely from
`transcript_lines.start_time`/`end_time` (no new media, no AI cutting) → Record → score using the
three columns `shadowing_sessions` already has (`pronunciation_score`, `rhythm_score`,
`pitch_score`) → Retry → next sentence. History of scores per sentence is the same data § Shared
Context & Progress below uses for per-sentence Learning Status, no new schema.

**Dictation** — same lesson, but the transcript text is **hidden** until the learner checks their
answer, and the video does not play continuously: it loops only the current line's clip
(`start_time → end_time`) and stops, so the learner's attention never drifts past the sentence
they're working on. Play → blank input → Check → accuracy + which words/kana/kanji were wrong +
correction hint (against `dictation_attempts.accuracy_score`/`user_input`) → next sentence.

**Summary** — read-only aggregation of *this lesson's own* data: AI summary, main points, vocabulary
highlights, grammar highlights, expressions, culture notes, difficulty, related lessons, the
learner's own completion state per sentence across the other three modes. **No chat box, no "Ask
AI," no cross-lesson reasoning** — the moment a question needs history beyond this lesson, it is a
Companion question, not a Summary one (see § Companion below). Content split follows the existing AI
cascade free/deep line (`business-model.md` §2/§3.1) — no new gating mechanism.
```

Replace it with:

```markdown
# Learning Modes

Route shape: shared layout + nested segments, one Lesson hosting four sibling workspaces:

| Route | Learning Mode |
|---|---|
| `/shadowing/[id]` | Shadowing (default) |
| `/shadowing/[id]/pronunciation` | Pronunciation |
| `/shadowing/[id]/listening` | Listening Practice (Dictation sub-mode, default) |
| `/shadowing/[id]/listening/fill-blank` | Listening Practice (Fill-in-the-blank sub-mode) |
| `/shadowing/[id]/listening/translation` | Listening Practice (Translation sub-mode) |
| `/shadowing/[id]/summary` | Summary |

**Shadowing** — everything else in this document: continuous-playback, transcript-first workspace.

**Pronunciation** — same lesson, same transcript, re-framed per-sentence: the video stops behaving
as continuous playback and becomes one exercise per line. Replay a clip cut purely from
`transcript_lines.start_time`/`end_time` (no new media, no AI cutting) → Record → score using the
three columns `shadowing_sessions` already has (`pronunciation_score`, `rhythm_score`,
`pitch_score`) → Retry → next sentence. History of scores per sentence is the same data § Shared
Context & Progress below uses for per-sentence Learning Status, no new schema.

**Listening Practice** — same lesson, transcript hidden or partially hidden depending on sub-mode,
video loops only the current line's clip (`start_time → end_time`) and stops — the learner's
attention never drifts past the sentence they're working on. A compact sub-mode selector inside
this Learning Mode switches between three practice types, all writing to the same
`dictation_attempts` table with a `practice_type` discriminator (`dictation | fill_blank |
translation`):

- **Dictation** (default sub-mode) — transcript fully hidden. Play → blank input → Check → accuracy
  + which words/kana/kanji were wrong + correction hint, against `dictation_attempts.accuracy_score`
  / `user_input`.
- **Fill-in-the-blank** — transcript shown with its most important words (content words, not
  particles) blanked. Play → fill the missing words → Check → accuracy scored against the blanked
  tokens, same `accuracy_score`/`user_input` columns.
- **Translation** — transcript shown in Japanese. Play → write a natural Vietnamese translation →
  Check. Scored via the existing Lite → Deep AI cascade (`business-model.md` §2/§3.1) rather than
  deterministic matching — same quota/fallback behavior as Analysis, no new gating mechanism.

Next sentence after Check, same as before, regardless of sub-mode.

**Summary** — read-only aggregation of *this lesson's own* data: AI summary, main points, vocabulary
highlights, grammar highlights, expressions, culture notes, difficulty, related lessons, the
learner's own completion state per sentence across the other three modes. **No chat box, no "Ask
AI," no cross-lesson reasoning** — the moment a question needs history beyond this lesson, it is a
Companion question, not a Summary one (see § Companion below). Content split follows the existing AI
cascade free/deep line (`business-model.md` §2/§3.1) — no new gating mechanism.
```

- [ ] **Step 2: Verify the edit**

Run:
```bash
grep -n "^\*\*Dictation\*\* — same lesson" docs/design/screens/screen-shadowing-practice.md
grep -n "^\*\*Listening Practice\*\*" docs/design/screens/screen-shadowing-practice.md
grep -n "View Modes live here" docs/design/screens/screen-shadowing-practice.md
```
Expected: first command prints nothing (old paragraph gone), second command prints one match, third command prints nothing (stale View Mode mention removed from the Shadowing paragraph).

- [ ] **Step 3: Commit**

```bash
git add docs/design/screens/screen-shadowing-practice.md
git commit -m "docs(shadowing-practice): restructure Dictation into Listening Practice with sub-modes"
```

---

### Task 2: `screen-shadowing-practice.md` — retire View Mode, rename to Two-Layer Model

**Files:**
- Modify: `docs/design/screens/screen-shadowing-practice.md` (the `# Three-Layer Model` section and the entire `# View Mode (inside Shadowing only)` section)

**Interfaces:**
- Consumes: nothing new from Task 1 (different sections of the same file; safe to do in either order, but numbered after Task 1 to match the spec's own section order).
- Produces: the file no longer contains a `# View Mode` section or the term "Three-Layer Model" — Task 6's verification grep depends on this.

- [ ] **Step 1: Replace the `# Three-Layer Model` section**

Find this exact block:

```markdown
# Three-Layer Model

Not one flat set of tabs — three independent axes, each with a single responsibility
(`docs/superpowers/specs/2026-07-31-shadowing-hub-lesson-workspace-design.md` §6.1):

```
Lesson
├── Learning Mode     "What skill am I practicing?"   — Shadowing / Pronunciation / Dictation / Summary
├── View Mode         "How do I want to see it?"       — exists only inside Shadowing: Reading / Normal / Immersion
├── Reading Settings  "How should the UI behave?"       — Font, Subtitle Size, Subtitle Color, Speed, Auto Pause, Repeat, ...
└── Analysis          a per-sentence utility (highlight → Analyze), not a mode at any layer
```

This resolves what would otherwise be a collision between this document's own Reading/Shadowing/
Immersion/Analysis progression (a **display-style axis**, now called View Mode, § View Mode below)
and the four Learning Modes below (a **practice-type axis**): they were never the same axis, so they
nest rather than merge.
```

Replace it with:

```markdown
# Two-Layer Model

Not one flat set of tabs — two independent axes, each with a single responsibility:

```
Lesson
├── Learning Mode     "What skill am I practicing?"   — Shadowing / Pronunciation / Listening Practice / Summary
├── Reading Settings  "How should the UI behave?"       — Font, Subtitle Size, Subtitle Color, Speed, Auto Pause, Repeat, ...
└── Analysis          a per-sentence utility (highlight → Analyze), not a mode at any layer
```

Shadowing renders with one fixed presentation, the same as Pronunciation, Listening Practice, and
Summary — there is no in-mode display-style switcher. An earlier design used a third axis, View
Mode (Reading / Normal / Immersion, existing only inside Shadowing), to let the learner switch
between display styles; it added complexity without enough learner value to keep and was retired
(`docs/superpowers/specs/2026-08-01-shadowing-practice-figma-reconciliation-design.md` §2).
```

- [ ] **Step 2: Delete the entire `# View Mode (inside Shadowing only)` section**

Find this exact block (it sits between the Transcript Display section and the Analysis section) and delete it entirely, including its trailing `---` separator:

```markdown
# View Mode (inside Shadowing only)

Exists only inside the Shadowing Learning Mode — Pronunciation, Dictation, and Summary each have
their own fixed presentation, not a View Mode selector
(`docs/superpowers/specs/2026-07-31-shadowing-hub-lesson-workspace-design.md` §6.4).

## Reading

Large typography.

Many visible sentences.

Translation visible.

Comfortable reading.

The old "Reading Mode" — unchanged in substance, now correctly scoped as a display preset of
Shadowing rather than a sibling of Dictation.

---

## Normal

Current sentence emphasized.

Translation hidden.

Playback controls prioritized.

Loop enabled.

Today's default balance.

---

## Immersion

Japanese only.

Minimal interface.

Video slightly larger.

Maximum focus.

The old "Immersion Mode" — unchanged in substance, now correctly scoped as a display preset of
Shadowing.

---

```

After deletion, the `# Transcript Display` section's content should be immediately followed by the `# Analysis` section (with the single `---` separator that already exists between every other pair of sections in this file — do not leave a double separator or a missing one; check the two lines immediately before `# Analysis` read exactly `---` once).

- [ ] **Step 3: Verify the edit**

Run:
```bash
grep -n "^# Three-Layer Model" docs/design/screens/screen-shadowing-practice.md
grep -n "^# View Mode" docs/design/screens/screen-shadowing-practice.md
grep -n "^# Two-Layer Model" docs/design/screens/screen-shadowing-practice.md
grep -B3 "^# Analysis$" docs/design/screens/screen-shadowing-practice.md
```
Expected: first two commands print nothing, third prints one match. The fourth command's output should show exactly one `---` line immediately above `# Analysis`, immediately preceded by the last line of the Transcript Display section's `Multiple surrounding sentences visible.` / `The learner should feel like reading,` / `not watching subtitles.` block — i.e. no leftover Reading/Normal/Immersion content and no doubled-up `---` between them.

- [ ] **Step 4: Commit**

```bash
git add docs/design/screens/screen-shadowing-practice.md
git commit -m "docs(shadowing-practice): retire View Mode axis, rename to Two-Layer Model"
```

---

### Task 3: `screen-shadowing-practice.md` — Sentence Actions, Companion, and Shared Context updates

**Files:**
- Modify: `docs/design/screens/screen-shadowing-practice.md` (the `# Sentence Actions`, `# Shared Context & Progress`, and `# Companion` sections)

**Interfaces:**
- Consumes: the four-mode list from Task 1 (`Shadowing / Pronunciation / Listening Practice / Summary`).
- Produces: final, fully-updated `screen-shadowing-practice.md` — no task after this one edits this file.

- [ ] **Step 1: Add two Sentence Actions**

Find this exact block:

```markdown
# Sentence Actions

Each sentence supports

- Replay
- Bookmark
- Save difficult sentence
- Vocabulary
- Grammar
- Mining
- AI explanation

These actions remain hidden until hover or focus.

The reading flow should remain uninterrupted.
```

Replace it with:

```markdown
# Sentence Actions

Each sentence supports

- Replay
- Bookmark
- Save difficult sentence
- Vocabulary
- Grammar
- Mining
- AI explanation
- Toggle furigana — a shortcut to the global Reading Settings furigana setting (Always / Adaptive /
  Hidden); flipping it here changes the same global setting, there is no separate per-sentence
  furigana state
- Practice this sentence — opens Pronunciation mode with the target sentence pre-selected and
  playback positioned at that sentence

These actions remain hidden until hover or focus.

The reading flow should remain uninterrupted.
```

- [ ] **Step 2: Update the mode names in `# Shared Context & Progress`**

Find this exact sentence:

```markdown
**No mode ordering is enforced.** Watch → Shadowing → Pronunciation → Dictation → Summary is one
valid path; Watch → Shadowing → Summary → continue tomorrow is another; Dictation-only is equally
valid. The four modes are not a wizard and never gate one another.
```

Replace it with:

```markdown
**No mode ordering is enforced.** Watch → Shadowing → Pronunciation → Listening Practice → Summary
is one valid path; Watch → Shadowing → Summary → continue tomorrow is another; Listening-Practice-
only is equally valid. The four modes are not a wizard and never gate one another.
```

Then find this exact sentence:

```markdown
**Progress is tracked per mode, not as one aggregate bar.** A lesson card shows independent progress
for each — e.g. "Shadowing 100% · Pronunciation 63% · Dictation 28%" — rather than a single blended
percentage that hides which skill is actually behind.
```

Replace it with:

```markdown
**Progress is tracked per mode, not as one aggregate bar.** A lesson card shows independent progress
for each — e.g. "Shadowing 100% · Pronunciation 63% · Listening Practice 28%" — rather than a single
blended percentage that hides which skill is actually behind.
```

Then find this exact sentence:

```markdown
**Each sentence carries its own Learning Status** across the three practice modes: a
listening/shadowing signal, a pronunciation score, a dictation accuracy score, and a derived
"difficult" flag from repeated low scores or repeated replays — all read directly off existing
per-sentence rows, no new table, no AI involved.
```

Replace it with:

```markdown
**Each sentence carries its own Learning Status** across the three practice modes: a
listening/shadowing signal, a pronunciation score, three `practice_type`-keyed Listening Practice
accuracy scores (dictation / fill_blank / translation), and a derived "difficult" flag from repeated
low scores or repeated replays — all read directly off existing per-sentence rows, no new table
(Translation's accuracy score is AI-derived, the other two are not, but all three live in the same
`dictation_attempts` row shape).
```

- [ ] **Step 3: Update the mode list in `# Companion`**

Find this exact sentence:

```markdown
✕ Not Supported, across all four Learning Modes (Shadowing, Pronunciation, Dictation, Summary) —
each is an active acquisition loop (`docs/design/design-reconciliation.md` §4, Learning Loop
Boundary), Companion is Dormant throughout. This is structurally enforced: no `CompanionAnchor` may
mount anywhere in the `/shadowing/[id]/**` route group (L9b scan test). Companion does not appear
during any session; any reflection it has about a completed session surfaces later, on a surface
where Companion is Available (Dashboard, `/journal`) — never inside the Lesson itself.
```

Replace it with:

```markdown
✕ Not Supported, across all four Learning Modes (Shadowing, Pronunciation, Listening Practice,
Summary) — each is an active acquisition loop (`docs/design/design-reconciliation.md` §4, Learning
Loop Boundary), Companion is Dormant throughout. This is structurally enforced: no `CompanionAnchor`
may mount anywhere in the `/shadowing/[id]/**` route group (L9b scan test). Companion does not appear
during any session; any reflection it has about a completed session surfaces later, on a surface
where Companion is Available (Dashboard, `/journal`) — never inside the Lesson itself.
```

- [ ] **Step 4: Verify the edit**

Run:
```bash
grep -n "Practice this sentence" docs/design/screens/screen-shadowing-practice.md
grep -n "Dictation, Summary" docs/design/screens/screen-shadowing-practice.md
grep -n "dictation accuracy score" docs/design/screens/screen-shadowing-practice.md
```
Expected: first command prints one match, second and third print nothing.

- [ ] **Step 5: Commit**

```bash
git add docs/design/screens/screen-shadowing-practice.md
git commit -m "docs(shadowing-practice): add furigana/practice-sentence actions, sync mode names"
```

---

### Task 4: `study-modes.md` — retire View Mode references

**Files:**
- Modify: `docs/design/patterns/study-modes.md` (the `# Available Study Modes`, `# Mode Selection`, and `# Adaptive Mode` sections)

**Interfaces:**
- Consumes: the "View Mode retired, Two-Layer Model" decision from Task 2 (this task documents the same retirement from `study-modes.md`'s side).
- Produces: final, fully-updated `study-modes.md` — no task after this one edits this file.

- [ ] **Step 1: Rewrite `# Available Study Modes`**

Find this exact block:

```markdown
# Available Study Modes

**Superseded inside the Shadowing Lesson Workspace.** The four modes this section originally
described — Reading, Shadowing, Immersion, Analysis — were restructured by
`docs/superpowers/specs/2026-07-31-shadowing-hub-lesson-workspace-design.md` §6.1/§6.4/§6.6 into
the Three-Layer Model now documented canonically in `screen-shadowing-practice.md`:

```
Lesson
├── Learning Mode     "What skill am I practicing?"   — Shadowing / Pronunciation / Dictation / Summary
├── View Mode         "How do I want to see it?"       — exists only inside Shadowing: Reading / Normal / Immersion
├── Reading Settings  "How should the UI behave?"      — Font, Subtitle Size, Subtitle Color, Speed, Auto Pause, Repeat, ...
└── Analysis          a per-sentence utility (highlight → Analyze), not a mode at any layer
```

Mapping from this document's old names to the new model:

| Old name (this document) | New home |
|---|---|
| Reading Mode | View Mode → **Reading** (`screen-shadowing-practice.md` § View Mode) |
| Shadowing Mode | View Mode → **Normal** ("today's default balance") |
| Immersion Mode | View Mode → **Immersion** |
| Analysis Mode | **Analysis**, a per-sentence utility — not a View Mode option, not a fourth mode |

`screen-shadowing-practice.md` § Three-Layer Model / § View Mode / § Analysis is now the canonical
description of each — this document no longer duplicates their Purpose/Layout/Companion Behavior
detail below.

**Review Mode, Focus Mode, and Adaptive Mode are unaffected** by this restructuring — they describe
different surfaces/axes, not the Shadowing Learning Mode's internal View Mode split: Review Mode is
the separate SRS review workspace (`screen-review.md`); Focus Mode is the general
concentration-density axis shared with `screen-architecture.md` § Focus States and
`adaptive-layouts.md` § Focus Modes (related in spirit, not the same concept —
`docs/design/design-reconciliation.md` §13, "Naming Is Local, Not Global"); Adaptive Mode is this
document's own auto-adjustment behavior. All three remain documented below, unchanged.
```

Replace it with:

```markdown
# Available Study Modes

**Superseded inside the Shadowing Lesson Workspace.** The four modes this section originally
described — Reading, Shadowing, Immersion, Analysis — were restructured by
`docs/superpowers/specs/2026-07-31-shadowing-hub-lesson-workspace-design.md` §6.1/§6.4/§6.6, and
later `2026-08-01-shadowing-practice-figma-reconciliation-design.md` §2, into a Learning Mode /
Reading Settings model now documented canonically in `screen-shadowing-practice.md`:

```
Lesson
├── Learning Mode     "What skill am I practicing?"   — Shadowing / Pronunciation / Listening Practice / Summary
├── Reading Settings  "How should the UI behave?"      — Font, Subtitle Size, Subtitle Color, Speed, Auto Pause, Repeat, ...
└── Analysis          a per-sentence utility (highlight → Analyze), not a mode at any layer
```

Mapping from this document's old names to the new model:

| Old name (this document) | New home |
|---|---|
| Reading Mode | Retired — Shadowing now has one fixed presentation, no display-style switcher |
| Shadowing Mode | Retired the same way — its behavior ("today's default balance") is simply how Shadowing always renders now |
| Immersion Mode | Retired the same way |
| Analysis Mode | **Analysis**, a per-sentence utility — not a mode, not a tab, unaffected by this retirement |

An intermediate step briefly gave Reading/Shadowing/Immersion Mode a new home, View Mode
(`docs/superpowers/specs/2026-07-31-shadowing-hub-lesson-workspace-design.md` §6.1/§6.4); View Mode
itself was later retired outright
(`docs/superpowers/specs/2026-08-01-shadowing-practice-figma-reconciliation-design.md` §2), so those
three old names have no new home to point to anymore.

`screen-shadowing-practice.md` § Two-Layer Model / § Analysis is now the canonical description of
each — this document no longer duplicates their Purpose/Layout/Companion Behavior detail below.

**Review Mode, Focus Mode, and Adaptive Mode are unaffected** by this restructuring — they describe
different surfaces/axes: Review Mode is the separate SRS review workspace (`screen-review.md`);
Focus Mode is the general concentration-density axis shared with `screen-architecture.md` § Focus
States and `adaptive-layouts.md` § Focus Modes (related in spirit, not the same concept —
`docs/design/design-reconciliation.md` §13, "Naming Is Local, Not Global"); Adaptive Mode is this
document's own auto-adjustment behavior. All three remain documented below, unchanged (Adaptive
Mode's own examples are trimmed separately, see § Adaptive Mode below).
```

- [ ] **Step 2: Delete the entire `# Mode Selection` section**

Find this exact block and delete it entirely, including its trailing `---` separator:

```markdown
# Mode Selection

Within Shadowing, View Mode should be accessible from a compact segmented control
(`screen-shadowing-practice.md` § View Mode):

```
Reading

Normal

Immersion
```

Analysis is not part of this control — it triggers from selecting text, not from switching modes
(see § Available Study Modes above). Review is a separate workspace reached by navigating away from
the Lesson entirely, not a mode switch within it.

Avoid dropdown menus.

Avoid nested settings.

Changing View Mode should require only one click.

---

```

After deletion, the `# Adaptive Mode` section's own `## Companion Behavior` subsection (the one immediately before where `# Mode Selection` used to be) should be followed directly by the `# Visual Adaptation` section, separated by exactly one `---` line.

- [ ] **Step 3: Trim `# Adaptive Mode`'s examples**

Find this exact block:

```markdown
Examples:

Reading for several minutes

↓

Workspace gradually emphasizes View Mode → Reading.

Repeated sentence looping

↓

Workspace gradually resembles View Mode → Normal.

Extended grammar exploration

↓

Workspace gently surfaces the Analysis utility.

The transition should be subtle.
```

Replace it with:

```markdown
Examples:

Extended grammar exploration

↓

Workspace gently surfaces the Analysis utility.

The transition should be subtle.
```

- [ ] **Step 4: Verify the edit**

Run:
```bash
grep -n "^# Mode Selection" docs/design/patterns/study-modes.md
grep -n "View Mode →" docs/design/patterns/study-modes.md
grep -n "Three-Layer Model" docs/design/patterns/study-modes.md
```
Expected: all three commands print nothing.

- [ ] **Step 5: Commit**

```bash
git add docs/design/patterns/study-modes.md
git commit -m "docs(study-modes): retire View Mode axis, sync with Two-Layer Model"
```

---

### Task 5: `navigation-system.md` — Nav Column Gamification exception

**Files:**
- Modify: `docs/design/screens/navigation-system.md` (the `# Purpose`, `# Gamification & Navigation`, and `# Settings Entry Point` sections)

**Interfaces:**
- Consumes: nothing from Tasks 1–4 (independent file).
- Produces: final, fully-updated `navigation-system.md` — no task after this one edits this file.

- [ ] **Step 1: Amend `# Purpose`**

Find this exact block:

```markdown
# Purpose

Navigation is a single, low-noise surface for arriving somewhere. It is not a dashboard, not a status
display, and not a place where Companion or Gamification speak. Its only job is: get the learner from
"I want to do X" to the screen for X, with the least visual weight possible.
```

Replace it with:

```markdown
# Purpose

Navigation is a single, low-noise surface for arriving somewhere. It is not a dashboard and not a
place where Companion speaks. Its only job is: get the learner from "I want to do X" to the screen
for X, with the least visual weight possible. Gamification is a narrow, deliberate exception to this
neutrality — see § Gamification & Navigation — not a general invitation for status displays.
```

- [ ] **Step 2: Formalize `# Gamification & Navigation`**

Find this exact block:

```markdown
# Gamification & Navigation

`/leaderboard` is a real, shipped nav item. It belongs entirely to the Gamification Layer
(`design-reconciliation.md` §3, Layer Responsibility Rule: Gamification owns XP, Streak, Progress,
Goal completion). The Nav Column itself stays neutral chrome — it does not display a live XP counter,
streak flame, or rank badge next to any nav item. Any such indicator, if added later, would be a
Gamification-owned addition to the Nav Column, and Companion must never narrate it from within
navigation, per the same Layer Responsibility Rule.
```

Replace it with:

```markdown
# Gamification & Navigation

`/leaderboard` is a real, shipped nav item. It belongs entirely to the Gamification Layer
(`design-reconciliation.md` §3, Layer Responsibility Rule: Gamification owns XP, Streak, Progress,
Goal completion). The Nav Column carries one deliberate Gamification exception, added
(`docs/superpowers/specs/2026-08-01-shadowing-practice-figma-reconciliation-design.md` §5): a compact
streak indicator (e.g. flame + day count) in the Nav footer, reusing the same streak data the
Gamification Layer already tracks — no new schema. It is a glance-level indicator only; the fuller
session/goal/hours detail stays where it already lives (Shadowing Hub's Current Session rail,
Dashboard) and is not duplicated here. Beyond this one indicator, the Nav Column stays neutral — no
live XP counter, no rank badge next to any nav item — and Companion must never narrate the streak
indicator from within navigation, per the same Layer Responsibility Rule.
```

- [ ] **Step 3: Update the "Nav footer controls" bullet in `# Settings Entry Point`**

Find this exact block:

```markdown
1. **Nav footer controls** (shipped): `ThemeToggle`, `ReduceMotionToggle`, and sign-out, rendered
   below the nav list in `app-nav.tsx`. These are global, low-frequency toggles — not a settings
   screen.
```

Replace it with:

```markdown
1. **Nav footer controls** (shipped): `ThemeToggle`, `ReduceMotionToggle`, sign-out, a streak
   indicator, and a single "Rain Sound" ambient-audio toggle, rendered below the nav list in
   `app-nav.tsx`. The streak indicator and Rain Sound toggle are the Gamification exception
   documented in § Gamification & Navigation above; the rest remain global, low-frequency toggles —
   not a settings screen.
```

- [ ] **Step 4: Verify the edit**

Run:
```bash
grep -n "not a place where Companion or Gamification speak" docs/design/screens/navigation-system.md
grep -n "Rain Sound" docs/design/screens/navigation-system.md
grep -n "deliberate Gamification exception" docs/design/screens/navigation-system.md
```
Expected: first command prints nothing, second and third each print at least one match.

- [ ] **Step 5: Commit**

```bash
git add docs/design/screens/navigation-system.md
git commit -m "docs(navigation-system): add Nav Column streak + ambient sound Gamification exception"
```

---

### Task 6: Repo-wide verification pass

**Files:**
- None modified unless a stray reference is found (in which case, fix it in the same file it's found in and note which task's pattern it follows).

**Interfaces:**
- Consumes: the final state of all three files from Tasks 1–5.
- Produces: confidence that no stale cross-reference to the retired concepts (View Mode, Three-Layer Model, flat Dictation mode, the old Nav Column ban) survives anywhere under `docs/design/`.

- [ ] **Step 1: Run the full verification sweep**

```bash
grep -rn "Three-Layer Model" docs/design/
grep -rn "^# View Mode" docs/design/
grep -rn "^# Mode Selection" docs/design/
grep -rln "Dictation, Summary" docs/design/
grep -rn "not a place where Companion or Gamification speak" docs/design/
```

Expected: every command prints nothing. `docs/design/` deliberately excludes `docs/superpowers/specs/` and `docs/superpowers/plans/` from this sweep — historical spec/plan files (e.g. `2026-07-31-shadowing-hub-lesson-workspace-design.md`) are allowed to keep describing View Mode as the design decision that was current when they were written; only living docs under `docs/design/` must be fully caught up.

- [ ] **Step 2: If any command prints a match, fix it**

Read the matching file at the reported line, determine which of Tasks 1–5's replacement pattern applies (a mode-name update, a section rename, or a section deletion), apply the same kind of fix, and re-run the single grep command that caught it to confirm it now prints nothing.

- [ ] **Step 3: Read both fully-edited screen sections once, end to end**

Read `docs/design/screens/screen-shadowing-practice.md` in full and confirm: the file reads coherently from `# Learning Modes` through `# Analysis` with no leftover blank sections, doubled `---` separators, or dangling references to a section that no longer exists. Do the same for `docs/design/patterns/study-modes.md` from `# Available Study Modes` through `# Adaptive Mode`.

- [ ] **Step 4: Commit (only if Step 2 made any fixes)**

```bash
git add -A docs/design/
git commit -m "docs: fix stale cross-references found in final reconciliation sweep"
```

If Step 2 found nothing to fix, skip this commit — Tasks 1–5's commits already cover everything.
