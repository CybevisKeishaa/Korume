# Design Docs Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconcile `docs/design/patterns/*.md` and `docs/design/screens/*.md` with the product spec,
business-model G1–G3, and the shipped Companion system (Spec 1 + L9b), by creating one governance
"constitution" doc and correcting 12 files that currently contradict it or contradict themselves.

**Architecture:** Documentation-only change, four phases, strictly ordered — Phase 1 creates the
canonical governance file; Phases 2–3 edit existing pattern/screen files to link back to it instead of
restating rules inline; Phase 4 (missing-screens backlog) is explicitly not executed.

**Tech Stack:** Markdown files only. No code, no build, no test suite.

## Global Constraints

- **Source-of-truth spec:** `docs/superpowers/specs/2026-07-28-design-docs-reconciliation-design.md`
  (LOCKED). Every task below implements one numbered item from that spec's §9 file-change list — do
  not deviate from its resolutions (§3–§8) without a new spec revision.
- **No tests apply.** Per spec §10, verification is a re-read pass confirming (a) the edited section
  matches the spec's resolution and (b) every cross-reference in the edited text resolves to a real
  file. Each task's "Step 2: Verify" does this instead of running a test suite.
- **No code changes.** Nothing in `app/` or `components/` is touched by this plan. The
  `speech-bubble.tsx` restyle and the Phase 4 missing-screen docs are explicit follow-ups, out of
  scope here.
- **Phase order is load-bearing.** Phase 2/3 files link back to `docs/design/design-reconciliation.md`
  (created in Phase 1) — Phase 1 must be done and committed before any Phase 2 task starts.
- **One commit per task.** Commit message prefix `docs(design):` for Phase 1, `docs(design-patterns):`
  for Phase 2, `docs(design-screens):` for Phase 3.
- **Every edited/created file keeps its existing content except the exact block being changed** — do
  not reformat or reflow unrelated sections.

---

## File Structure

| File | Task | Change |
|---|---|---|
| `docs/design/design-reconciliation.md` | 1 | **Create.** The governance "constitution" — 11 short sections, Canonical status. |
| `docs/design/patterns/companion-patterns.md` | 2 | Fix refs; add Presence mapping + Listening/Silent; expand Learning Boundary; correct Speech Bubble framing. |
| `docs/design/patterns/feedback-patterns.md` | 3 | Remove leaderboard ban; add Gamification/Companion split section + Layer Responsibility table. |
| `docs/design/patterns/study-modes.md` | 4 | Replace Review Mode's Companion Behavior with a Not Supported statement. |
| `docs/design/patterns/empty-states.md` | 5 | Fix broken `screen-library.md` reference. |
| `docs/design/patterns/settings-patterns.md` | 6 | Mark file as roadmap — no `/settings` route exists. |
| `docs/design/screens/screen-architecture.md` | 7 | Fix "Avoid: gamification" line. |
| `docs/design/screens/screen-dashboard.md` | 8 | Fix Progress section; add Layer Responsibility table. |
| `docs/design/screens/screen-video-library.md` | 9 | Fix Progress section; mark Companion section Planned. |
| `docs/design/screens/screen-review.md` | 10 | Replace Companion section with Not Supported statement. |
| `docs/design/screens/screen-shadowing-detail.md` | 11 | Replace Companion section with Not Supported statement. |
| `docs/design/screens/screen-mining.md` | 12 | Scope Companion section to browse/collection; mark non-empty anchor Planned. |
| `docs/design/screens/screen-video-detail.md` | 13 | Mark Companion section Planned. |

No new files besides Task 1. No files deleted.

---

## Phase 1 — Governance

### Task 1: Create `docs/design/design-reconciliation.md`

**Files:**
- Create: `docs/design/design-reconciliation.md`

**Interfaces:**
- Consumes: nothing (first file in the chain).
- Produces: the canonical file every Phase 2/3 task links to by path
  `docs/design/design-reconciliation.md` and section number (`§1`–`§11` as defined below). Later
  tasks assume these exact section numbers exist — do not renumber without updating every reference
  in Tasks 2–13.

- [ ] **Step 1: Write the file**

Create `docs/design/design-reconciliation.md` with exactly this content:

````markdown
# Design System Governance & Reconciliation

> **Status:** Canonical
> **Version:** 1.0 (2026-07-28)
> **Applies to:** `docs/design/patterns/*.md`, `docs/design/screens/*.md`, and every future design
> document in this repo.
> **Decision record:** `docs/superpowers/specs/2026-07-28-design-docs-reconciliation-design.md`

---

## 1. Source of Truth

Product specifications are authoritative on product truth and behavior.
Design documentation translates specifications into user experience (UX/UI rules).
Implementation is audited against both — it is evidence, not authority.

### Authority Order

When two documents disagree, resolve by this order (highest wins):

1. Product specification (`japanese-learning-app-spec.md`)
2. Layer/System specifications (`docs/superpowers/specs/*-l*-design.md`) — these define architecture,
   behavior, and product rules, not just implementation shape
3. Business model principles (`docs/product/business-model.md`)
4. Design system rules (this file and its children)
5. Screen specifications (`docs/design/screens/*.md`)
6. Implementation details (code, component comments)
7. Experimental drafts (anything not yet Approved — see §7)

---

## 2. Companion Rules

- Companion never interrupts learning loops (§4, Learning Loop Boundary).
- Companion presence is controlled by the Ambient Layer
  (`components/companion/ambient-provider.tsx`), never by an individual screen.
- Companion does not own gamification and never narrates it (§3).
- Companion does not replace progress systems — it sits beside them, not instead of them.

---

## 3. Gamification Rules

Gamification exists per **G1–G3** (`docs/product/business-model.md` §1.1) and is a real, shipped
product layer — XP, streak, leaderboard, badge. Design docs must not prohibit it.

```
Learning Journey
        |
        +---- Gamification Layer
        |       XP · Streak · Leaderboard · Badge
        |       (G1–G3: reinforces learning, self-vs-past-self first,
        |        social ranking only once a real social graph exists)
        |
        +---- Companion Layer
                Memory · Reflection · Meaning
                (Spec 1 P0–P12: never comments on scores, never
                 takes credit, speaks in accompaniment terms only)
```

### Layer Responsibility Rule

Every screen that shows both layers documents which layer owns which information:

| Layer | Allowed | Forbidden |
|---|---|---|
| Gamification | XP, Streak, Progress, Goal completion | — |
| Companion | Memory, Reflection, Journey meaning | Reacting to XP/streak/leaderboard changes |

Example — Dashboard:

- Không: *"Wow, bạn vừa nhận thêm 20 XP!"*
- Có: *"Hôm nay bạn đã quay lại với một đoạn hội thoại quen thuộc."*

---

## 4. Learning Loop Boundary

> Companion không tồn tại trong các active acquisition loop: Shadowing practice, Dictation, SRS
> review, Mining review session, Pronunciation evaluation, JLPT practice, Grammar practice,
> Vocabulary review, Kanji practice, Conversation drills.
>
> Không phải vì Companion "không muốn" — vì focus của learner là nhân vật chính trong loop đó.
> Companion xuất hiện **sau khi hoàn thành loop**, không phải **trong** loop.

**The boundary is conceptual, not route-based.** The list above is illustrative, not exhaustive. Any
future active acquisition loop inherits Hidden by default — a screen must justify an exception to
show Companion; it never needs to justify staying Hidden.

---

## 5. Companion Presence Mapping

| Design Concept | Runtime State | Meaning |
|---|---|---|
| Hidden | Dormant / No Anchor | Companion không tồn tại trên surface |
| Ambient | Idle | Companion hiện diện nhưng không tương tác |
| Observe | Observing | Companion notices context |
| Listening | Listening | Companion stays present while learner acts |
| Address | Speaking | Companion chủ động giao tiếp |
| Silent | Silent | Quyết định không nói (context đã emit nhưng Companion chọn im lặng) |

**Dormant ≠ Silent.** Two different axes:

- **Presence existence** — Dormant vs. Active. Dormant = no anchor declared, Companion cannot appear
  at all.
- **Interaction state** — Idle / Observing / Listening / Speaking / Silent. Only applies once Active.
  `Silent` = a context was emitted and evaluated, and Companion chose not to speak — a decision, not
  an absence.

---

## 6. Anchor Availability

Three states — do not collapse into two:

- **Available** — shipped today (L9b D3: Dashboard, `/journal`, Video Library empty state, Mining
  deck empty state).
- **Planned** — architecture allows it (Spec 1 §5.2, any surface may declare an anchor), not yet
  built. Adding it later needs no architecture change.
- **Not Supported** — forbidden by the Learning Loop Boundary (§4). Not a backlog item — moving out
  of this state requires changing the boundary rule itself, not just shipping a feature.

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

---

## 7. Design Document Lifecycle

Every design document declares exactly one state at the top of the file:

| State | Meaning |
|---|---|
| Draft | Exploration only. Cannot override existing rules; cannot be cited by other docs as settled. |
| Approved | Defines UX behavior for its scope. Citable by other docs. |
| Canonical | Referenced by other docs as source of truth for its topic. |
| Deprecated | Historical reference only; superseded content, kept for context, not followed. |

A Draft never outranks a spec, a Layer spec, or an Approved/Canonical design doc — regardless of how
recently it was written.

---

## 8. Screen Documentation Rules

Every screen spec must define:

- Purpose
- User state
- Primary action
- Secondary actions
- Empty states
- Loading states
- **Success states** (distinct from empty — completing a video, finishing shadowing, hitting a
  milestone, unlocking content)
- Error states
- Companion behavior (§4, §5, §6)
- Gamification behavior (§3)
- Accessibility considerations

---

## 9. Companion Documentation Rules

Every mention of Companion in any design doc must specify:

- Presence level (§5)
- Anchor availability: Available / Planned / Not Supported (§6)
- Context trigger (what `emitContext()` call, if named)
- Learning boundary status (§4)

---

## 10. Visual vs. Interaction Changes

A restyle (border, color, font, shape — e.g. "Handwritten Note" replacing chat-bubble chrome) is a
**visual pattern**, not a replacement **interaction pattern**. Visual simplification must never
remove semantic functionality: dismiss affordance, accessibility behavior, live region, and keyboard
support are the interaction *contract* and stay fixed under any restyle.

---

## 11. Design Evolution Principle

> New design documentation may improve: clarity, usability, emotional quality, consistency.
> It may not silently redefine: product goals, business rules, learning philosophy, system
> architecture.
>
> A change to *how something is presented* is a design-doc edit. A change to *what is true about the
> product* is a spec edit — proposed against the Authority Order (§1), not slipped into a pattern or
> screen file.
````

- [ ] **Step 2: Verify**

Read the created file back and confirm: all 11 section headers present in order (`## 1.` through
`## 11.`), no `TBD`/`TODO` text, both tables in §3 and §6 render as valid markdown (pipe counts match
header row). Confirm `docs/superpowers/specs/2026-07-28-design-docs-reconciliation-design.md` exists
(the file the header links to).

- [ ] **Step 3: Commit**

```bash
git add docs/design/design-reconciliation.md
git commit -m "docs(design): create design system governance and reconciliation doc

Canonical constitution for docs/design/patterns and docs/design/screens:
authority order, Companion rules, gamification rules, learning loop
boundary, presence mapping, anchor availability, and the design
document lifecycle. Phase 1 of the reconciliation plan."
```

---

## Phase 2 — Foundation patterns

### Task 2: Fix `docs/design/patterns/companion-patterns.md`

**Files:**
- Modify: `docs/design/patterns/companion-patterns.md`

**Interfaces:**
- Consumes: `docs/design/design-reconciliation.md` §4 (Learning Loop Boundary), §5 (Presence
  mapping), §10 (Visual vs. Interaction Changes) — created in Task 1.
- Produces: corrected references and an expanded Learning Boundary / Presence Levels / Companion
  Notes section that Tasks 4, 10, 11, 12 point back to.

- [ ] **Step 1: Fix the header dependency list**

Find:
```
> Design Pattern
> Version 1.0
> Depends on:
> - companion-system.md
> - character-bible.md
> - navigation-system.md
> - learning-surfaces.md
```

Replace with:
```
> Design Pattern
> Status: Approved
> Version 1.1
> Depends on:
> - docs/design/design-reconciliation.md
> - docs/superpowers/specs/2026-07-16-companion-system-design.md
> - MASCOT.md
> - navigation-system.md
> - learning-surfaces.md
```

- [ ] **Step 2: Expand the Presence Levels intro line**

Find:
```
Companion có bốn mức hiện diện.
```

Replace with:
```
Companion có các mức hiện diện sau. Bảng mapping đầy đủ với runtime state machine (`CompanionState`)
nằm tại `docs/design/design-reconciliation.md` §5 — đây là bản tóm tắt.
```

- [ ] **Step 3: Add the Silent level after Level 3 — Address**

Find:
```
Sau đó,

Companion quay về trạng thái Ambient.

---

# Silence Is A Valid Response
```

Replace with:
```
Sau đó,

Companion quay về trạng thái Ambient.

---

## Silent — Quyết định không nói

Khác với Hidden (Dormant — không có anchor, Companion không tồn tại trên surface), Silent là một
trạng thái Active: Companion đã nhận context, đã cân nhắc, và **chủ động chọn** không nói.

Dormant ≠ Silent. Đừng gộp hai khái niệm này (chi tiết: `docs/design/design-reconciliation.md` §5).

---

# Silence Is A Valid Response
```

- [ ] **Step 4: Expand the Learning Boundary section**

Find:
```
# Learning Boundary

Trong Learning Surface:

Companion luôn biến mất.

Bao gồm:

- Shadowing
- Review
- Speaking
- Typing
- Dictation
- Listening

Không avatar.

Không popup.

Không animation.

Không AI.

Không dialogue.
```

Replace with:
```
# Learning Boundary

Xem **Learning Loop Boundary** đầy đủ tại `docs/design/design-reconciliation.md` §4 — bản dưới đây
là tóm tắt, file đó là canonical.

Trong các active acquisition loop, Companion luôn Hidden (Dormant — không có anchor).

Bao gồm (danh sách minh hoạ, không đầy đủ — xem §4 "conceptual, not route-based"):

- Shadowing practice
- Dictation
- SRS review
- Mining review session
- Pronunciation evaluation
- JLPT practice
- Grammar practice
- Vocabulary review
- Kanji practice
- Conversation drills
- Listening practice (hoạt động học — khác với runtime state "Listening" ở bảng Presence Levels
  bên trên, đừng nhầm hai khái niệm này)

Không avatar.

Không popup.

Không animation.

Không AI.

Không dialogue.

Bất kỳ active acquisition loop nào trong tương lai mặc định Hidden — screen phải giải trình nếu
muốn ngoại lệ, không cần giải trình để giữ Hidden.
```

- [ ] **Step 5: Correct the Companion Notes / Speech Bubble section**

Find:
```
# Companion Notes

Companion không dùng Speech Bubble.

Thay vào đó là Handwritten Notes.

Ví dụ:

━━━━━━━━━━━━

✨

This sentence seems difficult.

━━━━━━━━━━━━

Note tự biến mất.

Không cần đóng.

Không có nút OK.
```

Replace with:
```
# Companion Notes

Companion notes are correct about interaction behavior today; only the visual language changes.

Visual language: Handwritten Notes thay vì chat-assistant bubble chrome (border/shadow/rounded card
kiểu chat).

Ví dụ:

━━━━━━━━━━━━

✨

This sentence seems difficult.

━━━━━━━━━━━━

Interaction behavior giữ nguyên — accessibility-driven, xem
`docs/design/design-reconciliation.md` §10:

- Auto-fade (~8s)
- Dismiss button (click/Esc) — đây không phải "nút OK xác nhận"; learner không cần bấm gì để note
  tự biến mất
- Keyboard accessibility
- Persistent live region cho screen reader

Handwritten Note là visual pattern, không phải interaction pattern thay thế. Visual simplification
không được xoá semantic functionality.
```

- [ ] **Step 6: Verify**

Grep the file for the old broken references to confirm they're gone:

```bash
grep -n "companion-system.md\|character-bible.md" docs/design/patterns/companion-patterns.md
```

Expected: no matches (both were replaced with real paths in Step 1). Confirm the new referenced files
exist: `docs/design/design-reconciliation.md` (Task 1), `docs/superpowers/specs/2026-07-16-companion-system-design.md`, `MASCOT.md` — all three should be found via:

```bash
ls docs/design/design-reconciliation.md docs/superpowers/specs/2026-07-16-companion-system-design.md MASCOT.md
```

Expected: all three print without "No such file or directory".

- [ ] **Step 7: Commit**

```bash
git add docs/design/patterns/companion-patterns.md
git commit -m "docs(design-patterns): reconcile companion-patterns.md with governance doc

Fixes broken references (companion-system.md, character-bible.md),
adds the Listening/Silent presence levels and Dormant-vs-Silent
distinction, expands the Learning Boundary list with the conceptual
general form, and corrects Speech Bubble framing to 'correct
interaction behavior, restyled visual language' instead of 'wrong'."
```

---

### Task 3: Fix `docs/design/patterns/feedback-patterns.md`

**Files:**
- Modify: `docs/design/patterns/feedback-patterns.md`

**Interfaces:**
- Consumes: `docs/design/design-reconciliation.md` §3 (Gamification Rules, Layer Responsibility
  Rule).
- Produces: corrected Anti-Patterns list and a new "Relationship With Gamification" section other
  docs can point to for the Feedback-layer-specific application of §3.

- [ ] **Step 1: Add a "Relationship With Gamification" section after Companion Feedback**

Find:
```
The Companion acknowledges the journey.

Never the score.

---

# Visual Language
```

Replace with:
```
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
```

- [ ] **Step 2: Remove the leaderboard ban from Anti-Patterns**

Find:
```
# Anti-Patterns

Do not gamify feedback.

Do not celebrate every small action.

Do not punish incorrect answers.

Do not interrupt concentration with popups.

Do not use rankings or leaderboards.

Do not display giant success banners.

Do not create artificial urgency.

Do not encourage speed over understanding.
```

Replace with:
```
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
```

- [ ] **Step 3: Verify**

```bash
grep -n "rankings or leaderboards" docs/design/patterns/feedback-patterns.md
```

Expected: no matches. Confirm the new "Relationship With Gamification" section exists:

```bash
grep -n "Relationship With Gamification" docs/design/patterns/feedback-patterns.md
```

Expected: one match.

- [ ] **Step 4: Commit**

```bash
git add docs/design/patterns/feedback-patterns.md
git commit -m "docs(design-patterns): reconcile feedback-patterns.md gamification stance

Removes the blanket rankings/leaderboard ban (contradicted G1-G3 and
the shipped Layer 7 leaderboard) and adds a Relationship With
Gamification section applying the Layer Responsibility Rule to this
surface specifically."
```

---

### Task 4: Fix `docs/design/patterns/study-modes.md`

**Files:**
- Modify: `docs/design/patterns/study-modes.md`

**Interfaces:**
- Consumes: `docs/design/design-reconciliation.md` §4 (Learning Loop Boundary), §6 (Anchor
  Availability — Not Supported).
- Produces: a Review Mode section internally consistent with `companion-patterns.md`'s Learning
  Boundary (Task 2) and with Task 10 (`screen-review.md`).

- [ ] **Step 1: Replace the Review Mode Companion Behavior subsection**

Find:
```
## Companion Behavior

Warm but restrained.

It remembers previous milestones without celebrating excessively.

---

# Focus Mode
```

Replace with:
```
## Companion Behavior

✕ Not Supported. Review is an active acquisition loop
(`docs/design/design-reconciliation.md` §4, Learning Loop Boundary) — Companion stays Hidden
throughout Review, the same as Shadowing Mode above. It may address the learner after the review
session ends, never during it.

---

# Focus Mode
```

- [ ] **Step 2: Verify**

```bash
grep -n "Warm but restrained" docs/design/patterns/study-modes.md
```

Expected: no matches (the old Review Mode text is gone; note this exact phrase does not appear
elsewhere in the file). Confirm Shadowing Mode's existing "## Companion Behavior \n\n Silent." block
a few sections above is untouched — read the file and check the Shadowing Mode section still reads
"Silent.\n\nLearning requires complete concentration."

- [ ] **Step 3: Commit**

```bash
git add docs/design/patterns/study-modes.md
git commit -m "docs(design-patterns): fix study-modes.md Review Mode Companion violation

Review Mode described Companion notes appearing during Review, which
contradicted this same file's Shadowing Mode section and the Learning
Loop Boundary. Replaced with an explicit Not Supported statement."
```

---

### Task 5: Fix `docs/design/patterns/empty-states.md`

**Files:**
- Modify: `docs/design/patterns/empty-states.md`

**Interfaces:**
- Consumes: nothing from other tasks (independent fix).
- Produces: a working cross-reference to `screen-video-library.md`.

- [ ] **Step 1: Fix the broken reference**

Find:
```
> **Related:** `feedback-patterns.md`, `companion-patterns.md`, `screen-library.md`, `screen-dashboard.md`, `microcopy-guidelines.md`, `emotion-design.md`
```

Replace with:
```
> **Related:** `feedback-patterns.md`, `companion-patterns.md`, `screen-video-library.md`, `screen-dashboard.md`, `microcopy-guidelines.md`, `emotion-design.md`, `docs/design/design-reconciliation.md`
```

- [ ] **Step 2: Verify**

```bash
grep -n "screen-library.md" docs/design/patterns/empty-states.md
ls docs/design/screens/screen-video-library.md
```

Expected: first command finds no matches, second prints the file path (exists).

- [ ] **Step 3: Commit**

```bash
git add docs/design/patterns/empty-states.md
git commit -m "docs(design-patterns): fix broken screen-library.md reference in empty-states.md

The referenced file never existed under that name; the real file is
screen-video-library.md."
```

---

### Task 6: Fix `docs/design/patterns/settings-patterns.md`

**Files:**
- Modify: `docs/design/patterns/settings-patterns.md`

**Interfaces:**
- Consumes: `docs/design/design-reconciliation.md` §7 (Design Document Lifecycle).
- Produces: an explicit Draft/roadmap marker so this file is never mistaken for current state.

- [ ] **Step 1: Mark the file as roadmap in its header**

Find:
```markdown
# Settings Patterns

> **Status:** Design System Pattern  
> **Layer:** Experience Architecture  
> **Applies to:** Entire Product  
> **Related:** `screen-settings.md`, `workspace-patterns.md`, `overlays-and-drawers.md`, `navigation-system.md`, `interaction-principles.md`, `design-language.md`
```

Replace with:
```markdown
# Settings Patterns

> **Status:** Draft — roadmap, not current state. No `/settings` route exists in code yet
> (confirmed 2026-07-28 audit); this document describes a design concept awaiting implementation,
> per the Design Document Lifecycle (`docs/design/design-reconciliation.md` §7).
> **Layer:** Experience Architecture  
> **Applies to:** Entire Product (future)  
> **Related:** `screen-settings.md` (not yet written — see `docs/design/design-reconciliation.md`
> Phase 4 backlog), `workspace-patterns.md`, `overlays-and-drawers.md`, `navigation-system.md`,
> `interaction-principles.md`, `design-language.md`, `docs/design/design-reconciliation.md`
```

- [ ] **Step 2: Verify**

```bash
grep -n "roadmap, not current state" docs/design/patterns/settings-patterns.md
```

Expected: one match. Confirm there is genuinely no `/settings` route:

```bash
find "app/[locale]/(app)" -ipath "*settings*"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add docs/design/patterns/settings-patterns.md
git commit -m "docs(design-patterns): mark settings-patterns.md as roadmap (Draft)

No /settings route exists in code. Header now states this explicitly
per the Design Document Lifecycle so the file isn't read as
describing current behavior."
```

---

## Phase 3 — Screen specs

### Task 7: Fix `docs/design/screens/screen-architecture.md`

**Files:**
- Modify: `docs/design/screens/screen-architecture.md`

**Interfaces:**
- Consumes: `docs/design/design-reconciliation.md` §3 (Gamification Rules).
- Produces: a "What We Avoid" section that no longer contradicts the shipped Gamification Layer.

- [ ] **Step 1: Fix the Avoid list**

Find:
```
# What We Avoid

Nihongo Cinema intentionally avoids patterns commonly found in productivity software.

Avoid:

- dashboard-first layouts
- KPI-heavy interfaces
- enterprise SaaS aesthetics
- bright notification colors
- gamification
- achievement celebrations
- streak reminders
- excessive floating widgets
- permanent inspector panels
- aggressive onboarding
- visual clutter

Learning should feel peaceful rather than optimized for engagement.
```

Replace with:
```
# What We Avoid

Nihongo Cinema intentionally avoids patterns commonly found in productivity software.

Avoid:

- dashboard-first layouts
- KPI-heavy interfaces
- enterprise SaaS aesthetics
- bright notification colors
- excessive floating widgets
- permanent inspector panels
- aggressive onboarding
- visual clutter

Gamification (XP, streak, leaderboard, badge) is a real, shipped product layer
(G1–G3, `docs/design/design-reconciliation.md` §3) — it is not avoided. What is avoided is the
Companion narrating it, and any single screen treating gamification numbers as the primary
emotional signal instead of the Learning Journey itself. See the Layer Responsibility Rule
(`docs/design/design-reconciliation.md` §3).

Learning should feel peaceful rather than optimized for engagement — that is a statement about
tone, not a ban on the Gamification Layer existing.
```

- [ ] **Step 2: Verify**

```bash
grep -n "^- gamification$\|^- achievement celebrations$\|^- streak reminders$" docs/design/screens/screen-architecture.md
```

Expected: no matches (all three removed from the bullet list).

- [ ] **Step 3: Commit**

```bash
git add docs/design/screens/screen-architecture.md
git commit -m "docs(design-screens): fix screen-architecture.md gamification stance

Removed gamification/achievement/streak from 'What We Avoid' — they
are a real, shipped, spec-mandated layer (G1-G3). Added a pointer to
the Layer Responsibility Rule instead."
```

---

### Task 8: Fix `docs/design/screens/screen-dashboard.md`

**Files:**
- Modify: `docs/design/screens/screen-dashboard.md`

**Interfaces:**
- Consumes: `docs/design/design-reconciliation.md` §3 (Layer Responsibility Rule table).
- Produces: a Progress section consistent with the shipped `StreakCard`.

- [ ] **Step 1: Fix the Progress section**

Find:
```
# Progress

Avoid

XP

Levels

Daily missions

Achievement badges

Streak reminders

Instead,

quietly communicate continuity.

Examples

Recently active

Returning after a short break

Building confidence

Exploring new expressions

Progress should feel human.
```

Replace with:
```
# Progress

The Dashboard shows both layers side by side — each owns different information
(`docs/design/design-reconciliation.md` §3, Layer Responsibility Rule):

| Layer | Allowed | Forbidden |
|---|---|---|
| Gamification | XP, Streak, Progress, Goal completion | — |
| Companion | Memory, Reflection, Journey meaning | Reacting to XP/streak changes |

Gamification examples (shipped: `StreakCard`):

Bạn đã duy trì 12 ngày học liên tục.

Companion examples — never about the numbers:

Recently active

Returning after a short break

Building confidence

Exploring new expressions

Progress should feel human — that governs the Companion's voice, not whether the Gamification
Layer is visible.
```

- [ ] **Step 2: Verify**

```bash
grep -n "^Avoid$" docs/design/screens/screen-dashboard.md
grep -n "StreakCard" docs/design/screens/screen-dashboard.md
```

Expected: first command finds no matches in the Progress section context (there may be other
unrelated "Avoid" usages elsewhere in the file — confirm by reading, not just grep count); second
command finds one match.

- [ ] **Step 3: Commit**

```bash
git add docs/design/screens/screen-dashboard.md
git commit -m "docs(design-screens): fix screen-dashboard.md Progress section

Replaced the 'Avoid XP/Levels/Streak' list (contradicted the shipped
StreakCard) with the Layer Responsibility table, showing what each
layer is allowed to say on this screen."
```

---

### Task 9: Fix `docs/design/screens/screen-video-library.md`

**Files:**
- Modify: `docs/design/screens/screen-video-library.md`

**Interfaces:**
- Consumes: `docs/design/design-reconciliation.md` §3 (Gamification Rules), §6 (Anchor Availability
  — Planned).
- Produces: a Progress section consistent with §3, and a Companion section marked Planned per §6.

- [ ] **Step 1: Fix the Progress section**

Find:
```
# Progress

Avoid

52%

Level 8

XP

Instead show

Continue from sentence 18

Recently practiced

Finished shadowing

Saved expressions

Learning feels continuous rather than measured.
```

Replace with:
```
# Progress

Gamification numbers (XP, Level) are not avoided at the product level — they belong to the
Gamification Layer, not to this discovery surface (`docs/design/design-reconciliation.md` §3).
This screen simply doesn't repeat them here: it shows continuity instead, because the Library's
job is discovery, not status.

Show

Continue from sentence 18

Recently practiced

Finished shadowing

Saved expressions

Learning feels continuous rather than measured.
```

- [ ] **Step 2: Mark the Companion section Planned**

Find:
```
# Companion

The Companion quietly appears only when meaningful.

Examples

"This lesson matches the expressions you've been saving."

"You haven't visited this story in a while."

"This movie contains beautiful everyday conversations."

No recommendations based on engagement.

Only thoughtful observations.
```

Replace with:
```
# Companion

○ Planned — chưa implement. L9b (D3) chỉ có 4 anchor (Dashboard, `/journal`, Video Library empty
state, Mining deck empty state); Video Library non-empty state is not one of them yet
(`docs/design/design-reconciliation.md` §6). The behavior below describes the target design once
this anchor is built, not current behavior.

The Companion quietly appears only when meaningful.

Examples

"This lesson matches the expressions you've been saving."

"You haven't visited this story in a while."

"This movie contains beautiful everyday conversations."

No recommendations based on engagement.

Only thoughtful observations.
```

- [ ] **Step 3: Verify**

```bash
grep -n "○ Planned" docs/design/screens/screen-video-library.md
grep -n "^52%$" docs/design/screens/screen-video-library.md
```

Expected: first command finds one match; second finds none.

- [ ] **Step 4: Commit**

```bash
git add docs/design/screens/screen-video-library.md
git commit -m "docs(design-screens): fix screen-video-library.md gamification + anchor status

Progress section no longer bans XP/Level display at the product
level. Companion section marked Planned — this anchor isn't in L9b's
shipped set (D3)."
```

---

### Task 10: Fix `docs/design/screens/screen-review.md`

**Files:**
- Modify: `docs/design/screens/screen-review.md`

**Interfaces:**
- Consumes: `docs/design/design-reconciliation.md` §4 (Learning Loop Boundary), §6 (Not Supported).
- Produces: a Companion section consistent with Task 4 (`study-modes.md` Review Mode) and Task 2
  (`companion-patterns.md` Learning Boundary).

- [ ] **Step 1: Replace the Companion section**

Find:
```
# Companion

Occasionally leaves a small handwritten note.

Examples

✨

You always smile when reviewing this conversation.

This sentence has become much easier.

You haven't visited this movie in a while.

The Companion observes gently.

Never evaluates.
```

Replace with:
```
# Companion

✕ Not Supported. Review is an active acquisition loop
(`docs/design/design-reconciliation.md` §4, Learning Loop Boundary) — Companion is Dormant
throughout Review, the same as Shadowing. It does not appear during the session; any reflection it
has about a completed review surfaces later, on a surface where Companion is Available (Dashboard,
`/journal`) — never inside Review itself.
```

- [ ] **Step 2: Verify**

```bash
grep -n "Occasionally leaves a small handwritten note" docs/design/screens/screen-review.md
```

Expected: no matches. Read the file to confirm the "✕ Not Supported" section reads correctly in
context (it should sit where the old "# Companion" section was, still followed by "# Ambient
Atmosphere").

- [ ] **Step 3: Commit**

```bash
git add docs/design/screens/screen-review.md
git commit -m "docs(design-screens): fix screen-review.md Companion Learning Boundary violation

Review described Companion notes appearing mid-session, contradicting
companion-patterns.md's own Learning Boundary and the L9b scan test.
Replaced with an explicit Not Supported statement."
```

---

### Task 11: Fix `docs/design/screens/screen-shadowing-detail.md`

**Files:**
- Modify: `docs/design/screens/screen-shadowing-detail.md`

**Interfaces:**
- Consumes: `docs/design/design-reconciliation.md` §4 (Learning Loop Boundary), §6 (Not Supported).
- Produces: a Companion section consistent with Task 2's Learning Boundary list.

- [ ] **Step 1: Replace the Companion section**

Find:
```
# Companion

The Companion never occupies permanent space.

Occasionally a handwritten note appears.

Examples

✨

"I've saved this sentence."

"This phrase appears often."

"This pronunciation sounds difficult."

The note fades away.

No interaction required.

No chat window.

No conversation history.

The Companion behaves like someone studying nearby.
```

Replace with:
```
# Companion

✕ Not Supported. Shadowing is an active acquisition loop
(`docs/design/design-reconciliation.md` §4, Learning Loop Boundary) — Companion is Dormant
throughout Shadowing. This is structurally enforced: no `CompanionAnchor` may mount on the
shadowing route (L9b scan test). Companion does not appear during the session; any reflection it
has about a completed shadowing session surfaces later, on a surface where Companion is Available
(Dashboard, `/journal`) — never inside Shadowing itself.
```

- [ ] **Step 2: Verify**

```bash
grep -n "The Companion behaves like someone studying nearby" docs/design/screens/screen-shadowing-detail.md
```

Expected: no matches. Read the file to confirm the "✕ Not Supported" section sits where the old
"# Companion" section was, still followed by "# Difficulty Feedback".

- [ ] **Step 3: Commit**

```bash
git add docs/design/screens/screen-shadowing-detail.md
git commit -m "docs(design-screens): fix screen-shadowing-detail.md Companion Learning Boundary violation

Shadowing Detail described Companion notes appearing mid-session,
contradicting companion-patterns.md's own Learning Boundary and the
L9b structural scan test that forbids CompanionAnchor on this route.
Replaced with an explicit Not Supported statement."
```

---

### Task 12: Fix `docs/design/screens/screen-mining.md`

**Files:**
- Modify: `docs/design/screens/screen-mining.md`

**Interfaces:**
- Consumes: `docs/design/design-reconciliation.md` §4 (Learning Loop Boundary), §6 (Planned / Not
  Supported).
- Produces: a Companion section that distinguishes the Mining browse screen (Planned) from the
  Mining Review Session route (Not Supported), matching how spec §5/§7 scoped this file.

- [ ] **Step 1: Scope and mark the Companion section**

Find:
```
# Companion

Companion rarely appears.

Occasionally

✨

"You've collected many words from this series."

"This expression appears again later."

"It may pair well with another phrase."

Then disappears.

No suggestions list.

No AI chat.
```

Replace with:
```
# Companion

○ Planned for the general collection view — chưa implement. L9b (D3) only shipped the Mining
**empty-state** anchor; this section describes the non-empty browse/collection view, which is not
yet an anchor (`docs/design/design-reconciliation.md` §6).

**Scope note:** this section is about the Mining *browse/collection* screen only. The Mining
*Review Session* (`components/video-player/mining-review-session.tsx`) is a separate, distinct
route and an active acquisition loop — Companion is ✕ Not Supported there
(`docs/design/design-reconciliation.md` §4), same as Shadowing/Review.

Companion rarely appears.

Occasionally

✨

"You've collected many words from this series."

"This expression appears again later."

"It may pair well with another phrase."

Then disappears.

No suggestions list.

No AI chat.
```

- [ ] **Step 2: Verify**

```bash
grep -n "mining-review-session.tsx" docs/design/screens/screen-mining.md
```

Expected: one match. Confirm the referenced component exists:

```bash
ls components/video-player/mining-review-session.tsx
```

Expected: prints the file path.

- [ ] **Step 3: Commit**

```bash
git add docs/design/screens/screen-mining.md
git commit -m "docs(design-screens): scope screen-mining.md Companion section, mark Planned

Distinguishes the Mining browse/collection screen (Companion Planned,
not yet an L9b anchor) from the Mining Review Session route (Not
Supported — active acquisition loop), so neither is mistaken for the
other."
```

---

### Task 13: Fix `docs/design/screens/screen-video-detail.md`

**Files:**
- Modify: `docs/design/screens/screen-video-detail.md`

**Interfaces:**
- Consumes: `docs/design/design-reconciliation.md` §6 (Anchor Availability — Planned).
- Produces: a Companion section marked Planned, matching Task 9's treatment of Video Library.

- [ ] **Step 1: Mark the Companion section Planned**

Find:
```
# Companion

Appears only occasionally.

Examples

"This conversation feels emotional."

"This scene contains useful daily expressions."

The Companion never starts conversations.

It simply leaves thoughtful notes.
```

Replace with:
```
# Companion

○ Planned — chưa implement. L9b (D3) chỉ có 4 anchor (Dashboard, `/journal`, Video Library empty
state, Mining deck empty state); Video Detail is not one of them yet
(`docs/design/design-reconciliation.md` §6). The behavior below describes the target design once
this anchor is built, not current behavior.

Appears only occasionally.

Examples

"This conversation feels emotional."

"This scene contains useful daily expressions."

The Companion never starts conversations.

It simply leaves thoughtful notes.
```

- [ ] **Step 2: Verify**

```bash
grep -n "○ Planned" docs/design/screens/screen-video-detail.md
```

Expected: one match.

- [ ] **Step 3: Commit**

```bash
git add docs/design/screens/screen-video-detail.md
git commit -m "docs(design-screens): mark screen-video-detail.md Companion section Planned

Video Detail isn't one of L9b's four shipped anchors (D3) yet."
```

---

## Phase 4 — Missing screens backlog

**Not executed by this plan.** Per spec §9, the following remain recorded as backlog only, each
starting at Draft status (§7) and inheriting whatever this file's rules say at the time it is
written: `screen-journal.md`, `screen-leaderboard.md`, `screen-community.md`,
`screen-conversation.md`, `screen-kanji.md`, `screen-vocabulary.md`, `screen-grammar.md`,
`screen-jlpt.md`, `screen-playlists.md`, `screen-profile.md`, `screen-settings.md`. No task in this
plan creates these files. Confirm at the end of Task 13 that none of them exist yet:

```bash
ls docs/design/screens/ | grep -E "journal|leaderboard|community|conversation|kanji|vocabulary|grammar|jlpt|playlists|profile|settings"
```

Expected: no output (nothing to do — this line is a checkpoint, not a task).

---

## Final Verification (after Task 13)

- [ ] **Cross-reference sweep:** grep every edited/created file for `docs/design/design-reconciliation.md` and confirm each hit references a real section number (`§1` through `§11`) that exists in the Task 1 file.

```bash
grep -rn "design-reconciliation.md §" docs/design/patterns/ docs/design/screens/
```

Read the output and manually confirm each `§N` cited is between 1 and 11.

- [ ] **No leftover broken references:**

```bash
grep -rn "companion-system.md\|character-bible.md\|screen-library.md" docs/design/
```

Expected: no matches anywhere under `docs/design/`.

- [ ] **Commit count check:** confirm 13 commits were made (one per task) since the plan started, in
addition to the two spec commits already on the branch.

```bash
git log --oneline -15
```
