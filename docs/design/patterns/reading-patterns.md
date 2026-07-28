# Reading Patterns

> **Status:** Approved  
> **Layer:** Experience Architecture  
> **Applies to:** Reading screen, Reading mode within Shadowing/Dictation  
> **Related:** `transcript-patterns.md`, `docs/design/design-reconciliation.md`

> Reading is the primary interaction model of Nihongo Cinema.

Users should never feel like they are operating software.
They should feel like they are sitting in a quiet place reading Japanese.

Everything that appears around the text exists only to support reading.

---

# Philosophy

The application is built around a simple principle:

Reading comes before interaction.

Whenever a UI decision competes with readability,
readability always wins.

---

# Reading Rhythm

Reading should have a natural pace.

Avoid:

• dense paragraphs
• crowded annotations
• multiple highlighted sentences
• excessive icons

Instead provide:

• generous whitespace
• comfortable line height
• stable visual rhythm
• clear sentence separation

The interface should breathe.

---

# Sentence Hierarchy

Transcript always contains three visual levels.

## Current sentence

Visual focus.

Characteristics:

• warm surface
• strongest contrast
• full opacity
• optional subtle glow

The current sentence should attract attention naturally,
never aggressively.

---

## Previous sentences

Slightly faded.

Still readable.

Remain available for context.

No collapse.

---

## Future sentences

Neutral appearance.

No unnecessary emphasis.

The learner should feel invited,
not overwhelmed.

---

# Comfortable Width

Reading width should never become too wide.

Ideal:

60–80 characters per line.

Longer lines reduce comprehension.

Users may resize the workspace,
but typography should preserve readable measure.

---

# Furigana

Furigana should never dominate the sentence.

Hierarchy:

Japanese
↓

Furigana
↓

Translation

Furigana remains visually lighter than the base text.

---

# Translation

Translation supports understanding.

It never competes with Japanese.

Preferred behavior:

Hidden

↓

Tap to reveal

↓

Always visible

Users choose the level of assistance.

---

# Inline Vocabulary

Vocabulary should appear naturally inside the reading flow.

Avoid:

large colored chips

Instead use:

small rounded labels

minimal contrast

soft borders

Vocabulary should feel like bookmarks,
not buttons.

---

# Annotation

Grammar,
dictionary,
and AI explanations should never interrupt reading.

Annotations appear only when requested.

The transcript itself remains clean.

---

# Reading Focus

Whenever a learner scrolls,
the application quietly preserves orientation.

Current sentence remains visually anchored.

Scrolling should feel like moving through pages,
not navigating software.

---

# Reading Modes

Different learning styles require different reading experiences.

## Guided Reading

Japanese

Furigana

Translation

Vocabulary

Ideal for beginners.

---

## Shadowing Reading

Japanese emphasized.

Translation hidden.

Playback synchronized.

Loop controls available.

---

## Immersion Reading

Japanese only.

Minimal UI.

Maximum focus.

---

## Analysis Reading

Reading remains central.

Grammar and dictionary appear in supporting surfaces.

The transcript never becomes secondary.

---

# Motion

Reading interactions should resemble paper.

Examples:

gentle fade

soft highlight transition

slow scrolling

subtle cursor movement

No bouncing.

No flashy animations.

---

# Emotional Goal

The learner should eventually stop noticing the interface.

Only the story,
the voice,
and the language remain.