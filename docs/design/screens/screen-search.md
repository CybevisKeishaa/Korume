# screen-search.md

> **Status:** Approved
> **Related:** `docs/design/patterns/companion-patterns.md`, `docs/design/screens/navigation-system.md`, `docs/design/design-reconciliation.md`

> Search is not a command.
>
> It is a conversation with everything the learner has experienced.
>
> The learner should never feel like they are querying a database.
>
> They should feel like they are remembering.

---

# Purpose

Search is the universal gateway to Korume.

It should allow learners to instantly find:

- Videos
- Sentences
- Vocabulary
- Grammar
- Notes
- Companion memories
- Journal entries
- Collections

without needing to know where something lives.

The learner thinks:

> "I remember hearing this somewhere..."

Search quietly helps them find it.

---

# Emotional Goal

Search should evoke

curiosity

memory

discovery

instead of

precision

or administration.

It should feel closer to

Spotlight Search

Raycast

Arc Browser Command Bar

Readwise Search

than

Google Search

or

database filtering.

---

# Core Philosophy

Search is memory.

Every result represents

a learning moment,

not merely

stored information.

Whenever possible,

results should preserve context.

Never reduce learning into isolated data.

---

# Entry Points

Search should be available from anywhere.

Desktop

• Global shortcut

⌘K / Ctrl+K

• Header Search

• Sidebar (a persistent search affordance within the Nav Column chrome — not a separate top-level
nav item; see `docs/design/screens/navigation-system.md`, whose 14-item inventory has no dedicated
"Search" entry because this affordance lives inside that chrome, not beside it)

• Empty States

Opening search should feel instantaneous.

---

# Layout

Desktop Overlay

```

             ┌──────────────────────────────┐
             │ Search                       │
             ├──────────────────────────────┤
             │                              │
             │ Results                      │
             │                              │
             │                              │
             │                              │
             └──────────────────────────────┘

```

The background softly blurs.

The learner never loses context.

Search appears

not as a page,

but as a temporary study layer.

---

# Search Input

Large.

Comfortable.

Centered.

Placeholder

Search anything...

Examples

Japanese word

English meaning

Vietnamese meaning

Grammar

Movie title

Character

Sentence

Tag

Collection

No borders shouting for attention.

---

# Search Scope

Search automatically understands intent.

Example

猫

↓

Vocabulary

Sentences

Videos

Grammar

Notes

Collections

Everything appears together.

The learner should never choose a category first.

---

# Unified Results

Instead of tabs,

results appear grouped naturally.

Example

Vocabulary

Sentences

Videos

Grammar

Journal

Collections

Every group is collapsible.

---

# Result Cards

Every result should include

Primary content

Secondary context

Tiny metadata

Relevant source

Never show long technical metadata.

Context matters more.

---

# Vocabulary Result

Shows

Word

Reading

Meaning

Source sentence

Source video

Collection

Difficulty

The sentence preview is always visible.

---

# Sentence Result

Shows

Japanese sentence

Translation

Source

Timestamp

Speaker (if available)

Tiny waveform icon

Clicking opens

Shadowing Practice

at exactly that sentence.

---

# Video Result

Shows

Poster

Title

Episode

Duration

Progress (playback/watch progress on this specific video — not the Gamification Layer's Progress
metric, `docs/design/design-reconciliation.md` §3; Search has no Gamification Layer presence, see
Gamification Behavior below)

Tiny atmosphere

Avoid large thumbnails.

---

# Grammar Result

Shows

Grammar Pattern

Meaning

JLPT

Example sentence

Source

AI explanation available

Keep explanations hidden until opened.

---

# Journal Result

Shows

Title

Date

Preview

Mood

Related video

Feels like reopening a memory.

---

# Companion Result

○ Planned — chưa implement. Search is not one of L9b (D3)'s four shipped Companion anchors (Dashboard,
`/journal`, Shadowing Hub empty state, Mining deck empty state) — see
`docs/design/design-reconciliation.md` §6. The behavior below describes the target design once this
anchor is built, not current behavior.

Presence level once built: Observe (`docs/design/design-reconciliation.md` §5) — Companion surfaces a
memory as one result type among several, it does not address the learner directly. Search is not an
active acquisition loop, so the Learning Loop Boundary (§4) does not restrict it here.

Very subtle.

Examples

"You once struggled with this expression."

"This appeared several times."

"I remember you bookmarked this."

No avatar.

No AI branding.

---

# Instant Preview

Hovering a result

shows

small preview panel

without navigation.

Examples

Sentence

↓

Translation

↓

Video timestamp

↓

Play button

Everything happens gently.

---

# Search Ranking

Search favors

Personal relevance

↓

Recently studied

↓

Frequently visited

↓

Exact match

↓

Similar meaning

↓

AI semantic similarity

Personal history is more important than popularity.

---

# Semantic Search

The learner does not need exact words.

Examples

Search

food

↓

食べる

ご飯

料理

レストラン

Search

sad

↓

悲しい

切ない

寂しい

Search should understand meaning.

---

# Filters

Filters appear only when needed.

Examples

Videos

Sentences

Vocabulary

Grammar

JLPT

Collections

Date

Avoid exposing dozens of filters immediately.

---

# Recent Searches

Shown when search opens.

Examples

昨日

N3 passive

Your Name

Train expressions

Recent searches quietly fade over time.

No permanent history feeling.

---

# Suggestions

Suggestions feel like memories.

Instead of

Popular Searches

Show

Continue yesterday's study

Words from your latest movie

Recently bookmarked expressions

Sentences you saved

---

# Empty Search

Before typing

Large breathing room.

Suggestions

Recent learning

Collections

Favorite movies

No clutter.

---

# No Results

Message

Nothing matched this search.

Maybe try another word,

or search using Japanese.

Offer gentle suggestions.

Never display

0 Results Found

---

# User State

Idle — no query yet (see Empty Search below).

Typing — query in progress, results update as the learner types.

Reviewing — results shown, learner scanning or hovering (see Instant Preview).

Navigating away — learner opens a result; Search itself does not change state, the destination screen
takes over.

---

# Loading States

Search should never show a blocking spinner.

Instead:

soft skeleton result rows

gentle fade-in as each result type resolves (Vocabulary, Sentence, Video, Grammar, Journal, Companion
may each resolve at slightly different times — semantic search takes longer than exact match)

Never wait for everything before showing anything.

The learner should never feel like the interface stalled.

---

# Success States

There is no separate "success" moment for Search itself — finding a matching result is what Reviewing
already looks like. Bookmarking or opening a result from Search inherits that action's own success
treatment (see `docs/design/screens/screen-states.md` § Success) rather than Search defining its own.

---

# Error States

If search (especially semantic search) fails or times out, fall back to exact keyword matching
silently — never surface a technical error for a search failure.

Only if there are truly no results at all does the "No Results" empty state above apply; a backend
failure should look identical to "still searching," never like an alarm.

---

# Gamification Behavior

Search has no Gamification Layer presence. It never displays XP, streak, leaderboard rank, or any
other Gamification-owned signal (`docs/design/design-reconciliation.md` §3) — Search is a wayfinding
surface, not a status surface. If a future result type surfaces something like "most-searched this
week," that would be a Gamification-owned addition and must be labeled as such, not folded into
Search's own memory-driven voice.

---

# Keyboard Navigation

Everything should be keyboard-first.

↑ ↓

Move

Enter

Open

Esc

Close

Tab

Next group

Fast.

Invisible.

Natural.

---

# Search Actions

Every result supports quick actions.

Open

Bookmark

Add to Collection

Copy

Open Video

Open Shadowing

Reveal in Mining

Actions appear quietly.

Never crowd the interface.

---

# Motion

Opening

Soft fade

↓

Blur

↓

Input receives focus

Searching

Results progressively appear

Closing

Everything softly disappears

No zoom.

No bounce.

No dramatic transitions.

---

# Visual Language

Premium dark mode.

Soft charcoal.

Warm gray surfaces.

Rounded result cards.

Large spacing.

Minimal shadows.

Typography remains the visual focus.

Search should feel calm,

even with hundreds of results.

---

# Things To Avoid

Do not imitate

Google Search

IDE Command Palette

Admin Search

Database Explorer

Developer Tool

Enterprise Search

Search should always feel

human

personal

memory-driven.

---

# Relationship With Other Screens

Search connects every screen.

Dashboard

↓

Shadowing Hub

↓

Shadowing Practice

↓

Mining

↓

Journal

↓

Settings (target design — no `/settings` route ships today, see
`docs/design/screens/navigation-system.md` § Settings Entry Point)

The learner should never wonder

where something is located.

Search already knows.

---

# Emotional Goal

When opening Search,

the learner should feel

"I'm looking for something I once experienced."

not

"I'm searching inside software."

The best search experience is one that quietly reconnects the learner

with meaningful moments in their Japanese journey.