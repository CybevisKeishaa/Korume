# Shadowing Detail
## The Adaptive Learning Workspace

> **Status:** Approved

> The heart of Nihongo Cinema.

This is not a video page.

This is not a transcript page.

This is not an online lesson.

It is a personal learning workspace designed for long, comfortable Japanese study sessions.

Everything on this screen exists to help the learner read, listen, imitate and understand Japanese without feeling overwhelmed.

---

# Emotional Goal

The learner should forget they are using software.

Instead they should feel like they entered a quiet study room prepared only for Japanese.

The interface should evoke:

- Comfort
- Warmth
- Curiosity
- Presence
- Patience
- Quiet companionship

Nothing asks for attention.

Everything patiently waits.

---

# Learning Philosophy

Priority order:

Transcript

↓

Audio

↓

Video

↓

Tools

↓

AI

The transcript is the center of the experience.

The video exists only to provide emotional context.

Every other component supports the transcript instead of competing with it.

---

# Layout

Default desktop layout

```
┌────────────────────────────────────────────────────────────┐
│ Header                                                     │
├──────────────┬─────────────────────────────────────────────┤
│              │                                             │
│ Video        │ Transcript Workspace                        │
│              │                                             │
│              │                                             │
├──────────────┴─────────────────────────────────────────────┤
│ Utility Drawer                                             │
└────────────────────────────────────────────────────────────┘
```

---

# Split Workspace

Resizable.

Default ratio

Video

35%

Transcript

65%

The divider can be dragged.

When transcript grows,

video gracefully shrinks.

When video reaches minimum width,

layout automatically changes into

```
Video

↓

Transcript
```

No horizontal scrolling.

No tiny unreadable panels.

Transcript always wins.

---

# Sidebar

The navigation sidebar can be hidden.

During study,

the learner should almost never see navigation.

This makes the workspace feel immersive rather than application-like.

---

# Header

Minimal height.

Contains only

- Back
- Title
- Source
- JLPT level
- Bookmark
- Download
- Overflow menu

No colorful actions.

No gamification.

No progress indicators.

No unnecessary controls.

---

# Video Workspace

The video provides context.

It should never dominate the page.

Characteristics

- rounded corners
- soft elevation
- warm shadow
- minimal controls
- elegant beat timeline

Beat markers are tiny.

Current beat softly glows.

No bright accents.

No cinema-scale player.

---

# Transcript Workspace

The primary learning surface.

Design like a premium reading application.

Large Japanese typography.

Beautiful furigana.

Comfortable line spacing.

Wide breathing margins.

Multiple surrounding sentences visible.

The learner should feel like reading,

not watching subtitles.

---

# Sentence States

Current sentence

- warm background
- slightly larger
- highest contrast

Previous sentence

- softer opacity

Future sentence

- neutral

Already mastered

- subtle fade

Saved sentence

- tiny bookmark indicator

Never use strong colors.

---

# Sentence Actions

Each sentence supports

- Replay
- Bookmark
- Save difficult sentence
- Vocabulary
- Grammar
- Mining
- AI explanation

These actions remain hidden until hover or focus.

The reading flow should remain uninterrupted.

---

# Transcript Display

Support

Japanese only

Japanese + Vietnamese

Japanese + English

Japanese + Multiple Languages

Translation visibility

- Hidden
- Tap to reveal
- Always visible

Furigana

- Always
- Adaptive
- Hidden

Changes happen instantly.

No modal.

No settings page.

---

# Reading Modes

## Reading Mode

Large typography.

Many visible sentences.

Translation visible.

Comfortable reading.

---

## Shadowing Mode

Current sentence emphasized.

Translation hidden.

Playback controls prioritized.

Loop enabled.

---

## Immersion Mode

Japanese only.

Minimal interface.

Video slightly larger.

Maximum focus.

---

## Analysis Mode

Grammar

Vocabulary

Notes

AI explanation

displayed inside Utility Drawer.

The transcript never shrinks.

---

# Playback Controls

Floating.

Inspired by Spotify.

Contains

- Play
- Pause
- Previous
- Next
- Loop
- Speed
- Repeat
- Auto Pause

Rounded.

Soft.

Never technical.

---

# Utility Drawer

Instead of permanent side panels,

secondary tools live here.

Tabs

- Vocabulary
- Grammar
- Mining
- Notes
- AI
- Settings

Collapsed by default.

Expands upward.

The transcript never loses width.

The learner always remains inside the reading experience.

---

# Reading Settings

The learner can customize

Typography

- Japanese font
- Font size
- Line height
- Reading width

Furigana

- Always
- Adaptive
- Hidden

Translation

- Hidden
- Reveal
- Always

Translation language

- Vietnamese
- English
- Japanese

Sentence emphasis

- Minimal
- Soft
- Strong

Changes are immediate.

Everything feels like adjusting a physical book.

---

# Full Transcript Mode

The transcript becomes almost full width.

Video shrinks into Picture-in-Picture.

Ideal for

- repetitive shadowing
- intensive reading
- listening practice

The learner should feel like reading a novel while hearing the original voice.

---

# Subtitle Sources

Support multiple subtitle origins.

- Original
- AI Generated
- Community Corrected
- Personal Edited

The source should be quietly indicated.

Never distract.

---

# Companion

✕ Not Supported. Shadowing is an active acquisition loop
(`docs/design/design-reconciliation.md` §4, Learning Loop Boundary) — Companion is Dormant
throughout Shadowing. This is structurally enforced: no `CompanionAnchor` may mount on the
shadowing route (L9b scan test). Companion does not appear during the session; any reflection it
has about a completed shadowing session surfaces later, on a surface where Companion is Available
(Dashboard, `/journal`) — never inside Shadowing itself.

---

# Difficulty Feedback

Avoid

- red
- warning icons
- failure language

Instead use

- warm underline
- amber glow
- gentle left border
- subtle sparkle

The learner should feel

"I understand."

never

"I failed."

---

# Study Atmosphere

Optional environments

🌙 Evening Study

☕ Coffee Shop

🌧 Rainy Day

📚 Quiet Library

🌸 Spring Morning

🎐 Summer Night

Atmosphere changes

- background glow
- color temperature
- glass tint
- shadow softness
- ambient particles

Changes are almost imperceptible.

The learner chooses a place to study,

not a theme.

---

# Motion

Everything moves slowly.

Animations include

- breathing hover
- transcript fade
- paper scrolling
- elegant skeleton loading
- subtle cursor motion
- gentle transitions
- tiny sparkle when saving

No bounce.

No spring explosions.

No flashy transitions.

---

# Empty States

When no transcript exists

The interface should feel hopeful.

Example

> "This video is waiting to become your next lesson."

Offer

Generate subtitles

instead of displaying an empty table.

---

# Success Feedback

Quiet.

Examples

Sentence saved.

Bookmark added.

Mining complete.

Displayed as a tiny warm toast that disappears naturally.

Never interrupt reading.

---

# Accessibility

Every reading preference should be remembered.

Typography settings persist across devices.

Keyboard navigation is fully supported.

The interface should remain beautiful at every zoom level.

---

# Success Criteria

A learner opens this page and immediately feels

> "I could happily spend an hour here."

If they instead think

> "This looks like another language learning app."

the design has failed.