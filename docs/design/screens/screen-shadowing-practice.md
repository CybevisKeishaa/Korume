# Shadowing Practice
## The Adaptive Learning Workspace

> **Status:** Approved
> Replaces `screen-shadowing-detail.md` per `docs/superpowers/specs/2026-07-29-shadowing-hub-consolidation-design.md` §0/§2/§5. **The route (`/shadowing/[id]`) represents the Lesson, not
> "the Practice screen."** Shadowing Practice — everything this document specifies — is the primary
> experience rendered at that route today, but it is one experience *within* the Lesson, not the
> route's identity: three other Learning Modes (Pronunciation, Listening Practice, Summary) are siblings of
> Shadowing within the same Lesson Workspace, sharing one transcript, one timeline, one progress
> record (`docs/superpowers/specs/2026-07-31-shadowing-hub-lesson-workspace-design.md` §6). No
> standalone Lesson Detail page and no Lesson Info Panel exist inside Practice — both were proposed
> and explicitly rejected (Consolidation spec §2).

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

# Two-Layer Model

Not one flat set of tabs — two independent axes, each with a single responsibility:

```
Lesson
├── Learning Mode     "What skill am I practicing?"   — Shadowing / Pronunciation / Listening Practice / Summary
├── Reading Settings  "How should the UI behave?"       — Font, Subtitle Size, Subtitle Color, Speed, Auto Pause, Repeat, ...
└── Analysis          a per-sentence utility (highlight → Analyze), not a mode at any layer
```

Shadowing renders with one fixed presentation, the same as Pronunciation, Listening Practice, and
Summary — there is no in-mode display-style switcher. An earlier design used a third axis, View
Mode (Reading / Normal / Immersion, existing only inside Shadowing), to let the learner switch
between display styles; it added complexity without enough learner value to keep and was retired
(`docs/superpowers/specs/2026-08-01-shadowing-practice-figma-reconciliation-design.md` §2).

---

# Learning Modes

Route shape: shared layout + nested segments, one Lesson hosting four sibling workspaces:

| Route | Learning Mode |
|---|---|
| `/shadowing/[id]` | Shadowing (default) |
| `/shadowing/[id]/pronunciation` | Pronunciation |
| `/shadowing/[id]/listening` | Listening Practice (Dictation sub-mode, default) |
| `/shadowing/[id]/listening/fill-blank` | Listening Practice (Fill-in-the-blank sub-mode) |
| `/shadowing/[id]/listening/translation` | Listening Practice (Translation sub-mode) |
| `/shadowing/[id]/summary` | Summary |

**Shadowing** — everything else in this document: continuous-playback, transcript-first workspace.

**Pronunciation** — same lesson, same transcript, re-framed per-sentence: the video stops behaving
as continuous playback and becomes one exercise per line. Replay a clip cut purely from
`transcript_lines.start_time`/`end_time` (no new media, no AI cutting) → Record → score using the
three columns `shadowing_sessions` already has (`pronunciation_score`, `rhythm_score`,
`pitch_score`) → Retry → next sentence. History of scores per sentence is the same data § Shared
Context & Progress below uses for per-sentence Learning Status, no new schema.

**Listening Practice** — same lesson, transcript hidden or partially hidden depending on sub-mode,
video loops only the current line's clip (`start_time → end_time`) and stops — the learner's
attention never drifts past the sentence they're working on. A compact sub-mode selector inside
this Learning Mode switches between three practice types, all writing to the same
`dictation_attempts` table with a `practice_type` discriminator (`dictation | fill_blank |
translation`):

- **Dictation** (default sub-mode) — transcript fully hidden. Play → blank input → Check → accuracy
  + which words/kana/kanji were wrong + correction hint, against `dictation_attempts.accuracy_score`
  / `user_input`.
- **Fill-in-the-blank** — transcript shown with its most important words (content words, not
  particles) blanked. Play → fill the missing words → Check → accuracy scored against the blanked
  tokens, same `accuracy_score`/`user_input` columns.
- **Translation** — transcript shown in Japanese. Play → write a natural Vietnamese translation →
  Check. Scored via the existing Lite → Deep AI cascade (`business-model.md` §2/§3.1) rather than
  deterministic matching — same quota/fallback behavior as Analysis, no new gating mechanism.

Next sentence after Check, same as before, regardless of sub-mode.

**Summary** — read-only aggregation of *this lesson's own* data: AI summary, main points, vocabulary
highlights, grammar highlights, expressions, culture notes, difficulty, related lessons, the
learner's own completion state per sentence across the other three modes. **No chat box, no "Ask
AI," no cross-lesson reasoning** — the moment a question needs history beyond this lesson, it is a
Companion question, not a Summary one (see § Companion below). Content split follows the existing AI
cascade free/deep line (`business-model.md` §2/§3.1) — no new gating mechanism.

---

# Shared Context & Progress

Switching Learning Mode never resets position: on sentence 24 in Shadowing, switch to Pronunciation
→ opens on sentence 24; switch to Listening Practice → same; return to Shadowing → video resumes
exactly where it was. All modes write to the same per-sentence progress surface (shadowing
completion, pronunciation score, listening practice accuracy, bookmarks, review-due), so Hub-level
views ("Continue Learning," "Needs Review," "Weak Pronunciation") never need cross-system sync — they
read one source.

**No mode ordering is enforced.** Watch → Shadowing → Pronunciation → Listening Practice → Summary
is one valid path; Watch → Shadowing → Summary → continue tomorrow is another; Listening-Practice-
only is equally valid. The four modes are not a wizard and never gate one another.

**Progress is tracked per mode, not as one aggregate bar.** A lesson card shows independent progress
for each — e.g. "Shadowing 100% · Pronunciation 63% · Listening Practice 28%" — rather than a single
blended percentage that hides which skill is actually behind.

**Each sentence carries its own Learning Status** across the three practice modes: a
listening/shadowing signal, a pronunciation score, three `practice_type`-keyed Listening Practice
accuracy scores (dictation / fill_blank / translation), and a derived "difficult" flag from repeated
low scores or repeated replays — all read directly off existing per-sentence rows, no new table
(Translation's accuracy score is AI-derived, the other two are not, but all three live in the same
`dictation_attempts` row shape).

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

The navigation sidebar is **hidden by default** — not merely "can be hidden" — across the entire
`/shadowing/[id]/**` route group, i.e. all four Learning Modes, not just Shadowing
(`docs/superpowers/specs/2026-07-31-shadowing-hub-lesson-workspace-design.md` §6.7). A small edge
affordance reveals it on demand.

During study,

the learner should almost never see navigation.

This makes the workspace feel immersive rather than application-like.

The Lesson header (Back / Title / Learning Mode tabs / Bookmark / Overflow) is a separate, always-
visible layer — this is lesson context, not app navigation, and is unaffected by the sidebar toggle.

---

# Header

Minimal height.

Contains only

- Back
- Title
- Source
- Learning Mode tabs
- JLPT level
- Bookmark
- Download transcript
- Overflow menu

No colorful actions.

This header itself doesn't display Gamification (XP, Streak, Leaderboard, Badge) — that's a real,
shipped layer that lives elsewhere (Dashboard, post-session summaries), not banned product-wide
(`docs/design/design-reconciliation.md` §3). This header just isn't where it speaks.

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
- Toggle furigana — a shortcut to the global Reading Settings furigana setting (Always / Adaptive /
  Hidden); flipping it here changes the same global setting, there is no separate per-sentence
  furigana state
- Practice this sentence — opens Pronunciation mode with the target sentence pre-selected and
  playback positioned at that sentence

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

# Analysis

A per-sentence **utility**, not a mode at any layer — not a fourth View Mode option, not a tab, not
a screen (`docs/superpowers/specs/2026-07-31-shadowing-hub-lesson-workspace-design.md` §6.6).
Extends the existing Sentence Actions rather than replacing them: free-form text selection (not just
whole-sentence tap) opens a popover at the selection.

Single-word selections resolve instantly (dictionary + reading, no AI, same cost profile as the
existing Vocabulary Preview).

Phrase/clause selections surface an "Analyze" action into the existing AI cascade (Lite free-
preview, Deep Plus — `business-model.md` §2/§3.1, no new gate).

The popover also carries Play (replay just that span), Bookmark, Add to Mining — all reusing
existing Sentence Actions, no new primitives.

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

Subtitle/text color — 4 presets bundling background + text together (Warm Cream, Night, Sepia, High
Contrast), each independently WCAG AA-verified. No free-form color picker — keeps the "no strong
colors" spirit and avoids a contrast-failure support burden
(`docs/superpowers/specs/2026-07-31-shadowing-hub-lesson-workspace-design.md` §6.5).

Playback speed — remembered as the learner's own default.

Auto-Pause sensitivity — silence-based vs. existing beat-marker-based.

Loop count before auto-advancing to the next sentence.

Keyboard-shortcut cheat sheet — togglable, off by default.

"Resume where I left off" vs. "restart from the beginning" when reopening a partially-studied
lesson.

Changes are immediate.

Everything feels like adjusting a physical book.

All settings persist across devices (existing accessibility requirement, unchanged) and every one
has a sensible default — Free never has to configure anything to get the full experience.

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

✕ Not Supported, across all four Learning Modes (Shadowing, Pronunciation, Listening Practice,
Summary) — each is an active acquisition loop (`docs/design/design-reconciliation.md` §4, Learning
Loop Boundary), Companion is Dormant throughout. This is structurally enforced: no `CompanionAnchor`
may mount anywhere in the `/shadowing/[id]/**` route group (L9b scan test). Companion does not appear
during any session; any reflection it has about a completed session surfaces later, on a surface
where Companion is Available (Dashboard, `/journal`) — never inside the Lesson itself.

Summary Mode was explicitly considered as a possible Companion touchpoint and rejected — Summary
understands the lesson, Companion understands the learner; keeping this boundary intact lets future
Learning Modes be added indefinitely without ever touching Companion's architecture
(`docs/superpowers/specs/2026-07-31-shadowing-hub-lesson-workspace-design.md` §0.5, §6.8).

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

A lesson only ever reaches this route once Create Lesson has produced a transcript
(`docs/superpowers/specs/2026-07-31-shadowing-hub-lesson-workspace-design.md` §2.1) — the no-
transcript failure branch is handled inside the Create Lesson modal on the Hub, not here (see
`screen-shadowing-hub.md` § Create Lesson Experience). This section is retained only for the rare
case a transcript becomes unavailable after the lesson was created (e.g. a caption source removed
upstream):

The interface should feel hopeful.

Example

> "This lesson is temporarily missing its transcript."

Offer

Try again

Back to Shadowing Hub

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