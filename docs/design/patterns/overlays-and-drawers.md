# Overlays & Drawers Pattern

> **Status:** Approved  
> **Layer:** Experience Architecture  
> **Applies to:** Entire Product  
> **Related:** `workspace-patterns.md`, `learning-surfaces.md`, `navigation-system.md`, `screen-shadowing-practice.md`, `screen-review.md`, `docs/design/design-reconciliation.md`

---

# Philosophy

Overlays should never interrupt learning.

A learner should never feel like a new application suddenly appeared on top of another application.

Instead, every temporary interface should feel like another layer of the same workspace.

The goal is not to show more UI.

The goal is to preserve context.

The learner should always know:

> "I'm still in the same place."

Drawer and overlay state is independent of Companion presence. A drawer opening or closing never
changes whether Companion is Hidden or Available on the underlying screen — Companion's presence is
still governed only by the Learning Loop Boundary and Anchor Availability of that screen
(`docs/design/design-reconciliation.md` §4, §6), never by which drawer happens to be open. This
matters most on `screen-shadowing-practice.md` and `screen-review.md`, where Companion stays Hidden
regardless of any drawer opened during the session.

---

# Design Principles

## 1. Learning First

Nothing may permanently cover the learning surface.

Temporary interfaces exist only long enough to complete a task.

When finished, the learner immediately returns to where they were.

Never reset scroll position.

Never reset playback.

Never reset transcript position.

---

## 2. Context Never Disappears

Whenever possible:

The previous screen remains visible.

The learner should still remember where they came from.

Avoid full-screen replacements.

Avoid unnecessary navigation.

---

## 3. Progressive Disclosure

The interface reveals complexity gradually.

Never show every control simultaneously.

Instead:

Primary task

↓

Secondary actions

↓

Advanced tools

↓

Expert configuration

The learner should never feel overwhelmed.

---

# Overlay Hierarchy

The product supports four interface layers.

```
Workspace

↓

Drawer

↓

Modal

↓

System Dialog
```

Higher layers should be increasingly rare.

---

# Layer 1 — Workspace

The default interaction model.

Examples:

- Shadowing
- Review
- Dashboard
- Library
- Search

No overlay.

No interruption.

---

# Layer 2 — Drawer

Preferred solution.

Use whenever the learner needs additional information without leaving the current task.

Examples:

- Vocabulary
- Grammar
- AI Explanation
- Notes
- Mining
- Reading Settings
- Subtitle Source
- Playback Settings

Drawers preserve context.

The learner remains inside the learning surface.

---

# Drawer Types

## Bottom Drawer

Primary drawer pattern.

Used inside learning workspaces.

Examples:

- Grammar
- Vocabulary
- AI
- Mining
- Notes

Behavior:

- slides upward
- transcript remains visible
- video remains visible
- workspace keeps its layout
- easy to dismiss

This is the preferred interaction model for Korume.

---

## Side Drawer

Used for secondary exploration.

Examples:

- Filter panel
- Search filters
- Collection information
- Playlist information
- Bookmark details

Should never exceed 420–480px width.

Avoid occupying more than one third of the workspace.

---

## Floating Drawer

Small contextual panel.

Appears near the user's current focus.

Examples:

- Sentence actions
- Quick translation
- Pronunciation details
- Furigana options

Should disappear automatically after task completion.

---

# Layer 3 — Modal

Use sparingly.

A modal temporarily pauses interaction.

Therefore it must justify the interruption.

Allowed use cases:

- Delete confirmation
- Rename collection
- Export options
- Login
- Payment
- Critical warning

Not allowed:

Grammar explanation

Vocabulary

Playback settings

Subtitle settings

Reading settings

AI explanation

These belong in drawers.

---

# Modal Principles

Modals answer one question only.

Never build mini applications inside modals.

Maximum:

One task

One decision

Return immediately

---

# Layer 4 — System Dialog

Reserved for operating-system level actions.

Examples:

- File picker
- Camera permission
- Microphone permission
- Browser permission
- Native share sheet

The application should never imitate system dialogs.

---

# Bottom Utility Workspace

The Shadowing Workspace introduces a specialized drawer system.

Collapsed state:

```
Playback

Vocabulary

Grammar

Mining

Notes

AI

Settings
```

Selecting one expands the drawer.

Only one utility may be open at a time.

Switching utilities replaces content instead of stacking drawers.

The transcript never changes size.

The transcript never loses focus.

---

# Drawer Behavior

## Opening

Should feel gentle.

Movement:

- vertical
- soft easing
- subtle blur

Duration:

200–280ms

---

## Closing

Closing should feel lighter than opening.

Avoid dramatic disappearing animations.

The learner should feel that the workspace simply became quieter.

---

## Resizing

Large drawers may support dragging.

However:

Dragging should never feel required.

The default height should already feel comfortable.

---

# Persistent State

Drawers remember:

- selected tab
- expanded section
- scroll position
- reading settings
- filter selection

Returning to the drawer should restore the previous state whenever possible.

---

# Multiple Drawers

Never allow stacked drawers.

Incorrect:

```
Drawer

↓

Drawer

↓

Drawer
```

Correct:

Replace the current drawer content.

The workspace should always have a single secondary surface.

---

# Blur & Background

Opening a drawer should not darken the application dramatically.

Preferred:

- soft blur
- slight dimming
- preserved depth

Avoid:

Heavy black overlays

High opacity backgrounds

The learner should still perceive the workspace beneath.

---

# Escape Behavior

The learner should always have an obvious way to return.

Supported methods:

- ESC
- close button
- swipe (touch devices)
- click outside (when appropriate)

Avoid trapping the learner.

---

# Focus Management

Keyboard focus should move naturally.

When a drawer closes:

Focus returns to the previously active element.

For example:

Transcript sentence

↓

Vocabulary drawer

↓

Close

↓

Same transcript sentence regains focus

---

# Mobile Adaptation

Desktop:

Bottom drawer expands upward.

Tablet:

Bottom drawer occupies approximately half the screen.

Mobile:

Drawer becomes a full-height sheet while preserving the feeling of belonging to the same workspace.

Even on mobile:

Avoid navigating to a completely different page whenever a drawer is sufficient.

---

# Accessibility

Every drawer must:

- support keyboard navigation
- support screen readers
- restore focus correctly
- have predictable close behavior
- avoid hidden interactions

No gesture should be the only way to dismiss a drawer.

---

# Anti-Patterns

Do not build dashboards inside drawers.

Do not open multiple nested modals.

Do not use drawers as navigation.

Do not force the learner to close a drawer before continuing playback.

Do not obscure the transcript unnecessarily.

Do not interrupt learning with promotional overlays.

Do not display AI chat windows over the transcript.

---

# Emotional Goal

Opening a drawer should feel like gently opening a notebook beside the book you are reading.

Not like launching another application.

The learner should never think:

> "Now I'm managing software."

Instead, they should feel:

> "I'm simply looking a little deeper before continuing my journey."