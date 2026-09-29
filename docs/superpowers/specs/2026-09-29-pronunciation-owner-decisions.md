# Owner decisions — Pronunciation final review (2026-09-29)

Verbatim from the owner, answering the six pre-merge questions. Recorded
as rulings 15–20 in `pronunciation-library-port.md`.

**General principle:** for Figma ports, **Figma decides composition,
hierarchy and visual intent.** The repo decides the source of truth and the
implementation architecture.

- Do not distort the Figma UI just to keep an old abstraction. If an old
  abstraction no longer fits, and there is no real accessibility or
  technical reason for it, fix the abstraction.
- Never fabricate data just to look like the frame.

## 15. i+1 recommendation engine — B + C

Do both now:

- **B:** drop the invocations that are known in advance to be useless.
- **C:** within one request/page load, load the recommendation context
  once, and reuse the result and the scoring for Search/Sort and AI Sensei.

No cross-request cache (D) on this branch. Add a cache between requests
only after a measurement shows it is needed, because it brings
invalidation whenever SRS or progress changes.

Architecture target: `load recommendation context once → score candidates
once → multiple consumers`. No consumer may re-read user/SRS/progress and
run its own engine pass.

## 16. TwoColumnShell / right rail — A

Change the old invariant. **Do not duplicate** Today's Speaking, Weekly
Improvement, AI Sensei Recommendation or Recently Practiced into the main
column. Pronunciation keeps the Figma composition: these cards live in the
right rail.

New rule:

> Right rail may contain unique supplementary information if it remains
> rendered at supported layouts, has clear headings/landmark labelling, and
> is keyboard/screen-reader accessible. If a future responsive layout can
> hide/remove the rail, task-critical information must then be given
> another accessible home.

## 17. Featured path "recent activity" — B

"Recent activity" covers **both watching a lesson and speaking/shadowing
practice**. Use one canonical helper as the source of truth:

`lastActivityAt = max(last_watched_at, latest speaking/shadowing activity)`

The featured hero and "Continue where you left off" must use the same
recent-activity semantics. Do not write this logic separately in each
component.

## 18. Sort & display — A

The default state keeps the Figma composition with curated shelves.

When the user does any of the following, show an **All lessons / result
surface** and apply the settings to that result set:

- searches;
- filters;
- picks a sort other than the default;
- or changes a display option that affects the catalogue.

Never reorder the curated Learning Paths/Goals/Shelves by `Shortest`,
`Newest`, etc.; their order is deliberate.

- Default → the Figma curated shelves.
- A non-default discovery state → the result surface.
- Reset to default → back to the curated shelves.

No state may exist in which pressing `Apply` produces no visible change.

## 19. PostgREST 1000-row truncation — A, fix on this branch

This is a correctness issue and must be closed before merge. Implementation
rules:

- an aggregate that fits SQL is done in SQL/RPC/view;
- data that truly needs application-layer processing uses a reusable
  pagination/chunking helper;
- no hand-copied pagination loop in several places;
- a regression test that goes past 1000 rows is required;
- review `/shadowing`, because `recommendations.ts` is shared code.

Data-layer convention from now on: **never aggregate a dataset that can
exceed PostgREST `max_rows` from an unpaginated select.**

## 20. Merge — not until 15–19 are complete

Do not merge just because the branch is large. Before merge, all of these
must be done:

- 15;
- 16;
- 17;
- 18;
- 19;
- a review of the Codex diff;
- a DB reset and live SQL verification;
- the mutation checks;
- the focus/a11y e2e;
- the full test/typecheck/lint/protocol/e2e gates, per the repo workflow.

When everything is green, **stop so the owner can look in Chrome, and only
then ask for the merge decision.**

## UI fidelity (Pronunciation)

- Match Figma exactly in the default state.
- The right rail keeps its role and composition.
- Curated shelves are never sorted arbitrarily.
- Search/filter/sort may take the user into result mode, but must not
  change the default visual hierarchy.
- Figma data the repo can measure uses real data. Data it cannot measure is
  omitted or given an intentional empty state, never fabricated.
