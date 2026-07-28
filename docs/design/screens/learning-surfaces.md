# Learning Surfaces

> Purpose
>
> This document defines the primary learning surfaces used throughout Nihongo Cinema.
>
> A learning surface is the canvas where a learner interacts with knowledge.
>
> Unlike cards, panels or containers, a learning surface represents a meaningful learning activity.
>
> Every screen should be composed from one or more learning surfaces.

---

# Philosophy

Most software is built from components.

Nihongo Cinema is built from learning surfaces.

A button performs an action.

A card groups information.

A surface creates an experience.

The learner should never feel surrounded by interface elements.

Instead, they should feel surrounded by places designed for learning.

---

# Surface Hierarchy

Not every surface has equal importance.

Every screen should contain:

One Primary Surface

Optionally one Secondary Surface

Supporting Utility Surfaces

Ambient Surfaces

The hierarchy should always remain obvious.

---

# Primary Learning Surface

The Primary Surface occupies the emotional center of the screen.

It answers:

> What is the learner doing right now?

Examples

Reading

Shadowing

Writing

Reviewing

Reflecting

Collecting

The Primary Surface usually occupies

60–80%

of the available viewport.

Nothing should visually compete with it.

---

# Secondary Surface

A Secondary Surface provides supporting context.

Examples

Video beside transcript

Dictionary beside reading

Collection beside preview

Notes beside journal

A Secondary Surface should never distract from the primary activity.

Its purpose is context.

Not attention.

---

# Utility Surface

Utility Surfaces provide temporary tools.

Examples

Playback

Grammar

Mining

Vocabulary

AI

Settings

Notes

Characteristics

Appears when needed.

Disappears when finished.

Never permanently owns screen space.

---

# Ambient Surface

Ambient Surfaces create emotional presence.

Examples

Background lighting

Study atmosphere

Companion notes

Seasonal effects

Soft particles

Subtle motion

They provide no functionality.

Only atmosphere.

---

---

# Surface Library

---

# Reading Surface

Purpose

Understand Japanese naturally.

The Reading Surface is the heart of Nihongo Cinema.

It should feel closer to

Apple Books

Kindle

Readwise Reader

than

Google Docs

Word

Subtitle editors

Characteristics

Large typography

Comfortable margins

Generous line spacing

Minimal controls

Reading rhythm

Soft highlights

Large whitespace

Supports

Japanese

Furigana

Translation

Vocabulary

Grammar

Selection

Bookmarks

Mining

Notes

without becoming visually crowded.

---

Reading States

Normal

↓

Focused

↓

Immersive

↓

Analysis

The transition between states should never interrupt reading.

---

# Transcript Surface

A specialized Reading Surface.

Purpose

Synchronize listening with reading.

Characteristics

Current sentence

Soft emphasis

Previous sentences

Slightly faded

Future sentences

Neutral

Scrolling should resemble turning pages rather than subtitle playback.

The learner should feel they are reading a story.

Not watching captions.

---

# Shadowing Surface

Purpose

Practice speaking.

Based on the Transcript Surface.

Additional behaviors

Current sentence focus

Loop support

Pronunciation indicators

Playback synchronization

Sentence repetition

Reading remains visually dominant.

Playback quietly supports it.

---

# Collection Surface

Purpose

Organize knowledge.

Examples

Mining

Bookmarks

Vocabulary

Saved Sentences

Grammar

Unlike spreadsheets,

collections should feel curated.

Imagine browsing

a bookshelf

a card catalog

or

a notebook

rather than a database.

---

Collection Principles

Comfortable spacing.

Clear grouping.

Visual rhythm.

Useful previews.

No overwhelming tables by default.

---

# Reflection Surface

Purpose

Help learners remember.

Used by

Journal

Learning history

Daily memories

AI companion memories

Characteristics

Narrative first.

Chronological rhythm.

Personal feeling.

Soft surfaces.

Warm spacing.

Entries should resemble journal pages.

Not timeline widgets.

---

# Discovery Surface

Purpose

Explore learning material.

Used by

Videos

Courses

Recommendations

Collections

Characteristics

Encourage curiosity.

Visual browsing.

Good thumbnail rhythm.

Generous spacing.

Minimal metadata.

Avoid overwhelming learners with information density.

---

# Overview Surface

Purpose

Help learners orient themselves.

Used by

Dashboard

Home

Characteristics

Small number of meaningful sections.

Learning suggestions.

Continue learning.

Recent memories.

Saved items.

Upcoming review.

The learner should immediately know

where they left off

and

where to continue.

Avoid

KPIs

Statistics

Charts

Productivity metrics

---

# Companion Surface

Purpose

Create quiet companionship.

The Companion should never feel like

a chatbot

or

an AI assistant.

Instead,

it behaves like another learner sitting nearby.

This surface is only available where the Companion has an anchor (Available or Planned per
`docs/design/design-reconciliation.md` §6) — never inside an active acquisition loop (§4). It does
not apply to Shadowing.

Examples

"This sentence appears often."

"I quietly saved this."

The Companion rarely speaks.

Silence is acceptable.

---

# Media Surface

Purpose

Provide context.

Examples

Video

Audio

Animation

Reference image

The Media Surface is intentionally secondary.

Especially during learning.

Rules

Never dominate the screen.

Support learning.

Not entertainment.

In Shadowing,

the transcript always has higher priority.

---

# Utility Surface

Utility Surfaces provide interaction.

Examples

Playback

Settings

Dictionary

Grammar

Notes

AI

Characteristics

Temporary.

Contextual.

Expandable.

Dismissible.

They should feel attached to the current activity.

Not attached to the application.

---

# Surface Behaviors

Every surface supports a shared interaction language.

---

Expand

Surfaces may temporarily occupy more space.

Reading

↓

Fullscreen

Video

↓

Picture-in-Picture

Collection

↓

Expanded Browser

---

Collapse

Supporting surfaces may quietly disappear.

The primary learning activity expands naturally.

Nothing should abruptly hide.

---

Focus

A surface may enter Focus Mode.

Everything unrelated fades.

The learner remains inside the same screen.

No navigation.

No page transition.

---

Context Awareness

Surfaces react to activity.

Selecting a word

↓

Dictionary appears.

Playing audio

↓

Playback controls become active.

Mining vocabulary

↓

Collection updates quietly.

Avoid asking learners where tools are.

Bring tools closer to the activity.

---

# Surface Composition

Screens are composed from multiple surfaces.

Dashboard

Overview Surface

+

Discovery Surface

+

Reflection Surface

---

Videos Library

Discovery Surface

+

Collection Surface

---

Video Detail

Reading Surface

+

Media Surface

+

Utility Surface

---

Shadowing

Shadowing Surface

+

Media Surface

+

Bottom Utility Surface

Companion Surface is intentionally absent here — Shadowing is a Not Supported active acquisition
loop (`docs/design/design-reconciliation.md` §4, Learning Loop Boundary).

---

Journal

Reflection Surface

+

Companion Surface

---

Mining

Collection Surface

+

Utility Surface

---

# Surface Transitions

Moving between surfaces should feel natural.

Examples

Reading

↓

Analysis

Dictionary gently slides upward.

Grammar expands below.

Transcript remains stable.

---

Watching

↓

Shadowing

Video becomes smaller.

Transcript expands.

Playback floats.

The learner never loses context.

---

Collection

↓

Detail

The selected item grows naturally.

Avoid opening separate pages whenever possible.

---

# Surface Atmosphere

Every surface carries its own emotional tone.

| Surface | Emotional Tone |
|----------|----------------|
| Reading | Calm |
| Transcript | Focused |
| Shadowing | Present |
| Discovery | Curious |
| Collection | Organized |
| Reflection | Personal |
| Companion | Quiet |
| Media | Contextual |
| Utility | Invisible |

Atmosphere should be expressed through

spacing

typography

lighting

motion

surface depth

rather than color alone.

---

# Shared Rules

Across all learning surfaces

Prioritize content over interface.

Prioritize whitespace over separators.

Prioritize rhythm over density.

Prioritize reading over clicking.

Prioritize continuity over page changes.

Prioritize atmosphere over decoration.

Every surface should quietly encourage learners to stay a little longer.

---

# Success Criteria

A successful learning surface disappears during use.

The learner no longer notices the interface.

They notice

the sentence,

the sound,

the story,

their own voice,

and the feeling of slowly understanding Japanese.

At that moment,

the surface has fulfilled its purpose.