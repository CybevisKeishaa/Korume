# Video Library
## The Story Collection

> **Status:** Approved

> Every video is not content.
>
> Every video is a story waiting to become part of someone's Japanese journey.

The Video Library is not a media browser.

It is not YouTube.

It is not Netflix.

It is not a file manager.

It is a calm, personal collection of stories curated for learning Japanese.

The learner should feel like browsing a beautiful bookshelf rather than searching through a video database.

---

# Emotional Goal

Opening the Library should evoke curiosity.

The learner should naturally slow down.

Browsing should feel enjoyable even before choosing a lesson.

Every video should invite exploration rather than compete for attention.

---

# Core Philosophy

The library exists to answer one simple question:

> "What story do I want to spend time with today?"

Not

> "Which video should I consume?"

---

# Information Hierarchy

Priority

Story

↓

Learning Experience

↓

Metadata

↓

Actions

The emotional identity of each lesson is more important than its technical details.

---

# Layout

Desktop

```
┌─────────────────────────────────────────────────────────────┐
│ Quiet Header                                                │
├─────────────────────────────────────────────────────────────┤
│ Search                                                      │
├─────────────────────────────────────────────────────────────┤
│ Collections                                                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Story Grid                                                  │
│                                                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

Large margins.

Generous spacing.

No dashboard widgets.

No information overload.

---

# Header

Minimal.

Contains

Library

Import Video

Search

Display Options

Nothing else.

No statistics.

No counters.

No badges.

---

# Search

Search should feel lightweight.

Placeholder

Search by title, expression, anime, movie or topic...

The search bar is elegant and quiet.

Rounded.

Soft border.

Warm surface.

No giant search interface.

---

# Collections

Collections replace traditional filters.

Instead of technical categories,

present meaningful groups.

Examples

Continue Learning

Recently Added

Slice of Life

Daily Conversation

Anime

Drama

Movies

Favorites

Saved for Later

Each collection feels like a bookshelf.

Not a filter menu.

---

# Story Grid

Every lesson appears as a Story Card.

Cards breathe.

They are never compressed.

Each card contains

Poster

Title

Series

Small learning summary

Estimated study time

Subtitle availability

Bookmark

Hover reveals

Continue Learning

Open Lesson

Start Shadowing

The interface never feels button-heavy.

---

# Story Card

Cards should resemble beautifully arranged books.

Large artwork.

Comfortable typography.

Soft corners.

Subtle elevation.

Tiny metadata.

Nothing noisy.

Hover creates

slight elevation

gentle glow

soft scaling

No dramatic movement.

---

# Story Metadata

Instead of emphasizing duration,

emphasize learning value.

Examples

Great for casual conversation

Excellent listening practice

Rich emotional vocabulary

Simple everyday expressions

Metadata explains

why this lesson is meaningful.

Not merely

what it contains.

---

# Progress

Gamification numbers (XP, Level) are not avoided at the product level — they belong to the
Gamification Layer, not to this discovery surface (`docs/design/design-reconciliation.md` §3).
This screen simply doesn't repeat them here: it shows continuity instead, because the Library's
job is discovery, not status.

Show

Continue from sentence 18

Recently practiced

Finished shadowing

Saved expressions

Learning feels continuous rather than measured.

---

# Thumbnail Philosophy

Artwork is the emotional entry point.

Thumbnails should be large enough to appreciate.

Rounded corners.

Soft shadow.

No heavy overlays.

Minimal text.

The artwork should breathe.

---

# Continue Learning

Lessons already studied receive a subtle visual cue.

A warm accent line.

A small bookmark.

A remembered position.

Never large progress bars.

Never bright completion rings.

The learner should recognize familiar lessons naturally.

---

# Import Experience

Importing a video should feel like adding a new book to a shelf.

Not uploading a file.

The interface should ask

Paste YouTube URL

or

Import Local Video

After importing,

show a quiet processing state.

Examples

Preparing subtitles...

Understanding dialogue...

Creating your learning space...

Avoid technical terminology.

---

# Sorting

Sorting is intentionally simple.

Recently Studied

Recently Added

Alphabetical

Favorites

Recommended

Never expose dozens of sorting options.

---

# Display Modes

Support multiple browsing styles.

## Gallery

Large artwork.

Most emotional.

Ideal default.

---

## Comfortable

Medium cards.

Balanced information.

---

## Compact

Smaller cards.

Suitable for large libraries.

Even in Compact mode,

maintain generous spacing.

Never resemble a spreadsheet.

---

# Empty Library

An empty library should inspire curiosity.

Example

> Every learning journey begins with one story.

Offer

Import your first YouTube video

Browse sample lessons

The screen should feel hopeful,

never empty.

---

# Companion

○ Planned — chưa implement. L9b (D3) chỉ có 4 anchor (Dashboard, `/journal`, Video Library empty
state, Mining deck empty state); Video Library non-empty state is not one of them yet
(`docs/design/design-reconciliation.md` §6). The behavior below describes the target design once
this anchor is built, not current behavior.

The Companion quietly appears only when meaningful.

Examples

"This lesson matches the expressions you've been saving."

"You haven't visited this story in a while."

"This movie contains beautiful everyday conversations."

No recommendations based on engagement.

Only thoughtful observations.

---

# Motion

Cards fade into place.

Hover gently lifts cards.

Collections slide naturally.

Search expands softly.

Scrolling resembles browsing a bookshelf.

No bounce.

No flashy transitions.

---

# Accessibility

Remember

Display mode

Sort order

Preferred collections

Reading preferences

across sessions.

The Library should always feel familiar when the learner returns.

---

# Responsive Behavior

## Wide Desktop

Five to six story cards per row.

Large artwork.

Generous spacing.

---

## Standard Desktop

Three to four cards per row.

Maintain comfortable reading rhythm.

---

## Tablet

Two cards per row.

Collections become horizontally scrollable.

---

## Mobile

Single-column layout.

Large artwork.

Search remains pinned.

Navigation becomes bottom navigation.

The emotional feeling should remain unchanged.

---

# Success Criteria

The learner opens the Library and immediately thinks

> "Which story do I want to spend time with today?"

They should never think

> "Which file should I open?"

If the screen feels like YouTube, Netflix, or a media manager,

the design has failed.