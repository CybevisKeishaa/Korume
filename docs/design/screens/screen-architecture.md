# Screen Architecture

> **Purpose**
>
> This document defines the architectural philosophy behind every screen in Nihongo Cinema.
>
> It is not a UI specification.
>
> It is a guide for designing learning spaces.
>
> Every future screen should inherit these principles before introducing its own layout, interactions or visual identity.

---

# Core Philosophy

Nihongo Cinema is not designed as a collection of application pages.

It is designed as a collection of places.

Users are not navigating software.

They are moving between environments designed for different moments in their learning journey.

Every screen should feel like entering a new room with its own atmosphere, rhythm and purpose.

A learner should never think:

> "Which feature am I using?"

Instead they should naturally feel:

> "Where am I studying now?"

---

# Learning Spaces

Every screen belongs to one emotional category.

| Space | Purpose | Feeling |
|---------|----------|----------|
| Arrival | Orient yourself | Calm, welcoming |
| Discovery | Explore new content | Curious |
| Understanding | Read and understand | Focused |
| Practice | Listen, shadow, repeat | Immersive |
| Collection | Save valuable knowledge | Organized |
| Reflection | Review experiences | Personal |
| Preparation | Configure your environment | Quiet |

Screens should be designed around emotional intention before visual appearance.

---

# The Three-Layer Architecture

Every screen is built from three layers.

```
Environment

↓

Workspace

↓

Tools
```

The relationship between these layers never changes.

The Environment creates atmosphere.

The Workspace defines the learning activity.

The Tools quietly support the workspace.

Never reverse this hierarchy.

---

# Layer 1 — Environment

The Environment is responsible for emotion.

It exists behind the interface rather than inside it.

It should never compete for attention.

Its purpose is to create comfort during long study sessions.

The Environment may include:

- subtle background lighting
- gentle gradients
- soft depth
- warm surfaces
- atmospheric blur
- ambient particles
- breathing motion
- color temperature
- seasonal study atmospheres

The Environment never contains functionality.

It should feel like the room rather than the furniture.

---

# Layer 2 — Workspace

The Workspace is the heart of every screen.

Every screen has exactly one primary workspace.

Examples:

Dashboard

→ Learning Overview

Video Detail

→ Reading Workspace

Shadowing

→ Transcript Workspace

Journal

→ Reflection Workspace

Mining

→ Vocabulary Collection

Settings

→ Configuration Workspace

The Workspace should visually occupy most of the screen.

Everything else exists to support it.

---

# Layer 3 — Tools

Tools provide assistance.

They should never dominate the experience.

Whenever possible, tools should appear through:

- bottom drawers
- floating panels
- popovers
- sheets
- contextual menus
- expandable sections

Avoid permanent panels unless they are essential to the current activity.

Users should always feel that the workspace owns the screen.

---

# Reading First

Nihongo Cinema is fundamentally a reading application enhanced with media.

Whenever a layout decision must be made, prioritize readability over controls.

If there is a conflict between:

larger buttons

or

more visible transcript

the transcript always wins.

Japanese text is one of the primary visual elements of the product.

Treat it with the same care as photography in a premium magazine.

---

# Workspace Priority

Every screen should answer one question:

> What is the learner trying to experience right now?

Not:

> Which feature are they using?

Examples:

The Shadowing screen is about speaking.

The Video Detail screen is about understanding.

The Journal is about remembering.

The Dashboard is about arriving.

Design should reinforce this intention.

---

# Progressive Disclosure

Complexity should appear gradually.

The default experience should feel calm and approachable.

Additional information should only appear when requested.

For example:

Transcript

↓

Dictionary

↓

Grammar

↓

AI explanation

↓

Advanced analysis

The learner should discover depth naturally instead of facing it immediately.

---

# Adaptive Workspace

Learning is personal.

No single layout fits everyone.

Major workspaces should support adaptation.

Examples include:

- resizable split views
- collapsible navigation
- expandable transcript
- picture-in-picture video
- bottom utility drawers
- focus mode
- reading mode
- immersive mode

Adaptation should feel continuous rather than switching between separate pages.

---

# Space Allocation

Primary workspaces should typically occupy between 60% and 80% of the available screen.

Secondary tools should remain visually lighter.

Navigation should consume as little space as possible during active study.

The interface should never resemble a dashboard filled with equally important sections.

Visual hierarchy should always be obvious.

---

# Navigation Philosophy

Navigation exists to help learners arrive.

It should disappear once learning begins.

During focused study:

- navigation may collapse
- sidebars may hide
- controls become quieter
- reading surfaces expand

The interface should reward concentration with more space.

---

# Consistent Screen Structure

Although every screen serves a different purpose, they all follow a similar architectural rhythm.

```
Quiet Header

↓

Primary Workspace

↓

Contextual Tools

↓

Ambient Feedback
```

This rhythm creates familiarity without making every page look identical.

---

# Contextual Tools

Information should appear where it is needed.

Avoid forcing learners to travel across the interface.

Examples:

Vocabulary appears beside selected text.

Grammar opens beneath the current sentence.

Playback controls remain near listening activities.

Reading settings stay close to the reading surface.

Tools should feel attached to the activity rather than attached to the application.

---

# Focus States

Every learning screen should support varying levels of concentration.

Typical progression:

Normal

↓

Focused

↓

Immersive

↓

Minimal

The transition between these states should be smooth.

No page reloads.

No abrupt layout changes.

No interruption.

The workspace quietly adapts.

---

# Visual Rhythm

Interfaces should breathe.

Create rhythm through:

- generous spacing
- typography
- surface hierarchy
- empty space
- alignment
- consistent margins

Avoid solving hierarchy with color alone.

Whitespace is a design element.

Silence is part of the interface.

---

# Motion Philosophy

Motion exists for orientation.

Never for entertainment.

Animations should resemble:

- breathing
- paper
- fabric
- light
- gentle wind

Avoid:

- bouncing
- spring-heavy motion
- exaggerated easing
- attention-grabbing transitions

If users notice the animation more than the content, it is too strong.

---

# Emotional Hierarchy

Every screen should communicate one primary emotion.

| Screen | Emotional Purpose |
|---------|-------------------|
| Dashboard | Arrival |
| Videos Library | Discovery |
| Video Detail | Understanding |
| Shadowing | Practice |
| Mining | Collection |
| Journal | Reflection |
| Settings | Preparation |

Visual design should reinforce these emotional roles.

---

# Shared Design Rules

Across the product:

- Calm over excitement.
- Reading over clicking.
- Presence over notifications.
- Comfort over density.
- Focus over productivity.
- Trust over gamification.
- Beauty over decoration.
- Atmosphere over visual effects.
- Consistency over novelty.

These principles should guide every design decision.

---

# What We Avoid

Nihongo Cinema intentionally avoids patterns commonly found in productivity software.

Avoid:

- dashboard-first layouts
- KPI-heavy interfaces
- enterprise SaaS aesthetics
- bright notification colors
- excessive floating widgets
- permanent inspector panels
- aggressive onboarding
- visual clutter

Gamification (XP, streak, leaderboard, badge) is a real, shipped product layer
(G1–G3, `docs/design/design-reconciliation.md` §3) — it is not avoided. What is avoided is the
Companion narrating it, and any single screen treating gamification numbers as the primary
emotional signal instead of the Learning Journey itself. See the Layer Responsibility Rule
(`docs/design/design-reconciliation.md` §3).

Learning should feel peaceful rather than optimized for engagement — that is a statement about
tone, not a ban on the Gamification Layer existing.

---

# Success Criteria

A screen is successful if someone enjoys staying inside it even when they are not actively interacting.

The interface should quietly encourage longer, more comfortable study sessions.

When a learner opens Nihongo Cinema, they should feel:

> "This is a beautiful place to study Japanese."

Rather than:

> "This is another language learning application."

Every future screen should inherit this feeling before introducing its own identity.