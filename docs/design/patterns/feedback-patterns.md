# Feedback Patterns

> **Status:** Approved  
> **Layer:** Learning Experience  
> **Applies to:** Entire Product  
> **Related:** `companion-patterns.md`, `study-modes.md`, `interaction-principles.md`, `motion-principles.md`, `microcopy-guidelines.md`

---

# Philosophy

Feedback exists to support learning.

It does not exist to judge performance.

Every piece of feedback should answer one question:

> **"What helps the learner continue?"**

Not:

> "How can we make this feel exciting?"

Nihongo Cinema values calm progress over emotional highs.

A learner should finish a session feeling:

> "I understand a little more than before."

Never:

> "I won."

Or:

> "I failed."

---

# Core Principles

## Learning Before Evaluation

Feedback should always explain before it evaluates.

Whenever possible:

```
Observation

↓

Understanding

↓

Suggestion

↓

Result
```

Instead of:

```
Wrong

↓

Try Again
```

Learning happens through understanding.

Not through judgement.

---

## Quiet Confidence

Good feedback should feel calm.

No dramatic celebrations.

No harsh criticism.

No emotional manipulation.

The interface should sound like an experienced study partner.

Not a game.

---

## Encourage Continuation

Every piece of feedback should naturally invite the learner to continue.

Never create pressure.

Never create urgency.

Never create guilt.

---

# Feedback Hierarchy

Different events deserve different levels of attention.

---

## Level 1 — Invisible Feedback

The ideal feedback.

The learner notices it subconsciously.

Examples:

- button hover
- sentence highlight
- bookmark saved
- playback state
- pronunciation waveform
- selected vocabulary

Visual language:

- subtle motion
- soft glow
- quiet color transition

No text required.

---

## Level 2 — Ambient Feedback

Acknowledges a completed action.

Examples:

- Note saved
- Mining card created
- Download finished
- Bookmark removed

Presentation:

Small toast.

Minimal animation.

Automatically disappears.

No confirmation dialog.

---

## Level 3 — Contextual Feedback

Provides learning-related information.

Examples:

- pronunciation improvement
- repeated grammar pattern
- difficult sentence
- adaptive furigana update

Presentation:

Integrated inside the current learning surface.

Never cover the transcript.

Never interrupt playback.

---

## Level 4 — Reflective Feedback

Reserved for meaningful learning moments.

Examples:

- first completed shadowing
- first finished movie
- long-term improvement
- review milestone

These moments belong to the Companion.

The learner is invited to pause briefly and appreciate the journey.

Reflection should feel personal.

Never spectacular.

---

# Positive Feedback

Positive feedback confirms progress.

It should never exaggerate achievement.

Avoid:

Amazing!

Excellent!!

Perfect!!!

Legendary!

Instead:

You pronounced this sentence more naturally.

Your rhythm became more consistent.

This expression now seems familiar.

You've practiced this dialogue several times.

These statements describe observable progress.

Not emotional reward.

---

# Correctness Feedback

Incorrect answers are opportunities.

Never use failure-oriented language.

Avoid:

Wrong.

Failed.

Incorrect.

Try again.

Instead:

Almost there.

Listen once more.

Pay attention to the final vowel.

This particle changes the meaning.

Let's compare the two pronunciations.

The learner should always know what to improve.

---

# Pronunciation Feedback

Pronunciation is gradual.

Never reduce speech to a single score.

Instead, break feedback into meaningful dimensions.

Possible dimensions:

- rhythm
- timing
- intonation
- vowel clarity
- consonant clarity
- fluency
- consistency

Feedback should emphasize trends rather than isolated attempts.

Example:

Your rhythm has become steadier across the last few attempts.

Not:

Score: 82

---

# AI Feedback

AI should explain.

Not evaluate.

Good AI feedback:

Explains why something sounds natural.

Highlights repeated patterns.

Suggests alternative expressions.

Connects today's lesson with previous learning.

Poor AI feedback:

Generic praise.

Artificial encouragement.

Overly emotional language.

The learner should feel understood.

Not flattered.

---

# Companion Feedback

The Companion never grades.

It witnesses.

Instead of saying:

> You did well.

It says:

> I remember when this sentence felt difficult.

Or:

> You've returned to this dialogue many times.

The Companion acknowledges the journey.

Never the score.

---

# Relationship With Gamification

Feedback (this document) and Gamification (XP/streak/leaderboard/badge) are two separate,
complementary layers — see `docs/design/design-reconciliation.md` §3.

Gamification owns: XP, Streak, Progress, Goal completion.

Feedback/Companion owns: Memory, Reflection, Journey meaning, in-the-moment learning signals.

Không: "Wow, bạn vừa nhận thêm 20 XP!" (feedback narrating a Gamification event)

Có: "Your rhythm became more consistent." (feedback describing observable learning progress)

The Gamification Layer is not banned from the product — it lives on Dashboard and Leaderboard. It
simply never speaks through this Feedback surface's voice.

---

# Visual Language

Positive progress

- warm white
- soft amber
- muted gold
- gentle glow

Needs attention

- warm underline
- amber border
- subtle emphasis

Avoid:

Bright green success.

Bright red failure.

Aggressive warning colors.

Learning should remain emotionally safe.

---

# Motion

Feedback animations should be slow.

Recommended duration:

150–250ms

Soft fade.

Gentle scale.

Minimal movement.

Avoid:

Bounce.

Shake.

Explosion.

Confetti.

Particle bursts.

Fast transitions.

---

# Sound

Sound feedback should be optional.

If enabled:

- soft
- warm
- low volume
- unobtrusive

Avoid arcade sounds.

Avoid achievement fanfares.

Avoid loud notification tones.

Silence should remain the default atmosphere.

---

# Toast Notifications

Use only for actions that complete immediately.

Examples:

Sentence bookmarked.

Mining card saved.

Download complete.

Note updated.

Toast duration:

2–3 seconds.

Position:

Away from the transcript reading area.

Never cover the active sentence.

---

# Inline Feedback

Preferred whenever possible.

Examples:

Vocabulary chip updates.

Grammar suggestions.

Pronunciation hints.

Reading preferences.

Inline feedback feels like part of the page.

Not an interruption.

---

# Empty Feedback

Sometimes the best feedback is none.

Examples:

The learner pauses.

The learner rereads a sentence.

The learner listens several times.

The learner remains silent.

The interface should resist the urge to react.

Silence is also feedback.

---

# Recovery Feedback

Errors should preserve confidence.

Instead of emphasizing mistakes:

Guide the next action.

Example:

Let's slow the playback slightly.

Or:

Try listening before speaking.

Recovery should always feel achievable.

---

# Accessibility

Feedback must never rely only on:

- color
- sound
- animation

Every meaningful change should also have:

- textual meaning
- semantic state
- screen reader support

The learning experience should remain inclusive.

---

# Anti-Patterns

Do not gamify moment-to-moment feedback (per-answer points popups, mini score animations).

Do not celebrate every small action.

Do not punish incorrect answers.

Do not interrupt concentration with popups.

Do not let this feedback layer duplicate or restate what the Gamification Layer already shows — XP,
streak, and leaderboard rank exist and are correct (`docs/design/design-reconciliation.md` §3). This
surface stays calm regardless of what the Gamification Layer displays elsewhere.

Do not display giant success banners.

Do not create artificial urgency.

Do not encourage speed over understanding.

---

# Emotional Goal

Feedback should feel like studying beside someone who quietly notices your progress.

They do not clap after every sentence.

They do not criticize every mistake.

Sometimes they simply smile.

Sometimes they gently point at something worth noticing.

Sometimes they say nothing at all.

The learner should leave every study session feeling:

> **"I made progress today, and I want to come back tomorrow."**