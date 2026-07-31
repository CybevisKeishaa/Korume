# Shadowing Hub
## The Learner's Home for Shadowing

> **Status:** Approved
> Replaces `screen-video-library.md` per `docs/superpowers/specs/2026-07-29-shadowing-hub-consolidation-design.md` §0/§5 and `docs/superpowers/specs/2026-07-31-shadowing-hub-lesson-workspace-design.md` §5. **The primary product domain is Shadowing, not Video** — this screen is
> not "a library that also does other things"; it is the learner's home for the Shadowing domain,
> answering "What should I practice next?" through browse/discover, search/filter, recommendations
> — **and** continuing an unfinished session, seeing weekly progress, resuming where they left off.
> Session-continuity is core to the Hub's identity, not a feature bolted onto a library.

> Every lesson is not content.
>
> Every lesson is a story waiting to become part of someone's Japanese journey.

The Shadowing Hub is not a media browser.

It is not YouTube.

It is not Netflix.

It is not a file manager.

It is a calm, personal home for the learner's Shadowing practice — a place to pick up an unfinished
lesson, discover a new one, and see how the week is going, all at once.

The learner should feel like browsing a beautiful bookshelf rather than searching through a video database.

---

# Emotional Goal

Opening the Hub should evoke curiosity.

The learner should naturally slow down.

Browsing should feel enjoyable even before choosing a lesson.

Every lesson should invite exploration rather than compete for attention.

---

# Core Philosophy

The Hub exists to answer one simple question:

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
┌─────────────────────────────────────────────────────────────┬──────────────────┐
│ Quiet Header                                                │                  │
├─────────────────────────────────────────────────────────────┤ Current Session  │
│ Search                                                      │ & This Week's    │
├─────────────────────────────────────────────────────────────┤ Record           │
│ Collections                                                 │                  │
├─────────────────────────────────────────────────────────────┤                  │
│                                                             │                  │
│ Story Grid                                                  │                  │
│                                                             │                  │
│                                                             │                  │
└─────────────────────────────────────────────────────────────┴──────────────────┘
```

Large margins.

Generous spacing.

No dashboard widgets except the Current Session rail below — that rail is Gamification-Layer
continuity content, deliberately shown here (see § Current Session & This Week's Record).

No information overload.

---

# Current Session & This Week's Record

A right-rail section, always visible on desktop, present because the Hub owns learning *continuity*
— not to be confused with the Dashboard, which owns long-term *progress*
(`docs/design/design-reconciliation.md` §3, Hub/Dashboard split):

> **Shadowing Hub owns learning continuity** — current session (in progress, resume action), weekly
> record framed as "how is my practice going right now," the immediate next step.
>
> **Dashboard owns long-term progress** — arrival/overview, historical trends, milestones over time,
> the broader relationship with the whole product, not just Shadowing.

Contains

Current session (lesson in progress, one-tap Resume)

This week's record — streak, goal, hours studied

Both are Gamification-Layer content (`docs/design/design-reconciliation.md` §3) — this is a
deliberate exception to the Hub's otherwise neutral-browsing stance, unlike the old Video Library.

## Layer Responsibility

| Layer | Allowed | Forbidden |
|---|---|---|
| Gamification | Current session, Streak, Weekly goal, Hours studied | — |
| Companion | Memory, Reflection, Journey meaning (empty-state only, see § Companion) | Reacting to XP/streak/leaderboard changes |

---

# Header

Minimal.

Contains

Shadowing Hub

Create Lesson

Search

Display Options

Nothing else.

No statistics.

No counters.

No notification badges.

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

The grid is entirely collection-driven, ordered by each collection's stored display order — no
hardcoded sections in code (`docs/superpowers/specs/2026-07-31-shadowing-hub-lesson-workspace-design.md` §5). Three computed (virtual) collections are always prepended, in this order:

Continue Learning

My Lessons

Recently Added

Then editorial collections follow in their stored order (Featured typically first among those).
Editorial examples

Slice of Life

Daily Conversation

Anime

Drama

Movies

JLPT N3

A Lesson can belong to any number of editorial collections simultaneously — the Netflix model, not
a single-category filter. "Favorites" / "Saved for Later" are themselves computed collections (a
query, not a stored row), same as Continue Learning/My Lessons/Recently Added above.

Each collection feels like a bookshelf.

Not a filter menu.

---

# My Lessons

The learner's own `PRIVATE` creations — every lesson they've made via Create Lesson, or dedup-joined
from someone else's (`docs/superpowers/specs/2026-07-31-shadowing-hub-lesson-workspace-design.md`
§1.3, §5). This is a top-level, always-visible section, not a filter chip buried behind a menu —
learners return to their own imports far more than to random discovery.

Displayed exactly like any other collection row: Story Cards, same treatment, same spacing. What
makes it different is placement (always second, right after Continue Learning) and permanence (it
is never empty of intent — even a freshly-created lesson with no transcript yet belongs here).

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

A small 🔒 badge appears when the lesson's `library_access` is `PLUS` and the viewer is Free —
visible, never hidden, per `business-model.md` §5 "show don't tell"
(`docs/superpowers/specs/2026-07-31-shadowing-hub-lesson-workspace-design.md` §5). No other badge
communicates access tier; `FREE` lessons carry no badge at all.

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
This screen simply doesn't repeat them here: it shows continuity instead, because the Hub's
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

# Create Lesson Experience

Creating a lesson should feel like adding a new book to a shelf.

Not uploading a file. "Import Video" is retired product-facing language — this action is **Create
Lesson** everywhere it appears in Hub copy
(`docs/superpowers/specs/2026-07-31-shadowing-hub-lesson-workspace-design.md` §2, §7).

The modal shows quota remaining before any input (e.g. "2/3 lessons left this month" / "Unlimited"
for Plus), so a later block is never a surprise (§2.1 of that spec).

The interface should ask

Paste YouTube URL

After pasting, show a quiet three-line processing state — not the technical steps behind it:

```
Preparing lesson...
✓ Finding transcript
✓ Building lesson
✓ Ready to study
```

A dedup hit (someone already prepared this exact lesson) skips straight to a delight line instead of
a technical one:

```
Great news! Someone has already prepared this lesson.
✓ Added instantly
✓ Ready to study
```

A no-caption failure offers a way forward, never a dead end:

```
Preparing lesson...
✓ Finding transcript
✕ No transcript found
  [ Generate with AI 🔒 Plus ]   [ Try another video ]
```

Avoid technical terminology throughout.

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

# Empty Hub

An empty Hub should inspire curiosity.

Example

> Every learning journey begins with one story.

Offer

Create your first Lesson

Browse sample lessons

The screen should feel hopeful,

never empty.

This empty state is one of L9b (D3)'s four shipped Companion anchors — Available today
(`docs/design/design-reconciliation.md` §6, listed there as "Shadowing Hub (empty state)"). Unlike
the non-empty view below (Planned), Companion may appear here now; see
`docs/design/patterns/companion-patterns.md` § Declare Anchor for the presence-level and copy
conventions it follows.

---

# Companion

○ Planned — chưa implement. L9b (D3) chỉ có 4 anchor (Dashboard, `/journal`, Shadowing Hub empty
state, Mining deck empty state); Shadowing Hub non-empty state is not one of them yet
(`docs/design/design-reconciliation.md` §6). The behavior below describes the target design once
this anchor is built, not current behavior. Removing the previous Video Detail page does not
transfer its responsibilities here either — Companion provides context only where it already would
have, never to backfill a removed screen (`docs/design/design-reconciliation.md` §2).

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

The Hub should always feel familiar when the learner returns.

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

The learner opens the Hub and immediately thinks

> "Which story do I want to spend time with today?"

They should never think

> "Which file should I open?"

If the screen feels like YouTube, Netflix, or a media manager,

the design has failed.