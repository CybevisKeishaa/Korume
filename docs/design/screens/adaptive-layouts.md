# Adaptive Layouts

> **Status:** Approved
> **Related:** `docs/design/screens/navigation-system.md`, `docs/design/patterns/companion-patterns.md`, `docs/design/design-reconciliation.md`
>
> This document uses several internal level-progressions (Layout Types, Reading Expansion, Header
> Adaptation, Focus Modes, Companion Adaptation) that are related in spirit but are independent axes,
> not one shared taxonomy — including with each other. None of their names are binding on sibling
> documents either (`docs/design/design-reconciliation.md` §13).

> Purpose
>
> This document defines how Nihongo Cinema adapts across different screen sizes, workspace configurations and study modes.
>
> Adaptation is not only about responsiveness.
>
> It is about respecting the learner's current intention.
>
> The interface should continuously reshape itself to support focus instead of forcing users into a fixed layout.

---

# Philosophy

Most applications adapt to the device.

Nihongo Cinema adapts to the learner.

A learner watching a difficult scene needs a different workspace than someone reviewing vocabulary.

The interface should quietly respond to changing needs.

Adaptation should feel natural, almost invisible.

Users should never think:

> "The layout changed."

They should simply feel:

> "This feels more comfortable."

---

# Adaptive Hierarchy

Every screen follows the same priority.

```
Primary Workspace

↓

Supporting Workspace

↓

Context Tools

↓

Navigation

↓

Ambient Elements
```

When screen space becomes limited, elements disappear from the bottom upward.

Never sacrifice the primary workspace first.

---

# Responsive Philosophy

Do not design around breakpoints.

Design around reading comfort.

Traditional responsive design asks:

> "How many pixels are available?"

Nihongo Cinema asks:

> "How much space does the learner need?"

---

# Layout Types

The product uses four adaptive layout families.

---

# 1. Immersive Workspace

Purpose

Maximum focus.

Characteristics

- Navigation hidden
- Companion hidden
- Tools collapsed
- Workspace fills the screen
- Minimal header
- No distractions

Ideal for

- Shadowing
- Reading
- Listening
- Review

---

Typical Layout

```
Header

↓

Primary Workspace

↓

Floating Controls
```

---

# 2. Balanced Workspace

Purpose

Daily learning.

Characteristics

- Primary workspace visible
- Secondary workspace visible
- Utilities available
- Navigation collapsible

This is the default layout for most desktop screens.

---

Typical Layout

```
Sidebar

↓

Workspace

↓

Bottom Drawer
```

---

# 3. Exploration Workspace

Purpose

Browsing.

Examples

Videos

Library

Dashboard

Collection

Characteristics

Navigation remains visible.

Content grid expands naturally.

Information density is slightly higher.

---

# 4. Compact Workspace

Purpose

Small displays.

Tablet.

Small laptop.

Characteristics

Panels stack vertically.

Utilities become sheets.

Floating controls remain.

Reading comfort remains unchanged.

---

# Workspace Ratios

Resizable layouts should use soft ratios.

Never fixed values.

Recommended defaults

| Layout | Default |
|----------|----------|
| Video / Transcript | 35 / 65 |
| Reading / Dictionary | 70 / 30 |
| Collection / Preview | 55 / 45 |
| Journal / Companion | 75 / 25 |

Users may freely resize.

---

# Split Workspace

Split layouts are adaptive.

```
┌──────────────┬────────────────────┐
│              │                    │
│ Left         │ Right              │
│              │                    │
└──────────────┴────────────────────┘
```

The divider should feel physical.

Dragging updates both panes smoothly.

Avoid sudden jumps.

---

# Minimum Comfortable Size

Every workspace defines a comfort threshold.

Example

Video

Never smaller than contextual viewing.

Transcript

Never narrower than comfortable reading width.

Dictionary

Never narrower than readable content.

When a threshold is reached,

adaptation begins automatically.

---

# Automatic Reflow

When split panels become uncomfortable,

the interface transitions naturally.

Example

Desktop

```
Video | Transcript
```

↓

Tablet

```
Video

Transcript
```

↓

Focus Mode

```
Transcript

Video (Picture-in-Picture)
```

The transition should be animated gently.

Never abrupt.

---

# Picture-in-Picture

Small contextual media.

Used when the learner prioritizes reading.

Ideal size

Approximately 18–25% of screen width.

Characteristics

Rounded.

Floating.

Draggable.

Dismissible.

Always stays above the transcript.

---

# Reading Expansion

The reading surface should always be expandable.

Possible states

Normal

↓

Wide

↓

Focused

↓

Fullscreen

Each transition should preserve reading position.

Never reload content.

---

# Bottom Drawer

The Bottom Utility Drawer is adaptive.

States

Collapsed

↓

Peek

↓

Half

↓

Expanded

↓

Fullscreen

The drawer should never permanently reduce transcript width.

It expands vertically.

---

# Navigation Adaptation

Navigation should progressively disappear during study.

The progression below (Expanded sidebar → Collapsed sidebar → Icon rail → Hidden) is Planned target design; currently only Expanded (desktop) and Wrapped (mobile) are shipped. See `docs/design/screens/navigation-system.md` § Navigation States.

Desktop

Expanded sidebar.

↓

Collapsed sidebar.

↓

Icon rail.

↓

Hidden.

The learner always controls whether navigation is visible.

---

# Header Adaptation

Headers should simplify as focus increases.

Normal

Back

Title

Metadata

Actions

↓

Focused

Back

Title

↓

Immersive

Minimal overlay

The header should never compete with learning.

---

# Companion Adaptation

**On Learning Loop surfaces** (Shadowing, Dictation, SRS review, Mining review session, Pronunciation
evaluation, JLPT/Grammar/Vocabulary/Kanji practice, Conversation drills —
`docs/design/design-reconciliation.md` §4), Companion is Hidden at every focus level below, not only
at Presentation Mode. This matches "1. Immersive Workspace" above, which already lists "Companion
hidden" as a Characteristic whenever that workspace hosts Shadowing, Reading, Listening, or Review.

**On surfaces where Companion is Available or Planned** (§6 — Dashboard, `/journal`, Shadowing Hub,
Mining browse/collection), the Companion behaves differently depending on focus:

Normal

Small ambient notes.

↓

Focused

Almost silent.

↓

Immersive

Only essential observations.

↓

Presentation Mode

Hidden completely.

Companion respects concentration.

---

# Reading Width

Reading comfort is more important than maximizing width.

Target line length

Approximately

45–80 characters.

Avoid excessively wide paragraphs.

When the screen becomes very wide,

increase margins instead of stretching text endlessly.

---

# Typography Scaling

Typography scales smoothly.

Never jump between predefined sizes.

Scale should respond to

- screen size
- reading mode
- accessibility settings
- workspace width

Reading should remain effortless.

---

# Tool Placement

Secondary tools adapt according to available space.

Large display

Bottom drawer.

↓

Medium display

Sheet.

↓

Small display

Fullscreen panel.

The learning surface always remains the priority.

---

# Interaction Density

Large displays

More surrounding context.

Small displays

Less surrounding information.

Never shrink everything equally.

Reduce complexity before reducing readability.

---

# Motion During Adaptation

Every layout transition should communicate continuity.

Avoid

- snapping
- flashing
- rebuilding
- page refreshes

Prefer

- fading
- sliding
- resizing
- breathing motion

Users should feel that the workspace is gently rearranging itself.

---

# Focus Modes

Every major learning workspace supports four levels of focus.

## Normal

Navigation visible.

Utilities available.

Balanced workspace.

---

## Focus

Navigation hidden.

Transcript expands.

Tools collapse.

On Learning Loop surfaces (`docs/design/design-reconciliation.md` §4), Companion is Hidden here, not
merely quieter — same exception as § Companion Adaptation above. On Companion-Available/Planned
surfaces, Companion becomes quieter.

---

## Immersion

Only learning content remains.

Playback controls float.

Everything else disappears.

---

## Reading

Maximum transcript width.

Video moves into Picture-in-Picture.

Reading settings become immediately accessible.

Feels similar to Apple Books or Kindle.

---

# Accessibility

Adaptation should also respect personal preferences.

Users may customize

- font size
- line height
- sentence width
- furigana visibility
- translation visibility
- subtitle language
- contrast
- animation intensity

These changes should happen instantly.

No settings page reloads.

---

# Animation Principles

Adaptive transitions should remain subtle.

Recommended duration

150–350 ms

Large layout changes

300–500 ms

Atmosphere changes

800–1500 ms

Nothing should feel mechanical.

Nothing should attract attention.

---

# Success Criteria

A successful adaptive layout is one that learners barely notice.

The interface should quietly reshape itself around the learner's current intention.

The learner should never need to fight the layout.

Instead, the workspace should gently make room for the way they choose to study.