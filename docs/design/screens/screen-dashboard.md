# Dashboard
## The Learning Home

> **Status:** Approved

> The place that quietly welcomes the learner back.

This is not a productivity dashboard.

This is not a statistics page.

This is not an administration panel.

It is the front door of Korume.

Every time the learner returns, the interface should gently say

"Welcome back."

instead of

"You have unfinished work."

---

# Emotional Goal

Opening the Dashboard should feel like walking back into a familiar study room.

The learner immediately remembers

where they left off,

what they were learning,

and what they may enjoy next.

No pressure.

No urgency.

No guilt.

Only quiet invitation.

---

# Core Philosophy

The Dashboard exists for one purpose:

Help the learner begin studying within a few seconds.

Everything else is secondary.

---

# Layout

Desktop

```
┌─────────────────────────────────────────────────────┐
│ Welcome                                              │
├─────────────────────────────────────────────────────┤
│ Continue Learning                                    │
├─────────────────────────────────────────────────────┤
│ Recently Visited                                     │
├──────────────────────┬──────────────────────────────┤
│ Discover             │ Learning Memory              │
├──────────────────────┴──────────────────────────────┤
│ Gentle Activity Timeline                             │
└─────────────────────────────────────────────────────┘
```

Large breathing room.

No dense widgets.

No grid of statistics.

Scrolling should feel natural.

---

# Welcome Section

Instead of greetings based on time,

show contextual welcome.

Examples

Welcome back.

Continue where you stopped yesterday.

You were practicing casual conversations.

Ready for another quiet session?

The message changes naturally.

Never feels generated.

---

# Continue Learning

The most important section.

Only one lesson appears.

Large thumbnail.

Lesson title.

One-line summary.

Estimated remaining study time.

Primary button

Continue Learning

Secondary

Start Shadowing

Open Transcript

Nothing else competes with this section.

---

# Recently Visited

Horizontal collection.

Shows

Recently opened lessons

Journal entries

Saved transcripts

Mining collections

Everything appears as memories,

not history.

Cards feel like bookmarks.

---

# Discover

Instead of

Recommended videos,

present

Suggested learning journeys.

Examples

Continue your slice-of-life conversations.

Practice listening with slower dialogue.

Explore another Studio Ghibli film.

Each recommendation explains

why it may be enjoyable.

Never optimized for engagement.

Optimized for curiosity.

---

# Learning Memory

Instead of statistics,

surface meaningful moments.

Examples

You saved a beautiful expression yesterday.

You wrote a journal after watching Your Name.

You practiced this sentence several times.

The learner remembers experiences,

not numbers.

---

# Activity Timeline

A gentle chronological story.

Yesterday

Studied for 25 minutes.

Saved 4 expressions.

Practiced shadowing.

Three days ago

Finished your first dialogue.

Last week

Started learning from Spirited Away.

This timeline tells a story,

not a report.

---

# Progress

The Dashboard shows both layers side by side — each owns different information
(`docs/design/design-reconciliation.md` §3, Layer Responsibility Rule). Dashboard owns long-term
progress specifically — arrival/overview, historical trends, milestones over time — as distinct from
`screen-shadowing-hub.md`, which owns learning *continuity* (current session, weekly record); see
that file's own Layer Responsibility table for the Hub-side half of this split:

| Layer | Allowed | Forbidden |
|---|---|---|
| Gamification | XP, Streak, Progress, Goal completion | — |
| Companion | Memory, Reflection, Journey meaning | Reacting to XP/streak changes |

Gamification examples (shipped: `StreakCard`):

Bạn đã duy trì 12 ngày học liên tục.

Companion examples — never about the numbers:

Recently active

Returning after a short break

Building confidence

Exploring new expressions

Progress should feel human — that governs the Companion's voice, not whether the Gamification
Layer is visible.

---

# Companion

The Companion quietly appears in one corner.

Examples

"I noticed you've been enjoying conversation-heavy lessons."

"This phrase appears often in your saved sentences."

No suggestions.

No interruptions.

No chat window.

---

# Motion

Cards gently fade into view.

Continue Learning softly breathes.

Timeline scrolls naturally.

No bouncing.

No celebration effects.

Everything moves slowly.

---

# Empty State

When the learner is new,

the dashboard feels welcoming.

Example

Welcome.

Let's find your first Japanese story.

Offer

Import a YouTube video

Browse Library

No overwhelming onboarding.

---

# Returning Learner

The Dashboard should immediately answer

What should I study next?

without requiring decisions.

The learner should never feel lost.

---

# Success Criteria

The learner opens the Dashboard and thinks

"I know exactly where to continue."

The Dashboard feels like entering a familiar study room,

not opening an analytics application.