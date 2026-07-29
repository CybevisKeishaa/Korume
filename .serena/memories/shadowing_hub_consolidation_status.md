# Shadowing Hub Consolidation — status

**Spec:** `docs/superpowers/specs/2026-07-29-shadowing-hub-consolidation-design.md` — Status: Draft,
content fully approved by the user after two review rounds, **execution not started**.

## What it decides

Replaces the video-centric IA (`videos` nav item, `screen-video-library.md`, `screen-video-detail.md`,
`screen-shadowing-detail.md` as three separate stops: Library → Detail → Shadowing) with a two-level
model: **Shadowing Hub → Shadowing Lesson** (`/shadowing`, `/shadowing/[id]`). Shadowing Practice is the
primary workspace rendered *within* the lesson route, not the route's identity — this framing matters
for future extensibility (Dictation/Vocabulary/Grammar as sibling workspaces later, no new IA fight
needed). Core principle stated as an ADR in the spec: **"The primary product domain is Shadowing, not
Video."** No standalone Lesson Detail page, no Lesson Info Panel inside Practice — both were proposed
and explicitly rejected during the brainstorm (see spec §2 for the full "how we got here" history).
Companion's Learning Loop Boundary (`docs/design/design-reconciliation.md` §4/§6) is explicitly **not**
touched — Companion still Dormant/Not Supported throughout Shadowing Practice, unchanged. New governance
rule added by this spec: removing a screen must never be read as "Companion now covers this."

## Trigger

User shared two Figma exports (`public/demo/image.png` — matches `screen-shadowing-detail.md` well;
`image1.png` — a "Shadowing Study Room" hub screen with session/streak rail) and asked whether work
could proceed based on the already-reconciled `docs/design/` screens (see `mem:project_status` /
[[design-docs-reconciliation-status]] in Claude's own memory — that reconciliation is a separate,
already-complete piece of work; this spec builds on top of it, not instead of it). The images surfaced
that Video Library / Video Detail / Shadowing Detail were three disconnected screens for what should be
one learner journey.

## Execution plan (spec §6) — NOT STARTED

17 files, 4 phases:

1. `git mv` two renames: `screen-video-library.md`→`screen-shadowing-hub.md`,
   `screen-shadowing-detail.md`→`screen-shadowing-practice.md`.
2. Rewrite the two renamed files (Hub gains a Current-Session/streak rail + Layer Responsibility table;
   Practice gets a one-line Lesson-vs-Practice clarifying note); mark `screen-video-detail.md`
   **Deprecated** with an explicit "not the basis for future UI work" line.
3. Governance docs: `navigation-system.md` (NAV_ITEMS swap + new Naming Principle section),
   `design-reconciliation.md` (§2 Companion Rules bullet, §3 Gamification Hub/Dashboard split, §6 Anchor
   table, §12 backlog list), `screen-architecture.md` (2 tables + Naming Principle bullet),
   `screen-dashboard.md` (one cross-reference line).
4. Terminology sweep, cross-references only: `workspace-patterns.md`, `learning-surfaces.md`,
   `screen-mining.md`, `screen-review.md`, `screen-search.md`, `adaptive-layouts.md`,
   `docs/design/patterns/empty-states.md`, `docs/design/patterns/transcript-patterns.md`.

Exact per-file edits are written out in the spec's §6 — read it fresh rather than trusting this summary;
this memory is a pointer, the spec is the source of truth.

**Explicitly out of scope for this spec:** actual Next.js route/folder rename
(`app/[locale]/(app)/videos` → `.../shadowing`) and `components/layout/app-nav.tsx` changes — deferred
to a separate later implementation task, same pattern the prior design-docs-reconciliation spec used for
deferring the speech-bubble visual restyle.

## Why paused

User said (2026-07-29): "tôi sẽ làm cái khác trước, task l9b của tôi vẫn chưa xong" — L9b (Companion
Presence surfaces) takes priority; see `mem:project_status` NEXT ACTION block. This spec is fully
designed and approved; only *execution* was deferred, not the decision itself.

## How to apply next session

Before touching `docs/design/` nav/video/shadowing screens, or before creating any new screen doc that
would reference "Video Library"/"Video Detail"/"videos" as a concept, read the spec file fresh and
check whether §6 has been executed (quick check: does `docs/design/screens/screen-shadowing-hub.md`
exist? If not, the spec is still pending). Don't re-run the brainstorming conversation — the design is
settled. Only re-confirm with the user if enough time or other changes have passed that an assumption in
the spec (e.g. the Figma direction, or L9b's own IA) might have shifted underneath it.
