# screen-mining.md

> **Status:** Approved

> The Mining page is not a vocabulary database.
>
> It is a personal collection of language moments.
>
> Every word exists because the learner once stopped, became curious, and decided:
>
> "I want to remember this."

---

# Purpose

Mining is where learning becomes ownership.

Unlike a dictionary,
which contains every word,

Mining only contains

**my words.**

It should feel closer to

- a handwritten vocabulary notebook
- a bookshelf of collected memories
- a personal archive

than

- Excel
- Anki browser
- database tables

The learner should enjoy browsing words even without reviewing them.

---

# Emotional Goal

The learner should feel:

"I've been building this collection for a long time."

not

"I have 2,147 flashcards."

Mining celebrates accumulation,
not pressure.

---

# Core Philosophy

Every vocabulary item has a story.

The learner should always remember:

- where it came from
- which scene it appeared in
- why they saved it

The context is often more valuable than the definition.

Context should always be visible.

---

# Layout

Desktop layout

```

┌─────────────────────────────────────────────────────────────┐
│ Quiet Header                                                │
├─────────────────────────────────────────────────────────────┤
│ Smart Filters                                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Vocabulary Collection                                       │
│                                                             │
│                                                             │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ Optional Detail Panel                                       │
└─────────────────────────────────────────────────────────────┘

```

Unlike traditional vocabulary pages,

there is **only one primary focus**:

the collection.

---

# Quiet Header

Contains

Back

Mining

Total saved words

Search

View Mode

Import / Export

Settings

No statistics.

No review counts.

No overdue cards.

No red badges.

---

# Smart Filters

Filters should feel like bookshelves.

Examples

All

Recent

Movies

Anime

Drama

JLPT

Favorites

Difficult

Mastered

Unsorted

Never display dozens of filter pills.

Collapse naturally.

---

# Search

Search should feel immediate.

Support

Japanese

Kana

Meaning

Romaji

Example sentence

Source title

Tag

Everything filters instantly.

No loading screen.

---

# View Modes

Support multiple ways of enjoying the collection.

## Card View (Default)

Large cards.

Comfortable spacing.

Shows

Word

Reading

Meaning

Context sentence

Source

Saved date

Tiny bookmark

Feels like browsing memories.

---

## Compact View

Higher density.

Useful for experienced learners.

Still maintain generous spacing.

Never resemble spreadsheets.

---

## Reading Shelf

Organize vocabulary into beautiful shelves.

Examples

Today's discoveries

This week's words

Recently revisited

From Your Favorite Movie

Feels like a bookshelf.

---

# Vocabulary Card

Each card should contain

Large Japanese word

Reading

Meaning

Sentence preview

Source thumbnail

Difficulty

Personal note (optional)

Date saved

Everything should breathe.

The sentence is more important than metadata.

---

# Context First

Every vocabulary card should answer

Where did this come from?

Display

Movie

Episode

Timestamp

Original sentence

The learner should be able to remember the scene.

---

# Expanded Detail

Clicking a word expands

not navigates.

The collection remains visible.

Expansion reveals

Meaning

Grammar

Pitch Accent

Example Sentences

Notes

Personal Memories

AI Explanation

Related Words

Everything appears progressively.

---

# Learning Memory

Each word may include

Why was it saved?

Example

"I kept hearing this in slice-of-life anime."

"This expression feels beautiful."

These memories make Mining personal.

---

# Collections

Allow learners to create collections.

Examples

Restaurant Japanese

N5 Grammar

Expressions I Love

Office Vocabulary

Your Name

Ghibli

Travel

Collections feel like folders on a bookshelf.

Not tags.

---

# Tags

Tags remain lightweight.

Examples

Verb

Expression

Keigo

Slang

Daily Life

Emotion

Travel

Weather

Do not overwhelm.

---

# Sorting

Sort naturally.

Recently Added

Oldest

Alphabetical

Frequency

JLPT

Most Reviewed

Random

Favorites

---

# Companion

○ Planned for the general collection view — chưa implement. L9b (D3) only shipped the Mining
**empty-state** anchor; this section describes the non-empty browse/collection view, which is not
yet an anchor (`docs/design/design-reconciliation.md` §6).

**Scope note:** this section is about the Mining *browse/collection* screen only. The Mining
*Review Session* (`components/video-player/mining-review-session.tsx`) is a separate, distinct
route and an active acquisition loop — Companion is ✕ Not Supported there
(`docs/design/design-reconciliation.md` §4), same as Shadowing/Review.

Companion rarely appears.

Occasionally

✨

"You've collected many words from this series."

"This expression appears again later."

"It may pair well with another phrase."

Then disappears.

No suggestions list.

No AI chat.

---

# Review Entry

Mining itself is not review.

However,

every word offers

Review

Shadow Again

Open Scene

Open Video

Everything is secondary.

The collection remains primary.

---

# Empty State

When no words exist

Large breathing room.

Small illustration.

Message

Your vocabulary collection is still empty.

Every interesting word you discover will quietly live here.

---

# Saving Animation

When saving from Shadowing

Tiny sparkle

↓

Card softly appears

↓

Settles naturally

Never toast.

Never celebration.

---

# Multi Select

Selecting multiple words reveals

Move

Add Tag

Collection

Export

Delete

Nothing else changes.

Avoid floating toolbars.

---

# Export

Support exporting

CSV

Anki

JSON

Markdown

Export feels like taking a notebook home.

---

# AI Integration

AI should help organize,

not replace.

Examples

Suggest Collection

Merge Similar Words

Generate Summary

Find Related Expressions

Everything optional.

Never automatic.

---

# Visual Language

Premium dark mode.

Warm charcoal background.

Soft gray surfaces.

Rounded cards.

Gentle borders.

Large spacing.

Minimal shadows.

Japanese typography receives the highest visual priority.

---

# Motion

Cards gently lift.

Expansion unfolds like paper.

Filtering softly fades.

Searching progressively updates.

No sudden movement.

No bouncing.

---

# Things To Avoid

Do not build

Anki Browser

Excel Table

Database UI

Enterprise Data Grid

Admin Panel

Dense Lists

Everything should remain

warm

personal

slow

comfortable.

---

# Relationship With Other Screens

Mining receives vocabulary from

- Shadowing Detail
- Video Detail
- Dictionary
- AI Suggestions

Mining sends learners back to

- Shadowing
- Original Scene
- Review

Mining is a living archive,

not the final destination.

---

# Emotional Goal

When opening Mining,

the learner should feel

"I've built my own Japanese library."

not

"I have hundreds of flashcards to finish."

The collection should feel like a bookshelf filled with memories,

where every word reminds the learner of a moment they genuinely enjoyed.