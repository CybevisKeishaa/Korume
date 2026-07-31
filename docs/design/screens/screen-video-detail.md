# Video Detail
## The Learning Overview

> **Status:** Deprecated
> The standalone Video Detail concept was removed
> (`docs/superpowers/specs/2026-07-29-shadowing-hub-consolidation-design.md` §0, §5): opening a
> lesson from the Shadowing Hub now enters the learning environment (Shadowing Practice) directly,
> no intermediate detail page. Essential metadata (title, JLPT level, source) already lives on the
> Hub's lesson card and the Lesson header; the rest is explicitly **not** transferred to Companion as
> a replacement responsibility (`docs/design/design-reconciliation.md` §2). **This screen is
> retained only for historical documentation and migration traceability. It must not be used as the basis for future UI work.**

> Every video is the beginning of a learning journey.

This page introduces a learning experience.

It does not present a piece of media.

The learner should feel invited to begin studying rather than encouraged to watch.

---

# Emotional Goal

Before pressing Play, the learner should already feel curious.

The page should create anticipation.

It should feel similar to opening the first page of a beautiful book.

Everything communicates

"This lesson is waiting for you."

instead of

"Watch this video."

---

# Primary Purpose

Help the learner understand

- what this lesson contains
- whether it matches their level
- how they want to study it

without overwhelming them with information.

---

# Layout

Desktop

```
┌──────────────────────────────────────────────────────────────┐
│ Quiet Header                                                 │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ Hero Video                                                   │
│                                                              │
├───────────────────────┬──────────────────────────────────────┤
│ Lesson Overview       │ Learning Actions                     │
│                       │                                      │
├───────────────────────┴──────────────────────────────────────┤
│ Learning Journey                                       │
├──────────────────────────────────────────────────────────────┤
│ Transcript Preview                                          │
└──────────────────────────────────────────────────────────────┘
```

Everything scrolls naturally.

No sticky cards except the learning actions.

---

# Hero Video

Large enough to establish context.

Not cinema sized.

Rounded corners.

Soft shadow.

Elegant poster frame before playback.

Minimal controls.

The learner should immediately understand

"This is a lesson."

not

"This is YouTube."

---

# Learning Actions

Primary

Continue Learning

Secondary

Start Shadowing

Reading Mode

Vocabulary

Download Transcript

Bookmark

Actions are calm.

Large touch targets.

No bright colors.

No oversized buttons.

---

# Lesson Overview

Display

Title

Series

Episode

JLPT estimation

Estimated study duration

Subtitle availability

Difficulty

Everything presented as quiet metadata.

Avoid colorful badges.

Avoid icons everywhere.

---

# Learning Journey

Instead of statistics,

show the learner's relationship with this lesson.

Examples

Started yesterday

You saved 12 expressions

Last practiced 3 days ago

Shadowed 18 sentences

Notes available

The language should feel personal.

Never administrative.

---

# Transcript Preview

Display the first several sentences.

Beautiful typography.

Comfortable spacing.

Japanese is emphasized.

Translation is secondary.

The preview invites reading.

Hovering a sentence

softly highlights it.

No editing feeling.

---

# Vocabulary Preview

Instead of tables,

show natural vocabulary cards.

Each card contains

Word

Reading

Meaning

Frequency

One example sentence

Cards resemble bookmarks,

not database rows.

---

# Grammar Preview

Display only the most meaningful grammar points.

Avoid exhaustive lists.

Each grammar point appears as

small study notes.

The learner should think

"I'll understand this."

instead of

"This looks difficult."

---

# AI Insights

AI never dominates.

Examples

"This lesson repeats casual speech."

"You may already know several expressions here."

"This episode is excellent for shadowing."

Maximum one insight visible.

Everything else stays hidden.

---

# Companion

○ Planned — chưa implement. L9b (D3) chỉ có 4 anchor (Dashboard, `/journal`, Video Library empty
state, Mining deck empty state); Video Detail is not one of them yet
(`docs/design/design-reconciliation.md` §6). The behavior below describes the target design once
this anchor is built, not current behavior.

Appears only occasionally.

Examples

"This conversation feels emotional."

"This scene contains useful daily expressions."

The Companion never starts conversations.

It simply leaves thoughtful notes.

---

# Progress

Gamification numbers (XP, Percent bars, Achievements) are not avoided at the product level — they
belong to the Gamification Layer, not to this understanding surface
(`docs/design/design-reconciliation.md` §3). This screen simply communicates the learner's
relationship with the lesson instead:

Examples

Recently studied

Favorite lesson

Returning after a break

Still exploring

The feeling should remain encouraging.

---

# Motion

Hero image slowly fades.

Cards softly appear while scrolling.

Transcript preview gently slides upward.

Nothing pops.

Nothing bounces.

Everything feels patient.

---

# Empty States

If subtitles do not exist

Show

"This lesson is waiting to become readable."

Offer

Generate subtitles

Generate AI transcript

instead of displaying missing data.

---

# Accessibility

Reading preferences inherit from Shadowing Workspace.

Typography

Language

Translation

Furigana

remain consistent across screens.

---

# Success Criteria

The learner should think

"I can't wait to study this."

before pressing Play.

If the page feels like a typical video platform,

the design has failed.