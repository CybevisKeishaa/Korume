# Study Modes Pattern

> **Status:** Approved  
> **Layer:** Learning Experience  
> **Applies to:** Shadowing Workspace, Review Workspace, Reading Workspace  
> **Related:** `learning-surfaces.md`, `workspace-patterns.md`, `screen-shadowing-practice.md`, `screen-review.md`, `interaction-principles.md`

---

# Philosophy

Study Modes are not different products.

They are different mental environments.

The learner should never feel that they have switched to another application.

Instead, the workspace quietly adapts itself to support the current learning intention.

The transcript remains the heart of every mode.

Everything else rearranges around it.

---

# Core Principle

The learner should choose **how they want to learn**, not **which feature they want to use**.

Study Modes describe intentions.

Examples:

- I want to read.
- I want to shadow.
- I want to analyze.
- I want to immerse myself.
- I want to review.

Not:

- Open grammar.
- Open vocabulary.
- Open playback controls.

The interface should always think in terms of learning activities rather than software features.

---

# Design Principles

## Reading Before Interaction

Every mode begins with reading.

Controls should only appear when they help the current learning activity.

Never allow controls to become the primary visual focus.

---

## One Primary Goal

Each Study Mode should optimize for exactly one learning objective.

Trying to optimize for everything simultaneously creates visual noise.

Every mode should answer one question:

> "What should the learner focus on right now?"

---

## Instant Transition

Switching modes should never reload the page.

The learner should remain inside the same workspace.

Only the layout, emphasis, and available tools should change.

Transition duration:

200–300ms

Soft fade.

No loading screen.

---

## State Preservation

Changing modes must never reset:

- playback position
- transcript position
- selected sentence
- bookmarks
- notes
- playback speed

The learner should continue exactly where they left off.

---

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

---

# Review Mode

## Purpose

Reconnect with previously studied material.

Strengthen long-term memory.

---

## Primary Focus

Recall.

Recognition.

Confidence.

---

## Layout

Transcript:

Visible.

Known words:

Softly indicated.

Review progress:

Quietly displayed.

Vocabulary panel:

Frequently used.

Playback:

Optional.

---

## Companion Behavior

✕ Not Supported. Review is an active acquisition loop
(`docs/design/design-reconciliation.md` §4, Learning Loop Boundary) — Companion stays Hidden
throughout Review, the same as the Shadowing Learning Mode (`screen-shadowing-practice.md` §
Companion). It may address the learner after the review session ends, never during it.

---

# Focus Mode

## Purpose

Maximum concentration.

No unnecessary interface.

---

## Primary Focus

The current learning task.

Nothing else.

---

## Layout

Navigation:

Hidden.

Header:

Collapsed.

Utility drawer:

Hidden.

Only:

- transcript
- playback
- current sentence

remain visible.

---

## Companion Behavior

✕ Not Supported. Focus Mode is an active acquisition loop
(`docs/design/design-reconciliation.md` §4, Learning Loop Boundary) — Companion stays Hidden, the
same as every other mode in this document. Silence is intentional.

---

# Adaptive Mode

## Purpose

Allow the workspace to adjust itself automatically.

The system observes the learner's current activity.

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

Never surprising.

The learner remains in control.

---

## Companion Behavior

✕ Not Supported. Adaptive Mode still resolves to one of the active-acquisition-loop modes above
(`docs/design/design-reconciliation.md` §4, Learning Loop Boundary) — Companion stays Hidden, the
same as every other mode in this document.

---

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

# Visual Adaptation

Study Modes primarily change emphasis.

They should not introduce entirely different visual styles.

Adaptable elements include:

- typography scale
- sentence emphasis
- translation visibility
- video size
- drawer priority
- playback controls
- spacing
- information density

The learner should always recognize the same workspace.

---

# Animation

Transitions should feel like rearranging a desk.

Not opening another application.

Recommended changes:

- typography smoothly resizes
- transcript reflows naturally
- video gently scales
- controls softly fade
- spacing breathes

Avoid:

Slides.

Flips.

Large zoom effects.

---

# Accessibility

Every Study Mode must remain fully keyboard accessible.

Mode switching should preserve:

- focus position
- playback state
- transcript position

No mode should rely solely on color to communicate its purpose.

---

# Persistence

The workspace should remember:

- last selected View Mode
- per-lesson preference (optional)
- global default preference

The learner should not need to reconfigure the workspace every session.

---

# Anti-Patterns

Do not create completely different pages for each mode.

Do not duplicate features across modes.

Do not hide essential playback controls.

Do not overload a single mode with every available tool.

Do not reset the learner's progress when switching modes.

Do not use Study Modes as feature marketing.

Study Modes exist to support learning, not product discovery.

---

# Emotional Goal

Changing Study Modes should feel like changing posture while studying.

Sometimes the learner leans back to read.

Sometimes they lean forward to speak.

Sometimes they open a notebook to analyze.

The room has not changed.

Only the way they choose to learn within it.