# Screen States

> **Status:** Approved
> **Related:** `docs/design/patterns/companion-patterns.md`, `docs/design/design-reconciliation.md`

> Every screen in Nihongo Cinema should feel calm—even when something is loading, syncing, or unavailable.

The interface should never punish waiting.

It should quietly accompany the learner.

---

# Philosophy

Software spends a surprising amount of time in temporary states.

Loading.

Saving.

Thinking.

Syncing.

Searching.

Offline.

Instead of treating these as interruptions,

Nihongo Cinema treats them as natural moments inside the learning journey.

Nothing should flash.

Nothing should panic.

Nothing should block reading unless absolutely necessary.

---

# Universal Principles

Every temporary state should feel:

calm

predictable

gentle

reversible

quiet

The learner should always feel that:

"The application knows what it is doing."

---

# Loading

Loading should resemble paper slowly appearing.

Never spinning forever.

Never flashing placeholders.

Preferred techniques:

• skeleton typography

• soft shimmer

• subtle fade

• progressive appearance

Never animate quickly.

Everything fades in slowly.

---

# Skeleton Design

Skeletons imitate real content.

Transcript skeleton:

□□□□□□□□□□□□□□□□□□□□□□□□

□□□□□□□□□□□□□□□□□□□□□□□□□□□□

□□□□□□□□□□□□□□□□□□□□

Video skeleton:

large rounded rectangle

soft gray gradient

very subtle shimmer

Cards:

rounded

warm gray

low contrast

---

# Progressive Loading

Never wait for everything.

Load in layers.

Example:

Header

↓

Video

↓

Transcript

↓

Vocabulary

↓

AI

↓

Metadata

The learner should always have something useful to read.

---

# Empty States

Empty should never mean failure.

It simply means

"This space has not been used yet."

Every empty state includes:

small illustration

short sentence

large breathing room

gentle suggestion

Example

No notes yet.

Your thoughts will slowly gather here.

Never:

"No data."

---

# AI Thinking

AI should never feel like ChatGPT typing.

Instead,

a small, quiet indicator reflects that something is being considered.

Example

✨

Thinking about this sentence...

No animated dots.

No typing cursor.

No fake human behavior.

**This generic "AI thinking" visual treatment is not the Companion entity.** It's the pattern for any
AI wait-state across the product, including surfaces where Companion is Not Supported (Grammar
explanation, Vocabulary extraction — see "AI Generation" below, both Not Supported per
`docs/design/design-reconciliation.md` §4). Where this indicator happens to represent Companion
specifically (e.g. on a Companion-Available surface like Dashboard or `/journal`), it must
additionally declare presence level and anchor availability per §9 — it does not get that status just
by using this visual style.

---

# Saving

Saving should feel almost invisible.

Preferred animation:

tiny sparkle

↓

soft fade

↓

bookmark filled

Duration:

under 600ms

No toast.

No popup.

No confirmation dialog.

---

# Success

Success is intentionally understated — for this Feedback/Companion-layer moment.

Examples:

Saved.

Added to Mining.

Bookmark updated.

Shown as:

small fade

soft highlight

gentle glow

Never use green checkmarks.

Never celebrate.

This restraint applies to Feedback/Companion-layer success (saving, mining, small in-the-moment
signals) — it is not a ban on the Gamification Layer's own success moments (badge unlock, streak
milestone, XP gain), which are a separate, real product layer entitled to their own celebratory
treatment (`docs/design/design-reconciliation.md` §3, Layer Responsibility Rule). This section governs
what this Feedback surface itself may do, not what Gamification is allowed to do elsewhere.

---

# Error

Errors should never feel alarming.

Avoid:

red

large icons

warning triangles

Instead:

warm amber

soft border

calm explanation

Example

We couldn't load this section.

Let's try again in a moment.

---

# Offline

Offline should feel temporary.

The learner should still continue reading whenever possible.

Example

You're offline.

Everything already downloaded is still available.

This means transcripts, decks, and user recordings only — video is always streamed live through
the YouTube IFrame Player API, never downloaded or cached (`CLAUDE.md` §2 Rule 1).

Offer retry quietly.

Never interrupt the session.

---

# Syncing

Syncing happens silently.

Never show progress bars unless necessary.

Preferred indicator:

small cloud icon

↓

Syncing...

↓

Disappears automatically.

---

# Downloading

Downloads happen in background.

This is transcripts, decks, and user recordings only — video is never downloaded, only ever
streamed live through the YouTube IFrame Player API (`CLAUDE.md` §2 Rule 1).

Only show:

soft circular progress

or

subtle percentage

No large modal.

---

# Searching

Search feels immediate.

Results appear progressively.

No loading page.

Empty search:

Continue typing...

No results:

Nothing matched this search.

Try another word.

---

# AI Generation

Applicable to:

Subtitle generation

Translation

Grammar explanation

Vocabulary extraction

Transcript correction

Display:

gentle placeholder blocks

soft breathing animation

As content becomes ready,

replace placeholders individually.

Never wait for everything.

---

# Long Running Tasks

Examples:

Importing YouTube

Processing subtitles

Generating shadowing data

Use a quiet progress card.

Example

Preparing your learning space...

Subtitle alignment

██████░░░░

Vocabulary extraction

████████░░

Grammar analysis

██░░░░░░░░

Avoid percentages unless necessary.

Learners care about progress,

not exact numbers.

---

# Permission Requests

Never interrupt immediately.

Only ask when needed.

Example

Enable microphone

when Shadowing begins.

Enable notifications

only after meaningful usage.

Never request multiple permissions together.

---

# Confirmation

Avoid confirmation dialogs.

Prefer undo.

Example

Sentence archived.

Undo

Visible for a few seconds.

No modal.

---

# Delete

Deletion should feel careful.

Never destructive-looking.

Use calm language.

Archive

Remove

Delete permanently

Each should clearly explain consequences.

---

# Notifications

Notifications are not popups.

They are whispers.

Appear near the bottom.

Fade automatically.

Never stack many.

Never cover transcript.

---

# Empty Companion

When Companion has nothing to say,

it simply rests.

No placeholder.

No suggested prompts.

Silence is acceptable.

This state only ever renders where Companion has an anchor at all — at Companion's four shipped
anchors today (`docs/design/design-reconciliation.md` §6). On a surface where Companion is Not Supported,
there is no Empty Companion state to render, because there is no Companion anchor to be empty in the
first place.

---

# Loading Motion

Motion resembles:

breathing

paper unfolding

fog clearing

light moving

Avoid:

bouncing

elastic motion

fast easing

gaming animations

---

# Visual Priority During States

Transcript always remains readable whenever possible.

Never cover:

current sentence

reading controls

active playback

Learning should continue,

even while the application is still working.

---

# Emotional Goal

A learner should never think:

"The app is making me wait."

Instead they should feel:

"The room is quietly preparing itself."