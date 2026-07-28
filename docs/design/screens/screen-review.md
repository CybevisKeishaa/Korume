# Review
## Revisiting Memories

> **Status:** Approved

> Review is not an exam.
>
> It is a quiet return to conversations you've already lived through.

The Review experience should never feel like doing homework.

It should feel like revisiting familiar moments from stories the learner already loves.

Instead of testing memory,

the application gently reconnects the learner with meaningful language.

---

# Emotional Goal

The learner should feel

"I remember this."

instead of

"I hope I don't get this wrong."

Review should reduce anxiety,

not create pressure.

Every session should feel calm,

comfortable,

and slightly nostalgic.

---

# Core Philosophy

Traditional SRS asks

> "Can you remember this?"

Nihongo Cinema asks

> "Would you like to revisit this?"

The experience encourages recognition before recall.

Learning should feel like meeting an old friend.

---

# Learning Principles

Review is based on context.

Not isolated words.

Not disconnected flashcards.

Everything originates from

- a movie
- an anime
- a drama
- a conversation
- a sentence the learner once cared about

Context is memory.

Memory is understanding.

---

# Layout

Desktop

```
┌──────────────────────────────────────────────────────────────┐
│ Quiet Header                                                 │
├──────────────────────────────────────────────────────────────┤
│ Welcome Back                                                 │
├──────────────────────────────────────────────────────────────┤
│ Current Memory                                               │
│                                                              │
│ Japanese Sentence                                            │
│                                                              │
│ Playback                                                     │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│ Reflection Actions                                           │
├──────────────────────────────────────────────────────────────┤
│ Upcoming Memories                                            │
└──────────────────────────────────────────────────────────────┘
```

The interface should resemble a reading experience,

not a flashcard application.

---

# Header

Minimal.

Contains

- Back
- Review
- Collection selector
- Search
- Settings

No session timer.

No daily target.

No streak counter.

No motivational banners.

---

# Welcome Back

Instead of saying

"You have 42 cards due."

Say

Welcome back.

These conversations have been waiting for you.

or

Let's revisit a few familiar moments.

The learner should feel invited,

never obligated.

---

# Memory Card

The center of the experience.

A Memory Card represents a complete learning moment.

Contains

Japanese sentence

Optional audio

Source

Character

Scene

Tiny timestamp

Everything feels like reopening a page in a journal.

---

# Progressive Reveal

Information appears gradually.

Step 1

Japanese only.

↓

Step 2

Replay audio.

↓

Step 3

Reveal translation.

↓

Step 4

Vocabulary.

↓

Step 5

Grammar.

The learner chooses when to reveal information.

Nothing appears all at once.

---

# Audio First

Listening is encouraged before reading.

A gentle play button sits beneath the sentence.

No waveform.

No technical controls.

Just

Play again.

---

# Reflection Actions

Replace traditional grading.

Instead of

Again

Hard

Good

Easy

Use emotional language.

Examples

I remembered immediately.

It came back after listening.

I'd like to revisit this again.

Let's save this for another day.

The system still calculates spaced repetition,

but the learner never thinks about algorithms.

---

# Vocabulary Context

When expanding vocabulary,

show words inside the original sentence.

Avoid isolated dictionary tables.

Each word feels connected to the story.

---

# Grammar Context

Grammar appears as short reading notes.

Examples

This casual ending appears often between friends.

This expression sounds softer than its dictionary form.

Grammar should feel conversational,

never academic.

---

# Multiple Review Types

The learner can choose different ways to revisit.

## Sentence Review

Read.

Listen.

Remember.

---

## Shadowing Review

Replay.

Repeat aloud.

Continue naturally.

---

## Vocabulary Review

Focus only on saved expressions.

Always linked to their original sentence.

---

## Listening Review

Audio first.

Transcript hidden.

Translation optional.

Ideal for advanced learners.

---

## Story Review

Revisit an entire dialogue.

Several connected sentences appear together.

The learner remembers conversations,

not fragments.

---

# Review Collections

Instead of decks,

use meaningful collections.

Examples

Recently Saved

Favorite Expressions

Studio Ghibli

Daily Conversation

Workplace Japanese

Travel

JLPT N4

Each collection feels like a bookshelf,

not a database.

---

# Gentle Progress

Avoid

Cards Due

Completion %

Accuracy

Daily Quota

Instead communicate

You've revisited three familiar conversations today.

One expression is becoming effortless.

This dialogue is beginning to feel natural.

Progress should sound human.

---

# Companion

✕ Not Supported. Review is an active acquisition loop
(`docs/design/design-reconciliation.md` §4, Learning Loop Boundary) — Companion is Dormant
throughout Review, the same as Shadowing. It does not appear during the session; any reflection it
has about a completed review surfaces later, on a surface where Companion is Available (Dashboard,
`/journal`) — never inside Review itself.

---

# Ambient Atmosphere

Review respects the current Study Atmosphere.

Rainy Day

Quiet Library

Coffee Shop

Evening Study

The atmosphere remains consistent.

The learner should never feel transported into another application.

---

# Motion

Memory cards gently fade.

Translations unfold naturally.

Vocabulary expands like opening notebook pages.

Audio controls softly illuminate.

Every interaction should resemble turning pages.

No bounce.

No celebration.

No rapid transitions.

---

# Empty State

When there is nothing scheduled,

avoid

Congratulations!

You're done!

Instead show

Your memories are resting.

Why not revisit a favorite story?

Offer

Browse Library

Open Journal

Continue Shadowing

Review never truly ends.

There is always another story worth revisiting.

---

# Success Feedback

Quiet.

Examples

Memory revisited.

Saved for another day.

Added to favorites.

The feedback fades naturally.

No confetti.

No sound effects.

No achievement popups.

---

# Accessibility

Review inherits all reading preferences.

- Font
- Font size
- Furigana
- Translation language
- Reading width
- Color temperature

The learner never has to configure the experience twice.

---

# Success Criteria

A learner finishes a review session and feels

> "That was a pleasant conversation."

instead of

> "I completed my flashcards."

If Review feels like Anki,

Quizlet,

or a test,

the design has failed.

If it feels like quietly returning to stories that have become part of the learner's life,

the design is successful.