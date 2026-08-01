# Transcript Patterns

> **Status:** Approved  
> **Layer:** Experience Architecture  
> **Applies to:** Entire Product (Shadowing Practice, Listening Practice, Reading, Mining)  
> **Related:** `reading-patterns.md`, `video-patterns.md`, `docs/design/patterns/companion-patterns.md`, `docs/design/design-reconciliation.md`

> The transcript is the heart of Nihongo Cinema.

Everything else—video, AI, dictionary, grammar, playback, notes—exists to support the transcript.

The learner should always feel they are reading Japanese, not interacting with software.

---

# Core Principles

A transcript is not a subtitle.

A transcript is not a document.

A transcript is not a chat conversation.

It is a living reading surface that synchronizes listening, reading, speaking, and understanding.

Every design decision must protect this feeling.

---

# Visual Hierarchy

Only one sentence should become the visual anchor.

Hierarchy:

Current Sentence
↓

Nearby Context
↓

Everything Else

Attention should naturally flow downward while reading.

---

# Sentence States

Every sentence belongs to exactly one state.

## Current

The learner is actively reading or listening.

Visual characteristics

• warm background surface
• highest contrast
• optional soft glow
• full opacity

Never use bright colors.

---

## Previous

Already completed.

Remain visible.

Slightly faded.

Still readable.

The learner should never lose context.

---

## Upcoming

Neutral appearance.

No visual pressure.

The learner discovers them naturally.

---

## Saved

Quietly bookmarked.

Use only a subtle bookmark indicator.

Avoid bright labels.

---

## Difficult

Soft amber accent.

Gentle underline.

Tiny sparkle when first marked.

Never use warning colors.

Difficulty is guidance,

not failure.

---

# Sentence Layout

Each sentence is a self-contained reading block.

Recommended order

Japanese

↓

Furigana

↓

Translation

↓

Vocabulary (optional)

↓

Metadata (minimal)

Spacing is generous.

Sentences should never feel compressed.

---

# Japanese Typography

Japanese text is always the visual hero.

Recommendations

large size

comfortable spacing

high contrast

balanced line length

The learner should enjoy looking at the text.

---

# Furigana

Furigana supports reading.

It never dominates.

Rules

lighter weight

smaller size

higher spacing

easy to ignore for advanced learners

Support

Always

Adaptive

Hidden

Changes occur instantly.

---

# Translation

Translation is secondary information.

It should feel like a quiet companion.

Available modes

Hidden

Reveal on interaction

Always visible

Supported languages

Vietnamese

English

Japanese

Custom language (future)

Never allow translation to visually overpower Japanese.

---

# Vocabulary Integration

Vocabulary belongs inside the transcript.

Avoid opening new panels unnecessarily.

Preferred presentation

small inline chips

soft surfaces

minimal contrast

rounded edges

Vocabulary should resemble handwritten study notes — a visual comparison to a learner's own margin
notes, not a reference to Companion's "Handwritten Notes" (`docs/design/patterns/companion-patterns.md`
§ Companion Notes), which is a different, Companion-specific UI element.

---

# Playback Synchronization

Transcript should synchronize with audio naturally.

During playback

current sentence updates smoothly

scroll position gently follows

no abrupt jumps

The learner should never lose orientation.

---

# Active Reading Indicator

Avoid loud play indicators.

Instead use

soft left accent

warm glow

subtle breathing animation

quiet highlight

The learner should immediately know

where they are

without feeling interrupted.

---

# Selection

Selecting text should feel intentional.

Selection surface

soft

rounded

warm

Selection immediately enables contextual tools without opening large interfaces.

Examples

Dictionary

Mining

Grammar

Copy

Bookmark

Everything appears nearby.

Never cover surrounding sentences.

---

# AI Integration

AI never inserts itself into the transcript.

Instead

small contextual indicators appear beside the sentence.

Examples

✨ Common expression

✨ Natural pronunciation

✨ Difficult grammar

Selecting the note reveals more information.

Ignoring it changes nothing.

**This is not the Companion.** These are content-difficulty annotations attached to the transcript
itself — they appear during Shadowing, Listening Practice, and Reading precisely because those are Not
Supported for Companion (`docs/design/design-reconciliation.md` §4). The visual language happens to
share the `✨` mark with Companion's Handwritten Notes
(`docs/design/patterns/companion-patterns.md` § Companion Notes), but the two are unrelated systems
with different rules: this indicator has no presence-level or anchor-availability state
(`design-reconciliation.md` §5, §9) because it isn't Companion at all.

---

# Notes

Personal notes belong to the learner.

Notes appear as quiet annotations.

Think

margin notes in a favorite book.

Not sticky notes.

Not comments.

Not chat bubbles.

---

# Difficulty Indicators

Difficulty should encourage curiosity.

Never communicate failure.

Preferred visual language

warm underline

tiny amber dot

soft left border

gentle glow

Avoid

red

orange warning boxes

error icons

danger colors

---

# Transcript Modes

The transcript adapts to different study styles.

## Reading

Comfortable spacing.

Translation visible.

Vocabulary available.

Large context.

---

## Shadowing

Current sentence emphasized.

Playback synchronized.

Translation hidden.

Loop controls prioritized.

---

## Immersion

Japanese only.

Minimal interface.

Maximum focus.

Video becomes secondary.

---

## Analysis

Grammar

Vocabulary

Dictionary

AI explanations

appear in supporting surfaces.

The transcript remains visually dominant.

---

# Responsive Behavior

Transcript always has priority.

If space becomes limited

secondary panels collapse

video shrinks

navigation hides

Only after these adjustments should transcript width change.

The transcript should never become cramped.

---

# Motion

Sentence transitions should resemble turning pages.

Preferred animations

soft fade

slow elevation

gentle highlight transition

subtle scrolling

Never bounce.

Never flash.

Never shake.

---

# Emotional Goal

The learner should eventually forget there is a transcript component.

Instead,

they simply experience Japanese through reading, listening, and speaking.

The interface quietly disappears,

leaving only the language.