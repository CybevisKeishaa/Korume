# Video Patterns

> **Status:** Approved
> **Related:** `transcript-patterns.md`, `docs/design/design-reconciliation.md`

> Video provides context.
>
> It is not the destination of the learning experience.

In Nihongo Cinema, learners are not here to watch videos.

They are here to understand Japanese through authentic media.

The video exists to provide emotion, pronunciation, facial expressions, timing, and cultural context.

The transcript remains the primary learning surface.

---

# Core Philosophy

A traditional video platform is designed around watching.

Nihongo Cinema is designed around learning.

Therefore:

Video supports the transcript.

It never competes with it.

---

# Visual Priority

The visual hierarchy should always be:

Transcript

↓

Playback Controls

↓

Video

↓

Supporting Tools

This hierarchy should remain consistent across every learning screen.

---

# Video as Context

The video should feel like a companion to the text.

It provides:

• pronunciation
• emotion
• body language
• timing
• cultural cues

The learner should never feel pressured to keep watching continuously.

Pausing frequently is expected.

---

# Default Size

Desktop default workspace:

Video

35%

Transcript

65%

The transcript should always receive more visual space than the player.

---

# Adaptive Layout

The video panel is fully resizable.

When expanded:

the transcript gracefully becomes narrower while preserving comfortable reading width.

When reduced:

the transcript naturally grows.

When the video reaches its minimum comfortable width:

the layout may automatically switch to:

Video

↓

Transcript

The learner should never encounter cramped panels.

---

# Full Transcript Mode

The learner may choose to focus entirely on reading.

In this mode:

the transcript becomes nearly full width.

The video transitions into a Picture-in-Picture window.

Characteristics:

small

rounded

movable

quiet

This mode is ideal for:

shadowing

intensive reading

repetition

---

# Full Video Mode

Occasionally learners want to observe acting, expressions, or scene context.

Full Video Mode should exist.

However:

the transcript remains easily accessible.

Closing the mode should smoothly restore the workspace.

Avoid creating a separate viewing experience.

---

# Player Appearance

The player should feel integrated into the workspace.

Characteristics:

large rounded corners

soft elevation

minimal borders

warm dark surface

subtle shadow

No heavy chrome.

No platform branding.

No unnecessary controls.

---

# Playback Controls

Playback controls should feel closer to Spotify than YouTube.

Rounded.

Soft.

Minimal.

Primary controls:

Play / Pause

Previous Sentence

Next Sentence

Loop Sentence

Playback Speed

Repeat

Auto Pause

Everything should be tactile.

Nothing should resemble professional editing software.

---

# Timeline

The timeline represents learning progress,

not media consumption.

Instead of chapter markers,

use Beat Markers.

Each Beat represents a study sentence or dialogue segment.

Visual style:

tiny dots

soft ticks

minimal labels

Current Beat:

warm highlight

gentle glow

Completed Beats:

slightly brighter than upcoming ones.

This Timeline strip itself stays quiet — it is not where Gamification or Companion speak. Badges,
completion celebrations, and streak/XP moments are a real, shipped product layer (G1–G3,
`docs/design/design-reconciliation.md` §3) that lives elsewhere (Dashboard, post-session summaries),
not inside this ambient scrubber.

---

# Subtitle Relationship

The transcript is separate from subtitles.

The video may contain:

embedded subtitles

no subtitles

AI subtitles

community subtitles

user-corrected subtitles

The player should never assume subtitles are burned into the video.

The transcript is always the authoritative reading surface.

---

# Subtitle Overlay

Subtitle overlays inside the player should remain optional.

Available modes:

Hidden

Japanese

Translation

Bilingual

When enabled,

subtitles remain visually quiet.

Avoid oversized television-style captions.

---

# Picture-in-Picture

PiP is considered a learning tool,

not a multitasking feature.

The PiP window should be:

small

rounded

movable

semi-floating

It should never obscure the current sentence.

---

# Loading State

Loading should feel calm.

Instead of flashing placeholders:

soft skeleton

blurred thumbnail

gentle fade-in

The learner should never feel interrupted.

---

# Error State

Video errors should avoid technical language.

Instead of:

"Playback failed."

Prefer:

"This video couldn't be played right now."

Offer quiet recovery options.

Retry.

Reload the player.

Open original source.

No alarming visuals.

Video is always played live through the YouTube IFrame Player API — never downloaded, re-hosted, or
cached (`CLAUDE.md` §2 Rule 1). Recovery options may retry playback or hand off to the source; they
must never suggest downloading the video.

---

# Ambient Integration

The video should inherit the current Study Atmosphere.

Examples:

🌙 Evening Study

slightly warmer shadow

☕ Coffee Shop

soft ambient glow

🌧 Rainy Day

cooler tint

📚 Quiet Library

neutral lighting

The video surface should harmonize with the workspace rather than stand apart.

---

# Motion

Playback-related motion should be restrained.

Preferred transitions:

gentle fade

soft scaling

smooth resize

subtle opacity changes

Avoid:

dramatic zooms

elastic animations

rapid panel movement

The learner's attention should remain on the language.

---

# Accessibility

Support:

keyboard shortcuts

screen readers where applicable

high contrast mode

caption customization

variable playback speed

adjustable player size

All adjustments should happen instantly without disrupting the learning session.

---

# Emotional Goal

The learner should never feel like they are "watching YouTube."

Instead, the video should feel like a quiet window into the world of Japanese.

It is always present.

Always supportive.

Never demanding attention.

The learner should naturally move between:

watching,

reading,

listening,

speaking,

and thinking—

without noticing where one activity ends and the next begins.