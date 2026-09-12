# Branch Run State

## Goal and scope

Branch: `shadowing-explore-c3`; base: `aacf813`.

Replace the `/shadowing/explore` placeholder with Figma Explore Lessons (`200:7705`) and its preview drawer (`200:10726`). Keep the approved three-line transcript preview and Add to My Lessons action; do not build the global Search lesson command palette.

## Authorities

- `AGENTS.md`, `docs/lessons.md`, `.codex/docs/workflow.md`.
- `docs/superpowers/specs/2026-08-07-shadowing-hub-plan-c-design.md` §5.1 and D18.
- `docs/superpowers/plans/2026-09-09-shadowing-explore-c3.md`.
- Figma `IwFHZDZdHW7qsSFiNbWrkd`, nodes `200:7705`, `200:10726`.

## Decisions and contracts

- Explore is an `(app)` desktop screen without a Companion rail. The global mobile handoff remains active below 1024px.
- Hero catalogue search and situation context are C3. Selecting a situation re-queries every shelf.
- Drawer state is local; no preview URL or global command shortcut is introduced.
- The drawer uses truthful stored transcript lines and a server-owned idempotent library membership action. Saving public catalogue content must not consume private-import quota.
- No video bytes are downloaded, proxied, or stored by this work.

## Working tree and environment

- Isolated worktree: `.worktrees/shadowing-explore-c3`; branch created from merged C2 at `aacf813`.
- Root workspace has user-owned untracked `.agents/` and two `.serena/memories/*` paths; untouched.
- Dependencies were installed in the C3 worktree.
- The isolated worktree has its own `.env.local`; no configuration or secret was copied from the root
  worktree during this resume.

## Completed checkpoints

- Data/API: authenticated batched Explore projection, bounded eight-card shelves with a truthful
  overflow state, shared transcript word-count cache, truthful absence handling, RLS-before-service-role idempotent membership POST,
  and public catalogue saves excluded from private-import quota accounting.
- UI: localized Explore route, local search and situation URLs, My Lessons/recent/recommendation
  sections, five curated shelves, and an accessible local preview drawer with stored transcript lines.
  The global Search lesson command palette remains unbuilt by scope.
- Tests: request/model, route, RTL, localization contract, registry, and browser spec were added.
  Access and localization guards were mutation-checked by reading the temporary mutation back,
  observing the focused test fail, then restoring it.
- Review fix round: corrected an unrelated `kanji-explorer` registry mutation; aligned the inventory
  with C3 exclusions; added duplicate-membership, missing-data, five-shelf, drawer busy/failure/close,
  situation-chip/error-path browser contracts; bounded and cached transcript tokenization.
- Whole-branch review fix wave: recommendations and the quiet suggestion are now constrained to the
  same RLS-visible query/situation catalogue as the other shelves. The browser acceptance path now
  reaches the situation chip, card Preview, drawer close, and Add control by bounded sequential Tab
  traversal rather than programmatic focus or clicks.

## Verification and remaining gate

- Passed: focused C3 Vitest command (12 files, 66 tests) after review fixes; post-fix focused
  data/RTL/localization command (3 files, 16 tests); full `npm test -- --reporter=dot`; `npm run
  typecheck`; `npm run lint` (only existing repository warnings); `npm run build`; and `git diff
  --check`.
- Local-env authority was granted without copying secrets. A hidden isolated build was verified by a
  fresh `.next/BUILD_ID`; its server returned HTTP 200. The C3 browser spec first exposed an absent
  local seed, so the reviewed idempotent `supabase/seed.sql` fixture was applied to the local test DB
  and read back as `E2E Explore Lesson | restaurant | beginner-foundation | 3`. The full browser
  spec then passed 2/2 after its Start-link assertion was scoped to the card containing the unique
  Preview control; a global exact-count assertion was invalid because the same lesson legitimately
  appears in Recent, Recommended, and its collection shelf.
- Resume verification (2026-09-12): the focused mutation is now valid. Removing the selected card's
  lesson title from its Start accessible name produced the expected focused browser failure at the
  card-scoped Start assertion; the source was restored from a SHA-256-verified backup, rebuilt, and
  the full C3 browser spec passed 2/2 again on the fresh artifact. Local Supabase had been stopped;
  its auth health endpoint was restored before the authenticated browser test was rerun.
- The stale RTL fixture contract (`durationValue` rather than `durationTemplate`) was red in both
  runtime RTL and TypeScript, then updated to the current localized-template contract. Focused RTL
  passed 9/9 and TypeScript passed.
- Fresh branch gates after that fix: full Vitest JSON report 2743/2743 across 897 files, TypeScript,
  lint (baseline warnings only), `git diff --check`, production build, and the C3 Playwright spec 2/2.
- Fix-wave verification (2026-09-12): the new context-filter unit test was RED against an unrelated
  recommendation, then GREEN after filtering against the query's visible lesson ids. The new keyboard
  test passed only after bounded sequential traversal was added; a `tabIndex={-1}` Preview mutation
  then failed at that traversal and was restored from a SHA-256-verified backup. Fresh build and C3
  Playwright passed 2/2, TypeScript passed, lint retained baseline warnings only, `git diff --check`
  passed, and the full Vitest JSON report passed 2744/2744 across 897 files.
- Next: request a fix-wave re-review. Do not merge or push without the user's direction.
