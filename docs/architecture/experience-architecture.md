# Experience Architecture

> Status: Living Design Document
>
> Defines reusable interaction patterns that connect Product Philosophy
> with feature implementation.
>
> This document intentionally does not describe UI layouts,
> database schema, or implementation details.

---

# Purpose

Every feature should feel like it belongs to the same product.

Not because it looks the same.

But because it behaves according to the same principles.

Experience Architecture is the layer between philosophy and implementation.

```
Product Philosophy
        ↓
Experience Architecture
        ↓
Feature Design
        ↓
Implementation
```

Instead of every feature inventing its own interaction rules,
shared concepts are defined once here and reused everywhere.

---

# Core Principle

> AI should not appear more often.
>
> AI should appear at the right moment.

Silence is also a response.

The system earns attention.

It never demands attention.

---

# Building Blocks

---

# Attention Window

## Definition

An Attention Window is a moment where the learner's cognitive load
naturally decreases.

Only during these moments may the system consider speaking.

Attention Windows are opportunities.

Never obligations.

---

## Examples

- replay finished
- learner pauses naturally
- transcript scrolling
- vocabulary tap
- beat completed
- video ended
- idle moment

---

## Non Examples

The following are NOT attention windows simply because they happened.

- user paused for 0.2s
- video buffering
- page loading
- animation finished

Attention is determined by the learner.

Not by the application.

---

# Learning Workspace

Learning Workspace is a mode where the learner is already interacting
with learning tools.

Examples:

- transcript
- vocabulary
- grammar
- shadowing controls

Ambient feedback is allowed.

Interruptions are not.

---

# Immersive Space

Fullscreen video.

Reading mode.

Focused speaking.

Immersive Space should remain visually quiet.

No Companion.

No popups.

No achievements.

No interruptions.

---

# Ambient Feedback

Ambient Feedback exists without requesting action.

Examples:

✓ tiny marker

✓ subtle fade

✓ progress indicator

✓ quiet memory saved

Not examples:

✗ dialog

✗ popup

✗ notification

✗ mandatory interaction

---

# Companion Presence Levels

Presence has different intensities.

## Level 0

Invisible.

Collects signals only.

Default state.

---

## Level 1

Silent acknowledgement.

Small bubble.

No CTA.

Disappears automatically.

---

## Level 2

Short reflection.

Appears only when emotionally meaningful.

Usually after completion.

---

## Level 3

Narrative moments.

Learning Wrapped.

Milestones.

Special memories.

Rare by design.

---

# Confidence Before Personalization

The system should never personalize with certainty
before enough evidence exists.

Every learner model has confidence.

Low confidence → observe.

Medium confidence → adapt gently.

High confidence → personalize.

---

# Progressive Understanding

The system never assumes it fully understands the learner.

Understanding grows slowly.

Confidence can decrease.

Traits may disappear.

The model is always revisable.

---

# Explainability

Every important adaptation should have a reason.

Not:

> Because AI decided.

Instead:

> Because you replayed these conversations often.

or

> Because pronunciation has improved consistently.

The learner should understand why.

---

# Contestability

The learner may disagree.

The system should treat every model as a hypothesis.

Never as objective truth.

---

# Calm Design

The product should reduce mental load.

Not increase stimulation.

Progress should feel inevitable.

Not addictive.

---

# Invisible Intelligence

The best AI often looks like no AI.

When the learner feels:

> "This app understands me."

instead of

> "Look how smart the AI is."

the system succeeded.

---

# Reusable Experience Patterns

The following patterns may be reused across features.

- Attention Window
- Silent Save
- Ambient Feedback
- Progressive Reveal
- Completion Reflection
- Narrative Summary
- Passive Personalization
- Memory Callback
- Confidence Gating

Future features should reuse these patterns instead of inventing new ones.

---

# Relationship to Other Documents

Product Philosophy

Defines values.

↓

Experience Architecture (this document)

Defines interaction mechanisms.

↓

Feature Roadmaps

Defines user-facing experiences.

↓

Implementation Specs

Defines technical behavior.

↓

Code

Implements the experience.