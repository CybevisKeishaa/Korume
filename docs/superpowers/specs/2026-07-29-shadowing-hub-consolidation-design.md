# Shadowing Hub Consolidation — Design Spec

> **Status:** Draft — brainstormed in conversation 2026-07-29, revised after written-spec review,
> awaiting final sign-off before execution.
> ⚠️ **Editorial note added 2026-08-12: `public/demo/` was deleted.** The user ruled that everything
> in it was throwaway — images edited ad hoc to show the assistant something, never design artifacts —
> so the folder is gone as of this date and the paths below no longer resolve. The trigger is left
> written as it happened. **Open, for the user: this spec's conclusions were derived from those
> images, and it has already been executed and merged (`a6a7617`). Whether that makes any of its IA
> decisions worth re-checking against live Figma is a product call, not an editorial one.**
>
> **Trigger:** Two Figma exports (`public/demo/image.png`, `image1.png`) proposed a "Shadowing Study
> Room" screen and surfaced that the shipped IA treats video as a first-class navigation concept
> (`videos` nav item, `screen-video-library.md`, `screen-video-detail.md`) parallel to — and
> disconnected from — `screen-shadowing-detail.md`. Working session with the user established this is
> not the product's intended model.
> **Does not itself change routes or code.** This is a documentation-reconciliation pass, mirroring
> `2026-07-28-design-docs-reconciliation-design.md`. Actual folder renames (`app/[locale]/(app)/videos`
> → `.../shadowing`) and nav-component changes (`components/layout/app-nav.tsx`) are a separate,
> later implementation task.

---

## 0. Architectural Decision Record

**Context**

Nihongo Cinema's shipped navigation and design docs model video as an independent destination:
`videos` is a top-level nav item, `screen-video-library.md` ("Video Library — The Story Collection")
and `screen-video-detail.md` ("Video Detail — The Learning Overview") exist as their own screens, and
`screen-shadowing-detail.md` is a third, separate screen reached only by drilling into a video. A
learner's path was Library → Detail → Shadowing: three stops to start practicing.

**Decision**

> **The primary product domain is Shadowing, not Video.** Video is merely one medium through which
> Shadowing happens today.

Shadowing becomes the sole learner-facing environment for this domain. The previous Video Library →
Video Detail → Shadowing Practice hierarchy is replaced with a two-level model:

```
Shadowing Hub → Shadowing Lesson (Shadowing Practice is the primary experience within it)
```

No intermediate detail page. Opening a lesson from the Hub enters the learning environment directly.

**Rationale**

Stating the domain principle first — rather than starting from "video is an implementation detail" —
matters: it keeps this architecture correct even if Shadowing later runs on audio-only clips, podcasts,
or AI-generated dialogue. None of those would require revisiting this IA, because the decision was
never about the current media type — it is a domain-model decision, not a media-type decision. That
video is currently an implementation detail (it provides emotion, pronunciation, timing, and cultural
context — `docs/design/patterns/video-patterns.md`) is a *consequence* of the domain principle, not the
principle itself.

Learners come to Nihongo Cinema to practice Japanese, not to browse media. The information architecture
is organized around learning activities (Shadowing) instead of media objects (Video). Every
intermediate stop between "I want to practice" and "I am practicing" is friction this product should
not have.

**Consequences**

- One nav item instead of two (`shadowing` replaces `videos`); one fewer decision point per session.
- `screen-video-library.md` and `screen-shadowing-detail.md` are renamed and reframed, not just edited.
  The renamed Hub is not "a library that also does other things" — see §2.
- `screen-video-detail.md` is deprecated outright. Its essential facts (title, JLPT level) already live
  on the Hub's lesson card and the lesson's own header; nothing new is required to cover the rest.
  Critically, this is **not** a hand-off to the Companion — see §3's explicit statement that removing a
  screen must never be read as "therefore Companion now covers this." What context remains is already,
  independently, something Companion does on surfaces where it already speaks (Hub, Dashboard,
  `/journal`); this decision asks nothing new of it.
- The Learning Loop Boundary (`design-reconciliation.md` §4/§6) is explicitly **not** touched by this
  decision (see §3). This is called out because everything else in this pass changes; a future reader
  should not assume the Companion boundary moved along with the rest.
- Route and folder renames are real but deferred — this spec only commits the design-doc layer. Code
  migration is tracked as a follow-up, same pattern the prior reconciliation spec used for the
  speech-bubble restyle (§6 of that spec).

---

## 1. New IA principle (invariant, not a style note)

> **Product-facing destinations are named after learner intent, never implementation.**

This is an architectural invariant, not a one-off naming preference — it is the rule that makes
`videos` → `shadowing` more than a cosmetic rename, and the rule any future nav item or screen name must
pass before it ships. Applied retroactively, it disqualifies an entire class of names without needing a
fresh argument each time: "Videos," "Clips," "Media," "Assets" — anything named for the content type
backing a feature rather than the learner's reason for being there. (It already governs why `/mining`
is not called `/clips` or `/flashcard-export`, even though no one wrote that rule down until now.)

Added in two places, worded to match each doc's existing voice:

- `docs/design/screens/navigation-system.md`, as a new short section directly under `# Purpose`.
- `docs/design/screens/screen-architecture.md`, as one bullet appended to `# Shared Design Rules`
  (alongside "Calm over excitement," "Reading over clicking," etc.): **"Learner intent over
  implementation."**

---

## 2. The two-level model, and how we got there (for future readers)

The brainstorm went through three shapes before landing here — worth recording so a future reader who
finds a stray mention of "Lesson Detail" in an old branch or draft understands it was considered and
rejected, not missed:

1. **Hub → Lesson Detail → Practice** (first proposal). Rejected: a detail page's reason to exist is
   giving the learner a decision point before committing. That decision already happens in the Hub
   (title, level, duration, thumbnail are visible on the card before tapping it) — repeating it on
   another page added a click, not a choice.
2. **Hub → Practice, with a collapsible "Lesson Info Panel" inside Practice** (second proposal).
   Rejected for the same reason one level down: permanent UI space for information the learner already
   saw is not free just because it collapses.
3. **Hub → Lesson, header-only metadata, Companion owns nothing new** (final). The only lesson metadata
   inside the lesson environment is what the existing header already carries — Back / Title / Source /
   JLPT level / Bookmark / Download transcript / Overflow (`screen-shadowing-detail.md` § Header,
   unchanged by this spec). Anything beyond that is either already answered by the Hub before the
   learner clicks, or is the kind of contextual, occasional remark the Companion already makes
   elsewhere in the product — not a reason to reserve permanent space inside the practice loop, and not
   a new mandate for Companion either (§3).

**Final model:**

- **Shadowing Hub** — the learner's home for Shadowing. A library/browse capability lives inside it, but
  the Hub is not itself "a library" — describing it that way undersells half of what it does. It
  answers *"What should I practice next?"* through several capabilities that are equally central:
  browse and discover lessons, search/filter, see recommendations — **and** continue an unfinished
  session, see weekly progress, resume where they left off. It replaces the previous library screen
  (`screen-video-library.md`, now deprecated); the Figma reference (`image1.png`)'s session-continuity
  rail (current session progress, resume action, weekly record — streak, goal, hours) is core to the
  Hub's identity, not a feature bolted onto a library. This is Gamification-Layer content and is shown
  here explicitly, unlike the old Video Library's neutral-browsing stance — see §4 for exactly which
  progress information belongs to the Hub versus the Dashboard.
- **Shadowing Lesson** (route: `/shadowing/[id]`) — what a learner enters when they select a lesson from
  the Hub. **The route represents the lesson, not "the Practice screen"** — Shadowing Practice
  (transcript-first workspace: Reading/Shadowing/Immersion/Analysis modes, playback controls, Utility
  Drawer — all of `screen-shadowing-detail.md`, unchanged by this spec) is the primary experience
  rendered there today, but it is an experience *within* the lesson, not the lesson's identity. This
  distinction matters for extensibility: if the lesson environment later grows additional activities
  (Dictation, Vocabulary drills, Grammar notes) as workspaces or tabs within the same lesson, that is a
  natural extension of "more workspaces inside this lesson" — it does not require another IA argument
  about whether they deserve their own top-level route the way Video Detail once wrongly did.

---

## 3. Companion boundary — explicitly unchanged, and not a replacement for the removed screen

This pass renames a screen that currently reads **"✕ Not Supported. Shadowing is an active acquisition
loop... Companion is Dormant throughout Shadowing"** (`screen-shadowing-detail.md` § Companion). That
statement, and the underlying Learning Loop Boundary rule (`design-reconciliation.md` §4) and Anchor
Availability table (§6), are **not modified** by this spec. The only edit in that table is relabeling
the row from "Shadowing" to "Shadowing Practice" for precision now that "Shadowing" alone is ambiguous
between Hub and Lesson.

This was a deliberate question during the brainstorm, not an oversight: a version of this design
considered letting the Companion answer lesson questions "on demand" inside Practice. That would have
required moving the "Shadowing" row in §6 from Not Supported to Planned and amending §4's rationale —
a real change to a Canonical governance rule, not a naming cleanup. The user explicitly chose to keep
Companion's lesson-context role confined to the Hub (before starting) and Dashboard/`/journal` (after
finishing), leaving §4/§6 untouched.

**Explicit rule, stated so it outlives this spec:**

> Removing the Lesson Detail screen does not imply moving its responsibilities into Companion. Companion
> provides context only when it already would have, on surfaces where it already speaks. It does not
> exist to backfill a screen that was just removed, and a missing UI is never, by itself, a reason to
> add a new Companion touchpoint.

This principle is added to `design-reconciliation.md` §2 (Companion Rules) as a new bullet, so it stands
as general guidance beyond this one deprecation — the recurring failure mode it prevents is "we removed
a screen, so let's have Companion say the thing that screen used to show."

---

## 4. Layer Responsibility: Shadowing Hub vs. Dashboard

Both surfaces show progress-shaped information; without an explicit split, "where does streak / current
session / weekly progress live" is litigated again every time either screen is touched. Stated once,
here:

> **Shadowing Hub owns learning continuity** — current session (in progress, resume action), weekly
> record framed as "how is my practice going right now," the immediate next step.
>
> **Dashboard owns long-term progress** — arrival/overview, historical trends, milestones over time,
> the broader relationship with the whole product, not just Shadowing.

Both are Gamification-Layer content (`design-reconciliation.md` §3) — this split is about *which
screen*, never about *whether* the information is shown. Added as a new bullet under
`design-reconciliation.md` §3 (Gamification Rules), and referenced from `screen-shadowing-hub.md`'s own
Layer Responsibility table (required per §3 of that same file, since the Hub carries both Gamification
and, per §3 above, an explicitly-limited Companion presence).

---

## 5. Terminology & route mapping

| Old | New |
|---|---|
| `screen-video-library.md` ("Video Library — The Story Collection") | `screen-shadowing-hub.md` ("Shadowing Hub — The Learner's Home for Shadowing") |
| `screen-video-detail.md` ("Video Detail — The Learning Overview") | **Deprecated** (no replacement screen; see §0 Consequences, §3) |
| `screen-shadowing-detail.md` ("Shadowing Detail") | `screen-shadowing-practice.md` ("Shadowing Practice" — documents the primary workspace within the Shadowing Lesson route, per §2) |
| Nav item `videos` → `/videos` | Nav item `shadowing` → `/shadowing` |
| Route `/videos` | Route `/shadowing` (Hub) |
| Route `/videos/[id]` | *(removed — no Detail page)* |
| Route `/videos/[id]/shadowing` | Route `/shadowing/[id]` — the **Shadowing Lesson**; Shadowing Practice is the primary workspace rendered there today, not the route's identity (§2) |
| Route `/videos/[id]/dictation` | Route `/shadowing/[id]/dictation` — a sibling workspace within the same lesson (unchanged pattern; Dictation's own screen doc doesn't exist yet, so redesigning its IA is out of scope here) |
| Emotional Hierarchy row "Videos Library \| Discovery" | "Shadowing Hub \| Discovery" |
| Emotional Hierarchy row "Video Detail \| Understanding" | *(removed)* |
| Emotional Hierarchy row "Shadowing \| Practice" | "Shadowing Practice \| Practice" |

---

## 6. File change list (four phases, executed in order)

### Phase 1 — Renames

1. `git mv docs/design/screens/screen-video-library.md docs/design/screens/screen-shadowing-hub.md`
2. `git mv docs/design/screens/screen-shadowing-detail.md docs/design/screens/screen-shadowing-practice.md`

### Phase 2 — Rewritten content (the two renamed files)

3. `screen-shadowing-hub.md` — retitle to "Shadowing Hub — The Learner's Home for Shadowing"; reframe
   intro paragraphs so the Hub is described as replacing the library screen, not as a library that
   gained features (§2); add the Current Session + This Week's Record right-rail section (from
   `image1.png`); add the Layer Responsibility table required by `design-reconciliation.md` §3,
   including the Hub/Dashboard continuity-vs-progress split (§4 above); update its own Companion section
   anchor name (still Available for empty state / Planned for non-empty — unchanged status, renamed
   surface).
4. `screen-shadowing-practice.md` — retitle (`# Shadowing Detail` → `# Shadowing Practice`); add one
   short clarifying note near the top distinguishing the Shadowing Lesson route (`/shadowing/[id]`, the
   container) from Shadowing Practice (the workspace this document specifies, currently the sole
   experience rendered at that route) — per §2's extensibility point. No other content changes: §2 and
   §3 establish that no Lesson Info Panel is added.
5. `screen-video-detail.md` — change Status header to **Deprecated**; add a short pointer note: the
   standalone detail concept was removed, essential metadata lives on the Hub's lesson card and the
   lesson header, and per §3 above, the rest is explicitly **not** transferred to Companion as a
   replacement responsibility. Add verbatim: *"This screen is retained only for historical
   documentation and migration traceability. It must not be used as the basis for future UI work."*
   Keep the rest of the file as historical record, per the Design Document Lifecycle
   (`design-reconciliation.md` §7) — not deleted.

### Phase 3 — Governance docs

6. `docs/design/screens/navigation-system.md` — NAV_ITEMS table: remove `videos` row, add `shadowing`
   → `/shadowing` in the same slot; add § Naming Principle (§1 above, invariant wording); rewrite the
   acquisition-loop drill-in prose so "Shadowing" unambiguously means Shadowing *Practice*
   (`/shadowing/[id]`, understood per §2 as the lesson's primary workspace), while Shadowing *Hub* is
   the top-level nav entry — the current wording lists "Shadowing" as a banned top-level example and
   must not be read as still banning the Hub; update the Companion & Navigation anchor-availability
   line (`/videos` → `/shadowing`).
7. `docs/design/design-reconciliation.md` — §2 (Companion Rules): add the "not a replacement for a
   removed screen" bullet (§3 above). §3 (Gamification Rules): add the Hub-owns-continuity /
   Dashboard-owns-progress split (§4 above). §6 table: rename "Video Library (empty state)" →
   "Shadowing Hub (empty state)", "Video Library (non-empty)" → "Shadowing Hub (non-empty)", remove the
   "Video Detail \| Planned" row (no screen to anchor), relabel "Shadowing" → "Shadowing Practice" in
   the Not Supported row; update the §6 prose bullet listing Available anchors; §12 backlog/compliance
   list: update the two renamed filenames, remove `screen-video-detail.md` (deprecated docs aren't held
   to §8 compliance); bump `Version` header.
8. `docs/design/screens/screen-architecture.md` — Workspace-examples list: remove the "Video Detail →
   Reading Workspace" row (Reading is already a *mode* inside Shadowing Practice, not a separate
   screen); Emotional Hierarchy table per §5 above; prose "The Video Detail screen is about
   understanding." line removed; add the Naming Principle bullet (§1 above, invariant wording).
9. `docs/design/screens/screen-dashboard.md` — add a one-line cross-reference to the Hub/Dashboard
   continuity-vs-progress split (§4 above), pointing to `screen-shadowing-hub.md`, so the boundary is
   discoverable from both sides.

### Phase 4 — Terminology sweep (cross-references only, no structural change)

10. `workspace-patterns.md` — 3 occurrences of "Video Detail" → resolve per local context (remove from
    the "instead of designing" list; replace "ideal for: Video Detail" with "Shadowing (Reading Mode)";
    replace the per-screen composition entry with "Shadowing Practice").
11. `learning-surfaces.md` — "Videos Library" → "Shadowing Hub"; merge "Video Detail" into the existing
    "Shadowing" entry rather than leaving two rows for one screen.
12. `screen-mining.md` — "Mining receives vocabulary from: Shadowing Detail / Video Detail / ..." →
    collapse the two into one "Shadowing Practice" line.
13. `screen-review.md` — cross-reference `screen-video-library.md` → `screen-shadowing-hub.md`.
14. `screen-search.md` — "Video Library empty state" → "Shadowing Hub empty state".
15. `adaptive-layouts.md` — "Video Library" → "Shadowing Hub".
16. `docs/design/patterns/empty-states.md` — related-docs reference `screen-video-library.md` →
    `screen-shadowing-hub.md`.
17. `docs/design/patterns/transcript-patterns.md` — "Applies to: ... (Video Detail, Shadowing,
    Dictation, Reading, Mining)" → "(Shadowing Practice, Dictation, Reading, Mining)".

`docs/design/patterns/video-patterns.md` is explicitly **not** touched — it already frames video as
supporting the transcript ("learners are not here to watch videos"), consistent with this spec's
principle without any edit needed.

---

## 7. Verification

Docs-only pass, no code changes, no build/test/lint run required. Verification is:

- Re-read each edited file against §0–§5 above.
- Confirm every relative-path or backtick cross-reference to a renamed file (`screen-video-library.md`,
  `screen-shadowing-detail.md`) was updated to its new name across all 17 files in §6, not just the two
  renamed files themselves.
- Confirm `design-reconciliation.md` §6's Anchor Availability table has no orphaned row referencing a
  deprecated screen.
- **Grep the full `docs/design/` tree for `Video Library` and `Video Detail`.** The only remaining
  matches after this pass must be inside `screen-video-detail.md` itself (the file documenting its own
  deprecation) — any other match means a terminology-sweep item in Phase 4 was missed.
- Commit the design-doc changes together with a message describing the consolidation — deferred until
  the user asks for a commit, per this session's working style.
