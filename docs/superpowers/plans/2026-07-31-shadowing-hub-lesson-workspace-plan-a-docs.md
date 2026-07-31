# Shadowing Hub, Lesson Workspace — Plan A (Docs) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring every design/product doc in the repo into agreement with the locked Shadowing Hub →
Lesson Workspace domain model — executing the still-unexecuted 2026-07-29 Consolidation spec's
17-file change list, layering the 2026-07-31 Lesson Workspace spec's new content into the same
rewrites (not a second pass), and closing the 7 additional stale-reference gaps that spec's own
repo-wide audit found. Zero code changes.

**Architecture:** Documentation-only change, five phases, mostly ordered (Phase 1 must precede
everything that references the renamed files — Phases 2–4 all do). No build, no test suite —
verification is grep + read-back against the two source specs.

**Tech Stack:** Markdown files only.

## Global Constraints

- **Source-of-truth specs, both locked for execution:**
  - `docs/superpowers/specs/2026-07-29-shadowing-hub-consolidation-design.md` — its header says
    "Draft — awaiting final sign-off," but the newer spec below explicitly calls it "Draft, approved,
    never executed" and builds directly on top of it. Treat both specs as authoritative for this plan;
    do not re-open either's decisions.
  - `docs/superpowers/specs/2026-07-31-shadowing-hub-lesson-workspace-design.md` — Approved
    2026-07-31. §8 and §8.1 are this plan's direct source for every task below.
- **No tests apply.** Verification is a re-read pass confirming (a) the edited section matches the
  source spec's resolution and (b) every cross-reference in the edited text resolves to a real file.
  Each task's "Verify" step does this via `grep`, same pattern as
  `docs/superpowers/plans/2026-07-28-design-docs-reconciliation.md`.
- **No code changes.** Nothing in `app/`, `components/`, or `lib/` is touched. The actual Next.js
  route rename (`app/[locale]/(app)/videos` → `.../shadowing`) and all schema/API/UI work
  (`library_access`, Create Lesson pipeline, Learning Modes) are separate Plans B/C/D, not this one.
- **Do not mark `feature_backlog_deferred` items #14 or #11 DONE in this plan.** Per the Lesson
  Workspace spec §8: they're resolved by *implementation* (Plan B/C/D), not by updating docs about
  the implementation. This plan only prepares the docs those plans will build against.
- **Phase order is load-bearing.** Phase 1 (renames + rewrites) must be committed before Phase 2
  (governance docs, which cite the renamed files' new names and sections) or Phase 3 (terminology
  sweep, which fixes cross-references to the pre-rename filenames). Phase 4 (Lesson Workspace gap
  fixes) and Phase 5 (business-model.md) have no dependency on Phase 1–3 content and could run
  earlier, but are sequenced last here to keep "the two specs, in the order they were written" as the
  simplest mental model for whoever executes this.
- **One commit per task.** Prefix `docs(design):` for `docs/design/**`, `docs(features):` for
  `docs/features/**`, `docs(product):` for `docs/product/business-model.md`, `docs(spec):` for
  `japanese-learning-app-spec.md`.
- **Every edited file keeps its existing content except the exact block being changed** — do not
  reformat or reflow unrelated sections. Where this plan's Find/Replace block contains a nested
  triple-backtick fence (ASCII diagrams, code samples), the instruction itself is wrapped in a
  four-backtick fence so the nested fence doesn't prematurely close it — do not mistake the outer
  four-backtick fence for content to write.
- **Terminology, binding for every task:** "Video" → "Lesson" in all *product-facing* copy (DB table
  name `videos` stays internal-only, unchanged — Lesson Workspace spec §1.1). "Video Library" /
  "Videos Library" → "Shadowing Hub". "Video Detail" → deprecated, no replacement screen (its content
  either moves to the Lesson header/Hub card or is dropped, per context). "Shadowing Detail" /
  "Shadowing" (when it unambiguously means the practice workspace, not the Hub nav item) →
  "Shadowing Practice". "Import Video" → "Create Lesson".

---

## File Structure

| File | Task | Change |
|---|---|---|
| `docs/design/screens/screen-video-library.md` → `screen-shadowing-hub.md` | 1 | **Rename + rewrite.** Consolidation §6 item 3 + Lesson Workspace §5. |
| `docs/design/screens/screen-shadowing-detail.md` → `screen-shadowing-practice.md` | 2 | **Rename + rewrite.** Consolidation §6 item 4 + Lesson Workspace §6. |
| `docs/design/screens/screen-video-detail.md` | 3 | Mark Deprecated. Consolidation §6 item 5. |
| `docs/design/screens/navigation-system.md` | 4 | NAV_ITEMS swap, Naming Principle section, anchor line. Consolidation §6 item 6. |
| `docs/design/design-reconciliation.md` | 5 | §2/§3/§6/§12 edits, version bump. Consolidation §6 item 7. |
| `docs/design/screens/screen-architecture.md` | 6 | Workspace list, Emotional Hierarchy, Naming Principle. Consolidation §6 item 8 + Lesson Workspace §8.1 (3 follow-ups). |
| `docs/design/screens/screen-dashboard.md` | 7 | One cross-reference line. Consolidation §6 item 9. |
| `docs/design/screens/workspace-patterns.md` | 8 | 4 stale references. Consolidation §6 item 10. |
| `docs/design/screens/learning-surfaces.md` | 9 | Merge Video Detail into Shadowing entry, rename Videos Library. Consolidation §6 item 11. |
| `docs/design/screens/screen-mining.md` | 10 | Collapse two stale entries into one. Consolidation §6 item 12. |
| `docs/design/screens/screen-review.md` | 11 | Cross-reference + copy fix. Consolidation §6 item 13. |
| `docs/design/screens/screen-search.md` | 12 | 3 stale references. Consolidation §6 item 14 + found-in-execution catches. |
| `docs/design/screens/adaptive-layouts.md` | 13 | 1 stale reference. Consolidation §6 item 15. |
| `docs/design/patterns/empty-states.md` | 14 | Related-docs reference. Consolidation §6 item 16. |
| `docs/design/patterns/transcript-patterns.md` | 15 | Applies-to line. Consolidation §6 item 17. |
| `docs/design/patterns/study-modes.md` | 16 | Related-docs reference. Lesson Workspace §8.1 gap. |
| `docs/design/patterns/overlays-and-drawers.md` | 17 | Related-docs reference + inline prose. Lesson Workspace §8.1 gap. |
| `docs/features/F-005-learn-before-watching.md` | 18 | Move button off deprecated page. Lesson Workspace §8.1 gap. |
| `docs/features/F-003-learning-journey.md` | 19 | Move timeline into Summary Mode. Lesson Workspace §8.1 gap. |
| `japanese-learning-app-spec.md` | 20 | Pointer note on struck-through §3.12 line. Lesson Workspace §8.1 gap. |
| `docs/features/F-009-shadowing-challenge.md` | 21 | Stale workflow wording. Lesson Workspace §8.1 gap. |
| `docs/product/business-model.md` | 22 | Principle 3 rewrite, §2 table rows, philosophy line, header cross-ref. Lesson Workspace §3.4. |

No new files. No files deleted. `docs/design/patterns/video-patterns.md` is explicitly **not**
touched (Consolidation §6: already frames video as supporting the transcript, no edit needed).

---

## Phase 1 — Renames + rewritten content

### Task 1: `screen-video-library.md` → `screen-shadowing-hub.md`

**Files:**
- Rename: `docs/design/screens/screen-video-library.md` → `docs/design/screens/screen-shadowing-hub.md`
- Modify: the renamed file's content (extensive)

**Interfaces:**
- Consumes: Consolidation spec §0–§2, §5; Lesson Workspace spec §5 (Shadowing Hub), §1.2–§1.4
  (`library_access`, `user_lesson_library`, `collections`).
- Produces: the canonical Hub screen doc every later task (navigation-system.md, design-
  reconciliation.md, workspace-patterns.md, learning-surfaces.md, screen-review.md, screen-search.md,
  adaptive-layouts.md, empty-states.md) cross-references by its new filename.

- [ ] **Step 1: Rename the file**

```bash
git mv docs/design/screens/screen-video-library.md docs/design/screens/screen-shadowing-hub.md
```

- [ ] **Step 2: Retitle and reframe the intro**

Find:

````markdown
# Video Library
## The Story Collection

> **Status:** Approved

> Every video is not content.
>
> Every video is a story waiting to become part of someone's Japanese journey.

The Video Library is not a media browser.

It is not YouTube.

It is not Netflix.

It is not a file manager.

It is a calm, personal collection of stories curated for learning Japanese.

The learner should feel like browsing a beautiful bookshelf rather than searching through a video database.
````

Replace:

````markdown
# Shadowing Hub
## The Learner's Home for Shadowing

> **Status:** Approved
> Replaces `screen-video-library.md` per `docs/superpowers/specs/2026-07-29-shadowing-hub-
> consolidation-design.md` §0/§5 and `docs/superpowers/specs/2026-07-31-shadowing-hub-lesson-
> workspace-design.md` §5. **The primary product domain is Shadowing, not Video** — this screen is
> not "a library that also does other things"; it is the learner's home for the Shadowing domain,
> answering "What should I practice next?" through browse/discover, search/filter, recommendations
> — **and** continuing an unfinished session, seeing weekly progress, resuming where they left off.
> Session-continuity is core to the Hub's identity, not a feature bolted onto a library.

> Every lesson is not content.
>
> Every lesson is a story waiting to become part of someone's Japanese journey.

The Shadowing Hub is not a media browser.

It is not YouTube.

It is not Netflix.

It is not a file manager.

It is a calm, personal home for the learner's Shadowing practice — a place to pick up an unfinished
lesson, discover a new one, and see how the week is going, all at once.

The learner should feel like browsing a beautiful bookshelf rather than searching through a video database.
````

- [ ] **Step 3: Fix the Emotional Goal section**

Find:

```markdown
# Emotional Goal

Opening the Library should evoke curiosity.

The learner should naturally slow down.

Browsing should feel enjoyable even before choosing a lesson.

Every video should invite exploration rather than compete for attention.
```

Replace:

```markdown
# Emotional Goal

Opening the Hub should evoke curiosity.

The learner should naturally slow down.

Browsing should feel enjoyable even before choosing a lesson.

Every lesson should invite exploration rather than compete for attention.
```

- [ ] **Step 4: Add the Current Session rail to the Layout diagram and add its own section**

Find:

````markdown
# Layout

Desktop

```
┌─────────────────────────────────────────────────────────────┐
│ Quiet Header                                                │
├─────────────────────────────────────────────────────────────┤
│ Search                                                      │
├─────────────────────────────────────────────────────────────┤
│ Collections                                                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Story Grid                                                  │
│                                                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

Large margins.

Generous spacing.

No dashboard widgets.

No information overload.
````

Replace:

````markdown
# Layout

Desktop

```
┌─────────────────────────────────────────────────────────────┬──────────────────┐
│ Quiet Header                                                │                  │
├─────────────────────────────────────────────────────────────┤ Current Session  │
│ Search                                                      │ & This Week's    │
├─────────────────────────────────────────────────────────────┤ Record           │
│ Collections                                                 │                  │
├─────────────────────────────────────────────────────────────┤                  │
│                                                             │                  │
│ Story Grid                                                  │                  │
│                                                             │                  │
│                                                             │                  │
└─────────────────────────────────────────────────────────────┴──────────────────┘
```

Large margins.

Generous spacing.

No dashboard widgets except the Current Session rail below — that rail is Gamification-Layer
continuity content, deliberately shown here (see § Current Session & This Week's Record).

No information overload.

---

# Current Session & This Week's Record

A right-rail section, always visible on desktop, present because the Hub owns learning *continuity*
— not to be confused with the Dashboard, which owns long-term *progress*
(`docs/design/design-reconciliation.md` §3, Hub/Dashboard split):

> **Shadowing Hub owns learning continuity** — current session (in progress, resume action), weekly
> record framed as "how is my practice going right now," the immediate next step.
>
> **Dashboard owns long-term progress** — arrival/overview, historical trends, milestones over time,
> the broader relationship with the whole product, not just Shadowing.

Contains

Current session (lesson in progress, one-tap Resume)

This week's record — streak, goal, hours studied

Both are Gamification-Layer content (`docs/design/design-reconciliation.md` §3) — this is a
deliberate exception to the Hub's otherwise neutral-browsing stance, unlike the old Video Library.

## Layer Responsibility

| Layer | Allowed | Forbidden |
|---|---|---|
| Gamification | Current session, Streak, Weekly goal, Hours studied | — |
| Companion | Memory, Reflection, Journey meaning (empty-state only, see § Companion) | Reacting to XP/streak/leaderboard changes |
````

- [ ] **Step 5: Rewrite the Header section — "Import Video" retired**

Find:

```markdown
# Header

Minimal.

Contains

Library

Import Video

Search

Display Options

Nothing else.
```

Replace:

```markdown
# Header

Minimal.

Contains

Shadowing Hub

Create Lesson

Search

Display Options

Nothing else.
```

- [ ] **Step 6: Rewrite Collections for the computed-first, editorial-second model**

Find:

```markdown
# Collections

Collections replace traditional filters.

Instead of technical categories,

present meaningful groups.

Examples

Continue Learning

Recently Added

Slice of Life

Daily Conversation

Anime

Drama

Movies

Favorites

Saved for Later

Each collection feels like a bookshelf.

Not a filter menu.
```

Replace:

```markdown
# Collections

Collections replace traditional filters.

Instead of technical categories,

present meaningful groups.

The grid is entirely collection-driven, ordered by each collection's stored display order — no
hardcoded sections in code (`docs/superpowers/specs/2026-07-31-shadowing-hub-lesson-workspace-
design.md` §5). Three computed (virtual) collections are always prepended, in this order:

Continue Learning

My Lessons

Recently Added

Then editorial collections follow in their stored order (Featured typically first among those).
Editorial examples

Slice of Life

Daily Conversation

Anime

Drama

Movies

JLPT N3

A Lesson can belong to any number of editorial collections simultaneously — the Netflix model, not
a single-category filter. "Favorites" / "Saved for Later" are themselves computed collections (a
query, not a stored row), same as Continue Learning/My Lessons/Recently Added above.

Each collection feels like a bookshelf.

Not a filter menu.

---

# My Lessons

The learner's own `PRIVATE` creations — every lesson they've made via Create Lesson, or dedup-joined
from someone else's (`docs/superpowers/specs/2026-07-31-shadowing-hub-lesson-workspace-design.md`
§1.3, §5). This is a top-level, always-visible section, not a filter chip buried behind a menu —
learners return to their own imports far more than to random discovery.

Displayed exactly like any other collection row: Story Cards, same treatment, same spacing. What
makes it different is placement (always second, right after Continue Learning) and permanence (it
is never empty of intent — even a freshly-created lesson with no transcript yet belongs here).
```

- [ ] **Step 7: Add the 🔒 badge to Story Card**

Find:

```markdown
# Story Card

Cards should resemble beautifully arranged books.

Large artwork.

Comfortable typography.

Soft corners.

Subtle elevation.

Tiny metadata.

Nothing noisy.

Hover creates

slight elevation

gentle glow

soft scaling

No dramatic movement.
```

Replace:

```markdown
# Story Card

Cards should resemble beautifully arranged books.

Large artwork.

Comfortable typography.

Soft corners.

Subtle elevation.

Tiny metadata.

Nothing noisy.

A small 🔒 badge appears when the lesson's `library_access` is `PLUS` and the viewer is Free —
visible, never hidden, per `business-model.md` §5 "show don't tell"
(`docs/superpowers/specs/2026-07-31-shadowing-hub-lesson-workspace-design.md` §5). No other badge
communicates access tier; `FREE` lessons carry no badge at all.

Hover creates

slight elevation

gentle glow

soft scaling

No dramatic movement.
```

- [ ] **Step 8: Rewrite Import Experience as Create Lesson Experience**

Find:

```markdown
# Import Experience

Importing a video should feel like adding a new book to a shelf.

Not uploading a file.

The interface should ask

Paste YouTube URL

or

Import Local Video

After importing,

show a quiet processing state.

Examples

Preparing subtitles...

Understanding dialogue...

Creating your learning space...

Avoid technical terminology.
```

Replace:

````markdown
# Create Lesson Experience

Creating a lesson should feel like adding a new book to a shelf.

Not uploading a file. "Import Video" is retired product-facing language — this action is **Create
Lesson** everywhere it appears in Hub copy
(`docs/superpowers/specs/2026-07-31-shadowing-hub-lesson-workspace-design.md` §2, §7).

The modal shows quota remaining before any input (e.g. "2/3 lessons left this month" / "Unlimited"
for Plus), so a later block is never a surprise (§2.1 of that spec).

The interface should ask

Paste YouTube URL

After pasting, show a quiet three-line processing state — not the technical steps behind it:

```
Preparing lesson...
✓ Finding transcript
✓ Building lesson
✓ Ready to study
```

A dedup hit (someone already prepared this exact lesson) skips straight to a delight line instead of
a technical one:

```
Great news! Someone has already prepared this lesson.
✓ Added instantly
✓ Ready to study
```

A no-caption failure offers a way forward, never a dead end:

```
Preparing lesson...
✓ Finding transcript
✕ No transcript found
  [ Generate with AI 🔒 Plus ]   [ Try another video ]
```

Avoid technical terminology throughout.
````

- [ ] **Step 9: Fix the Empty Library section**

Find:

```markdown
# Empty Library

An empty library should inspire curiosity.

Example

> Every learning journey begins with one story.

Offer

Import your first YouTube video

Browse sample lessons

The screen should feel hopeful,

never empty.

This empty state is one of L9b (D3)'s four shipped Companion anchors — Available today
(`docs/design/design-reconciliation.md` §6). Unlike the non-empty view below (Planned), Companion may
appear here now; see `docs/design/patterns/companion-patterns.md` § Declare Anchor for the
presence-level and copy conventions it follows.
```

Replace:

```markdown
# Empty Hub

An empty Hub should inspire curiosity.

Example

> Every learning journey begins with one story.

Offer

Create your first Lesson

Browse sample lessons

The screen should feel hopeful,

never empty.

This empty state is one of L9b (D3)'s four shipped Companion anchors — Available today
(`docs/design/design-reconciliation.md` §6, listed there as "Shadowing Hub (empty state)"). Unlike
the non-empty view below (Planned), Companion may appear here now; see
`docs/design/patterns/companion-patterns.md` § Declare Anchor for the presence-level and copy
conventions it follows.
```

- [ ] **Step 10: Fix the Companion section**

Find:

```markdown
# Companion

○ Planned — chưa implement. L9b (D3) chỉ có 4 anchor (Dashboard, `/journal`, Video Library empty
state, Mining deck empty state); Video Library non-empty state is not one of them yet
(`docs/design/design-reconciliation.md` §6). The behavior below describes the target design once
this anchor is built, not current behavior.
```

Replace:

```markdown
# Companion

○ Planned — chưa implement. L9b (D3) chỉ có 4 anchor (Dashboard, `/journal`, Shadowing Hub empty
state, Mining deck empty state); Shadowing Hub non-empty state is not one of them yet
(`docs/design/design-reconciliation.md` §6). The behavior below describes the target design once
this anchor is built, not current behavior. Removing the previous Video Detail page does not
transfer its responsibilities here either — Companion provides context only where it already would
have, never to backfill a removed screen (`docs/design/design-reconciliation.md` §2).
```

- [ ] **Step 11: Fix the Success Criteria section**

Find:

```markdown
# Success Criteria

The learner opens the Library and immediately thinks

> "Which story do I want to spend time with today?"

They should never think

> "Which file should I open?"

If the screen feels like YouTube, Netflix, or a media manager,

the design has failed.
```

Replace:

```markdown
# Success Criteria

The learner opens the Hub and immediately thinks

> "Which story do I want to spend time with today?"

They should never think

> "Which file should I open?"

If the screen feels like YouTube, Netflix, or a media manager,

the design has failed.
```

- [ ] **Step 12: Verify**

```bash
grep -n "Video Library\|Import Video" docs/design/screens/screen-shadowing-hub.md
```

Expected: no matches. Confirm the new sections exist:

```bash
grep -n "^# Current Session & This Week's Record$\|^# My Lessons$\|^# Create Lesson Experience$" docs/design/screens/screen-shadowing-hub.md
```

Expected: three matches, one each.

- [ ] **Step 13: Commit**

```bash
git add docs/design/screens/screen-shadowing-hub.md
git commit -m "docs(design): rename+rewrite screen-video-library.md to screen-shadowing-hub.md

Executes Consolidation spec §6 item 3 and layers in Lesson Workspace
spec §5 in the same pass: computed-first collections (Continue
Learning / My Lessons / Recently Added, then editorial), My Lessons
promoted to a top-level section, Story Card PLUS lock badge, Create
Lesson replacing Import Video with its 3-line progress copy, and the
Current Session & This Week's Record right-rail with its own Layer
Responsibility table."
```

---

### Task 2: `screen-shadowing-detail.md` → `screen-shadowing-practice.md`

**Files:**
- Rename: `docs/design/screens/screen-shadowing-detail.md` → `docs/design/screens/screen-shadowing-practice.md`
- Modify: the renamed file's content (extensive)

**Interfaces:**
- Consumes: Consolidation spec §0, §2, §5; Lesson Workspace spec §6 (all subsections), §0.4/§0.5
  (Lesson-is-a-workspace, Summary-vs-Companion boundary).
- Produces: the canonical Lesson Workspace screen doc every later task
  (navigation-system.md, design-reconciliation.md, workspace-patterns.md, learning-surfaces.md,
  screen-mining.md, screen-review.md, screen-search.md, study-modes.md, overlays-and-drawers.md)
  cross-references by its new filename.

- [ ] **Step 1: Rename the file**

```bash
git mv docs/design/screens/screen-shadowing-detail.md docs/design/screens/screen-shadowing-practice.md
```

- [ ] **Step 2: Retitle and add the Lesson-vs-Practice clarifying note**

Find:

```markdown
# Shadowing Detail
## The Adaptive Learning Workspace

> **Status:** Approved

> The heart of Nihongo Cinema.

This is not a video page.

This is not a transcript page.

This is not an online lesson.

It is a personal learning workspace designed for long, comfortable Japanese study sessions.

Everything on this screen exists to help the learner read, listen, imitate and understand Japanese without feeling overwhelmed.
```

Replace:

```markdown
# Shadowing Practice
## The Adaptive Learning Workspace

> **Status:** Approved
> Replaces `screen-shadowing-detail.md` per `docs/superpowers/specs/2026-07-29-shadowing-hub-
> consolidation-design.md` §0/§2/§5. **The route (`/shadowing/[id]`) represents the Lesson, not
> "the Practice screen."** Shadowing Practice — everything this document specifies — is the primary
> experience rendered at that route today, but it is one experience *within* the Lesson, not the
> route's identity: three other Learning Modes (Pronunciation, Dictation, Summary) are siblings of
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
```

- [ ] **Step 3: Insert the Three-Layer Model, Learning Modes, and Shared Context & Progress sections**

Find:

```markdown
Nothing asks for attention.

Everything patiently waits.

---

# Learning Philosophy
```

Replace:

````markdown
Nothing asks for attention.

Everything patiently waits.

---

# Three-Layer Model

Not one flat set of tabs — three independent axes, each with a single responsibility
(`docs/superpowers/specs/2026-07-31-shadowing-hub-lesson-workspace-design.md` §6.1):

```
Lesson
├── Learning Mode     "What skill am I practicing?"   — Shadowing / Pronunciation / Dictation / Summary
├── View Mode         "How do I want to see it?"       — exists only inside Shadowing: Reading / Normal / Immersion
├── Reading Settings  "How should the UI behave?"       — Font, Subtitle Size, Subtitle Color, Speed, Auto Pause, Repeat, ...
└── Analysis          a per-sentence utility (highlight → Analyze), not a mode at any layer
```

This resolves what would otherwise be a collision between this document's own Reading/Shadowing/
Immersion/Analysis progression (a **display-style axis**, now called View Mode, § View Mode below)
and the four Learning Modes below (a **practice-type axis**): they were never the same axis, so they
nest rather than merge.

---

# Learning Modes

Route shape: shared layout + nested segments, one Lesson hosting four sibling workspaces:

| Route | Learning Mode |
|---|---|
| `/shadowing/[id]` | Shadowing (default) |
| `/shadowing/[id]/pronunciation` | Pronunciation |
| `/shadowing/[id]/dictation` | Dictation |
| `/shadowing/[id]/summary` | Summary |

**Shadowing** — everything else in this document: continuous-playback, transcript-first workspace,
View Modes live here.

**Pronunciation** — same lesson, same transcript, re-framed per-sentence: the video stops behaving
as continuous playback and becomes one exercise per line. Replay a clip cut purely from
`transcript_lines.start_time`/`end_time` (no new media, no AI cutting) → Record → score using the
three columns `shadowing_sessions` already has (`pronunciation_score`, `rhythm_score`,
`pitch_score`) → Retry → next sentence. History of scores per sentence is the same data § Shared
Context & Progress below uses for per-sentence Learning Status, no new schema.

**Dictation** — same lesson, but the transcript text is **hidden** until the learner checks their
answer, and the video does not play continuously: it loops only the current line's clip
(`start_time → end_time`) and stops, so the learner's attention never drifts past the sentence
they're working on. Play → blank input → Check → accuracy + which words/kana/kanji were wrong +
correction hint (against `dictation_attempts.accuracy_score`/`user_input`) → next sentence.

**Summary** — read-only aggregation of *this lesson's own* data: AI summary, main points, vocabulary
highlights, grammar highlights, expressions, culture notes, difficulty, related lessons, the
learner's own completion state per sentence across the other three modes. **No chat box, no "Ask
AI," no cross-lesson reasoning** — the moment a question needs history beyond this lesson, it is a
Companion question, not a Summary one (see § Companion below). Content split follows the existing AI
cascade free/deep line (`business-model.md` §2/§3.1) — no new gating mechanism.

---

# Shared Context & Progress

Switching Learning Mode never resets position: on sentence 24 in Shadowing, switch to Pronunciation
→ opens on sentence 24; switch to Dictation → same; return to Shadowing → video resumes exactly
where it was. All modes write to the same per-sentence progress surface (shadowing completion,
pronunciation score, dictation accuracy, bookmarks, review-due), so Hub-level views ("Continue
Learning," "Needs Review," "Weak Pronunciation") never need cross-system sync — they read one
source.

**No mode ordering is enforced.** Watch → Shadowing → Pronunciation → Dictation → Summary is one
valid path; Watch → Shadowing → Summary → continue tomorrow is another; Dictation-only is equally
valid. The four modes are not a wizard and never gate one another.

**Progress is tracked per mode, not as one aggregate bar.** A lesson card shows independent progress
for each — e.g. "Shadowing 100% · Pronunciation 63% · Dictation 28%" — rather than a single blended
percentage that hides which skill is actually behind.

**Each sentence carries its own Learning Status** across the three practice modes: a
listening/shadowing signal, a pronunciation score, a dictation accuracy score, and a derived
"difficult" flag from repeated low scores or repeated replays — all read directly off existing
per-sentence rows, no new table, no AI involved.

---

# Learning Philosophy
````

- [ ] **Step 4: Strengthen the Sidebar section to hidden-by-default across all four Learning Modes**

Find:

```markdown
# Sidebar

The navigation sidebar can be hidden.

During study,

the learner should almost never see navigation.

This makes the workspace feel immersive rather than application-like.
```

Replace:

```markdown
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
```

- [ ] **Step 5: Replace Reading Modes with View Mode + a separate Analysis utility**

Find:

```markdown
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
```

Replace:

```markdown
# View Mode (inside Shadowing only)

Exists only inside the Shadowing Learning Mode — Pronunciation, Dictation, and Summary each have
their own fixed presentation, not a View Mode selector
(`docs/superpowers/specs/2026-07-31-shadowing-hub-lesson-workspace-design.md` §6.4).

## Reading

Large typography.

Many visible sentences.

Translation visible.

Comfortable reading.

The old "Reading Mode" — unchanged in substance, now correctly scoped as a display preset of
Shadowing rather than a sibling of Dictation.

---

## Normal

Current sentence emphasized.

Translation hidden.

Playback controls prioritized.

Loop enabled.

Today's default balance.

---

## Immersion

Japanese only.

Minimal interface.

Video slightly larger.

Maximum focus.

The old "Immersion Mode" — unchanged in substance, now correctly scoped as a display preset of
Shadowing.

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
```

- [ ] **Step 6: Add the new Reading Settings**

Find:

```markdown
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
```

Replace:

```markdown
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
```

- [ ] **Step 7: Extend the Companion section across all four Learning Modes**

Find:

```markdown
# Companion

✕ Not Supported. Shadowing is an active acquisition loop
(`docs/design/design-reconciliation.md` §4, Learning Loop Boundary) — Companion is Dormant
throughout Shadowing. This is structurally enforced: no `CompanionAnchor` may mount on the
shadowing route (L9b scan test). Companion does not appear during the session; any reflection it
has about a completed shadowing session surfaces later, on a surface where Companion is Available
(Dashboard, `/journal`) — never inside Shadowing itself.
```

Replace:

```markdown
# Companion

✕ Not Supported, across all four Learning Modes (Shadowing, Pronunciation, Dictation, Summary) —
each is an active acquisition loop (`docs/design/design-reconciliation.md` §4, Learning Loop
Boundary), Companion is Dormant throughout. This is structurally enforced: no `CompanionAnchor` may
mount anywhere in the `/shadowing/[id]/**` route group (L9b scan test). Companion does not appear
during any session; any reflection it has about a completed session surfaces later, on a surface
where Companion is Available (Dashboard, `/journal`) — never inside the Lesson itself.

Summary Mode was explicitly considered as a possible Companion touchpoint and rejected — Summary
understands the lesson, Companion understands the learner; keeping this boundary intact lets future
Learning Modes be added indefinitely without ever touching Companion's architecture
(`docs/superpowers/specs/2026-07-31-shadowing-hub-lesson-workspace-design.md` §0.5, §6.8).
```

- [ ] **Step 8: Fix the Empty States section**

Find:

```markdown
# Empty States

When no transcript exists

The interface should feel hopeful.

Example

> "This video is waiting to become your next lesson."

Offer

Generate subtitles

instead of displaying an empty table.
```

Replace:

```markdown
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
```

- [ ] **Step 9: Verify**

```bash
grep -n "Shadowing Detail\|## Shadowing Mode\|## Analysis Mode" docs/design/screens/screen-shadowing-practice.md
```

Expected: no matches.

```bash
grep -n "^# Learning Modes$\|^# Shared Context & Progress$\|^# View Mode (inside Shadowing only)$\|^# Analysis$" docs/design/screens/screen-shadowing-practice.md
```

Expected: four matches, one each.

- [ ] **Step 10: Commit**

```bash
git add docs/design/screens/screen-shadowing-practice.md
git commit -m "docs(design): rename+rewrite screen-shadowing-detail.md to screen-shadowing-practice.md

Executes Consolidation spec §6 item 4 and layers in Lesson Workspace
spec §6 in the same pass: the Three-Layer Model (Learning Mode / View
Mode / Reading Settings / Analysis), the four Learning Mode routes
(Shadowing/Pronunciation/Dictation/Summary), Shared Context & Progress,
sidebar hidden-by-default across the whole route group, the old
Reading/Shadowing/Immersion/Analysis modes reframed as View Mode (3
options) plus a separate Analysis utility, new Reading Settings, and
Companion's Not Supported status extended to all four modes."
```

---

### Task 3: Mark `screen-video-detail.md` Deprecated

**Files:**
- Modify: `docs/design/screens/screen-video-detail.md`

**Interfaces:**
- Consumes: Consolidation spec §6 item 5 (verbatim wording), §0 Consequences, §3.
- Produces: the Deprecated marker every later cross-reference (Task 4, Task 6, `feature_backlog_deferred`)
  points to when explaining Video Detail has no replacement.

- [ ] **Step 1: Change the Status header and add the deprecation note**

Find:

```markdown
# Video Detail
## The Learning Overview

> **Status:** Approved

> Every video is the beginning of a learning journey.

This page introduces a learning experience.

It does not present a piece of media.

The learner should feel invited to begin studying rather than encouraged to watch.
```

Replace:

```markdown
# Video Detail
## The Learning Overview

> **Status:** Deprecated
> The standalone Video Detail concept was removed
> (`docs/superpowers/specs/2026-07-29-shadowing-hub-consolidation-design.md` §0, §5): opening a
> lesson from the Shadowing Hub now enters the learning environment (Shadowing Practice) directly,
> no intermediate detail page. Essential metadata (title, JLPT level, source) already lives on the
> Hub's lesson card and the Lesson header; the rest is explicitly **not** transferred to Companion as
> a replacement responsibility (`docs/design/design-reconciliation.md` §2). **This screen is
> retained only for historical documentation and migration traceability. It must not be used as the
> basis for future UI work.**

> Every video is the beginning of a learning journey.

This page introduces a learning experience.

It does not present a piece of media.

The learner should feel invited to begin studying rather than encouraged to watch.
```

No other edits — the rest of the file stays as historical record per the Design Document Lifecycle
(`docs/design/design-reconciliation.md` §7).

- [ ] **Step 2: Verify**

```bash
grep -n "Status:\*\* Deprecated\|must not be used as the basis for future UI work" docs/design/screens/screen-video-detail.md
```

Expected: two matches.

- [ ] **Step 3: Commit**

```bash
git add docs/design/screens/screen-video-detail.md
git commit -m "docs(design): mark screen-video-detail.md Deprecated

No replacement screen — essential metadata moved to the Shadowing
Hub's lesson card and the Lesson header. Kept only for historical
traceability, per Consolidation spec §6 item 5."
```

---

## Phase 2 — Governance docs

### Task 4: Fix `docs/design/screens/navigation-system.md`

**Files:**
- Modify: `docs/design/screens/navigation-system.md`

**Interfaces:**
- Consumes: Consolidation spec §1 (Naming Principle, invariant wording), §5, §6 item 6. Files
  produced by Tasks 1–2 (`screen-shadowing-hub.md`, `screen-shadowing-practice.md`).
- Produces: the `shadowing` NAV_ITEMS row and the Naming Principle section Task 6
  (`screen-architecture.md`) cross-references.

- [ ] **Step 1: Swap the NAV_ITEMS row**

Find:

```markdown
| 5 | `videos` | `/videos` |
```

Replace:

```markdown
| 5 | `shadowing` | `/shadowing` |
```

- [ ] **Step 2: Disambiguate "Shadowing" in the acquisition-loop prose**

Find:

```markdown
All 14 are shipped today — none are Planned or aspirational. Active acquisition-loop sub-routes
(Shadowing, Dictation, JLPT test-taking, SRS review, Mining review session) are reached by drilling
into their parent item (e.g. `/videos/[id]/shadowing`), never listed as their own top-level nav entry
— this keeps the acquisition loops off the persistent chrome, consistent with the Learning Loop
Boundary (`docs/design/design-reconciliation.md` §4). There is no dedicated Search entry in this list
— Search is a persistent affordance inside the Nav Column chrome itself, not a separate destination
(see `docs/design/screens/screen-search.md` § Entry Points).
```

Replace:

```markdown
All 14 are shipped today — none are Planned or aspirational. Active acquisition-loop sub-routes
(Shadowing Practice, Pronunciation, Dictation, JLPT test-taking, SRS review, Mining review session)
are reached by drilling into their parent item (e.g. `/shadowing/[id]`), never listed as their own
top-level nav entry — this keeps the acquisition loops off the persistent chrome, consistent with
the Learning Loop Boundary (`docs/design/design-reconciliation.md` §4). "Shadowing" as a top-level
nav entry names the **Shadowing Hub** (`screen-shadowing-hub.md`) — the learner's home for browsing
and resuming lessons, itself not an acquisition loop; **Shadowing Practice** (`screen-shadowing-
practice.md`), reached by drilling into a specific lesson, is the acquisition loop this paragraph's
ban is about. The two are not the same destination and must not be conflated when reading "Shadowing"
elsewhere in this document. There is no dedicated Search entry in this list — Search is a persistent
affordance inside the Nav Column chrome itself, not a separate destination
(see `docs/design/screens/screen-search.md` § Entry Points).
```

- [ ] **Step 3: Insert the Naming Principle section under Purpose**

Find:

```markdown
# Purpose

Navigation is a single, low-noise surface for arriving somewhere. It is not a dashboard, not a status
display, and not a place where Companion or Gamification speak. Its only job is: get the learner from
"I want to do X" to the screen for X, with the least visual weight possible.

---

# Navigation Inventory
```

Replace:

```markdown
# Purpose

Navigation is a single, low-noise surface for arriving somewhere. It is not a dashboard, not a status
display, and not a place where Companion or Gamification speak. Its only job is: get the learner from
"I want to do X" to the screen for X, with the least visual weight possible.

---

# Naming Principle

> **Product-facing destinations are named after learner intent, never implementation.**

This is an architectural invariant, not a one-off naming preference
(`docs/superpowers/specs/2026-07-29-shadowing-hub-consolidation-design.md` §1) — the rule that makes
`videos` → `shadowing` more than a cosmetic rename, and the rule any future nav item or screen name
must pass before it ships. Applied retroactively, it disqualifies an entire class of names without
needing a fresh argument each time: "Videos," "Clips," "Media," "Assets" — anything named for the
content type backing a feature rather than the learner's reason for being there. It already governs
why `/mining` is not called `/clips` or `/flashcard-export`, even though no one wrote that rule down
until now.

---

# Navigation Inventory
```

- [ ] **Step 4: Fix the Companion & Navigation anchor line**

Find:

```markdown
- Anchor availability today (`design-reconciliation.md` §6) is Available at Dashboard, `/journal`,
  and — in their empty states specifically — `/videos` and `/mining`; all other nav destinations
  are Planned or Not Supported for Companion. The nav item itself looks identical either way —
  availability is a property of the destination screen, not of the nav link.
```

Replace:

```markdown
- Anchor availability today (`design-reconciliation.md` §6) is Available at Dashboard, `/journal`,
  and — in their empty states specifically — `/shadowing` and `/mining`; all other nav destinations
  are Planned or Not Supported for Companion. The nav item itself looks identical either way —
  availability is a property of the destination screen, not of the nav link.
```

- [ ] **Step 5: Verify**

```bash
grep -n "\`videos\`\s*|\s*\`/videos\`" docs/design/screens/navigation-system.md
grep -n "^# Naming Principle$" docs/design/screens/navigation-system.md
```

Expected: first command no matches, second one match.

- [ ] **Step 6: Commit**

```bash
git add docs/design/screens/navigation-system.md
git commit -m "docs(design): swap videos->shadowing in NAV_ITEMS, add Naming Principle

Consolidation spec §6 item 6: NAV_ITEMS row, disambiguated Shadowing
Hub vs Shadowing Practice in the acquisition-loop prose, the Naming
Principle invariant section, and the /videos->/shadowing anchor line."
```

---

### Task 5: Fix `docs/design/design-reconciliation.md`

**Files:**
- Modify: `docs/design/design-reconciliation.md`

**Interfaces:**
- Consumes: Consolidation spec §3 (Companion "not a replacement" rule), §4 (Hub/Dashboard split),
  §5 (rename table), §6 item 7. Lesson Workspace spec §6.8 (Companion Not Supported across all four
  Learning Modes — folded into the same §6 table edit).
- Produces: the updated Version 1.2 governance doc every screen/pattern doc in this plan cites.

- [ ] **Step 1: Add the "not a replacement for a removed screen" bullet to §2**

Find:

```markdown
## 2. Companion Rules

- Companion never interrupts learning loops (§4, Learning Loop Boundary).
- Companion presence is controlled by the Ambient Layer
  (`components/companion/ambient-provider.tsx`), never by an individual screen.
- Companion does not own gamification and never narrates it (§3).
- Companion does not replace progress systems — it sits beside them, not instead of them.
```

Replace:

```markdown
## 2. Companion Rules

- Companion never interrupts learning loops (§4, Learning Loop Boundary).
- Companion presence is controlled by the Ambient Layer
  (`components/companion/ambient-provider.tsx`), never by an individual screen.
- Companion does not own gamification and never narrates it (§3).
- Companion does not replace progress systems — it sits beside them, not instead of them.
- **Removing a screen does not imply moving its responsibilities into Companion.** Companion
  provides context only where it already would have, on surfaces where it already speaks. It does
  not exist to backfill a screen that was just removed, and a missing UI is never, by itself, a
  reason to add a new Companion touchpoint
  (`docs/superpowers/specs/2026-07-29-shadowing-hub-consolidation-design.md` §3).
```

- [ ] **Step 2: Add the Hub/Dashboard split to §3**

Find:

```markdown
### Layer Responsibility Rule

Every screen that shows both layers documents which layer owns which information:

| Layer | Allowed | Forbidden |
|---|---|---|
| Gamification | XP, Streak, Progress, Goal completion | — |
| Companion | Memory, Reflection, Journey meaning | Reacting to XP/streak/leaderboard changes |

Example — Dashboard:
```

Replace:

```markdown
### Layer Responsibility Rule

Every screen that shows both layers documents which layer owns which information:

| Layer | Allowed | Forbidden |
|---|---|---|
| Gamification | XP, Streak, Progress, Goal completion | — |
| Companion | Memory, Reflection, Journey meaning | Reacting to XP/streak/leaderboard changes |

**Shadowing Hub vs. Dashboard split.** Both surfaces show progress-shaped Gamification content;
without an explicit split, "where does streak / current session / weekly progress live" gets
re-litigated every time either screen is touched
(`docs/superpowers/specs/2026-07-29-shadowing-hub-consolidation-design.md` §4):

> **Shadowing Hub owns learning continuity** — current session (in progress, resume action), weekly
> record framed as "how is my practice going right now," the immediate next step.
>
> **Dashboard owns long-term progress** — arrival/overview, historical trends, milestones over time,
> the broader relationship with the whole product, not just Shadowing.

Both are Gamification-Layer content — this split is about *which screen*, never about *whether* the
information is shown.

Example — Dashboard:
```

- [ ] **Step 3: Fix the §6 Available-anchors bullet and the Anchor Availability table**

Find:

```markdown
- **Available** — shipped today (L9b D3: Dashboard, `/journal`, Video Library empty state, Mining
  deck empty state).
```

Replace:

```markdown
- **Available** — shipped today (L9b D3: Dashboard, `/journal`, Shadowing Hub empty state, Mining
  deck empty state).
```

Find:

```markdown
| Surface | Status | Reason |
|---|---|---|
| Dashboard | Available | L9b shipped this anchor |
| `/journal` | Available | L9b shipped this anchor |
| Video Library (empty state) | Available | L9b shipped this anchor |
| Mining deck (empty state) | Available | L9b shipped this anchor |
| Video Detail | Planned | Architecture allows it; not yet built |
| Mining Browse (non-empty) | Planned | Architecture allows it; not yet built |
| Video Library (non-empty) | Planned | Architecture allows it; not yet built |
| Shadowing / Review / Dictation / SRS review / JLPT / Grammar / Vocab / Kanji / Conversation | Not Supported | Active acquisition loop (§4) |
```

Replace:

```markdown
| Surface | Status | Reason |
|---|---|---|
| Dashboard | Available | L9b shipped this anchor |
| `/journal` | Available | L9b shipped this anchor |
| Shadowing Hub (empty state) | Available | L9b shipped this anchor |
| Mining deck (empty state) | Available | L9b shipped this anchor |
| Mining Browse (non-empty) | Planned | Architecture allows it; not yet built |
| Shadowing Hub (non-empty) | Planned | Architecture allows it; not yet built |
| Shadowing Practice / Pronunciation / Dictation / Summary / Review / SRS review / JLPT / Grammar / Vocab / Kanji / Conversation | Not Supported | Active acquisition loop (§4) |
```

- [ ] **Step 4: Fix the §12 compliance paragraph**

Find:

```markdown
**§8 compliance for existing screen docs.** The seven screen docs edited during the initial
reconciliation pass (`screen-architecture.md`, `screen-dashboard.md`, `screen-video-library.md`,
`screen-review.md`, `screen-shadowing-detail.md`, `screen-mining.md`, `screen-video-detail.md`)
predate the full §8 checklist and do not yet define every required state (Loading, Success, Error
states in particular). §8 is mandatory for every *new* screen doc from the moment it's created.
Bringing the seven existing docs into full compliance is a separate, deferred follow-up — not done
in this pass — tracked here so the gap is visible rather than silently assumed.
```

Replace:

```markdown
**§8 compliance for existing screen docs.** The six screen docs edited during the initial
reconciliation pass (`screen-architecture.md`, `screen-dashboard.md`, `screen-shadowing-hub.md`,
`screen-review.md`, `screen-shadowing-practice.md`, `screen-mining.md`) predate the full §8
checklist and do not yet define every required state (Loading, Success, Error states in
particular). §8 is mandatory for every *new* screen doc from the moment it's created. Bringing the
six existing docs into full compliance is a separate, deferred follow-up — not done in this pass —
tracked here so the gap is visible rather than silently assumed. `screen-video-detail.md` is
excluded from this list: it is Deprecated (§7), and deprecated docs are not held to §8 compliance.
```

- [ ] **Step 5: Bump the version header**

Find:

```markdown
> **Status:** Canonical
> **Version:** 1.1 (2026-07-29)
```

Replace:

```markdown
> **Status:** Canonical
> **Version:** 1.2 (2026-07-31)
```

- [ ] **Step 6: Verify**

```bash
grep -n "Video Library\|Video Detail | Planned" docs/design/design-reconciliation.md
```

Expected: no matches.

```bash
grep -n "Version:\*\* 1.2" docs/design/design-reconciliation.md
```

Expected: one match.

- [ ] **Step 7: Commit**

```bash
git add docs/design/design-reconciliation.md
git commit -m "docs(design): reconcile design-reconciliation.md with Shadowing Hub rename

Consolidation spec §6 item 7: §2 'not a replacement for a removed
screen' bullet, §3 Hub/Dashboard continuity-vs-progress split, §6
Anchor Availability table renamed/pruned (also folds in Lesson
Workspace spec §6.8's confirmation that all four Learning Modes are
Not Supported), §12 backlog list updated, version bumped to 1.2."
```

---

### Task 6: Fix `docs/design/screens/screen-architecture.md`

**Files:**
- Modify: `docs/design/screens/screen-architecture.md`

**Interfaces:**
- Consumes: Consolidation spec §1, §5, §6 item 8. Lesson Workspace spec §8.1 (three follow-ups on
  top of the Consolidation edit).
- Produces: the corrected Workspace examples, Workspace Priority, and Emotional Hierarchy sections
  no other task in this plan depends on, but which `screen-dashboard.md`'s and `workspace-
  patterns.md`'s "primary workspace" language assumes stays internally consistent.

- [ ] **Step 1: Fix the Layer 2 Workspace examples list**

Find:

```markdown
# Layer 2 — Workspace

The Workspace is the heart of every screen.

Every screen has exactly one primary workspace.

Examples:

Dashboard

→ Learning Overview

Video Detail

→ Reading Workspace

Shadowing

→ Transcript Workspace

Journal

→ Reflection Workspace

Mining

→ Vocabulary Collection

Settings

→ Configuration Workspace (target design — no `/settings` route ships today; see
`docs/design/patterns/settings-patterns.md`, Draft/roadmap, and
`docs/design/screens/navigation-system.md` § Settings Entry Point)

The Workspace should visually occupy most of the screen.

Everything else exists to support it.
```

Replace:

```markdown
# Layer 2 — Workspace

The Workspace is the heart of every screen.

Every screen has exactly one primary workspace.

Examples:

Dashboard

→ Learning Overview

Shadowing Practice

→ Transcript Workspace

Journal

→ Reflection Workspace

Mining

→ Vocabulary Collection

Settings

→ Configuration Workspace (target design — no `/settings` route ships today; see
`docs/design/patterns/settings-patterns.md`, Draft/roadmap, and
`docs/design/screens/navigation-system.md` § Settings Entry Point)

**One Lesson route now hosts one workspace *per Learning Mode*** (Shadowing / Pronunciation /
Dictation / Summary, `docs/superpowers/specs/2026-07-31-shadowing-hub-lesson-workspace-design.md`
§6.1–§6.2), all sharing one lesson. This rule — "every screen has exactly one primary workspace" —
still holds *per Learning Mode*; it no longer holds *per route* the way this list implied when
Video Detail was still a separate screen.

The Workspace should visually occupy most of the screen.

Everything else exists to support it.
```

- [ ] **Step 2: Fix the Workspace Priority examples**

Find:

```markdown
# Workspace Priority

Every screen should answer one question:

> What is the learner trying to experience right now?

Not:

> Which feature are they using?

Examples:

The Shadowing screen is about speaking.

The Video Detail screen is about understanding.

The Journal is about remembering.

The Dashboard is about arriving.

Design should reinforce this intention.
```

Replace:

```markdown
# Workspace Priority

Every screen should answer one question:

> What is the learner trying to experience right now?

Not:

> Which feature are they using?

Examples:

The Shadowing mode is about speaking.

The Pronunciation mode is about speaking accuracy.

The Dictation mode is about focused listening.

The Summary mode is about remembering.

The Journal is about remembering.

The Dashboard is about arriving.

Design should reinforce this intention.
```

- [ ] **Step 3: Fix the Emotional Hierarchy table**

Find:

```markdown
# Emotional Hierarchy

Every screen should communicate one primary emotion.

| Screen | Emotional Purpose |
|---------|-------------------|
| Dashboard | Arrival |
| Videos Library | Discovery |
| Video Detail | Understanding |
| Shadowing | Practice |
| Mining | Collection |
| Journal | Reflection |
| Settings | Preparation (target design — not yet a shipped route, see `settings-patterns.md`) |

Visual design should reinforce these emotional roles.
```

Replace:

```markdown
# Emotional Hierarchy

Every screen should communicate one primary emotion.

| Screen | Emotional Purpose |
|---------|-------------------|
| Dashboard | Arrival |
| Shadowing Hub | Discovery |
| Shadowing Practice | Practice |
| Mining | Collection |
| Journal | Reflection |
| Settings | Preparation (target design — not yet a shipped route, see `settings-patterns.md`) |

Pronunciation, Dictation, and Summary do **not** each get their own row — they are modes within the
one "Shadowing Practice | Practice" row above, not separate screens with separate emotional
categories (`docs/superpowers/specs/2026-07-31-shadowing-hub-lesson-workspace-design.md` §8.1). This
is stated explicitly so a future editor does not fragment this table as more Learning Modes ship.

Visual design should reinforce these emotional roles.
```

- [ ] **Step 4: Add the Naming Principle bullet to Shared Design Rules**

Find:

```markdown
# Shared Design Rules

Across the product:

- Calm over excitement.
- Reading over clicking.
- Presence over notifications.
- Comfort over density.
- Focus over productivity.
- Trust over gamification.
- Beauty over decoration.
- Atmosphere over visual effects.
- Consistency over novelty.

These principles should guide every design decision.
```

Replace:

```markdown
# Shared Design Rules

Across the product:

- Calm over excitement.
- Reading over clicking.
- Presence over notifications.
- Comfort over density.
- Focus over productivity.
- Trust over gamification.
- Beauty over decoration.
- Atmosphere over visual effects.
- Consistency over novelty.
- Learner intent over implementation (`docs/design/screens/navigation-system.md` § Naming
  Principle — product-facing destinations are named after learner intent, never implementation).

These principles should guide every design decision.
```

- [ ] **Step 5: Verify**

```bash
grep -n "Video Detail\|Videos Library" docs/design/screens/screen-architecture.md
```

Expected: no matches.

```bash
grep -n "do \*\*not\*\* each get their own row" docs/design/screens/screen-architecture.md
```

Expected: one match.

- [ ] **Step 6: Commit**

```bash
git add docs/design/screens/screen-architecture.md
git commit -m "docs(design): fix screen-architecture.md for the Shadowing Hub/Lesson rename

Consolidation spec §6 item 8 (Workspace examples, Emotional
Hierarchy, Naming Principle bullet) plus Lesson Workspace spec
§8.1's three follow-ups: the per-Learning-Mode workspace note,
one-line purpose statements for Pronunciation/Dictation/Summary,
and the explicit no-separate-rows confirmation on Emotional
Hierarchy."
```

---

### Task 7: Fix `docs/design/screens/screen-dashboard.md`

**Files:**
- Modify: `docs/design/screens/screen-dashboard.md`

**Interfaces:**
- Consumes: Consolidation spec §4, §6 item 9. Task 1's `screen-shadowing-hub.md` (the file this
  cross-reference points to).
- Produces: nothing consumed elsewhere in this plan — a discoverability improvement only.

- [ ] **Step 1: Add the cross-reference to the Progress section**

Find:

```markdown
# Progress

The Dashboard shows both layers side by side — each owns different information
(`docs/design/design-reconciliation.md` §3, Layer Responsibility Rule):

| Layer | Allowed | Forbidden |
|---|---|---|
| Gamification | XP, Streak, Progress, Goal completion | — |
| Companion | Memory, Reflection, Journey meaning | Reacting to XP/streak changes |

Gamification examples (shipped: `StreakCard`):
```

Replace:

```markdown
# Progress

The Dashboard shows both layers side by side — each owns different information
(`docs/design/design-reconciliation.md` §3, Layer Responsibility Rule). Dashboard owns long-term
progress specifically — arrival/overview, historical trends, milestones over time — as distinct from
`screen-shadowing-hub.md`, which owns learning *continuity* (current session, weekly record); see
that file's own Layer Responsibility table for the Hub-side half of this split:

| Layer | Allowed | Forbidden |
|---|---|---|
| Gamification | XP, Streak, Progress, Goal completion | — |
| Companion | Memory, Reflection, Journey meaning | Reacting to XP/streak changes |

Gamification examples (shipped: `StreakCard`):
```

- [ ] **Step 2: Verify**

```bash
grep -n "screen-shadowing-hub.md" docs/design/screens/screen-dashboard.md
ls docs/design/screens/screen-shadowing-hub.md
```

Expected: first command one match, second prints the file path.

- [ ] **Step 3: Commit**

```bash
git add docs/design/screens/screen-dashboard.md
git commit -m "docs(design): cross-reference screen-shadowing-hub.md from screen-dashboard.md Progress

Consolidation spec §6 item 9 — makes the Hub/Dashboard
continuity-vs-progress split discoverable from both sides."
```

---

## Phase 3 — Terminology sweep (cross-references only)

### Task 8: Fix `docs/design/screens/workspace-patterns.md`

**Files:**
- Modify: `docs/design/screens/workspace-patterns.md`

**Interfaces:**
- Consumes: Consolidation spec §6 item 10. Files from Tasks 1–2.
- Produces: nothing consumed elsewhere — a cross-reference fix only.

- [ ] **Step 1: Fix the Philosophy "instead of designing" list**

Find:

```markdown
Instead of designing:

Dashboard

Video Detail

Shadowing

Journal

we design:

Reading Workspace

Collection Workspace

Reflection Workspace

Overview Workspace
```

Replace:

```markdown
Instead of designing:

Dashboard

Shadowing Practice

Journal

we design:

Reading Workspace

Collection Workspace

Reflection Workspace

Overview Workspace
```

- [ ] **Step 2: Fix Pattern 01's "Ideal for" list**

Find:

```markdown
# Pattern 01 — Reading Workspace

Purpose

Understanding Japanese.

Ideal for:

Video Detail

Transcript

Grammar

Dictionary
```

Replace:

```markdown
# Pattern 01 — Reading Workspace

Purpose

Understanding Japanese.

Ideal for:

Shadowing (Reading Mode)

Transcript

Grammar

Dictionary
```

- [ ] **Step 3: Fix the Pattern Composition examples**

Find:

```markdown
Example

Shadowing Detail

Split Workspace

+

Reading Workspace

+

Bottom Utility Drawer

+

Floating Controls

+

Focus Workspace

---

Video Detail

Reading Workspace

+

Inspector

+

Floating Controls
```

Replace:

```markdown
Example

Shadowing Practice

Split Workspace

+

Reading Workspace

+

Bottom Utility Drawer

+

Floating Controls

+

Focus Workspace

---

Shadowing Practice (Reading View Mode)

Reading Workspace

+

Inspector

+

Floating Controls
```

- [ ] **Step 4: Verify**

```bash
grep -n "Video Detail\|Shadowing Detail" docs/design/screens/workspace-patterns.md
```

Expected: no matches.

- [ ] **Step 5: Commit**

```bash
git add docs/design/screens/workspace-patterns.md
git commit -m "docs(design): fix stale Video Detail/Shadowing Detail references in workspace-patterns.md

Consolidation spec §6 item 10 — three occurrences resolved per local
context, plus the composition example's own 'Shadowing Detail'
heading."
```

---

### Task 9: Fix `docs/design/screens/learning-surfaces.md`

**Files:**
- Modify: `docs/design/screens/learning-surfaces.md`

**Interfaces:**
- Consumes: Consolidation spec §6 item 11. Files from Tasks 1–2.
- Produces: nothing consumed elsewhere — a cross-reference fix only.

- [ ] **Step 1: Merge Video Detail into the Shadowing Surface Composition entry, rename Videos Library**

Find:

```markdown
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
```

Replace:

```markdown
Dashboard

Overview Surface

+

Discovery Surface

+

Reflection Surface

---

Shadowing Hub

Discovery Surface

+

Collection Surface

---

Shadowing Practice

Reading Surface

+

Shadowing Surface

+

Media Surface

+

Utility Surface

+

Bottom Utility Surface

Merged from the former separate "Video Detail" entry (Reading Surface + Media Surface + Utility
Surface) — Video Detail is deprecated and its composition folds into this one screen's Reading View
Mode (`docs/superpowers/specs/2026-07-29-shadowing-hub-consolidation-design.md` §5). Companion
Surface is intentionally absent here — Shadowing Practice is a Not Supported active acquisition loop
(`docs/design/design-reconciliation.md` §4, Learning Loop Boundary).
```

- [ ] **Step 2: Verify**

```bash
grep -n "^Videos Library$\|^Video Detail$" docs/design/screens/learning-surfaces.md
```

Expected: no matches.

- [ ] **Step 3: Commit**

```bash
git add docs/design/screens/learning-surfaces.md
git commit -m "docs(design): merge Video Detail into Shadowing in learning-surfaces.md composition

Consolidation spec §6 item 11 — Videos Library renamed to Shadowing
Hub, Video Detail's surface composition folded into the single
Shadowing Practice entry rather than left as two rows for one
deprecated screen."
```

---

### Task 10: Fix `docs/design/screens/screen-mining.md`

**Files:**
- Modify: `docs/design/screens/screen-mining.md`

**Interfaces:**
- Consumes: Consolidation spec §6 item 12. Files from Tasks 1–2.
- Produces: nothing consumed elsewhere — a cross-reference fix only.

- [ ] **Step 1: Collapse the two stale entries into one**

Find:

```markdown
# Relationship With Other Screens

Mining receives vocabulary from

- Shadowing Detail
- Video Detail
- Dictionary
- AI Suggestions

Mining sends learners back to

- Shadowing
- Original Scene
- Review

Mining is a living archive,

not the final destination.
```

Replace:

```markdown
# Relationship With Other Screens

Mining receives vocabulary from

- Shadowing Practice
- Dictionary
- AI Suggestions

Mining sends learners back to

- Shadowing Practice
- Original Scene
- Review

Mining is a living archive,

not the final destination.
```

- [ ] **Step 2: Verify**

```bash
grep -n "Shadowing Detail\|Video Detail" docs/design/screens/screen-mining.md
```

Expected: no matches.

- [ ] **Step 3: Commit**

```bash
git add docs/design/screens/screen-mining.md
git commit -m "docs(design): collapse Shadowing Detail/Video Detail into Shadowing Practice in screen-mining.md

Consolidation spec §6 item 12."
```

---

### Task 11: Fix `docs/design/screens/screen-review.md`

**Files:**
- Modify: `docs/design/screens/screen-review.md`

**Interfaces:**
- Consumes: Consolidation spec §6 item 13. Task 1's `screen-shadowing-hub.md`.
- Produces: nothing consumed elsewhere — a cross-reference fix only.

- [ ] **Step 1: Fix the Gentle Progress cross-reference**

Find:

```markdown
These are real Gamification-owned metrics elsewhere (Dashboard) — this screen just doesn't repeat
them here, the same way `docs/design/screens/screen-video-library.md`'s Progress section handles it
(`docs/design/design-reconciliation.md` §3).
```

Replace:

```markdown
These are real Gamification-owned metrics elsewhere (Dashboard) — this screen just doesn't repeat
them here, the same way `docs/design/screens/screen-shadowing-hub.md`'s Progress section handles it
(`docs/design/design-reconciliation.md` §3).
```

- [ ] **Step 2: Fix the Empty State offer copy**

Find:

```markdown
Offer

Browse Library

Open Journal

Continue Shadowing
```

Replace:

```markdown
Offer

Browse Shadowing Hub

Open Journal

Continue Shadowing
```

- [ ] **Step 3: Verify**

```bash
grep -n "screen-video-library.md\|Browse Library" docs/design/screens/screen-review.md
```

Expected: no matches.

- [ ] **Step 4: Commit**

```bash
git add docs/design/screens/screen-review.md
git commit -m "docs(design): fix screen-video-library.md cross-reference in screen-review.md

Consolidation spec §6 item 13, plus the Empty State's own 'Browse
Library' offer copy caught in the same pass."
```

---

### Task 12: Fix `docs/design/screens/screen-search.md`

**Files:**
- Modify: `docs/design/screens/screen-search.md`

**Interfaces:**
- Consumes: Consolidation spec §6 item 14. Files from Tasks 1–2.
- Produces: nothing consumed elsewhere — a cross-reference fix only.

- [ ] **Step 1: Fix the Companion Result anchor list**

Find:

```markdown
# Companion Result

○ Planned — chưa implement. Search is not one of L9b (D3)'s four shipped Companion anchors (Dashboard,
`/journal`, Video Library empty state, Mining deck empty state) — see
`docs/design/design-reconciliation.md` §6. The behavior below describes the target design once this
anchor is built, not current behavior.
```

Replace:

```markdown
# Companion Result

○ Planned — chưa implement. Search is not one of L9b (D3)'s four shipped Companion anchors (Dashboard,
`/journal`, Shadowing Hub empty state, Mining deck empty state) — see
`docs/design/design-reconciliation.md` §6. The behavior below describes the target design once this
anchor is built, not current behavior.
```

- [ ] **Step 2: Fix the Sentence Result destination**

Find:

```markdown
Clicking opens

Shadowing Detail

at exactly that sentence.
```

Replace:

```markdown
Clicking opens

Shadowing Practice

at exactly that sentence.
```

- [ ] **Step 3: Fix the Relationship With Other Screens flow (found in execution — same class of stale reference the Consolidation spec's own audit missed here)**

Find:

```markdown
Search connects every screen.

Dashboard

↓

Videos

↓

Shadowing

↓

Mining

↓

Journal

↓

Settings (target design — no `/settings` route ships today, see
`docs/design/screens/navigation-system.md` § Settings Entry Point)
```

Replace:

```markdown
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
```

- [ ] **Step 4: Verify**

```bash
grep -n "Video Library\|Shadowing Detail\|^Videos$" docs/design/screens/screen-search.md
```

Expected: no matches.

- [ ] **Step 5: Commit**

```bash
git add docs/design/screens/screen-search.md
git commit -m "docs(design): fix stale Video Library/Shadowing Detail references in screen-search.md

Consolidation spec §6 item 14 (Companion Result anchor list), plus
two more stale references (Sentence Result destination, Relationship
With Other Screens flow) found while auditing this file's full
content, not just the one line the spec named."
```

---

### Task 13: Fix `docs/design/screens/adaptive-layouts.md`

**Files:**
- Modify: `docs/design/screens/adaptive-layouts.md`

**Interfaces:**
- Consumes: Consolidation spec §6 item 15. Task 1's `screen-shadowing-hub.md`.
- Produces: nothing consumed elsewhere — a cross-reference fix only.

- [ ] **Step 1: Fix the Companion Adaptation surface list**

Find:

```markdown
**On surfaces where Companion is Available or Planned** (§6 — Dashboard, `/journal`, Video Library,
Mining browse/collection), the Companion behaves differently depending on focus:
```

Replace:

```markdown
**On surfaces where Companion is Available or Planned** (§6 — Dashboard, `/journal`, Shadowing Hub,
Mining browse/collection), the Companion behaves differently depending on focus:
```

- [ ] **Step 2: Verify**

```bash
grep -n "Video Library" docs/design/screens/adaptive-layouts.md
```

Expected: no matches.

- [ ] **Step 3: Commit**

```bash
git add docs/design/screens/adaptive-layouts.md
git commit -m "docs(design): fix Video Library reference in adaptive-layouts.md Companion Adaptation

Consolidation spec §6 item 15."
```

---

### Task 14: Fix `docs/design/patterns/empty-states.md`

**Files:**
- Modify: `docs/design/patterns/empty-states.md`

**Interfaces:**
- Consumes: Consolidation spec §6 item 16. Task 1's `screen-shadowing-hub.md`.
- Produces: nothing consumed elsewhere — a cross-reference fix only.

- [ ] **Step 1: Fix the header Related list**

Find:

```markdown
> **Related:** `feedback-patterns.md`, `companion-patterns.md`, `screen-video-library.md`, `screen-dashboard.md`, `microcopy-guidelines.md`, `emotion-design.md`, `docs/design/design-reconciliation.md`
```

Replace:

```markdown
> **Related:** `feedback-patterns.md`, `companion-patterns.md`, `screen-shadowing-hub.md`, `screen-dashboard.md`, `microcopy-guidelines.md`, `emotion-design.md`, `docs/design/design-reconciliation.md`
```

- [ ] **Step 2: Verify**

```bash
grep -n "screen-video-library.md" docs/design/patterns/empty-states.md
ls docs/design/screens/screen-shadowing-hub.md
```

Expected: first command no matches, second prints the file path.

- [ ] **Step 3: Commit**

```bash
git add docs/design/patterns/empty-states.md
git commit -m "docs(design-patterns): fix screen-video-library.md cross-reference in empty-states.md

Consolidation spec §6 item 16."
```

---

### Task 15: Fix `docs/design/patterns/transcript-patterns.md`

**Files:**
- Modify: `docs/design/patterns/transcript-patterns.md`

**Interfaces:**
- Consumes: Consolidation spec §6 item 17.
- Produces: nothing consumed elsewhere — a cross-reference fix only.

- [ ] **Step 1: Fix the Applies-to line**

Find:

```markdown
> **Applies to:** Entire Product (Video Detail, Shadowing, Dictation, Reading, Mining)  
```

Replace:

```markdown
> **Applies to:** Entire Product (Shadowing Practice, Dictation, Reading, Mining)  
```

- [ ] **Step 2: Verify**

```bash
grep -n "Video Detail" docs/design/patterns/transcript-patterns.md
```

Expected: no matches.

- [ ] **Step 3: Commit**

```bash
git add docs/design/patterns/transcript-patterns.md
git commit -m "docs(design-patterns): drop deprecated Video Detail from transcript-patterns.md Applies-to line

Consolidation spec §6 item 17. docs/design/patterns/video-patterns.md
is deliberately NOT touched by this plan — it already frames video
as supporting the transcript, no edit needed."
```

---

## Phase 4 — Lesson Workspace spec gap fixes (§8.1)

### Task 16: Fix `docs/design/patterns/study-modes.md`

**Files:**
- Modify: `docs/design/patterns/study-modes.md`

**Interfaces:**
- Consumes: Lesson Workspace spec §8.1 (first bullet). Task 2's `screen-shadowing-practice.md`.
- Produces: nothing consumed elsewhere — a cross-reference fix only.

- [ ] **Step 1: Fix the header Related list**

Find:

```markdown
> **Applies to:** Shadowing Workspace, Review Workspace, Reading Workspace  
> **Related:** `learning-surfaces.md`, `workspace-patterns.md`, `screen-shadowing-detail.md`, `screen-review.md`, `interaction-principles.md`
```

Replace:

```markdown
> **Applies to:** Shadowing Workspace, Review Workspace, Reading Workspace  
> **Related:** `learning-surfaces.md`, `workspace-patterns.md`, `screen-shadowing-practice.md`, `screen-review.md`, `interaction-principles.md`
```

- [ ] **Step 2: Verify**

```bash
grep -n "screen-shadowing-detail.md" docs/design/patterns/study-modes.md
```

Expected: no matches.

- [ ] **Step 3: Commit**

```bash
git add docs/design/patterns/study-modes.md
git commit -m "docs(design-patterns): fix screen-shadowing-detail.md cross-reference in study-modes.md

Lesson Workspace spec §8.1 — missed by the Consolidation spec's own
Phase 4 sweep, caught by this spec's repo-wide audit."
```

---

### Task 17: Fix `docs/design/patterns/overlays-and-drawers.md`

**Files:**
- Modify: `docs/design/patterns/overlays-and-drawers.md`

**Interfaces:**
- Consumes: Lesson Workspace spec §8.1 (second bullet). Task 2's `screen-shadowing-practice.md`.
- Produces: nothing consumed elsewhere — a cross-reference fix only.

- [ ] **Step 1: Fix the header Related list**

Find:

```markdown
> **Applies to:** Entire Product  
> **Related:** `workspace-patterns.md`, `learning-surfaces.md`, `navigation-system.md`, `screen-shadowing-detail.md`, `screen-review.md`, `docs/design/design-reconciliation.md`
```

Replace:

```markdown
> **Applies to:** Entire Product  
> **Related:** `workspace-patterns.md`, `learning-surfaces.md`, `navigation-system.md`, `screen-shadowing-practice.md`, `screen-review.md`, `docs/design/design-reconciliation.md`
```

- [ ] **Step 2: Fix the inline prose sentence**

Find:

```markdown
Drawer and overlay state is independent of Companion presence. A drawer opening or closing never
changes whether Companion is Hidden or Available on the underlying screen — Companion's presence is
still governed only by the Learning Loop Boundary and Anchor Availability of that screen
(`docs/design/design-reconciliation.md` §4, §6), never by which drawer happens to be open. This
matters most on `screen-shadowing-detail.md` and `screen-review.md`, where Companion stays Hidden
regardless of any drawer opened during the session.
```

Replace:

```markdown
Drawer and overlay state is independent of Companion presence. A drawer opening or closing never
changes whether Companion is Hidden or Available on the underlying screen — Companion's presence is
still governed only by the Learning Loop Boundary and Anchor Availability of that screen
(`docs/design/design-reconciliation.md` §4, §6), never by which drawer happens to be open. This
matters most on `screen-shadowing-practice.md` and `screen-review.md`, where Companion stays Hidden
regardless of any drawer opened during the session.
```

- [ ] **Step 3: Verify**

```bash
grep -n "screen-shadowing-detail.md" docs/design/patterns/overlays-and-drawers.md
```

Expected: no matches.

- [ ] **Step 4: Commit**

```bash
git add docs/design/patterns/overlays-and-drawers.md
git commit -m "docs(design-patterns): fix screen-shadowing-detail.md cross-references in overlays-and-drawers.md

Lesson Workspace spec §8.1 — header Related list and the inline
prose sentence, both missed by the Consolidation spec's own Phase 4
sweep."
```

---

### Task 18: Fix `docs/features/F-005-learn-before-watching.md`

**Files:**
- Modify: `docs/features/F-005-learn-before-watching.md`

**Interfaces:**
- Consumes: Lesson Workspace spec §8.1 (third bullet). Consolidation spec §0 (Video Detail has no
  replacement). Lesson Workspace spec §6.7 (Lesson header).
- Produces: nothing consumed elsewhere — a stale-UI-target fix only.

- [ ] **Step 1: Move the button off the deprecated Video Detail page**

Find:

```markdown
## UI / UX
- A prominent button on video detail page.
- A quick onboarding card showing word count and estimated time.
- Preview interface: minimal, swipeable, with audio and context sentence if available.
- Progress indicator (x/18).
```

Replace:

```markdown
## UI / UX
- A prominent action, surfaced on the Shadowing Hub's lesson card or the Lesson header
  (`docs/superpowers/specs/2026-07-31-shadowing-hub-lesson-workspace-design.md` §6.7) — the standalone
  Video Detail page this button originally lived on is deprecated with no replacement
  (`docs/superpowers/specs/2026-07-29-shadowing-hub-consolidation-design.md` §0).
- A quick onboarding card showing word count and estimated time.
- Preview interface: minimal, swipeable, with audio and context sentence if available.
- Progress indicator (x/18).
```

- [ ] **Step 2: Verify**

```bash
grep -n "video detail page" docs/features/F-005-learn-before-watching.md
```

Expected: no matches.

- [ ] **Step 3: Commit**

```bash
git add docs/features/F-005-learn-before-watching.md
git commit -m "docs(features): move F-005's UI target off the deprecated Video Detail page

Lesson Workspace spec §8.1 — the Video Detail page this feature's
button was designed for no longer exists; its natural home is now
the Hub card or Lesson header."
```

---

### Task 19: Fix `docs/features/F-003-learning-journey.md`

**Files:**
- Modify: `docs/features/F-003-learning-journey.md`

**Interfaces:**
- Consumes: Lesson Workspace spec §8.1 (fourth bullet), §6.2 (Summary Learning Mode).
- Produces: nothing consumed elsewhere — a stale-UI-target fix only.

- [ ] **Step 1: Move the timeline chart into Summary Mode**

Find:

```markdown
## Workflow
1. Each time a user finishes watching a video (or at significant intervals), the system calculates comprehension % = (number of unique words in transcript that are "known" / total unique words).
2. Snapshot `(user_id, video_id, timestamp, comprehension_percent)` is saved.
3. When user views video details or dashboard, a timeline chart shows these snapshots.
4. Optionally display milestones (e.g., "First time: 18%", "Today: 67%").
```

Replace:

```markdown
## Workflow
1. Each time a user finishes watching a video (or at significant intervals), the system calculates comprehension % = (number of unique words in transcript that are "known" / total unique words).
2. Snapshot `(user_id, video_id, timestamp, comprehension_percent)` is saved.
3. This comprehension-over-time timeline belongs in the lesson's **Summary Learning Mode**
   (`docs/superpowers/specs/2026-07-31-shadowing-hub-lesson-workspace-design.md` §6.2) — a read-only
   aggregation of the lesson's own data — or the Dashboard; the standalone Video Detail page this
   originally targeted is deprecated with no replacement
   (`docs/superpowers/specs/2026-07-29-shadowing-hub-consolidation-design.md` §0).
4. Optionally display milestones (e.g., "First time: 18%", "Today: 67%").
```

- [ ] **Step 2: Fix the matching UI/UX line**

Find:

```markdown
## UI / UX
- Small line chart on video page.
- Dashboard widget: "Re-watch Progress" with several videos.
- Could show for the most recently rewatched video.
```

Replace:

```markdown
## UI / UX
- Small line chart inside the lesson's Summary Learning Mode.
- Dashboard widget: "Re-watch Progress" with several lessons.
- Could show for the most recently rewatched lesson.
```

- [ ] **Step 3: Verify**

```bash
grep -n "video details or dashboard\|line chart on video page" docs/features/F-003-learning-journey.md
```

Expected: no matches.

- [ ] **Step 4: Commit**

```bash
git add docs/features/F-003-learning-journey.md
git commit -m "docs(features): move F-003's timeline UI target into Summary Learning Mode

Lesson Workspace spec §8.1 — the Video Detail page this feature's
chart was designed for no longer exists; Summary Mode (§6.2) is its
natural home now that it exists as a concept."
```

---

### Task 20: Fix `japanese-learning-app-spec.md` §3.12

**Files:**
- Modify: `japanese-learning-app-spec.md`

**Interfaces:**
- Consumes: Lesson Workspace spec §8.1 (fifth bullet), §3.4.
- Produces: nothing consumed elsewhere — a clarifying pointer only.

- [ ] **Step 1: Add the pointer to the struck-through core-loop line**

Find:

```markdown
- ~~Free tier: giới hạn số video/ngày, số lần chấm phát âm AI/ngày~~ → core loop free & unlimited; chỉ metered việc *tạo* knowledge mới (quota Knowledge Generation)
```

Replace:

```markdown
- ~~Free tier: giới hạn số video/ngày, số lần chấm phát âm AI/ngày~~ → core loop free & unlimited; chỉ metered việc *tạo* knowledge mới (quota Knowledge Generation). **Cập nhật 2026-07-31:** "free & unlimited" chỉ đúng cho *core loop bên trong một Lesson đã mở* (Reading → Shadowing → Pronunciation → Dictation → Mining → Review) — độ rộng thư viện (Free chỉ mở lessons `FREE`-tier) và số Lesson tự tạo mỗi tháng (Free giới hạn 3/tháng) KHÔNG nằm trong "unlimited" này. Xem `docs/superpowers/specs/2026-07-31-shadowing-hub-lesson-workspace-design.md` §3.4.
```

- [ ] **Step 2: Verify**

```bash
grep -n "Cập nhật 2026-07-31" japanese-learning-app-spec.md
```

Expected: one match.

- [ ] **Step 3: Commit**

```bash
git add japanese-learning-app-spec.md
git commit -m "docs(spec): qualify the struck-through §3.12 core-loop claim

Lesson Workspace spec §8.1 — 'core loop free & unlimited' is true
only inside an already-open lesson; library breadth and lesson-
creation quota are the new exceptions this spec's Principle 3 draws.
Same banner pattern the existing SUPERSEDED note already uses,
applied one line lower where the claim actually lives."
```

---

### Task 21: Fix `docs/features/F-009-shadowing-challenge.md`

**Files:**
- Modify: `docs/features/F-009-shadowing-challenge.md`

**Interfaces:**
- Consumes: Lesson Workspace spec §8.1 (sixth bullet).
- Produces: nothing consumed elsewhere — a wording fix only.

- [ ] **Step 1: Fix the workflow step 1 wording**

Find:

```markdown
## Workflow
1. User enters "Challenge Mode" from video or dashboard.
2. System presents a random line from a video appropriate to their level (based on heatmap/difficulty).
```

Replace:

```markdown
## Workflow
1. User enters "Challenge Mode" from a lesson's Shadowing mode, or Dashboard.
2. System presents a random line from a video appropriate to their level (based on heatmap/difficulty).
```

- [ ] **Step 2: Verify**

```bash
grep -n "from video or dashboard" docs/features/F-009-shadowing-challenge.md
```

Expected: no matches.

- [ ] **Step 3: Commit**

```bash
git add docs/features/F-009-shadowing-challenge.md
git commit -m "docs(features): fix F-009's pre-Lesson-terminology workflow wording

Lesson Workspace spec §8.1 — low priority, F-009 is unbuilt, but the
wording predates both 'Lesson' terminology and Learning Modes."
```

---

## Phase 5 — Business model

### Task 22: Fix `docs/product/business-model.md`

**Files:**
- Modify: `docs/product/business-model.md`

**Interfaces:**
- Consumes: Lesson Workspace spec §3.4 (all five sub-bullets), §0.3 (philosophy line verbatim).
- Produces: the rewritten Principle 3 and §2 table every future feature-review-gate decision
  (per this doc's own §1 Product Decision Framework) will be checked against.

- [ ] **Step 1: Add the cross-reference to the header Related line**

Find:

```markdown
> **Related:** root `CLAUDE.md` §2 (non-negotiables), main spec §3.12 (Free/Premium — the Stripe
> part is superseded here), `docs/features/` (F-001..F-016), Serena memory `monetization_brainstorm`.
```

Replace:

```markdown
> **Related:** root `CLAUDE.md` §2 (non-negotiables), main spec §3.12 (Free/Premium — the Stripe
> part is superseded here), `docs/features/` (F-001..F-016), Serena memory `monetization_brainstorm`,
> `docs/superpowers/specs/2026-07-31-shadowing-hub-lesson-workspace-design.md` §3 (Lesson domain
> model + Create Lesson pipeline — rewrites Principle 3 below and adds library-breadth/lesson-
> creation rows to the §2 table).
```

- [ ] **Step 2: Rewrite Principle 3 with the core-loop clarification block**

Find:

```markdown
3. **Never lock the core loop. Premium *accelerates* learning, it does not *enable* learning.**
   The complete Video → Shadowing → Dictation → SRS → Mining loop is free and unlimited.
```

Replace:

````markdown
3. **Never lock the core learning experience. Once a learner has access to a lesson, the complete
   learning loop (Reading → Shadowing → Dictation → Review → Mining) is always available without
   feature restrictions. Premium expands the library and the ability to create new lessons, rather
   than fragmenting the learning experience.**

   **What is/isn't the core loop** (`docs/superpowers/specs/2026-07-31-shadowing-hub-lesson-
   workspace-design.md` §3.4 — read this precisely, "never lock the core loop" is easy to misread as
   "the entire library is free," which is the opposite of what it means):

   ```
   Core loop (free & unlimited, once a lesson is open):
     Create Lesson → Open Lesson → Shadowing → Pronunciation → Dictation → Mining → Review

   NOT the core loop (this is what Plus expands):
     Entire Library (breadth of which lessons can be opened)
     Unlimited Create Lesson (Free is capped at 3/month)
     AI Transcript Generation
   ```
````

- [ ] **Step 3: Add the philosophy line after Principle 6**

Find:

```markdown
6. **Every AI request must increase the long-term value of the platform.**
   Every AI call falls into exactly one of two categories — there is no valid third:
   - **Serve Knowledge** — deliver existing (cached) knowledge to the user.
   - **Generate Knowledge** — create reusable knowledge that becomes part of the shared base.

   No AI request may consume tokens without creating lasting value. This is a **feature-review gate**:
   if a proposed feature neither helps the current learner nor enriches the platform, question why it exists.

### 1.1 Gamification & notification principles (G1–G3)
```

Replace:

```markdown
6. **Every AI request must increase the long-term value of the platform.**
   Every AI call falls into exactly one of two categories — there is no valid third:
   - **Serve Knowledge** — deliver existing (cached) knowledge to the user.
   - **Generate Knowledge** — create reusable knowledge that becomes part of the shared base.

   No AI request may consume tokens without creating lasting value. This is a **feature-review gate**:
   if a proposed feature neither helps the current learner nor enriches the platform, question why it exists.

> **Nihongo Cinema does not sell lesson quality. It sells library breadth and the ability to
> create new lessons.** (`docs/superpowers/specs/2026-07-31-shadowing-hub-lesson-workspace-design.md`
> §0.3) Once a learner can open a lesson, Free and Plus get the identical learning experience inside
> it — full transcript, every Learning Mode, every Reading Setting. The difference is how many
> lessons a learner can open, and whether they can mint new ones from their own YouTube links.

### 1.1 Gamification & notification principles (G1–G3)
```

- [ ] **Step 4: Add the library-breadth, lesson-creation, and AI-transcript-generation rows to §2**

Find:

```markdown
| Capability | Free | JapanWeb+ |
|---|---|---|
| Core loop: Video → Shadowing → Dictation → SRS → Sentence Mining | ✅ unlimited | — |
| Own-voice pitch contour (client-side F0/YIN, $0) | ✅ unlimited | — |
| Kanji / Vocab / Grammar / Adaptive Furigana | ✅ | — |
| Progress / immersion dashboards, comprehension & difficulty timelines, weakness **tracking** — all *computed from your own data* | ✅ | — |
| JLPT | practice by individual section | **full mock exams** + detailed analysis |
| AI explanations | **Lite** (cached) + **preview** (~15–20% teaser) of deep sections | **full cascade deep** |
| Knowledge Generation (new/cache-miss sentences) | small quota (~2–3/day) | large / priority quota |
| Export data (transcript, notes, flashcards, vocabulary) | ✅ | — |
| AI Sensei (memory, coaching, weekly reports, personalized plan) | — | ✅ |
| Azure pronunciation scoring (accuracy/fluency/completeness + native overlay + per-word) | — | ✅ (generous internal quota) |
| Conversation partner (STT→Claude→TTS) | — | ✅ (generous monthly quota, not unlimited) |
| AI-**authored** intelligence over your data: weekly report, study plan, weakness explanation/coaching, WOW Study Replay narrative | — | ✅ |
```

Replace:

```markdown
| Capability | Free | JapanWeb+ |
|---|---|---|
| Core loop, once a lesson is open: Reading → Shadowing → Pronunciation → Dictation → Mining → Review | ✅ unlimited | — |
| Own-voice pitch contour (client-side F0/YIN, $0) | ✅ unlimited | — |
| Kanji / Vocab / Grammar / Adaptive Furigana | ✅ | — |
| Progress / immersion dashboards, comprehension & difficulty timelines, weakness **tracking** — all *computed from your own data* | ✅ | — |
| Public library breadth (which lessons can be opened) | subset (`FREE`-tier lessons only) | entire library (`FREE` + `PLUS`) |
| Personal lesson creation (Create Lesson, `docs/superpowers/specs/2026-07-31-shadowing-hub-lesson-workspace-design.md` §2) | 3/month | unlimited |
| AI Transcript Generation (no-caption fallback) | — | ✅ |
| JLPT | practice by individual section | **full mock exams** + detailed analysis |
| AI explanations | **Lite** (cached) + **preview** (~15–20% teaser) of deep sections | **full cascade deep** |
| Knowledge Generation (new/cache-miss sentences) | small quota (~2–3/day) | large / priority quota |
| Export data (transcript, notes, flashcards, vocabulary) | ✅ | — |
| AI Sensei (memory, coaching, weekly reports, personalized plan) | — | ✅ |
| Azure pronunciation scoring (accuracy/fluency/completeness + native overlay + per-word) | — | ✅ (generous internal quota) |
| Conversation partner (STT→Claude→TTS) | — | ✅ (generous monthly quota, not unlimited) |
| AI-**authored** intelligence over your data: weekly report, study plan, weakness explanation/coaching, WOW Study Replay narrative | — | ✅ |
```

- [ ] **Step 5: Verify**

```bash
grep -n "does not sell lesson quality\|Public library breadth\|Personal lesson creation\|AI Transcript Generation" docs/product/business-model.md
```

Expected: four matches (one per new phrase/row).

```bash
grep -n "Video → Shadowing → Dictation → SRS → Mining loop" docs/product/business-model.md
```

Expected: no matches (old Principle 3 wording fully replaced).

- [ ] **Step 6: Commit**

```bash
git add docs/product/business-model.md
git commit -m "docs(product): rewrite Principle 3 and add library-breadth rows per Lesson Workspace spec §3.4

Nihongo Cinema now sells library breadth and lesson-creation ability,
not lesson quality — the core loop stays free & unlimited only once
a lesson is already open. Adds the explicit core-loop clarification
block, the new philosophy line near the six principles, and three
new §2 table rows (library breadth, personal lesson creation, AI
Transcript Generation)."
```

---

## Final Verification (after Task 22)

- [ ] **No leftover stale references anywhere under `docs/`:**

```bash
grep -rln "Video Library\|Videos Library\|screen-video-library.md\|Video Detail\|screen-shadowing-detail.md\|Shadowing Detail\|Import Video" docs/ japanese-learning-app-spec.md
```

Expected: the only files listed should be `docs/design/screens/screen-video-detail.md` (documents
its own deprecation, per Consolidation spec §7 verification rule) and
`docs/design/screens/screen-video-library.md`/`docs/design/screens/screen-shadowing-detail.md` should
not appear at all (they no longer exist under those names — Tasks 1–2 renamed them). Any other hit
means a task above was missed.

- [ ] **Cross-reference sweep — every `design-reconciliation.md §N` cite resolves to a real section:**

```bash
grep -rn "design-reconciliation.md §" docs/design/
```

Read the output and confirm each `§N` cited is between 1 and 13 (the file's current section count).

- [ ] **Both renamed files exist, both old names are gone:**

```bash
ls docs/design/screens/screen-shadowing-hub.md docs/design/screens/screen-shadowing-practice.md
ls docs/design/screens/screen-video-library.md docs/design/screens/screen-shadowing-detail.md 2>&1
```

Expected: the first command prints both paths; the second command errors on both ("No such file").

- [ ] **Commit count check:** confirm 22 commits were made (one per task) since the plan started.

```bash
git log --oneline -25
```

- [ ] **Spec-coverage self-check** (run once, read the output, don't re-summarize it into a file):
  read `docs/superpowers/specs/2026-07-29-shadowing-hub-consolidation-design.md` §6 (all 17 items)
  and `docs/superpowers/specs/2026-07-31-shadowing-hub-lesson-workspace-design.md` §8/§8.1 side by
  side against the 22 tasks above; confirm every numbered item has a task. If a gap surfaces that
  this plan missed, do not silently patch it — stop and tell the user before adding a Task 23, the
  same way the design-docs-reconciliation plan's own Task-11-file-list lesson recommends.
