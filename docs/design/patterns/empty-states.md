# Empty States Pattern

> **Status:** Approved  
> **Layer:** Experience Architecture  
> **Applies to:** Entire Product  
> **Related:** `feedback-patterns.md`, `companion-patterns.md`, `screen-video-library.md`, `screen-dashboard.md`, `microcopy-guidelines.md`, `emotion-design.md`, `docs/design/design-reconciliation.md`

---

# Philosophy

Empty states are not missing content.

They are moments of possibility.

An empty screen should never make the learner feel:

> "There is nothing here."

Instead, it should communicate:

> "This is where your journey will begin."

An empty state is the first page of a story.

---

# Core Principle

> **An empty space should invite the learner forward, not remind them of what is missing.**

The absence of content is an opportunity to create direction, curiosity, and confidence.

---

# Design Principles

## 1. Never Celebrate Emptiness

Empty states are not achievements.

Avoid, specifically in an empty state itself:

- Congratulations
- Achievement animations
- Rewards
- Gamification language (XP counters, streak prompts, badge unlocks)

This is scoped to the empty state moment, not a product-wide ban — Gamification (XP, Streak,
Leaderboard, Badge) is a real, shipped layer per G1–G3
(`docs/design/design-reconciliation.md` §3, Layer Responsibility Rule) that simply never speaks
through an empty state's voice.

The goal is not to make emptiness exciting.

The goal is to make the next step obvious.

---

## 2. Guide Without Pressure

The learner should understand what they can do next.

Never create:

- urgency
- guilt
- artificial motivation
- fear of missing out

Avoid:

"You haven't studied today."

"You have no saved items."

"Your progress is empty."

Prefer:

"Your first saved sentence will appear here."

---

## 3. Preserve Emotional Warmth

Empty states are moments where the product introduces itself.

They should feel:

- calm
- welcoming
- personal
- hopeful

Not:

- broken
- incomplete
- abandoned

---

# Empty State Structure

Every empty state follows:

```

Atmosphere

↓

Explanation

↓

Possible Action

↓

Future Promise

```

---

# 1. Atmosphere

Create emotional context.

Possible elements:

- illustration
- Companion presence
- subtle animation
- meaningful empty space

The visual should communicate:

"There is a place waiting for your journey."

---

# 2. Explanation

Explain why the space is empty.

Never blame the learner.

Avoid:

"You haven't created anything yet."

Prefer:

"Your saved sentences will appear here."

---

# 3. Possible Action

Offer a natural next step.

Examples:

- Start learning
- Explore videos
- Save your first sentence
- Begin your first shadowing session

Only one primary action.

---

# 4. Future Promise

Show what will eventually exist.

Examples:

"Your favorite expressions will be collected here."

"Your learning memories will appear here."

"Your journey will slowly become a story."

---

# Empty State Types

---

# First-Time Empty State

## Situation

The learner has never used a feature.

Examples:

- Empty library
- Empty Journal
- Empty bookmarks
- Empty mining collection

---

## Goal

Introduce possibility.

---

## Pattern

```

Welcome

↓

Explain purpose

↓

Show first action

```

Example:

Library:

"Your Japanese journey begins with your first story."

---

# User-Created Empty State

## Situation

The learner used the feature before but removed everything.

Examples:

- Deleted notes
- Cleared bookmarks

---

## Goal

Respect their choice.

Do not imply loss.

---

Pattern:

"The space is ready whenever you discover something worth keeping."

---

# Learning Progress Empty State

## Situation

No progress exists.

Examples:

- Dashboard before first lesson
- Review system before first cards

---

## Goal

Create a starting point.

Avoid showing:

0%

0 days

No activity

These numbers create judgment.

---

# Search Empty State

## Situation

No results found.

---

## Goal

Help exploration.

Avoid:

"No results."

Only.

---

Preferred structure:

```

Search understanding

↓

Possible alternatives

↓

Related discovery

```

Example:

"We couldn't find that title."

"Try searching with Japanese characters or explore popular stories."

---

# Library Empty State

## Situation

No videos saved.

---

## Design

The library should feel like a shelf waiting for books.

Possible elements:

- empty bookshelf metaphor
- Companion quietly waiting
- first recommendation

Never:

"Your library is empty."

---

# Bookmark Empty State

## Situation

No saved sentences.

---

## Design

Explain the future value.

Example:

"Save sentences that feel worth remembering. They will return here."

---

# Mining Empty State

## Situation

No mined sentences.

---

## Design

Connect to discovery.

Example:

"Interesting expressions you collect during your journey will become your personal language library."

---

# Journal Empty State

## Situation

No memories recorded.

---

## Design

This is a special emotional surface.

The empty Journal should feel like a blank first page.

The Companion may appear quietly.

Not speaking.

Simply waiting.

---

# Companion Rules

Empty states are one of the few places where Companion presence is appropriate.

Allowed:

- sitting quietly
- observing
- inviting gently
- representing a beginning

Not allowed:

- interrupting
- giving motivational speeches
- creating artificial attachment
- asking for daily return

The Companion is a witness.

Not a coach.

---

# Visual Language

Preferred:

- generous whitespace
- warm surfaces
- soft illustrations
- subtle motion
- calm typography

Avoid:

- large warning icons
- sad illustrations
- error colors
- empty dashboards
- giant buttons

---

# Motion

Empty state animation should feel alive but quiet.

Examples:

- Companion breathing
- pages gently moving
- subtle ambient particles
- slow floating elements

Avoid:

- bouncing objects
- attention-seeking animation
- repeated loops

---

# Error Empty States

Not all empty states are positive.

Sometimes content cannot load.

These should be separated from normal empty states.

---

## Content Error

Example:

Video unavailable.

Pattern:

```

Acknowledge

↓

Explain simply

↓

Offer recovery

```

Never blame the learner.

---

# Permission Empty States

Examples:

- Microphone unavailable
- Download permission missing

Explain:

Why it matters.

What happens next.

How to continue.

---

# Copy Principles

Good empty state copy:

- short
- human
- clear
- forward-looking

Avoid:

- technical language
- system messages
- passive voice

---

# Good Examples

```

Your first shadowing memory will appear here.

Start with a scene you love.

```
```

This shelf is waiting for your first story.

Explore videos and create your collection.

```
```

Nothing saved yet.

When a sentence feels special, keep it here.

```

---

# Bad Examples

```

No data found.

```
```

You have not completed any lessons.

```
```

Your progress is 0%.

```
```

Nothing here. Start now!

```

---

# Accessibility

Empty states must support:

- screen readers
- keyboard navigation
- clear action labels
- sufficient contrast

Illustrations should support meaning.

They should never be the only explanation.

---

# Anti-Patterns

Do not treat empty states as placeholders.

Do not use empty states to promote unrelated features.

Do not add multiple actions.

Do not pressure users to fill empty spaces.

Do not use shame-based language.

Do not make the Companion responsible for every empty moment.

Do not turn the first experience into a sales screen.

---

# Emotional Goal

An empty state should feel like entering a quiet room before anyone arrives.

The room is not empty because something is missing.

The room is waiting.

The first sentence.

The first video.

The first memory.

The first step of a Japanese journey.

The learner should feel:

> **"This place will slowly become mine."**
