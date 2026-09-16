# Shadowing Explore C3 — completed 2026-09-13

## Canonical sources

- Product/design scope: `docs/superpowers/specs/2026-08-07-shadowing-hub-plan-c-design.md` §5.1 and D18.
- C3 run state: `docs/superpowers/run-state/shadowing-explore-c3.md`.
- Figma source: `IwFHZDZdHW7qsSFiNbWrkd`, Explore Lessons / preview drawer.

## Delivered state

- C3 Explore was merged into local `master` at `148d4af` after feature commit `ac2cfcc`.
- The post-merge fidelity correction is `429fac2` on `master`.
- `/[locale]/shadowing/explore` is an authenticated, server-rendered Supabase catalogue: collections,
  situations, videos, transcript lines, summaries, library membership, and recommendations are real data.
- Lesson cards use the compact Figma density at the 1600px desktop reference: four 296px columns in a
  1232px shelf, a 298px card, and a 112px thumbnail. Fixed content slots prevent long copy from making
  cards tall.
- Card metadata reports duration, transcript-line count, and curated `key_grammar` / `key_vocab` counts.
  The drawer uses the same curated vocabulary count; transcript lemma count is retained only as a distinct
  internal metric and is not labelled Vocabulary.
- Search, situation filtering, local preview, focus restoration, and idempotent Add to My Lessons are all
  implemented. The global Search lesson command palette remains explicitly out of C3 scope.

## Verification recorded

- The drawer regression was red when it rendered transcript words (14) as Vocabulary, then green for the
  curated count (2).
- Focused Explore tests: 23 passing.
- `npm run typecheck`, `npm run lint` (baseline warnings only), full `npm test -- --exclude '.worktrees/**'
  (exit 0), `git diff --check`, and the C3 Playwright suite (3/3, including 1600×732 density) passed.
- Whole-branch/fidelity reviewer approved the final correction.

## Next work after C3

Plan C1, C2, and C3 are complete. The named successor is **C4**, deliberately outside Plan C: plan and
build the asynchronous lesson-creation subsystem (jobs table, durable per-step transitions, truthful progress,
ETA only when authoritative, retry/resume). It will replace C2's non-numeric Building presentation without
redesigning its UI. Start C4 only after a new scoped plan is written; it crosses database and backend ownership.

Separate deferred items are the global Search lesson command palette, real content for several empty-state
routes, JLPT/Reading IA changes, and Plan D focus-screen restyling. They are not implicit C3 follow-ups.
