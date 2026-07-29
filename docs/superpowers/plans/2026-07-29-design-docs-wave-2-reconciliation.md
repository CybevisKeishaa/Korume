# Design Docs Wave 2 Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconcile the entire `docs/design/` documentation system — not just the 9 untracked files
drafted in a prior session, but every file that a repo-wide audit found to contradict, duplicate, or
drift from `docs/design/design-reconciliation.md` (the governance doc) or the shipped product. Commit
every fix.

**Architecture:** Documentation-only change, four phases, strictly ordered — Phase 0 amends the
governance doc itself (new terminology-scope rule other tasks cite), Phase 1 fixes/creates the
patterns files, Phase 2 fixes/creates the screens files (including several files a prior "Wave 1" pass
already touched but which a fresh repo-wide audit found still contradict shipped Gamification/Companion
behavior), Phase 3 brings the 12 root-level philosophy docs into lifecycle compliance. 22 tasks total.

**Tech Stack:** Markdown files only. No code, no build, no test suite.

**How this plan came to be:** An initial 9-file plan was written and self-reviewed, then the user asked
for a full repo-wide consistency pass before executing anything. Three parallel audits (root docs,
`patterns/`, `screens/`) read all ~35 design docs against `design-reconciliation.md`, CLAUDE.md, and
each other, and against ground truth in the actual codebase (`components/layout/app-nav.tsx`, the
`app/` route tree, `lib/companion/presence/arbitration.test.ts`). This plan is the result: every
original 9-file task, several of them widened in scope, plus 13 new tasks the audit surfaced.

## Global Constraints

- **Source-of-truth governance:** `docs/design/design-reconciliation.md` (Canonical). It currently has
  **12** sections (§1–§12 — a §12 "Backlog" section was added after the original 11-section doc shipped,
  during a later fix wave). Task 1 of this plan adds a **13th** section. Every later task that cites the
  governance doc must cite a real section number that exists at the time it runs — §1–§12 exist from the
  start, §13 exists only after Task 1 lands.
- **§12's existing deferral still stands.** §12 already states that `screen-architecture.md`,
  `screen-dashboard.md`, `screen-video-library.md`, `screen-review.md`, `screen-shadowing-detail.md`,
  `screen-mining.md`, `screen-video-detail.md` predate the full §8 screen-doc checklist (Loading/
  Success/Error states) and that bringing them into full §8 compliance is an intentionally separate,
  deferred follow-up. **Do not** add Loading/Success/Error/User-State sections to any of those 7 files
  in this plan — only fix the specific contradictions each task below names. `screen-search.md` (Task
  14) is a brand-new doc and is NOT covered by that deferral — it gets the full §8 checklist per the
  original 9-file plan.
- **CLAUDE.md is load-bearing.** §2 Rule 1 ("Never download, re-host, or proxy video") outranks any
  design-doc wording, per `design-reconciliation.md` §1 Authority Order.
- **G1–G3 gamification is real and shipped** (`docs/product/business-model.md` §1.1; XP, Streak,
  Leaderboard, Badge). A recurring defect class this plan fixes: design docs that state a blanket,
  unscoped ban on gamification/celebration/badges/streaks. The fix pattern throughout is the same one
  Wave 1 already established in `feedback-patterns.md`'s "Relationship With Gamification" section and
  `screen-dashboard.md`'s Layer Responsibility table: **scope the "avoid celebration" rule to this
  specific surface's own voice, and explicitly carve out that Gamification's own shipped moments are
  real and live elsewhere.** Never just delete the restraint guidance — these docs are right that *this
  surface* should stay quiet; they're wrong when they imply Gamification doesn't exist at all.
- **No tests apply.** Verification is a re-read pass: (a) the edited/created section matches the
  resolution described in each task, (b) every cross-reference resolves to a real file (`ls`/`Glob`).
- **No code changes.** Nothing in `app/` or `components/` is touched — this plan only reads them as
  ground truth (`app-nav.tsx`'s `NAV_ITEMS`, the route tree, `mining-review-session.tsx`,
  `anchor-boundary.test.ts`).
- **Every edited file keeps its existing content except the exact block being changed** — do not
  reformat or reflow unrelated sections. **Preserve each file's existing tone and structure** — these
  are prose design docs, not code; a fix adds a scoping sentence or a citation, it does not rewrite a
  file's voice.
- **One commit per task.** Commit prefix `docs(design-reconciliation):` for Phase 0,
  `docs(design-patterns):` for Phase 1, `docs(design-screens):` for Phase 2, `docs(design):` for
  Phase 3 (root docs, outside both subfolders).
- **9 of these files are currently untracked** (never committed): `patterns/overlays-and-drawers.md`,
  `reading-patterns.md`, `transcript-patterns.md`, `video-patterns.md`, `screens/adaptive-layouts.md`,
  `navigation-system.md` (empty), `screen-search.md`, `screen-states.md`, `workspace-patterns.md`. Their
  tasks' commits are those files' first commit. Every other file in this plan already exists in git
  history — those tasks produce a normal diff.
- **Ground-truth facts used below, already verified against the repo:**
  - Live nav item list (`components/layout/app-nav.tsx` `NAV_ITEMS`, 14 entries): `/dashboard`,
    `/kanji`, `/vocab`, `/grammar`, `/videos`, `/mining`, `/reading`, `/conversation`, `/jlpt`,
    `/community`, `/playlists`, `/leaderboard`, `/journal`, `/profile`. No collapse/icon-rail state
    exists in code today.
  - No `/settings` route exists anywhere under `app/[locale]/(app)/`.
  - `docs/architecture/experience-architecture.md` **does exist** (a prior audit pass incorrectly
    reported it as a dead link — it just needed its `docs/architecture/` prefix, since it isn't under
    `docs/design/`).
  - Companion anchor positions (`companion-patterns.md` § Declare Anchor): Dashboard → `Top Right`,
    Journal → `Bottom Left`, Landing → `Center`, Review → `No Anchor`.
  - Companion anchors shipped today (L9b D3, `design-reconciliation.md` §6 Available row): Dashboard,
    `/journal`, Video Library **empty state**, Mining deck **empty state**. Everything else is Planned
    or Not Supported.
  - `mining-review-session.tsx` and `anchor-boundary.test.ts` both exist (confirmed), grounding the
    "L9b scan test" and "Mining Review Session" citations already present in committed files.

---

## File Structure

| File | Task | Change |
|---|---|---|
| `docs/design/design-reconciliation.md` | 1 | Broaden Applies-to scope; version 1.0→1.1; add §13 (naming is local, not global). |
| `docs/design/patterns/video-patterns.md` | 2 | Fix CLAUDE.md video-download violation + gamification ban; add Status header. |
| `docs/design/patterns/overlays-and-drawers.md` | 3 | Fix invalid Status value; add Companion/drawer clarification. |
| `docs/design/patterns/reading-patterns.md` | 4 | Add missing Status/metadata header. |
| `docs/design/patterns/transcript-patterns.md` | 5 | Add Status header; disambiguate AI Integration indicator from Companion. |
| `docs/design/patterns/companion-patterns.md` | 6 | Add missing Listening presence level; disambiguate Companion Notes' `✨` example. |
| `docs/design/patterns/study-modes.md` | 7 | Fix Shadowing/Immersion/Focus Mode Companion-state wording (Silent/Invisible/Absent → consistent Not Supported). |
| `docs/design/patterns/empty-states.md` | 8 | Scope the "Avoid: Gamification" bullet with a carve-out. |
| `docs/design/patterns/design-language.md` | 9 | Fix "Never: Gamified" + "flashing badges" blanket bans; add Status header. |
| `docs/design/screens/navigation-system.md` | 10 | **Create** (file is empty). Full nav spec. |
| `docs/design/screens/adaptive-layouts.md` | 11 | Fix Companion Hidden/Observing contradiction (2 locations); Planned-only nav caveat; local-naming note; Status header. |
| `docs/design/screens/screen-states.md` | 12 | Disambiguate AI Thinking; Gamification carve-out for Success; anchor note for Empty Companion; Status header. |
| `docs/design/screens/workspace-patterns.md` | 13 | Anchor note for Reflection Workspace; Gamification carve-out for Ambient Feedback and Overview Workspace; Status header. |
| `docs/design/screens/screen-search.md` | 14 | Status header; 5 missing §8 sections; Companion Result anchor status; Video-Result Progress disambiguation; Entry-Points/Settings caveats. |
| `docs/design/screens/screen-shadowing-detail.md` | 15 | Fix unscoped "No gamification." ban. |
| `docs/design/screens/screen-review.md` | 16 | Fix 3 unscoped Gamification bans. |
| `docs/design/screens/screen-architecture.md` | 17 | Settings-not-yet-shipped caveat (2 spots); local-naming note for Focus States. |
| `docs/design/screens/learning-surfaces.md` | 18 | Add Status header; Gamification carve-out for Overview Surface; local-naming note for Reading States. |
| `docs/design/screens/screen-mining.md` | 19 | Disambiguate "No red badges" from the Gamification Badge primitive. |
| `docs/design/screens/screen-video-library.md` | 20 | Document Companion's Available status in the Empty Library state. |
| 10 root `docs/design/*.md` files | 21 | Add/fix Status headers; fix one broken cross-reference. |
| `docs/design/emotion-design.md` | 22 | Add Status header; stop devaluing the shipped Streak mechanic. |

No files deleted. Task 10 creates rather than edits (file is empty today).

---

## Phase 0 — Governance amendment

### Task 1: Amend `docs/design/design-reconciliation.md`

**Files:**
- Modify: `docs/design/design-reconciliation.md`

**Interfaces:**
- Consumes: nothing (this is the root of the citation graph).
- Produces: §13, which Tasks 11, 17, and 18 cite by number. Must land before those tasks run.

- [ ] **Step 1: Broaden the Applies-to line and bump the version**

Find:
```
> **Status:** Canonical
> **Version:** 1.0 (2026-07-28)
> **Applies to:** `docs/design/patterns/*.md`, `docs/design/screens/*.md`, and every future design
> document in this repo.
> **Decision record:** `docs/superpowers/specs/2026-07-28-design-docs-reconciliation-design.md`
```

Replace:
```
> **Status:** Canonical
> **Version:** 1.1 (2026-07-29)
> **Applies to:** `docs/design/patterns/*.md`, `docs/design/screens/*.md`, every root-level
> `docs/design/*.md` philosophy document, and every future design document in this repo.
> **Decision record:** `docs/superpowers/specs/2026-07-28-design-docs-reconciliation-design.md`
```

- [ ] **Step 2: Append §13 after the existing §12 Backlog section**

Find (the last paragraph of the file — §12 Backlog's closing note):
```
Bringing the seven existing docs into full compliance is a separate, deferred follow-up — not done
in this pass — tracked here so the gap is visible rather than silently assumed.
```

Replace:
```
Bringing the seven existing docs into full compliance is a separate, deferred follow-up — not done
in this pass — tracked here so the gap is visible rather than silently assumed.

---

## 13. Naming Is Local, Not Global

Several documents describe their own progression of concentration/focus/immersion levels (e.g.
`docs/design/screens/screen-architecture.md`'s Focus States, `docs/design/screens/learning-surfaces.md`'s
Reading States, `docs/design/screens/adaptive-layouts.md`'s several internal gradients,
`docs/design/patterns/study-modes.md`'s mode names). These are related in spirit — deeper focus, less
chrome — but are not one shared, product-wide taxonomy, and no document's local names bind another's.

A document defining such a progression names it as its own, scoped to what it actually governs, and may
note that sibling documents use their own different names for their own related-but-distinct concept —
it should not imply, and no other document should assume, that these names are interchangeable or that
one document's list is authoritative over another's.

This does not apply to Companion Presence Levels (§5) or Anchor Availability (§6), which remain the
single shared vocabulary for Companion state specifically, wherever it is discussed.
```

- [ ] **Step 3: Verify**

```bash
grep -n "^## 13\." docs/design/design-reconciliation.md
grep -n "Version:\*\* 1.1" docs/design/design-reconciliation.md
```

Expected: both find exactly one match.

- [ ] **Step 4: Commit**

```bash
git add docs/design/design-reconciliation.md
git commit -m "docs(design-reconciliation): broaden scope to root docs, add §13 naming rule

Applies-to now explicitly covers root-level docs/design/*.md
philosophy documents (Phase 3 of this plan brings them into Status
compliance). Added §13: several documents each define their own
local focus/immersion-level progression: this file rules that these
are independent, non-binding local taxonomies, not one shared
vocabulary readers should expect to reconcile against each other."
```

---

## Phase 1 — Patterns

### Task 2: Fix `docs/design/patterns/video-patterns.md`

**Files:**
- Modify: `docs/design/patterns/video-patterns.md`

**Interfaces:**
- Consumes: `docs/design/design-reconciliation.md` §3, §1.
- Produces: a video-error recovery list and Timeline section consistent with CLAUDE.md §2 and the
  shipped Gamification Layer.

- [ ] **Step 1: Fix the video-download CLAUDE.md violation**

CLAUDE.md §2 Rule 1: *"Never download, re-host, or proxy video from YouTube or any platform... No
`youtube-dl`, `ytdl`, or any downloader — ever."* This file's Error State currently says "Download
again," describing exactly the forbidden behavior from the user-facing side.

Find:
```
Offer quiet recovery options.

Retry.

Download again.

Open original source.

No alarming visuals.
```

Replace:
```
Offer quiet recovery options.

Retry.

Reload the player.

Open original source.

No alarming visuals.

Video is always played live through the YouTube IFrame Player API — never downloaded, re-hosted, or
cached (`CLAUDE.md` §2 Rule 1). Recovery options may retry playback or hand off to the source; they
must never suggest downloading the video.
```

- [ ] **Step 2: Remove the gamification ban from the Timeline section**

Find:
```
Completed Beats:

slightly brighter than upcoming ones.

No badges.

No completion celebrations.
```

Replace:
```
Completed Beats:

slightly brighter than upcoming ones.

This Timeline strip itself stays quiet — it is not where Gamification or Companion speak. Badges,
completion celebrations, and streak/XP moments are a real, shipped product layer (G1–G3,
`docs/design/design-reconciliation.md` §3) that lives elsewhere (Dashboard, post-session summaries),
not inside this ambient scrubber.
```

- [ ] **Step 3: Add a Status header**

Find:
```
# Video Patterns

> Video provides context.
>
> It is not the destination of the learning experience.
```

Replace:
```
# Video Patterns

> **Status:** Approved
> **Related:** `transcript-patterns.md`, `docs/design/design-reconciliation.md`

> Video provides context.
>
> It is not the destination of the learning experience.
```

- [ ] **Step 4: Verify**

```bash
grep -n "Download again" docs/design/patterns/video-patterns.md
grep -n "^No badges\.$" docs/design/patterns/video-patterns.md
grep -n "design-reconciliation.md" docs/design/patterns/video-patterns.md
```

Expected: first two commands find no matches; third finds two matches.

- [ ] **Step 5: Commit**

```bash
git add docs/design/patterns/video-patterns.md
git commit -m "docs(design-patterns): fix video-patterns.md CLAUDE.md violation + gamification ban

Error-state recovery listed 'Download again,' contradicting CLAUDE.md
§2 Rule 1 — replaced with 'Reload the player.' Timeline section
banned badges/celebrations outright, contradicting the shipped
Gamification Layer (G1-G3) — added a scoping note instead. Added a
Status header (this file previously had none)."
```

---

### Task 3: Fix `docs/design/patterns/overlays-and-drawers.md`

**Files:**
- Modify: `docs/design/patterns/overlays-and-drawers.md`

**Interfaces:**
- Consumes: `docs/design/design-reconciliation.md` §7, §4, §6.
- Produces: a valid Status value and a statement that Companion presence is independent of drawer
  state, for `screen-shadowing-detail.md` and `screen-review.md` (this file's own "Related" targets).

- [ ] **Step 1: Fix the invalid Status value and add the governance doc to Related**

Find:
```
> **Status:** Design System Pattern  
> **Layer:** Experience Architecture  
> **Applies to:** Entire Product  
> **Related:** `workspace-patterns.md`, `learning-surfaces.md`, `navigation-system.md`, `screen-shadowing-detail.md`, `screen-review.md`
```

Replace:
```
> **Status:** Approved  
> **Layer:** Experience Architecture  
> **Applies to:** Entire Product  
> **Related:** `workspace-patterns.md`, `learning-surfaces.md`, `navigation-system.md`, `screen-shadowing-detail.md`, `screen-review.md`, `docs/design/design-reconciliation.md`
```

- [ ] **Step 2: Add a Companion clarification note to the Philosophy section**

Find:
```
The learner should always know:

> "I'm still in the same place."

---

# Design Principles
```

Replace:
```
The learner should always know:

> "I'm still in the same place."

Drawer and overlay state is independent of Companion presence. A drawer opening or closing never
changes whether Companion is Hidden or Available on the underlying screen — Companion's presence is
still governed only by the Learning Loop Boundary and Anchor Availability of that screen
(`docs/design/design-reconciliation.md` §4, §6), never by which drawer happens to be open. This
matters most on `screen-shadowing-detail.md` and `screen-review.md`, where Companion stays Hidden
regardless of any drawer opened during the session.

---

# Design Principles
```

- [ ] **Step 3: Verify**

```bash
grep -n "Design System Pattern" docs/design/patterns/overlays-and-drawers.md
grep -n "design-reconciliation.md" docs/design/patterns/overlays-and-drawers.md
```

Expected: first finds no matches; second finds two matches.

- [ ] **Step 4: Commit**

```bash
git add docs/design/patterns/overlays-and-drawers.md
git commit -m "docs(design-patterns): reconcile overlays-and-drawers.md with governance doc

Status was 'Design System Pattern' — not a legal Design Document
Lifecycle state. Corrected to Approved. Added an explicit note that
drawer/overlay state never changes Companion presence, since this
file is the 'Related' target of screen-shadowing-detail.md and
screen-review.md, both Not Supported for Companion."
```

---

### Task 4: Fix `docs/design/patterns/reading-patterns.md`

**Files:**
- Modify: `docs/design/patterns/reading-patterns.md`

**Interfaces:**
- Consumes: `docs/design/design-reconciliation.md` §7.
- Produces: a Status/metadata header matching sibling pattern docs.

- [ ] **Step 1: Add the metadata header**

Find:
```
# Reading Patterns

> Reading is the primary interaction model of Nihongo Cinema.
```

Replace:
```
# Reading Patterns

> **Status:** Approved  
> **Layer:** Experience Architecture  
> **Applies to:** Reading screen, Reading mode within Shadowing/Dictation  
> **Related:** `transcript-patterns.md`, `docs/design/design-reconciliation.md`

> Reading is the primary interaction model of Nihongo Cinema.
```

- [ ] **Step 2: Verify**

```bash
grep -n "^> \*\*Status:\*\*" docs/design/patterns/reading-patterns.md
```

Expected: one match.

- [ ] **Step 3: Commit**

```bash
git add docs/design/patterns/reading-patterns.md
git commit -m "docs(design-patterns): add Status/metadata header to reading-patterns.md

File had no Status declaration, unlike every sibling pattern doc."
```

---

### Task 5: Fix `docs/design/patterns/transcript-patterns.md`

**Files:**
- Modify: `docs/design/patterns/transcript-patterns.md`

**Interfaces:**
- Consumes: `docs/design/design-reconciliation.md` §7, §4, §9.
- Produces: a metadata header and an AI Integration section that can't be misread as the Companion
  entity appearing inside Shadowing/Dictation/Reading loops.

- [ ] **Step 1: Add the metadata header**

Find:
```
# Transcript Patterns

> The transcript is the heart of Nihongo Cinema.
```

Replace:
```
# Transcript Patterns

> **Status:** Approved  
> **Layer:** Experience Architecture  
> **Applies to:** Entire Product (Video Detail, Shadowing, Dictation, Reading, Mining)  
> **Related:** `reading-patterns.md`, `video-patterns.md`, `docs/design/patterns/companion-patterns.md`, `docs/design/design-reconciliation.md`

> The transcript is the heart of Nihongo Cinema.
```

- [ ] **Step 2: Disambiguate the AI Integration indicator from the Companion entity**

Find:
```
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
```

Replace:
```
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
itself — they appear during Shadowing, Dictation, and Reading precisely because those are Not
Supported for Companion (`docs/design/design-reconciliation.md` §4). The visual language happens to
share the `✨` mark with Companion's Handwritten Notes
(`docs/design/patterns/companion-patterns.md` § Companion Notes), but the two are unrelated systems
with different rules: this indicator has no presence-level or anchor-availability state
(`design-reconciliation.md` §5, §9) because it isn't Companion at all.
```

- [ ] **Step 3: Disambiguate the "Vocabulary Integration" phrase collision**

The audit found a second, subtler naming collision: this section calls the vocabulary chips
"handwritten study notes," which is easy to conflate with Companion's own dedicated "Handwritten
Notes" visual-language term.

Find:
```
Vocabulary should resemble handwritten study notes.
```

Replace:
```
Vocabulary should resemble handwritten study notes — a visual comparison to a learner's own margin
notes, not a reference to Companion's "Handwritten Notes" (`docs/design/patterns/companion-patterns.md`
§ Companion Notes), which is a different, Companion-specific UI element.
```

- [ ] **Step 4: Verify**

```bash
grep -n "^> \*\*Status:\*\*" docs/design/patterns/transcript-patterns.md
grep -n "This is not the Companion" docs/design/patterns/transcript-patterns.md
grep -n "not a reference to Companion" docs/design/patterns/transcript-patterns.md
```

Expected: each finds one match.

- [ ] **Step 5: Commit**

```bash
git add docs/design/patterns/transcript-patterns.md
git commit -m "docs(design-patterns): reconcile transcript-patterns.md with governance doc

Added missing Status/metadata header. Clarified that the transcript's
inline sparkle annotations, and its 'handwritten study notes' phrase,
are a separate content-difficulty system, not the Companion entity —
both shared visual/verbal language with companion-patterns.md that
risked being read as Companion appearing during Shadowing/Dictation."
```

---

### Task 6: Fix `docs/design/patterns/companion-patterns.md`

**Files:**
- Modify: `docs/design/patterns/companion-patterns.md`

**Interfaces:**
- Consumes: `docs/design/design-reconciliation.md` §5 (Presence Mapping's 6-row table: Hidden,
  Ambient, Observe, **Listening**, Address, Silent).
- Produces: a Presence Levels section that actually contains every state the file's own Learning
  Boundary section references, and a Companion Notes example that's disambiguated from
  `transcript-patterns.md`'s content-difficulty indicators (Task 5).

This is the canonical Companion reference doc (already "Approved" from Wave 1) — the audit found it
has a real internal defect: its own Learning Boundary section says *"Listening practice (hoạt động
học — khác với runtime state \"Listening\" ở bảng Presence Levels bên trên..."* (i.e. "different from
the runtime state 'Listening' in the Presence Levels table above") — but no "Listening" state
actually appears in that table. It only has Level 0 Hidden, Level 1 Ambient, Level 2 Observe, Level 3
Address, plus a separate "Silent" section. `design-reconciliation.md` §5 defines 6 states including
Listening; this file is missing one of its own canonical rows.

- [ ] **Step 1: Insert the missing Listening level and renumber Address**

Find:
```
## Level 2 — Observe

Companion nhận biết một sự kiện vừa xảy ra.

Không nhất thiết phải phản hồi.

Ví dụ:

- learner vừa hoàn thành movie
- learner vừa bookmark
- learner vừa mining

Companion có thể:

- nhìn lên
- nghiêng đầu
- mỉm cười nhẹ

Hoặc...

không làm gì cả.

---

## Level 3 — Address

Đây là mức hiếm nhất.

Companion chủ động gửi một thông điệp.
```

Replace:
```
## Level 2 — Observe

Companion nhận biết một sự kiện vừa xảy ra.

Không nhất thiết phải phản hồi.

Ví dụ:

- learner vừa hoàn thành movie
- learner vừa bookmark
- learner vừa mining

Companion có thể:

- nhìn lên
- nghiêng đầu
- mỉm cười nhẹ

Hoặc...

không làm gì cả.

---

## Level 3 — Listening

Companion vẫn hiện diện trong khi người học đang thao tác.

Không nói.

Không gián đoạn.

Ví dụ:

- learner đang gõ một ghi chú
- learner đang chọn một từ để tra cứu
- learner đang cuộn qua Journal

Khác với Ambient (Level 1) — Companion không chỉ "ở đó", mà đang chú ý đến hành động cụ thể đang
diễn ra. Khác với Observe (Level 2) — sự kiện chưa hoàn tất, Companion không chờ để phản hồi.

---

## Level 4 — Address

Đây là mức hiếm nhất.

Companion chủ động gửi một thông điệp.
```

- [ ] **Step 2: Disambiguate the Companion Notes `✨` example**

Find:
```
Ví dụ:

━━━━━━━━━━━━

✨

This sentence seems difficult.

━━━━━━━━━━━━

Interaction behavior giữ nguyên — accessibility-driven, xem
```

Replace:
```
Ví dụ:

━━━━━━━━━━━━

✨

This sentence seems difficult.

━━━━━━━━━━━━

This only ever appears where Companion has an anchor at all (Available/Planned per §6) — it is not
the same thing as `transcript-patterns.md`'s inline "✨ Difficult grammar" content indicator, which is
a separate system that appears specifically during Shadowing/Dictation/Reading, where Companion is
Not Supported (`docs/design/patterns/transcript-patterns.md` § AI Integration).

Interaction behavior giữ nguyên — accessibility-driven, xem
```

- [ ] **Step 3: Verify**

```bash
grep -n "^## Level " docs/design/patterns/companion-patterns.md
grep -n "not the same thing as" docs/design/patterns/companion-patterns.md
```

Expected: first command lists Level 0, 1, 2, 3 (Listening), 4 (Address) in order; second finds one
match.

- [ ] **Step 4: Commit**

```bash
git add docs/design/patterns/companion-patterns.md
git commit -m "docs(design-patterns): fix companion-patterns.md missing Listening presence level

The Learning Boundary section already referenced a 'Listening' row
in the Presence Levels table above it, but that row didn't exist —
the file only had Hidden/Ambient/Observe/Address. Inserted it as
Level 3 (renumbering Address to Level 4) to match
design-reconciliation.md §5's 6-state table. Also disambiguated the
Companion Notes ✨ example from transcript-patterns.md's unrelated
content-difficulty indicator, which shares the same glyph."
```

---

### Task 7: Fix `docs/design/patterns/study-modes.md`

**Files:**
- Modify: `docs/design/patterns/study-modes.md`

**Interfaces:**
- Consumes: `docs/design/design-reconciliation.md` §4, §5 (Dormant ≠ Silent).
- Produces: Companion Behavior wording for Shadowing/Immersion/Focus Mode consistent with this same
  file's own Reading/Analysis/Review Mode sections (already "✕ Not Supported") and with
  `companion-patterns.md`'s Dormant≠Silent rule.

This file already correctly marks Reading Mode, Analysis Mode, and Review Mode's Companion Behavior as
"✕ Not Supported," citing §4. But Shadowing Mode says only "Silent.", Immersion Mode says
"Invisible.", and Focus Mode says "Absent." — three different words, none of them "Not Supported," for
what the Learning Loop Boundary requires to be the same Hidden/Dormant state. Worse, "Silent"
specifically means something else in the canonical model: an *Active* state where Companion evaluated
context and chose not to speak (`companion-patterns.md` § Silent — Quyết định không nói). Calling
Shadowing's state "Silent" contradicts that distinction.

- [ ] **Step 1: Fix Shadowing Mode's Companion Behavior**

Find:
```
Repeat.

---

## Companion Behavior

Silent.

Learning requires complete concentration.

---
```

Replace:
```
Repeat.

---

## Companion Behavior

✕ Not Supported. Shadowing is an active acquisition loop
(`docs/design/design-reconciliation.md` §4, Learning Loop Boundary) — Companion stays Hidden
throughout Shadowing, the same as every other mode in this document. Learning requires complete
concentration.

---
```

- [ ] **Step 2: Fix Immersion Mode's Companion Behavior**

Find:
```
Looping available but visually de-emphasized.

---

## Companion Behavior

Invisible.

Immersion should feel uninterrupted.

---
```

Replace:
```
Looping available but visually de-emphasized.

---

## Companion Behavior

✕ Not Supported. Immersion Mode is an active acquisition loop
(`docs/design/design-reconciliation.md` §4, Learning Loop Boundary) — Companion stays Hidden, the
same as every other mode in this document. Immersion should feel uninterrupted.

---
```

- [ ] **Step 3: Fix Focus Mode's Companion Behavior**

Find:
```
remain visible.

---

## Companion Behavior

Absent.

Silence is intentional.

---
```

Replace:
```
remain visible.

---

## Companion Behavior

✕ Not Supported. Focus Mode is an active acquisition loop
(`docs/design/design-reconciliation.md` §4, Learning Loop Boundary) — Companion stays Hidden, the
same as every other mode in this document. Silence is intentional.

---
```

- [ ] **Step 4: Verify**

```bash
grep -n "^Silent\.$\|^Invisible\.$\|^Absent\.$" docs/design/patterns/study-modes.md
grep -c "✕ Not Supported" docs/design/patterns/study-modes.md
```

Expected: first command finds no matches (all three replaced); second finds 6 (the 3 pre-existing +
the 3 just added).

- [ ] **Step 5: Commit**

```bash
git add docs/design/patterns/study-modes.md
git commit -m "docs(design-patterns): fix study-modes.md Companion-state wording

Shadowing Mode ('Silent.'), Immersion Mode ('Invisible.'), and Focus
Mode ('Absent.') each used a different word instead of this file's own
correct '✕ Not Supported' phrasing (used by Reading/Analysis/Review
Mode). 'Silent' specifically contradicted companion-patterns.md's
Dormant≠Silent rule, since Silent means an Active state that chose
not to speak, not Hidden/Dormant. All three modes are active
acquisition loops and now read consistently with the rest of the file."
```

---

### Task 8: Fix `docs/design/patterns/empty-states.md`

**Files:**
- Modify: `docs/design/patterns/empty-states.md`

**Interfaces:**
- Consumes: `docs/design/design-reconciliation.md` §3 (Layer Responsibility Rule).
- Produces: an Anti-Patterns-style Gamification line consistent with `feedback-patterns.md`'s already-
  fixed "Relationship With Gamification" section.

- [ ] **Step 1: Scope the "Avoid: Gamification" bullet**

Find:
```
## 1. Never Celebrate Emptiness

Empty states are not achievements.

Avoid:

- Congratulations
- Achievement animations
- Rewards
- Gamification

The goal is not to make emptiness exciting.

The goal is to make the next step obvious.
```

Replace:
```
## 1. Never Celebrate Emptiness

Empty states are not achievements.

Avoid, specifically in an empty state itself:

- Congratulations
- Achievement animations
- Rewards
- Gamification language (XP counters, streak prompts, badge unlocks)

This is scoped to the empty state moment, not a product-wide ban — Gamification (XP, Streak,
Leaderboard, Badge) is a real, shipped layer per G1–G3
(`docs/design/design-reconciliation.md` §3, Layer Responsibility Rule) that simply never speaks
through an empty state's voice.

The goal is not to make emptiness exciting.

The goal is to make the next step obvious.
```

- [ ] **Step 2: Verify**

```bash
grep -n "^- Gamification$" docs/design/patterns/empty-states.md
grep -n "Layer Responsibility Rule" docs/design/patterns/empty-states.md
```

Expected: first finds no matches; second finds one.

- [ ] **Step 3: Commit**

```bash
git add docs/design/patterns/empty-states.md
git commit -m "docs(design-patterns): scope empty-states.md's Gamification anti-pattern

'Avoid: ... Gamification' read as a blanket ban, contradicting G1-G3
and this file's own sibling feedback-patterns.md's carefully scoped
carve-out. Now scoped to the empty-state moment specifically, with
Gamification named as real and shipped elsewhere."
```

---

### Task 9: Fix `docs/design/patterns/design-language.md`

**Files:**
- Modify: `docs/design/patterns/design-language.md`

**Interfaces:**
- Consumes: `docs/design/design-reconciliation.md` §3, §7.
- Produces: an Emotional Direction and Quiet Feedback section that no longer read as banning the
  Gamification Layer outright — the sharpest such contradiction the root-docs audit found.

- [ ] **Step 1: Add a Status header**

Find:
```
# Design Language

> Status: Living Design Document
>
> Defines how the interface should feel,
> not how individual screens should look.
```

Replace:
```
# Design Language

> **Status:** Approved
>
> Defines how the interface should feel,
> not how individual screens should look.
```

- [ ] **Step 2: Fix "Never: ... Gamified"**

Find:
```
Never:

- Loud
- Busy
- Hyperactive
- Gamified
- Distracting
```

Replace:
```
Never:

- Loud
- Busy
- Hyperactive
- Distracting

This is a statement about *tone* — quiet, unhurried, non-manipulative — not a ban on the
Gamification Layer itself. XP, Streak, Leaderboard, and Badge are a real, shipped product layer per
G1–G3 (`docs/design/design-reconciliation.md` §3); they simply present calmly rather than loudly,
consistent with every other principle in this document.
```

- [ ] **Step 3: Fix "flashing badges"**

Find:
```
Avoid:

✗ celebration explosions

✗ flashing badges

✗ aggressive confetti

✗ noisy success screens
```

Replace:
```
Avoid:

✗ celebration explosions

✗ flashing notification badges

✗ aggressive confetti

✗ noisy success screens

This governs how a badge (or any notification indicator) *animates* — no flashing/explosive motion —
not whether the Gamification Layer's Badge primitive may exist or be shown at all
(`docs/design/design-reconciliation.md` §3).
```

- [ ] **Step 4: Verify**

```bash
grep -n "^- Gamified$\|^✗ flashing badges$" docs/design/design-language.md
```

Expected: no matches.

- [ ] **Step 5: Commit**

```bash
git add docs/design/design-language.md
git commit -m "docs(design): fix design-language.md gamification bans + Status header

'Never: ... Gamified' and '✗ flashing badges' both read as blanket
bans on the shipped Gamification Layer (G1-G3) — the sharpest such
contradiction a repo-wide audit found. Both now scoped to tone/motion
specifically, with Gamification named as real and shipped elsewhere.
Added a Status header (was 'Living Design Document,' not a legal
lifecycle state)."
```

---

## Phase 2 — Screens

### Task 10: Create `docs/design/screens/navigation-system.md`

**Files:**
- Modify (create content in empty file): `docs/design/screens/navigation-system.md`

**Interfaces:**
- Consumes: `docs/design/design-reconciliation.md` §2–§6; `docs/design/screens/screen-architecture.md`
  § Navigation Philosophy; `docs/design/patterns/companion-patterns.md` § Declare Anchor;
  `components/layout/app-nav.tsx` (ground truth).
- Produces: the file three already-committed docs (`settings-patterns.md`, `companion-patterns.md`,
  `overlays-and-drawers.md`) declare as a dependency but which has never had content. Also the target
  that Tasks 11, 13, 14, 17 cite for the "no `/settings` route" and "nav items" facts.

- [ ] **Step 1: Write the file**

The file is currently empty (0 bytes) — this step writes its entire content:

````markdown
# Navigation System

> **Status:** Approved
> **Related:** `docs/design/screens/screen-architecture.md`, `docs/design/patterns/companion-patterns.md`,
> `docs/design/patterns/settings-patterns.md`, `docs/design/patterns/overlays-and-drawers.md`,
> `docs/design/screens/adaptive-layouts.md`, `docs/design/design-reconciliation.md`

> Navigation exists to help learners arrive. It should disappear once learning begins.
> — `screen-architecture.md` § Navigation Philosophy

This document defines the navigation chrome itself: what's in it, where it lives, how it degrades
under focus, and the boundary between navigation and the two layers that must never bleed into it —
Companion and Gamification.

---

# Purpose

Navigation is a single, low-noise surface for arriving somewhere. It is not a dashboard, not a status
display, and not a place where Companion or Gamification speak. Its only job is: get the learner from
"I want to do X" to the screen for X, with the least visual weight possible.

---

# Navigation Inventory

The shipped navigation (`components/layout/app-nav.tsx`, `NAV_ITEMS`) is a single ordered list, no
grouping, no nesting:

| Order | Label key | Route |
|---|---|---|
| 1 | `dashboard` | `/dashboard` |
| 2 | `kanji` | `/kanji` |
| 3 | `vocab` | `/vocab` |
| 4 | `grammar` | `/grammar` |
| 5 | `videos` | `/videos` |
| 6 | `mining` | `/mining` |
| 7 | `reading` | `/reading` |
| 8 | `conversation` | `/conversation` |
| 9 | `jlpt` | `/jlpt` |
| 10 | `community` | `/community` |
| 11 | `playlists` | `/playlists` |
| 12 | `leaderboard` | `/leaderboard` |
| 13 | `journal` | `/journal` |
| 14 | `profile` | `/profile` |

All 14 are shipped today — none are Planned or aspirational. Active acquisition-loop sub-routes
(Shadowing, Dictation, JLPT test-taking, SRS review, Mining review session) are reached by drilling
into their parent item (e.g. `/videos/[id]/shadowing`), never listed as their own top-level nav entry
— this keeps the acquisition loops off the persistent chrome, consistent with the Learning Loop
Boundary (`docs/design/design-reconciliation.md` §4). There is no dedicated Search entry in this list
— Search is a persistent affordance inside the Nav Column chrome itself, not a separate destination
(see `docs/design/screens/screen-search.md` § Entry Points).

---

# Layout Regions

Two named regions the rest of this document — and Companion's declared anchors — are relative to:

- **Nav Column** — the persistent navigation itself. Desktop: a fixed left column (240px). Mobile: a
  top bar that wraps its items.
- **Content Region** — everything to the right of (desktop) or below (mobile) the Nav Column. This is
  the region every screen spec's layout describes, and the region Companion anchors (`Top Right`,
  `Bottom Left`, `Center`, `No Anchor` — `companion-patterns.md` § Declare Anchor) are positioned
  within. An anchor position is always relative to the Content Region, never to the Nav Column —
  Companion never anchors inside navigation chrome itself.

---

# Navigation States

Two states exist today; a third is a documented direction, not yet shipped:

| State | Status | Description |
|---|---|---|
| Expanded (desktop) | Available | Fixed left column, full labels, always visible. |
| Wrapped (mobile) | Available | Top bar, items wrap to fill width, full labels. |
| Collapsed / Icon rail | Planned | `adaptive-layouts.md` § Navigation Adaptation describes a future Expanded → Collapsed → Icon rail → Hidden progression during deep focus. Not implemented in `app-nav.tsx` today — treat any icon-rail or auto-hide description elsewhere as target design, not current behavior. |

Per `screen-architecture.md` § Navigation Philosophy, navigation is expected to recede during focused
study. Today that reduction happens by leaving the nav screen entirely (drilling into Shadowing/
Dictation/Review, which render outside the persistent nav chrome context for that flow) rather than
by the nav column collapsing in place. The Collapsed/Icon-rail state in `adaptive-layouts.md` is the
planned refinement of this same philosophy, not a contradiction of it.

---

# Nav vs. Drawer Boundary

Navigation is never implemented as a drawer or overlay. `overlays-and-drawers.md` states this as an
explicit anti-pattern ("Do not use drawers as navigation"). The Nav Column is persistent chrome, not a
temporary layer — it does not open, close, or slide over content the way a drawer does.

---

# Companion & Navigation

- The Nav Column never renders Companion. No anchor may be declared inside the Nav Column region —
  only within the Content Region (§ Layout Regions above).
- Companion presence is controlled by the Ambient Layer per screen
  (`docs/design/design-reconciliation.md` §2), never by the navigation component. The nav does not
  gain or lose a "Companion tab" or indicator based on which screen is active.
- Anchor availability today (`design-reconciliation.md` §6) is Available only at Dashboard and
  `/journal` among the items in this inventory; all other nav destinations are Planned or Not
  Supported for Companion. The nav item itself looks identical either way — availability is a
  property of the destination screen, not of the nav link.

---

# Gamification & Navigation

`/leaderboard` is a real, shipped nav item. It belongs entirely to the Gamification Layer
(`design-reconciliation.md` §3, Layer Responsibility Rule: Gamification owns XP, Streak, Progress,
Goal completion). The Nav Column itself stays neutral chrome — it does not display a live XP counter,
streak flame, or rank badge next to any nav item. Any such indicator, if added later, would be a
Gamification-owned addition to the Nav Column, and Companion must never narrate it from within
navigation, per the same Layer Responsibility Rule.

---

# Settings Entry Point

There is no `/settings` route today (confirmed absent from `NAV_ITEMS` and from the app route tree).
Two different things currently live where "settings" might be expected, and they must not be
conflated:

1. **Nav footer controls** (shipped): `ThemeToggle`, `ReduceMotionToggle`, and sign-out, rendered
   below the nav list in `app-nav.tsx`. These are global, low-frequency toggles — not a settings
   screen.
2. **`settings-patterns.md`'s dedicated Settings screen** (Draft/roadmap per
   `design-reconciliation.md` §7 — see that file's Status header): a future `/settings` route with
   the categories that file describes. When built, its nav entry point is a new top-level `NAV_ITEMS`
   entry, most naturally placed near `profile` — this document will need updating at that time. Any
   other design doc's mention of "Settings" as if it were a normal, already-shipped screen (e.g. in a
   list of example screens) describes this same target design, not current behavior.

---

# Responsive / Mobile Behavior

Below the `md` breakpoint, the Nav Column becomes a top bar; its items wrap (`flex-wrap`) rather than
scrolling or collapsing into a menu. There is no hamburger-menu pattern today — every item stays
visible and reachable at every viewport width. If a future redesign introduces a collapsed mobile
menu, it must still satisfy the Accessibility section below (keyboard reachability and landmark
semantics do not get to regress for the sake of a denser mobile layout).

---

# Accessibility

Shipped today:

- The Nav Column is a single `<nav>` landmark with an explicit `aria-label` (translated via the
  `nav.ariaLabel` key), so screen-reader users can jump straight to it.
- The active item carries `aria-current="page"`, kept in sync via pathname matching (exact match or
  prefix match for nested routes).
- Every item is a real `<Link>` — full keyboard reachability (Tab/Shift+Tab, Enter to activate) with
  no custom keyboard handling required, since it's native anchor semantics rather than a custom
  widget.

Any future Collapsed/Icon-rail state (§ Navigation States) must preserve all three of the above:
landmark + label, `aria-current`, and native link semantics — collapsing to icons only is a *visual*
change and must not silently drop the accessible name for each item
(`docs/design/design-reconciliation.md` §10, Visual vs. Interaction Changes).
````

- [ ] **Step 2: Verify**

```bash
grep -c "^# " docs/design/screens/navigation-system.md
grep -n "design-reconciliation.md §" docs/design/screens/navigation-system.md
grep -n "href:" components/layout/app-nav.tsx
```

Expected: at least 10 top-level sections; several `§N` citations, each between 1 and 13; 14 `href:`
entries matching the Navigation Inventory table exactly.

- [ ] **Step 3: Commit**

```bash
git add docs/design/screens/navigation-system.md
git commit -m "docs(design-screens): write navigation-system.md (was empty)

Three already-committed files (settings-patterns.md,
companion-patterns.md, overlays-and-drawers.md) declared this file a
dependency, but it had never been written. Documents the shipped
nav inventory (14 items), layout regions Companion anchors are
positioned relative to, the Nav-vs-Drawer boundary, and explicit
Companion/Gamification non-bleed rules for the nav chrome."
```

---

### Task 11: Fix `docs/design/screens/adaptive-layouts.md`

**Files:**
- Modify: `docs/design/screens/adaptive-layouts.md`

**Interfaces:**
- Consumes: `docs/design/design-reconciliation.md` §4, §6, §13 (Task 1 — must run after Task 1 and
  Task 10).
- Produces: a Companion Adaptation section, a Focus Modes section, and a Navigation Adaptation section
  all consistent with the Learning Loop Boundary and with the new `navigation-system.md`.

- [ ] **Step 1: Add a Status header and a local-naming note**

This file uses five different internal level-progressions (Layout Types, Reading Expansion, Header
Adaptation, Focus Modes, Companion Adaptation) — flag upfront that none of them share one taxonomy,
including with each other, per the new §13.

Find:
```
# Adaptive Layouts

> Purpose
>
> This document defines how Nihongo Cinema adapts across different screen sizes, workspace configurations and study modes.
```

Replace:
```
# Adaptive Layouts

> **Status:** Approved
> **Related:** `docs/design/screens/navigation-system.md`, `docs/design/patterns/companion-patterns.md`, `docs/design/design-reconciliation.md`
>
> This document uses several internal level-progressions (Layout Types, Reading Expansion, Header
> Adaptation, Focus Modes, Companion Adaptation) that are related in spirit but are independent axes,
> not one shared taxonomy — including with each other. None of their names are binding on sibling
> documents either (`docs/design/design-reconciliation.md` §13).

> Purpose
>
> This document defines how Nihongo Cinema adapts across different screen sizes, workspace configurations and study modes.
```

- [ ] **Step 2: Fix the Companion Adaptation contradiction**

This file's own "1. Immersive Workspace" section already states "Companion hidden" whenever that
layout hosts Shadowing/Reading/Listening/Review. The "Companion Adaptation" section below describes
Companion as still active ("Almost silent" at Focused, "Only essential observations" at Immersive).

Find:
```
# Companion Adaptation

The Companion behaves differently depending on focus.

Normal

Small ambient notes.

↓

Focused

Almost silent.

↓

Immersive

Only essential observations.

↓

Presentation Mode

Hidden completely.

Companion respects concentration.
```

Replace:
```
# Companion Adaptation

**On Learning Loop surfaces** (Shadowing, Dictation, SRS review, Mining review session, Pronunciation
evaluation, JLPT/Grammar/Vocabulary/Kanji practice, Conversation drills —
`docs/design/design-reconciliation.md` §4), Companion is Hidden at every focus level below, not only
at Presentation Mode. This matches "1. Immersive Workspace" above, which already lists "Companion
hidden" as a Characteristic whenever that workspace hosts Shadowing, Reading, Listening, or Review.

**On surfaces where Companion is Available or Planned** (§6 — Dashboard, `/journal`, Video Library,
Mining browse/collection), the Companion behaves differently depending on focus:

Normal

Small ambient notes.

↓

Focused

Almost silent.

↓

Immersive

Only essential observations.

↓

Presentation Mode

Hidden completely.

Companion respects concentration.
```

- [ ] **Step 3: Fix the same contradiction recurring in Focus Modes**

The audit found this bug repeats, unfixed by Step 2, in a second section of this file.

Find:
```
Tools collapse.

Companion becomes quieter.

---
```

Replace:
```
Tools collapse.

On Learning Loop surfaces (`docs/design/design-reconciliation.md` §4), Companion is Hidden here, not
merely quieter — same exception as § Companion Adaptation above. On Companion-Available/Planned
surfaces, Companion becomes quieter.

---
```

- [ ] **Step 4: Add a Planned-only caveat to Navigation Adaptation**

Find:
```
Navigation Adaptation: Expanded → Collapsed → Icon rail → Hidden. The learner always controls whether navigation is visible
```

Replace:
```
Navigation Adaptation: Expanded → Collapsed → Icon rail → Hidden — this progression is Planned target
design (`docs/design/screens/navigation-system.md` § Navigation States); only Expanded (desktop) and
Wrapped (mobile) are shipped today. The learner always controls whether navigation is visible
```

- [ ] **Step 5: Verify**

```bash
grep -n "On Learning Loop surfaces" docs/design/screens/adaptive-layouts.md
grep -n "is Planned target" docs/design/screens/adaptive-layouts.md
grep -n "^> \*\*Status:\*\*" docs/design/screens/adaptive-layouts.md
```

Expected: first finds 2 matches (Companion Adaptation + Focus Modes); second and third find 1 each.

- [ ] **Step 6: Commit**

```bash
git add docs/design/screens/adaptive-layouts.md
git commit -m "docs(design-screens): fix adaptive-layouts.md Companion/Navigation contradictions

Companion Adaptation and (separately) Focus Modes both described
Companion as still active during Focused/Immersive focus levels on
Learning Loop surfaces, contradicting this same file's '1. Immersive
Workspace' section and the Learning Loop Boundary (§4) — scoped both
to Companion-Available/Planned surfaces only. Navigation Adaptation's
Collapsed/Icon-rail progression is marked Planned, matching the new
navigation-system.md. Added a Status header and a §13 local-naming
note covering this file's five internal level-progressions."
```

---

### Task 12: Fix `docs/design/screens/screen-states.md`

**Files:**
- Modify: `docs/design/screens/screen-states.md`

**Interfaces:**
- Consumes: `docs/design/design-reconciliation.md` §3, §4, §6, §9.
- Produces: an AI Thinking section that can't be misread as Companion appearing inside Grammar/
  Vocabulary loops, a Success section consistent with the shipped Gamification Layer, and an Empty
  Companion section that declares anchor availability.

- [ ] **Step 1: Add a Status header**

Find:
```
# Screen States

> Every screen in Nihongo Cinema should feel calm—even when something is loading, syncing, or unavailable.
```

Replace:
```
# Screen States

> **Status:** Approved
> **Related:** `docs/design/patterns/companion-patterns.md`, `docs/design/design-reconciliation.md`

> Every screen in Nihongo Cinema should feel calm—even when something is loading, syncing, or unavailable.
```

- [ ] **Step 2: Disambiguate "AI Thinking" from the Companion entity**

Find:
```
# AI Thinking

AI should never feel like ChatGPT typing.

Instead,

the Companion quietly reflects.

Example

✨

Thinking about this sentence...

No animated dots.

No typing cursor.

No fake human behavior.
```

Replace:
```
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
```

- [ ] **Step 3: Add a Gamification carve-out to the Success section**

Find:
```
# Success

Success is intentionally understated.

Examples:

Saved.

Added to Mining.

small fade

soft highlight

gentle glow

Never use green checkmarks.

Never celebrate.
```

Replace:
```
# Success

Success is intentionally understated — for this Feedback/Companion-layer moment.

Examples:

Saved.

Added to Mining.

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
```

- [ ] **Step 4: Add an anchor-availability note to Empty Companion**

Find:
```
# Empty Companion

When Companion has nothing to say,

it simply rests.

No placeholder.

No suggested prompts.
```

Replace:
```
# Empty Companion

When Companion has nothing to say,

it simply rests.

No placeholder.

No suggested prompts.

This state only ever renders where Companion has an anchor at all — Available today at Dashboard and
`/journal` (`docs/design/design-reconciliation.md` §6). On a surface where Companion is Not Supported,
there is no Empty Companion state to render, because there is no Companion anchor to be empty in the
first place.
```

- [ ] **Step 5: Verify**

```bash
grep -n "the Companion quietly reflects" docs/design/screens/screen-states.md
grep -n "This generic \"AI thinking\"" docs/design/screens/screen-states.md
grep -n "Layer Responsibility Rule" docs/design/screens/screen-states.md
```

Expected: first finds no matches; second and third find one match each.

- [ ] **Step 6: Commit**

```bash
git add docs/design/screens/screen-states.md
git commit -m "docs(design-screens): reconcile screen-states.md with governance doc

AI Thinking named 'the Companion' as a generic AI wait-state indicator
used across the whole product, including Not Supported surfaces
(Grammar, Vocabulary) — disambiguated it from the Companion entity.
Success section's blanket 'never celebrate' now carves out the
Gamification Layer's own success moments. Empty Companion now states
it only applies where an anchor exists at all."
```

---

### Task 13: Fix `docs/design/screens/workspace-patterns.md`

**Files:**
- Modify: `docs/design/screens/workspace-patterns.md`

**Interfaces:**
- Consumes: `docs/design/design-reconciliation.md` §3, §6, §9.
- Produces: a Reflection Workspace section that declares Companion's anchor status, and an Ambient
  Feedback / Overview Workspace section pair with explicit Gamification carve-outs.

- [ ] **Step 1: Add a Status header**

Find:
```
# Workspace Patterns

> Purpose
>
> This document defines the reusable workspace patterns used throughout Nihongo Cinema.
```

Replace:
```
# Workspace Patterns

> **Status:** Approved
> **Related:** `docs/design/screens/navigation-system.md`, `docs/design/patterns/overlays-and-drawers.md`, `docs/design/design-reconciliation.md`

> Purpose
>
> This document defines the reusable workspace patterns used throughout Nihongo Cinema.
```

- [ ] **Step 2: Declare anchor availability in Reflection Workspace**

Find:
```
# Pattern 08 — Reflection Workspace

Purpose

Encourage memory.

Examples

Journal

Learning history

Companion memories

Characteristics
```

Replace:
```
# Pattern 08 — Reflection Workspace

Purpose

Encourage memory.

Examples

Journal

Learning history

Companion memories

"Companion memories" here is Available today specifically because Journal is one of Companion's four
shipped anchors (`docs/design/design-reconciliation.md` §6, L9b D3). Applying this Reflection
Workspace pattern to a different surface does not automatically carry Companion presence with it —
anchor availability is per-screen, not per-pattern.

Characteristics
```

- [ ] **Step 3: Add a Gamification carve-out to Ambient Feedback**

Find:
```
## Ambient Feedback

Feedback should never interrupt.

Examples

Sentence saved.

Small sparkle.

Soft fade.

Vocabulary mined.

Tiny toast.

Warm note.

No popups.

No celebrations.
```

Replace:
```
## Ambient Feedback

Feedback should never interrupt.

Examples

Sentence saved.

Small sparkle.

Soft fade.

Vocabulary mined.

Tiny toast.

Warm note.

No popups.

No celebrations.

This governs small, in-the-moment save/mine actions specifically — it is not a blanket ban on
celebration anywhere in the product. Gamification-owned milestones (badge unlock, streak, XP) are a
separate layer entitled to their own celebratory treatment elsewhere
(`docs/design/design-reconciliation.md` §3, Layer Responsibility Rule); this workspace's ambient
feedback simply never duplicates or narrates them.
```

- [ ] **Step 4: Add a Gamification carve-out to Overview Workspace**

Find:
```
Small number of meaningful sections.

No KPI walls.

No dense widgets.

Should answer:
```

Replace:
```
Small number of meaningful sections.

No enterprise-style KPI walls or dense widget grids — that's a statement about visual density and
tone, not a ban on the Gamification Layer's own Progress/Streak display. Dashboard (which reuses this
pattern) legitimately shows a Gamification Progress section per the Layer Responsibility Rule
(`docs/design/design-reconciliation.md` §3, `docs/design/screens/screen-dashboard.md` § Progress).

Should answer:
```

- [ ] **Step 5: Verify**

```bash
grep -n "anchor availability is per-screen" docs/design/screens/workspace-patterns.md
grep -c "Layer Responsibility Rule" docs/design/screens/workspace-patterns.md
```

Expected: first finds one match; second finds two (Ambient Feedback + Overview Workspace).

- [ ] **Step 6: Commit**

```bash
git add docs/design/screens/workspace-patterns.md
git commit -m "docs(design-screens): reconcile workspace-patterns.md with governance doc

Reflection Workspace's 'Companion memories' now notes this only holds
because Journal is a shipped anchor. Ambient Feedback and Overview
Workspace's unscoped celebration/KPI bans now carve out the
Gamification Layer's own shipped moments, the latter specifically
because Dashboard reuses this pattern and does show a Gamification
Progress section. Added a Status header."
```

---

### Task 14: Fix `docs/design/screens/screen-search.md`

**Files:**
- Modify: `docs/design/screens/screen-search.md`

**Interfaces:**
- Consumes: `docs/design/design-reconciliation.md` §3, §6, §8, §9; `docs/design/screens/navigation-system.md`
  § Settings Entry Point (Task 10 — must run after Task 10).
- Produces: a screen spec that satisfies the §8 checklist in full, a Companion Result section that
  declares presence level and anchor availability, and a Video Result field / Entry Points list that no
  longer conflicts with the Gamification and Navigation facts established elsewhere in this plan.

- [ ] **Step 1: Add a Status header**

Find:
```
# screen-search.md

> Search is not a command.
>
> It is a conversation with everything the learner has experienced.
```

Replace:
```
# screen-search.md

> **Status:** Approved
> **Related:** `docs/design/patterns/companion-patterns.md`, `docs/design/screens/navigation-system.md`, `docs/design/design-reconciliation.md`

> Search is not a command.
>
> It is a conversation with everything the learner has experienced.
```

- [ ] **Step 2: Clarify the Sidebar entry point against the new nav inventory**

Find:
```
• Header Search

• Sidebar

• Empty States

Opening search should feel instantaneous.
```

Replace:
```
• Header Search

• Sidebar (a persistent search affordance within the Nav Column chrome — not a separate top-level
nav item; see `docs/design/screens/navigation-system.md`, whose 14-item inventory has no dedicated
"Search" entry because this affordance lives inside that chrome, not beside it)

• Empty States

Opening search should feel instantaneous.
```

- [ ] **Step 3: Disambiguate the Video Result "Progress" field**

Find:
```
Episode

Duration

Progress

Tiny atmosphere

Avoid large thumbnails.
```

Replace:
```
Episode

Duration

Progress (playback/watch progress on this specific video — not the Gamification Layer's Progress
metric, `docs/design/design-reconciliation.md` §3; Search has no Gamification Layer presence, see
Gamification Behavior below)

Tiny atmosphere

Avoid large thumbnails.
```

- [ ] **Step 4: Declare Companion Result's anchor availability**

Find:
```
# Companion Result

Very subtle.

Examples

"You once struggled with this expression."

"This appeared several times."

"I remember you bookmarked this."

No avatar.

No AI branding.
```

Replace:
```
# Companion Result

○ Planned — chưa implement. Search is not one of L9b (D3)'s four shipped Companion anchors (Dashboard,
`/journal`, Video Library empty state, Mining deck empty state) — see
`docs/design/design-reconciliation.md` §6. The behavior below describes the target design once this
anchor is built, not current behavior.

Presence level once built: Observe (`docs/design/design-reconciliation.md` §5) — Companion surfaces a
memory as one result type among several, it does not address the learner directly. Search is not an
active acquisition loop, so the Learning Loop Boundary (§4) does not restrict it here.

Very subtle.

Examples

"You once struggled with this expression."

"This appeared several times."

"I remember you bookmarked this."

No avatar.

No AI branding.
```

- [ ] **Step 5: Add a Settings caveat to the Relationship diagram**

Find:
```
Journal

↓

Settings

The learner should never wonder
```

Replace:
```
Journal

↓

Settings (target design — no `/settings` route ships today, see
`docs/design/screens/navigation-system.md` § Settings Entry Point)

The learner should never wonder
```

- [ ] **Step 6: Add the missing §8 sections (User State, Loading, Success, Error, Gamification)**

Per `design-reconciliation.md` §8, every screen spec must define Purpose, User state, Primary action,
Secondary actions, Empty states, Loading states, Success states, Error states, Companion behavior,
Gamification behavior, and Accessibility. This file has Purpose, Empty states, Companion behavior, and
partial Accessibility, but is missing User state, Loading states, Success states, Error states, and
Gamification behavior entirely. Unlike the 7 screen docs `design-reconciliation.md` §12 exempts, this
is a brand-new doc — no deferral applies.

Find:
```
Never display

0 Results Found

---

# Keyboard Navigation
```

Replace:
```
Never display

0 Results Found

---

# User State

Idle — no query yet (see Empty Search below).

Typing — query in progress, results update as the learner types.

Reviewing — results shown, learner scanning or hovering (see Instant Preview).

Navigating away — learner opens a result; Search itself does not change state, the destination screen
takes over.

---

# Loading States

Search should never show a blocking spinner.

Instead:

soft skeleton result rows

gentle fade-in as each result type resolves (Vocabulary, Sentence, Video, Grammar, Journal, Companion
may each resolve at slightly different times — semantic search takes longer than exact match)

Never wait for everything before showing anything.

The learner should never feel like the interface stalled.

---

# Success States

There is no separate "success" moment for Search itself — finding a matching result is what Reviewing
already looks like. Bookmarking or opening a result from Search inherits that action's own success
treatment (see `docs/design/screens/screen-states.md` § Success) rather than Search defining its own.

---

# Error States

If search (especially semantic search) fails or times out, fall back to exact keyword matching
silently — never surface a technical error for a search failure.

Only if there are truly no results at all does the "No Results" empty state above apply; a backend
failure should look identical to "still searching," never like an alarm.

---

# Gamification Behavior

Search has no Gamification Layer presence. It never displays XP, streak, leaderboard rank, or any
other Gamification-owned signal (`docs/design/design-reconciliation.md` §3) — Search is a wayfinding
surface, not a status surface. If a future result type surfaces something like "most-searched this
week," that would be a Gamification-owned addition and must be labeled as such, not folded into
Search's own memory-driven voice.

---

# Keyboard Navigation
```

- [ ] **Step 7: Verify**

```bash
grep -n "^# User State$\|^# Loading States$\|^# Success States$\|^# Error States$\|^# Gamification Behavior$" docs/design/screens/screen-search.md
grep -n "○ Planned" docs/design/screens/screen-search.md
grep -n "not the Gamification Layer's Progress metric" docs/design/screens/screen-search.md
```

Expected: first finds five matches; second and third each find one.

- [ ] **Step 8: Commit**

```bash
git add docs/design/screens/screen-search.md
git commit -m "docs(design-screens): reconcile screen-search.md with governance doc

Added the five §8-mandated sections this new screen spec was missing.
Companion Result now declares anchor availability (Planned) and
presence level per §9. Video Result's 'Progress' field, the Sidebar
entry point, and the Relationship diagram's 'Settings' node are all
disambiguated against the new navigation-system.md and the
Gamification Layer Responsibility Rule. Added a Status header."
```

---

### Task 15: Fix `docs/design/screens/screen-shadowing-detail.md`

**Files:**
- Modify: `docs/design/screens/screen-shadowing-detail.md`

**Interfaces:**
- Consumes: `docs/design/design-reconciliation.md` §3.
- Produces: a Header section that no longer bans Gamification outright — this file was already
  "Approved" from Wave 1 (its Companion section is correct), but the audit found an unrelated,
  unscoped Gamification ban the first pass missed.

- [ ] **Step 1: Scope the "No gamification." line**

Find:
```
No colorful actions.

No gamification.

No progress indicators.

No unnecessary controls.
```

Replace:
```
No colorful actions.

This header itself doesn't display Gamification (XP, Streak, Leaderboard, Badge) — that's a real,
shipped layer that lives elsewhere (Dashboard, post-session summaries), not banned product-wide
(`docs/design/design-reconciliation.md` §3). This header just isn't where it speaks.

No progress indicators.

No unnecessary controls.
```

- [ ] **Step 2: Verify**

```bash
grep -n "^No gamification\.$" docs/design/screens/screen-shadowing-detail.md
```

Expected: no matches.

- [ ] **Step 3: Commit**

```bash
git add docs/design/screens/screen-shadowing-detail.md
git commit -m "docs(design-screens): fix screen-shadowing-detail.md gamification ban

Header section stated 'No gamification.' as a blanket rule,
contradicting the shipped Gamification Layer (G1-G3) — a repo-wide
audit found this even though this file's Companion section was
already correct from an earlier pass. Scoped to this header specifically."
```

---

### Task 16: Fix `docs/design/screens/screen-review.md`

**Files:**
- Modify: `docs/design/screens/screen-review.md`

**Interfaces:**
- Consumes: `docs/design/design-reconciliation.md` §3.
- Produces: three sections (Header, Gentle Progress, Success Feedback) that no longer ban Gamification
  outright.

- [ ] **Step 1: Scope the Header's session-timer/streak-counter ban**

Find:
```
- Search
- Settings

No session timer.

No daily target.

No streak counter.

No motivational banners.
```

Replace:
```
- Search
- Settings

This header itself doesn't display a session timer, a daily target, or a streak counter — those are
Gamification-owned (`docs/design/design-reconciliation.md` §3) and real, shipped elsewhere (Dashboard);
this header just isn't where they speak.

No motivational banners.
```

- [ ] **Step 2: Scope the Gentle Progress section's ban**

Find:
```
Avoid

Cards Due

Completion %

Accuracy

Daily Quota

Instead communicate

You've revisited three familiar conversations today.
```

Replace:
```
Avoid, on this screen specifically

Cards Due

Completion %

Accuracy

Daily Quota

These are real Gamification-owned metrics elsewhere (Dashboard) — this screen just doesn't repeat
them here, the same way `docs/design/screens/screen-video-library.md`'s Progress section handles it
(`docs/design/design-reconciliation.md` §3).

Instead communicate

You've revisited three familiar conversations today.
```

- [ ] **Step 3: Scope the Success Feedback section's ban**

Find:
```
The feedback fades naturally.

No confetti.

No sound effects.

No achievement popups.
```

Replace:
```
The feedback fades naturally.

No confetti.

No sound effects.

No achievement popups — not because achievements are banned (Gamification's badge/streak moments are
real and shipped elsewhere, `docs/design/design-reconciliation.md` §3), but because this particular
save/favorite feedback is a small Feedback-layer moment, not a milestone.
```

- [ ] **Step 4: Verify**

```bash
grep -n "^No session timer\.$\|^No daily target\.$\|^No streak counter\.$" docs/design/screens/screen-review.md
grep -c "design-reconciliation.md" docs/design/screens/screen-review.md
```

Expected: first finds no matches (old unscoped lines gone); second finds at least 3.

- [ ] **Step 5: Commit**

```bash
git add docs/design/screens/screen-review.md
git commit -m "docs(design-screens): fix screen-review.md unscoped gamification bans

Header, Gentle Progress, and Success Feedback each banned a
Gamification-owned element (streak counter, quota metrics, achievement
popups) with no carve-out, contradicting G1-G3 — a repo-wide audit
found these even though this file's Companion section was already
correct from an earlier pass. All three now scoped to this screen's
own restraint, with Gamification named as real and shipped elsewhere."
```

---

### Task 17: Fix `docs/design/screens/screen-architecture.md`

**Files:**
- Modify: `docs/design/screens/screen-architecture.md`

**Interfaces:**
- Consumes: `docs/design/patterns/settings-patterns.md` (Draft status, Wave 1);
  `docs/design/screens/navigation-system.md` (Task 10); `docs/design/design-reconciliation.md` §13
  (Task 1) — must run after Tasks 1 and 10.
- Produces: a Workspace Types list and Emotional Hierarchy table that don't claim `/settings` ships
  today, and a Focus States section that doesn't imply its "Minimal" tier is a cross-document standard.

- [ ] **Step 1: Add a caveat to the Workspace Types list**

Find:
```
Mining

→ Vocabulary Collection

Settings

→ Configuration Workspace

The Workspace should visually occupy most of the screen.
```

Replace:
```
Mining

→ Vocabulary Collection

Settings

→ Configuration Workspace (target design — no `/settings` route ships today; see
`docs/design/patterns/settings-patterns.md`, Draft/roadmap, and
`docs/design/screens/navigation-system.md` § Settings Entry Point)

The Workspace should visually occupy most of the screen.
```

- [ ] **Step 2: Add a caveat to the Emotional Hierarchy table**

Find:
```
| Journal | Reflection |
| Settings | Preparation |

Visual design should reinforce these emotional roles.
```

Replace:
```
| Journal | Reflection |
| Settings | Preparation (target design — not yet a shipped route, see `settings-patterns.md`) |

Visual design should reinforce these emotional roles.
```

- [ ] **Step 3: Add a local-naming note to Focus States**

Find:
```
Immersive

↓

Minimal

The transition between these states should be smooth.
```

Replace:
```
Immersive

↓

Minimal

This is this document's own screen-chrome-density progression — a related but distinct axis from
`adaptive-layouts.md`'s Companion Adaptation gradient or `learning-surfaces.md`'s Reading States;
none of these documents share one unified naming scheme, and none should be read as if they do (see
`docs/design/design-reconciliation.md` §13).

The transition between these states should be smooth.
```

- [ ] **Step 4: Verify**

```bash
grep -n "target design" docs/design/screens/screen-architecture.md
grep -n "design-reconciliation.md.*§13" docs/design/screens/screen-architecture.md
```

Expected: first finds two matches; second finds one.

- [ ] **Step 5: Commit**

```bash
git add docs/design/screens/screen-architecture.md
git commit -m "docs(design-screens): fix screen-architecture.md stale Settings claims + naming note

Workspace Types and Emotional Hierarchy both listed Settings at parity
with 5 shipped screens; both now note no /settings route exists yet.
Focus States' 'Minimal' tier now cites the new §13 rule that this
document's naming is local, not a cross-document standard."
```

---

### Task 18: Fix `docs/design/screens/learning-surfaces.md`

**Files:**
- Modify: `docs/design/screens/learning-surfaces.md`

**Interfaces:**
- Consumes: `docs/design/design-reconciliation.md` §3, §13 (Task 1); `docs/design/screens/screen-dashboard.md`
  § Progress (Wave 1) — must run after Task 1.
- Produces: a Status header (this foundational, depended-upon file had none), an Overview Surface
  section consistent with Dashboard's shipped Gamification display, and a Reading States section that
  doesn't imply its "Analysis" tier is a cross-document standard.

- [ ] **Step 1: Add a Status header**

Find:
```
# Learning Surfaces

> Purpose
>
> This document defines the primary learning surfaces used throughout Nihongo Cinema.
```

Replace:
```
# Learning Surfaces

> **Status:** Approved
> **Related:** `docs/design/patterns/companion-patterns.md`, `docs/design/design-reconciliation.md`

> Purpose
>
> This document defines the primary learning surfaces used throughout Nihongo Cinema.
```

- [ ] **Step 2: Fix the Overview Surface Gamification contradiction**

`companion-patterns.md` lists this file as a dependency, and `workspace-patterns.md`'s Pattern 09
("Used by: Dashboard") composes from the same concept — this surface backs the real, shipped
Dashboard, which shows a Gamification Progress section per Wave 1's `screen-dashboard.md` fix.

Find:
```
Avoid

KPIs

Statistics

Charts

Productivity metrics

---
```

Replace:
```
Avoid

Enterprise-style KPI walls, dense statistics grids, charts, and productivity-metrics dashboards.

This is not a ban on the Gamification Layer's own Progress/Streak display — Dashboard (which composes
from this surface) legitimately shows a Gamification Progress section per the Layer Responsibility
Rule (`docs/design/design-reconciliation.md` §3, `docs/design/screens/screen-dashboard.md` § Progress).
What's avoided here is a productivity-software aesthetic, not the Gamification Layer's existence.

---
```

- [ ] **Step 3: Add a local-naming note to Reading States**

Find:
```
Immersive

↓

Analysis

The transition between states should never interrupt reading.
```

Replace:
```
Immersive

↓

Analysis

This is this document's own Reading-Surface-specific progression — related to but not identical
with other documents' similarly-shaped state gradients (e.g. `adaptive-layouts.md`'s Companion
Adaptation, `screen-architecture.md`'s Focus States). None of these share one unified naming scheme
(`docs/design/design-reconciliation.md` §13).

The transition between states should never interrupt reading.
```

- [ ] **Step 4: Verify**

```bash
grep -n "^> \*\*Status:\*\*" docs/design/screens/learning-surfaces.md
grep -n "Layer Responsibility Rule" docs/design/screens/learning-surfaces.md
grep -n "design-reconciliation.md.*§13" docs/design/screens/learning-surfaces.md
```

Expected: each finds one match.

- [ ] **Step 5: Commit**

```bash
git add docs/design/screens/learning-surfaces.md
git commit -m "docs(design-screens): reconcile learning-surfaces.md with governance doc

This foundational, depended-upon file (cited by companion-patterns.md
and workspace-patterns.md) had no Status declaration and its Overview
Surface section unscoped-banned KPIs/statistics/charts, contradicting
the Dashboard's shipped Gamification Progress section. Fixed both,
and added a §13 local-naming note to Reading States' 'Analysis' tier."
```

---

### Task 19: Fix `docs/design/screens/screen-mining.md`

**Files:**
- Modify: `docs/design/screens/screen-mining.md`

**Interfaces:**
- Consumes: `docs/design/design-reconciliation.md` §3.
- Produces: a Quiet Header section that doesn't read as banning the Gamification Badge primitive.

- [ ] **Step 1: Disambiguate "No red badges"**

Find:
```
No statistics.

No review counts.

No overdue cards.

No red badges.
```

Replace:
```
No statistics.

No review counts.

No overdue cards.

No red notification badges (the small numeric "overdue count" chip pattern) — this is about that UI
chrome specifically, not the Gamification Layer's Badge primitive
(`docs/design/design-reconciliation.md` §3), which is a separate, real, shipped concept.
```

- [ ] **Step 2: Verify**

```bash
grep -n "^No red badges\.$" docs/design/screens/screen-mining.md
```

Expected: no matches.

- [ ] **Step 3: Commit**

```bash
git add docs/design/screens/screen-mining.md
git commit -m "docs(design-screens): disambiguate screen-mining.md's 'no red badges' line

Read as if it banned the Gamification Layer's Badge primitive;
clarified it means the UI notification-count chip specifically."
```

---

### Task 20: Fix `docs/design/screens/screen-video-library.md`

**Files:**
- Modify: `docs/design/screens/screen-video-library.md`

**Interfaces:**
- Consumes: `docs/design/design-reconciliation.md` §6, §9; `docs/design/patterns/companion-patterns.md`
  § Declare Anchor.
- Produces: an Empty Library section that documents Companion's actually-Available presence there —
  currently only the non-empty view's Planned status is documented.

Per `design-reconciliation.md` §6, "Video Library (empty state)" is one of the four Available
Companion anchors shipped in L9b (D3) — but this file's only Companion documentation is scoped to the
non-empty view and marked Planned. The Available case (empty state) has no Companion documentation at
all, an §9 gap.

- [ ] **Step 1: Document Companion's Available status in Empty Library**

Find:
```
The screen should feel hopeful,

never empty.

---

# Companion
```

Replace:
```
The screen should feel hopeful,

never empty.

This empty state is one of L9b (D3)'s four shipped Companion anchors — Available today
(`docs/design/design-reconciliation.md` §6). Unlike the non-empty view below (Planned), Companion may
appear here now; see `docs/design/patterns/companion-patterns.md` § Declare Anchor for the
presence-level and copy conventions it follows.

---

# Companion
```

- [ ] **Step 2: Verify**

```bash
grep -n "one of L9b (D3)'s four shipped Companion anchors" docs/design/screens/screen-video-library.md
```

Expected: one match.

- [ ] **Step 3: Commit**

```bash
git add docs/design/screens/screen-video-library.md
git commit -m "docs(design-screens): document Companion's Available status in Empty Library

The Video Library empty state is one of L9b's four shipped Companion
anchors, but this file only documented the non-empty view (Planned) —
the Available case had no §9 documentation at all."
```

---

## Phase 3 — Root docs

### Task 21: Add Status headers to 10 root-level `docs/design/*.md` files

**Files:**
- Modify: `docs/design/README.md`, `docs/design/PLAYBOOK.md`, `docs/design/ai-behavior-guidelines.md`,
  `docs/design/ai-writing-principles.md`, `docs/design/interaction-principles.md`,
  `docs/design/landing-storyboard.md`, `docs/design/microcopy-guidelines.md`,
  `docs/design/motion-principles.md`, `docs/design/motion-system.md`,
  `docs/design/nihongo_page_playbook.md`

**Interfaces:**
- Consumes: `docs/design/design-reconciliation.md` §7 (Task 1 broadened this to explicitly cover root
  docs) — must run after Task 1.
- Produces: valid `Draft`/`Approved`/`Canonical`/`Deprecated` declarations on 10 files that previously
  used informal, non-canonical labels ("Living Document," "Governing Note," a bare `Version:` line, or
  nothing at all). All 10 are settled, actively-cited philosophy docs — `Approved` fits every one; none
  of the audit findings suggested any of them is still exploratory.

This is one mechanical, repeated edit across 10 files — each Find/Replace is independent and small.

- [ ] **Step 1: `docs/design/README.md`**

Find:
```
# docs/design/ — How To Read These Documents

Status: Governing Note
```

Replace:
```
# docs/design/ — How To Read These Documents

> **Status:** Approved
```

- [ ] **Step 2: `docs/design/PLAYBOOK.md`**

Find:
```
# Nihongo Cinema Design Playbook

Version: 1.0
```

Replace:
```
# Nihongo Cinema Design Playbook

> **Status:** Approved
> Version: 1.0
```

- [ ] **Step 3: `docs/design/ai-behavior-guidelines.md`**

Find:
```
# AI Behavior Guidelines

> Status: Living Design Document
>
> Defines how AI behaves throughout the product.
```

Replace:
```
# AI Behavior Guidelines

> **Status:** Approved
>
> Defines how AI behaves throughout the product.
```

- [ ] **Step 4: `docs/design/ai-writing-principles.md`**

Find:
```
# AI Writing Principles

Status: Living Document

Purpose:
Define how AI communicates.
```

Replace:
```
# AI Writing Principles

> **Status:** Approved

Purpose:
Define how AI communicates.
```

- [ ] **Step 5: `docs/design/interaction-principles.md`**

Find:
```
# Interaction Principles

Status: Living Document

Purpose:
Define how every interaction should feel.
```

Replace:
```
# Interaction Principles

> **Status:** Approved

Purpose:
Define how every interaction should feel.
```

- [ ] **Step 6: `docs/design/landing-storyboard.md`**

Find:
```
# Landing Storyboard

Landing page là một câu chuyện.

Không phải danh sách tính năng.
```

Replace:
```
# Landing Storyboard

> **Status:** Approved

Landing page là một câu chuyện.

Không phải danh sách tính năng.
```

- [ ] **Step 7: `docs/design/microcopy-guidelines.md` (plus a broken-reference fix)**

The audit flagged `experience-architecture.md` as unresolvable — it exists, just not under
`docs/design/` (it's at `docs/architecture/experience-architecture.md`); fix the citation's path in
the same pass.

Find:
```
# Microcopy Guidelines

**Project:** Nihongo Cinema / AI Language OS  
**Version:** 1.0  
**Status:** Living Document

---

# Scope

This document defines **product-facing copy only** — how the product communicates through UI text.

It does not define:

- Companion personality (see `MASCOT.md`)
- AI behavior (see `ai-behavior-guidelines.md`)
- Product philosophy (see Product Philosophy / Spec 1)
- Experience mechanics (see `experience-architecture.md`)
```

Replace:
```
# Microcopy Guidelines

**Project:** Nihongo Cinema / AI Language OS  
**Version:** 1.0  
**Status:** Approved

---

# Scope

This document defines **product-facing copy only** — how the product communicates through UI text.

It does not define:

- Companion personality (see `MASCOT.md`)
- AI behavior (see `ai-behavior-guidelines.md`)
- Product philosophy (see Product Philosophy / Spec 1)
- Experience mechanics (see `docs/architecture/experience-architecture.md`)
```

- [ ] **Step 8: `docs/design/motion-principles.md`**

Find:
```
# Motion Principles

Status: Living Document

Purpose:
Define how motion should feel across the product.
```

Replace:
```
# Motion Principles

> **Status:** Approved

Purpose:
Define how motion should feel across the product.
```

- [ ] **Step 9: `docs/design/motion-system.md`**

Find:
```
# Motion System

---

# Motion Philosophy
```

Replace:
```
# Motion System

> **Status:** Approved

---

# Motion Philosophy
```

- [ ] **Step 10: `docs/design/nihongo_page_playbook.md`**

Find:
```
# Nihongo Cinema Landing Page Playbook

> Version: 1.0
>
> Đây không phải guideline về UI.
```

Replace:
```
# Nihongo Cinema Landing Page Playbook

> **Status:** Approved
> Version: 1.0
>
> Đây không phải guideline về UI.
```

- [ ] **Step 11: Verify**

```bash
grep -L "Status:\*\* Approved\|Status: Approved" docs/design/README.md docs/design/PLAYBOOK.md docs/design/ai-behavior-guidelines.md docs/design/ai-writing-principles.md docs/design/interaction-principles.md docs/design/landing-storyboard.md docs/design/microcopy-guidelines.md docs/design/motion-principles.md docs/design/motion-system.md docs/design/nihongo_page_playbook.md
grep -n "docs/architecture/experience-architecture.md" docs/design/microcopy-guidelines.md
```

Expected: first command (grep -L lists files WITHOUT a match) prints nothing — all 10 now have an
Approved status line; second finds one match.

- [ ] **Step 12: Commit**

```bash
git add docs/design/README.md docs/design/PLAYBOOK.md docs/design/ai-behavior-guidelines.md docs/design/ai-writing-principles.md docs/design/interaction-principles.md docs/design/landing-storyboard.md docs/design/microcopy-guidelines.md docs/design/motion-principles.md docs/design/motion-system.md docs/design/nihongo_page_playbook.md
git commit -m "docs(design): bring 10 root design docs into Status/lifecycle compliance

None of these 10 files used the Draft/Approved/Canonical/Deprecated
vocabulary design-reconciliation.md §7 requires — most used an
informal 'Living Document'/'Governing Note' label, three had no
Status field at all. All 10 are settled, actively-cited docs, so all
get Approved. Also fixed microcopy-guidelines.md's
experience-architecture.md citation to its real path under
docs/architecture/ (it exists, just not under docs/design/)."
```

---

### Task 22: Fix `docs/design/emotion-design.md`

**Files:**
- Modify: `docs/design/emotion-design.md`

**Interfaces:**
- Consumes: `docs/design/design-reconciliation.md` §3, §7.
- Produces: a Status header and an "After Learning" section that no longer devalues the shipped Streak
  mechanic.

Kept as its own task (rather than folded into Task 21's bulk fix) because, unlike the other 10 root
docs, this file also needs a content fix, not just a Status header.

- [ ] **Step 1: Add a Status header**

Find:
```
# Emotion Design

Status: Living Document

Purpose:
Define what users should feel while using the product.
```

Replace:
```
# Emotion Design

> **Status:** Approved

Purpose:
Define what users should feel while using the product.
```

- [ ] **Step 2: Stop devaluing the shipped Streak mechanic**

Find:
```
# After Learning

"I want to come back."

Not because of streaks.

Because the experience felt good.
```

Replace:
```
# After Learning

"I want to come back."

Not *only* because of streaks — Streak is a real, shipped Gamification reinforcement mechanic
(G1–G3, `docs/design/design-reconciliation.md` §3), not banned or devalued here.

Because the experience felt good.
```

- [ ] **Step 3: Verify**

```bash
grep -n "^> \*\*Status:\*\*" docs/design/emotion-design.md
grep -n "Not because of streaks" docs/design/emotion-design.md
```

Expected: first finds one match; second finds no matches.

- [ ] **Step 4: Commit**

```bash
git add docs/design/emotion-design.md
git commit -m "docs(design): fix emotion-design.md streak devaluation + Status header

'Not because of streaks' read as discounting Streak as a legitimate
return-driver, in tension with G1-G3 where Streak is an intentional
reinforcement mechanic. Softened to acknowledge it's real without
making it the whole story. Added a Status header."
```

---

## Final Verification (after Task 22)

- [ ] **Cross-reference sweep:** confirm every `design-reconciliation.md §N` citation across every
  file this plan touched resolves to a real section (1–13).

```bash
grep -rn "design-reconciliation.md §\|design-reconciliation.md.*§1[0-3]\b" docs/design/ | grep "§"
```

Read the output and manually confirm each `§N` cited is between 1 and 13.

- [ ] **No leftover CLAUDE.md violation:**

```bash
grep -rin "download again\|re-download\|ytdl\|youtube-dl" docs/design/
```

Expected: no matches.

- [ ] **No leftover unscoped Gamification bans:**

```bash
grep -rn "^No gamification\.$\|^- Gamified$\|^- Gamification$" docs/design/
```

Expected: no matches (all converted to scoped carve-outs).

- [ ] **No leftover broken references:**

```bash
grep -rn "companion-system.md\|character-bible.md\|screen-library.md" docs/design/
```

Expected: no matches (these were already fixed in Wave 1; confirming no regression).

- [ ] **All previously-untracked files are now tracked and committed:**

```bash
git status --porcelain docs/design/patterns/overlays-and-drawers.md docs/design/patterns/reading-patterns.md docs/design/patterns/transcript-patterns.md docs/design/patterns/video-patterns.md docs/design/screens/adaptive-layouts.md docs/design/screens/navigation-system.md docs/design/screens/screen-search.md docs/design/screens/screen-states.md docs/design/screens/workspace-patterns.md
```

Expected: no output.

- [ ] **Commit count check:** confirm 22 new commits since this plan started.

```bash
git log --oneline -22
```
