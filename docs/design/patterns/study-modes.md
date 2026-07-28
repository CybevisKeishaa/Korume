# Study Modes Pattern

> **Status:** Design System Pattern  
> **Layer:** Learning Experience  
> **Applies to:** Shadowing Workspace, Review Workspace, Reading Workspace  
> **Related:** `learning-surfaces.md`, `workspace-patterns.md`, `screen-shadowing-detail.md`, `screen-review.md`, `interaction-principles.md`

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

---

# Reading Mode

## Purpose

Comfortable transcript reading.

Ideal for first exposure to a dialogue.

---

## Primary Focus

Understanding.

Reading rhythm.

Natural pacing.

---

## Layout

Video:

Medium size.

Transcript:

Maximum readability.

Large typography.

Wide spacing.

Translation:

Visible.

Vocabulary chips:

Visible.

Grammar:

Available inside drawer.

---

## Playback

Normal controls.

No looping emphasis.

---

## Companion Behavior

Almost invisible.

Occasionally observes quietly.

Never interrupts reading.

---

# Shadowing Mode

## Purpose

Listening and speaking.

Training pronunciation and rhythm.

---

## Primary Focus

The current sentence.

Everything else becomes secondary.

---

## Layout

Transcript:

Current sentence strongly emphasized.

Previous sentences softly faded.

Future sentences neutral.

Translation:

Hidden by default.

Video:

Smaller.

Playback controls:

Prominent.

Loop button:

Always visible.

---

## Playback

Sentence looping.

Auto pause.

Speed adjustment.

Previous sentence.

Next sentence.

Repeat.

---

## Companion Behavior

Silent.

Learning requires complete concentration.

---

# Immersion Mode

## Purpose

Experience Japanese naturally.

Minimize assistance.

---

## Primary Focus

Japanese only.

---

## Layout

Video:

Larger.

Transcript:

Japanese only.

Translation:

Hidden.

Vocabulary:

Hidden.

Grammar:

Hidden.

Interface chrome:

Minimal.

---

## Playback

Continuous playback encouraged.

Looping available but visually de-emphasized.

---

## Companion Behavior

Invisible.

Immersion should feel uninterrupted.

---

# Analysis Mode

## Purpose

Understand difficult language.

Ideal after repeated listening.

---

## Primary Focus

Breaking down the language.

---

## Layout

Transcript remains central.

Bottom drawer becomes the primary supporting workspace.

Available tools:

- Grammar
- Vocabulary
- AI Explanation
- Notes
- Mining
- Sentence Breakdown

Video becomes less visually important.

---

## Companion Behavior

May occasionally leave a quiet observation.

Example:

> "This expression appears quite often."

Never explains grammar directly.

The learning tools do that.

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
throughout Review, the same as Shadowing Mode above. It may address the learner after the review
session ends, never during it.

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

Absent.

Silence is intentional.

---

# Adaptive Mode

## Purpose

Allow the workspace to adjust itself automatically.

The system observes the learner's current activity.

Examples:

Reading for several minutes

↓

Workspace gradually emphasizes Reading Mode.

Repeated sentence looping

↓

Workspace gradually resembles Shadowing Mode.

Extended grammar exploration

↓

Workspace gently shifts toward Analysis Mode.

The transition should be subtle.

Never surprising.

The learner remains in control.

---

# Mode Selection

Study Modes should be accessible from a compact segmented control.

Example:

```
Read

Shadow

Immerse

Analyze

Review
```

Avoid dropdown menus.

Avoid nested settings.

Changing modes should require only one click.

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

- last selected Study Mode
- per-video preference (optional)
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