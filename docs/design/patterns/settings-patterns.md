```markdown
# Settings Patterns

> **Status:** Draft — roadmap, not current state. No `/settings` route exists in code yet
> (confirmed 2026-07-28 audit); this document describes a design concept awaiting implementation,
> per the Design Document Lifecycle (`docs/design/design-reconciliation.md` §7).
> **Layer:** Experience Architecture  
> **Applies to:** Entire Product (future)  
> **Related:** `screen-settings.md` (not yet written — see `docs/design/design-reconciliation.md`
> Phase 4 backlog), `workspace-patterns.md`, `overlays-and-drawers.md`, `navigation-system.md`,
> `interaction-principles.md`, `design-language.md`, `docs/design/design-reconciliation.md`

---

# Philosophy

Settings are not a control center.

They are a personal environment.

The learner should not feel like they are configuring software.

They should feel like they are adjusting their own study room.

The purpose of settings is not to expose every possible option.

The purpose is to help the learner create the most comfortable learning environment.

---

# Core Principle

> **Settings should adapt the environment around the learner, not make the learner manage the system.**

A good setting disappears after being changed.

A bad setting creates another task.

---

# Design Principles

## 1. Personalization Over Configuration

Settings should answer:

"What feels better for me?"

Not:

"What technical option should I choose?"

Prefer:

- Reading size
- Translation visibility
- Playback comfort
- Study atmosphere
- Interface density

Avoid exposing:

- Technical states
- Internal system options
- Developer terminology
- Implementation details

---

## 2. Instant Feedback

Settings should apply immediately.

The learner should see the result while changing the option.

Avoid:

- Save buttons
- Confirmation screens
- Reloading pages
- Separate preview modes

The environment itself is the preview.

---

## 3. Contextual Settings

Settings should appear close to where they matter.

Example:

Transcript settings:

- Japanese font
- Font size
- Line height
- Furigana

belong near the reading workspace.

Not buried inside a global settings page.

---

## 4. Progressive Disclosure

Simple users should see simple choices.

Advanced users can discover deeper customization.

Example:

Basic:

```

Text Size

Small
Medium
Large

```

Advanced:

```

Font family
Line height
Sentence width
Character spacing

```

The interface grows with the learner.

---

# Settings Categories

The product organizes settings into five groups.

```

Learning Environment

↓

Reading

↓

Playback

↓

Language

↓

Account & System

```

---

# Learning Environment Settings

Controls how the study space feels.

Examples:

- Study atmosphere
- Workspace density
- Focus mode behavior
- Companion presence
- Ambient effects

---

# Study Atmosphere

Atmosphere is not a theme.

It is an emotional environment.

Examples:

- Evening Study
- Coffee Shop
- Rainy Day
- Quiet Library
- Spring Morning
- Summer Night

Changing atmosphere affects:

- background temperature
- blur
- shadow softness
- ambient motion
- subtle particles

It does not change:

- usability
- contrast
- information hierarchy

---

# Reading Settings

Reading is the primary customization area.

The learner spends most of their time reading Japanese.

Therefore reading settings should be easy to access.

---

## Typography

Options:

- Japanese font
- Font size
- Line height
- Sentence width
- Character spacing

The goal:

Long comfortable reading sessions.

---

## Furigana

Supported states:

```

Always

Adaptive

Hidden

```

### Always

Every kanji displays furigana.

Best for beginners.

---

### Adaptive

Furigana appears based on learner knowledge.

Best default.

---

### Hidden

Pure Japanese reading experience.

Best for immersion.

---

## Translation

Supported states:

```

Always Visible

Tap To Reveal

Hidden

```

---

## Translation Language

Options:

- Vietnamese
- English
- Japanese explanation

The selected language should persist.

---

# Playback Settings

Controls listening comfort.

---

## Playback Speed

Options:

- 0.5x
- 0.75x
- 1x
- 1.25x
- Custom

The default should remain natural.

Speed adjustment exists for learning support, not optimization.

---

## Auto Pause

Controls sentence practice behavior.

Options:

On

Off

Useful for:

- shadowing
- pronunciation practice
- detailed listening

---

## Loop Behavior

Options:

- Current sentence
- Current paragraph
- None

Avoid exposing unnecessary technical loop controls.

---

# Language Settings

Controls interface language and learning language.

---

## Interface Language

Examples:

- Vietnamese
- English
- Japanese

---

## Learning Language

Currently:

Japanese

Future:

Expandable architecture.

---

## Romaji

Supported states:

```

On

Off

```

Default:

Off after beginner onboarding.

Romaji should support learning.

Never become a permanent replacement for Japanese reading.

---

# Companion Settings

The Companion is a presence, not a notification system.

Settings should preserve that philosophy.

---

## Companion Presence

Options:

```

Present

Quiet

Minimal

```

---

### Present

Companion may appear in appropriate spaces.

---

### Quiet

Companion exists but speaks rarely.

---

### Minimal

Companion remains mostly invisible.

---

## Companion Reflections

Controls reflective moments.

Options:

- Allow reflections
- Reduce reflections
- Disable reflections

Never:

"Enable rewards"

"Enable motivation"

The Companion does not optimize engagement.

---

# AI Settings

AI is a capability layer.

It should never redefine the Companion.

---

## AI Features

Options:

- AI explanations
- AI reflection
- AI suggestions

---

## AI Transparency

Users should understand when AI is involved.

However:

Avoid technical explanations.

Do not expose:

- model names
- providers
- infrastructure
- API concepts

The learner interacts with the experience.

Not the technology.

---

# Interface Settings

Controls visual comfort.

---

## Density

Options:

```

Comfortable

Compact

```

Default:

Comfortable.

The product prioritizes calm reading.

---

## Motion

Options:

```

Full Motion

Reduced Motion

```

Accessibility support.

---

## Contrast

Options:

- Default
- Higher contrast

Never sacrifice readability.

---

# Settings Placement

Settings appear in three places.

---

# Contextual Settings

Preferred.

Example:

Reading settings inside transcript workspace.

Playback settings inside player controls.

---

# Workspace Drawer Settings

Used for temporary adjustments.

Examples:

- Subtitle style
- Furigana
- Translation

---

# Global Settings Screen

Used for:

- Account
- Preferences
- Privacy
- Subscription
- Device settings

Not for frequent learning adjustments.

---

# Setting Interaction Pattern

The standard interaction:

```

Open setting

↓

Adjust value

↓

Environment changes immediately

↓

Continue learning

```

No interruption.

---

# Controls

Preferred controls:

## Segmented Controls

For small choices.

Example:

```

Always | Adaptive | Hidden

```

---

## Sliders

For continuous adjustments.

Example:

Font size.

---

## Toggles

For binary states.

Example:

Romaji.

---

## Cards

For emotional environments.

Example:

Study atmosphere.

---

# Persistence

Settings should remember:

- user preference
- device preference when appropriate
- workspace preference

The learner should feel:

"This is my place."

Not:

"I have to configure it again."

---

# Default Settings

Defaults should favor comfort.

Recommended defaults:

```

Theme:
Premium Dark

Furigana:
Adaptive

Translation:
Tap To Reveal

Romaji:
Off

Density:
Comfortable

Motion:
Enabled

Companion:
Quiet Presence

```

---

# Reset Behavior

Reset should exist.

However, it should not be prominent.

When resetting:

- explain what will change
- allow confirmation
- preserve account data

Resetting preferences should never reset learning history.

---

# Dangerous Settings Separation

Never mix:

Learning preferences

with:

Account destruction

or:

Data deletion

These belong in separate areas.

---

# Mobile Adaptation

Desktop:

Settings can appear as panels.

Tablet:

Settings appear as drawers.

Mobile:

Settings become full-screen sheets.

The mental model remains identical.

---

# Accessibility

Settings must support:

- keyboard navigation
- screen readers
- reduced motion
- high contrast
- clear labels

Never communicate settings only through icons.

---

# Anti-Patterns

Do not create hundreds of settings.

Do not expose technical options.

Do not require saving changes.

Do not hide important reading settings.

Do not make personalization feel like configuration work.

Do not put every option into one giant settings page.

Do not use settings to compensate for poor default design.

---

# Emotional Goal

Settings should feel like adjusting a room before studying.

Changing the lamp.

Moving the chair.

Opening the window.

Choosing the atmosphere.

The learner is not managing software.

They are creating the environment where their Japanese journey continues.
```
