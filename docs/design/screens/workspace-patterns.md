# Workspace Patterns

> **Status:** Approved
> **Related:** `docs/design/screens/navigation-system.md`, `docs/design/patterns/overlays-and-drawers.md`, `docs/design/design-reconciliation.md`

> Purpose
>
> This document defines the reusable workspace patterns used throughout Nihongo Cinema.
>
> A workspace pattern is not tied to a specific screen.
>
> Instead, it describes a reusable way of organizing learning activities.
>
> Every major screen is composed from one or more workspace patterns.
>
> Reusing these patterns creates consistency while allowing every learning space to feel unique.

---

# Philosophy

Nihongo Cinema is not built from pages.

It is built from workspaces.

A workspace represents the learner's current activity.

Instead of designing:

Dashboard

Shadowing Practice

Journal

we design:

Reading Workspace

Collection Workspace

Reflection Workspace

Overview Workspace

These workspaces may appear across multiple screens.

---

# Workspace Principles

Every workspace should follow the same principles.

## One Primary Activity

A workspace exists for exactly one purpose.

Examples

reading

listening

shadowing

collecting

writing

reviewing

Avoid combining multiple equally important activities into a single layout.

---

## Large Working Area

The active workspace should visually dominate.

Typical allocation:

60–80%

of the available viewport.

Everything else should feel secondary.

---

## Progressive Complexity

Tools appear only when needed.

Never expose every feature simultaneously.

Simple first.

Powerful later.

---

## Adaptable

Every workspace should adapt to different study styles.

Resizable.

Collapsible.

Expandable.

Never fixed.

---

## Calm

No workspace should resemble an administration dashboard.

Remove visual competition.

Reduce unnecessary borders.

Prefer whitespace over separators.

---

# Pattern 01 — Reading Workspace

Purpose

Understanding Japanese.

Ideal for:

Shadowing Practice

Transcript

Grammar

Dictionary

Characteristics

Large reading surface.

Comfortable line length.

Generous spacing.

Typography-first.

Supports:

- Furigana
- Translation
- Vocabulary
- Notes
- Grammar
- Selection

Reading should remain uninterrupted.

---

Typical Layout

```
Header

↓

Reading Surface

↓

Context Actions
```

---

# Pattern 02 — Split Workspace

Purpose

Learning through two synchronized contexts.

Examples

Video + Transcript

Audio + Notes

Sentence + Dictionary

Characteristics

Two resizable panels.

User controls the ratio.

Neither side has a fixed width.

Typical default:

35%

↓

65%

The learner decides what deserves attention.

---

Rules

Never allow unreadable panels.

If one panel becomes too small,

automatically transition into

vertical layout.

---

# Pattern 03 — Bottom Utility Drawer

Purpose

Provide advanced tools without stealing workspace.

Contains

Vocabulary

Grammar

Mining

AI

Notes

Playback

Settings

Characteristics

Collapsed by default.

Expands upward.

Never changes the transcript width.

Feels attached to the workspace.

---

Drawer States

Collapsed

↓

Peek

↓

Expanded

↓

Fullscreen

Transitions should remain smooth.

---

# Pattern 04 — Inspector

Purpose

Display contextual information.

Appears only after interaction.

Examples

Selected vocabulary

Grammar explanation

Word details

AI explanation

Characteristics

Temporary.

Dismissible.

Lightweight.

Never permanently occupies screen space.

---

# Pattern 05 — Floating Controls

Purpose

Support ongoing activity.

Examples

Playback

Sentence navigation

Loop

Repeat

Characteristics

Small.

Rounded.

Minimal.

Easy to reach.

Should resemble media controls rather than software toolbars.

---

# Pattern 06 — Focus Workspace

Purpose

Remove distractions.

Characteristics

Hide navigation.

Hide side panels.

Hide unnecessary buttons.

Expand primary content.

Perfect for

shadowing

reading

deep listening

The learner should almost forget they are inside an application.

---

# Pattern 07 — Collection Workspace

Purpose

Organize saved knowledge.

Examples

Mining

Bookmarks

Saved Sentences

Vocabulary

Characteristics

Visual hierarchy over dense tables.

Comfortable browsing.

Supports filtering without feeling technical.

Information should resemble a curated bookshelf rather than a spreadsheet.

---

# Pattern 08 — Reflection Workspace

Purpose

Encourage memory.

Examples

Journal

Learning history

Companion memories

"Companion memories" here is Available today specifically because Journal is one of Companion's four
shipped anchors (`docs/design/design-reconciliation.md` §6, L9b D3). Applying this Reflection
Workspace pattern to a different surface does not automatically carry Companion presence with it —
anchor availability is per-screen, not per-pattern.

Characteristics

Narrative.

Timeline.

Cards feel personal.

Whitespace is generous.

Reading remains central.

Should evoke flipping through a notebook.

---

# Pattern 09 — Overview Workspace

Purpose

Provide orientation.

Used for

Dashboard

Characteristics

Small number of meaningful sections.

No enterprise-style KPI walls or dense widget grids — that's a statement about visual density and
tone, not a ban on the Gamification Layer's own Progress/Streak display. Dashboard (which reuses this
pattern) legitimately shows a Gamification Progress section per the Layer Responsibility Rule
(`docs/design/design-reconciliation.md` §3, `docs/design/screens/screen-dashboard.md` § Progress).

Should answer:

"What would I enjoy learning next?"

instead of

"How productive was I?"

---

# Pattern 10 — Configuration Workspace

Purpose

Customize the learning environment.

Examples

Settings

Reader Preferences

Playback Preferences

Characteristics

Immediate feedback.

No modal overload.

Adjustments happen live.

Examples

Font Size

↓

updates instantly.

Atmosphere

↓

changes immediately.

Users should feel they are arranging their study desk.

Not configuring software.

---

# Shared Workspace Behaviors

Every workspace should support:

## Resize

Users may adjust proportions.

The interface responds gracefully.

---

## Collapse

Secondary regions can disappear.

The primary workspace expands.

---

## Expand

A workspace may temporarily occupy almost the entire screen.

Ideal for

Reading

Shadowing

Writing

---

## Context Awareness

Tools respond to current activity.

Reading

↓

dictionary

Listening

↓

playback

Writing

↓

notes

Avoid showing irrelevant functionality.

---

## Ambient Feedback

Feedback should never interrupt.

Examples

Sentence saved.

Small sparkle.

Soft fade.

Vocabulary mined.

Tiny toast.

Warm note.

No popups.

No celebrations.

This governs small, in-the-moment save/mine actions specifically — it is not a blanket ban on
celebration anywhere in the product. Gamification-owned milestones (badge unlock, streak, XP) are a
separate layer entitled to their own celebratory treatment elsewhere
(`docs/design/design-reconciliation.md` §3, Layer Responsibility Rule); this workspace's ambient
feedback simply never duplicates or narrates them.

---

# Pattern Composition

Complex screens combine multiple patterns.

Example

Shadowing Practice

Split Workspace

+

Reading Workspace

+

Bottom Utility Drawer

+

Floating Controls

+

Focus Workspace

+

Inspector

---

Journal

Reflection Workspace

+

Inspector

---

Dashboard

Overview Workspace

+

Collection Preview

---

# Design Rule

Never invent a new layout before checking whether an existing workspace pattern already solves the problem.

Consistency creates familiarity.

Familiarity creates comfort.

Comfort encourages learners to return.