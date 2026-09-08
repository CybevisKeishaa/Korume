# Branch Run State

## Goal and scope

Branch: `shadowing-hub-plan-c2`; base: `bfd52c0`.

Execute the defined C2 wave: port the Figma Shadowing Hub (`149:2`) to
`/shadowing`, backed by truthful data. C1 is already merged; C3 Explore and
C4 durable import-job progress are explicitly excluded.

## Authorities

- `AGENTS.md`, `docs/lessons.md`, and `.codex/docs/workflow.md`.
- `docs/superpowers/specs/2026-08-07-shadowing-hub-plan-c-design.md` §§4, 6.
- `docs/superpowers/plans/2026-09-07-shadowing-hub-plan-c2.md` once accepted.
- Figma file `IwFHZDZdHW7qsSFiNbWrkd`, node `149:2`, via design context.

## Accepted commits

- C2 plan/run-state amendment and Task 1 are ready to commit as
  `feat(shadowing): add Hub read model` (`21a4e14`).
- Task 2 is ready to commit as
  `feat(recommendations): expose truthful learning reasons` (`46c5ee1`).
- Task 3 is ready to commit as
  `feat(shadowing): add Hub lesson card primitives` (`d28a03d`).
- Task 4's data correction is `d50ff27`; its Hub import/library UI source
  checkpoint is `0b033cd`. Failed private imports remain visible before they
  receive a `user_lesson_library` ledger row and can retry caption retrieval.
- `61caf26` and `9ed0297` contain Task 5/7-oriented source work, but their
  plan checklists have not yet been audited as complete.
- `06d5f32` expands the in-progress C2 source with the featured hero,
  taxonomy-backed discovery controls, an optional truthful continuity rail,
  measured recommendation explanations, and complete EN/VI Hub copy. It is a
  source checkpoint only; its RTL/data/validation evidence is intentionally
  committed after the source under L-027.
- C1 foundation merged earlier at `bd7f574`; landing motion merged to the
  base at `bfd52c0`.

## Contracts and decisions

- The Hub is an `(app)` page using `TwoColumnShell`; rail width is the C1
layout token and it disappears below `xl`.
- C2 has no durable building-row state because import is synchronous today. It
  may show client-only pending copy during submit; C4 may add a server-backed
  current step, percentage, and ETA only once a job source exists.
- Recommendation reasons are derived learning facts, not Figma sample copy.
- All video remains official YouTube IFrame playback; no media download/proxy.

## Verification

- Task 1 RED: `lib/data/shadowing-hub.test.ts` could not resolve its absent
  `./shadowing-hub` module.
- Task 1 GREEN: focused Vitest passed 4 tests; `npm run typecheck` passed.
- Task 2 RED: recommendation expectations for the new reason field failed as
  expected; GREEN: 17 focused tests and `npm run typecheck` passed.
- Task 3 RED: Hub card modules were absent; GREEN: focused RTL passed 3
  tests and `npm run typecheck` passed.
- Task 4 RED: the new quota component was absent, 403 import failures mapped
  to the generic error, and unavailable lessons had no retry control. GREEN:
  focused Hub import/library and import-form RTL coverage verifies quota facts,
  pending/error states, a real retry POST with authoritative refresh, and no
  fabricated percentage or ETA. `npm run typecheck` and `npm run lint` pass
  (lint retains only baseline warnings); the Task 4 fix-wave review approved.
- Figma design context fetched for `149:2`, `149:1072`, and `149:1162`.
- Fresh Figma screenshot re-read from `149:2` on 2026-09-08. The eight Hub
  content regions are Header, FeaturedHero, Import, My Lessons,
  SearchAndFilter, Popular, Continue Learning, Recently Added, and
  Recommended; the desktop rail has four cards. The rail has no durable job,
  daily-goal, or weekly-activity source today, so its C2 empty states must not
  imitate Figma's sample values. The non-empty Hub is not an approved Companion
  anchor; do not mount a mascot there.

## Working tree and environment

- User-owned untracked paths: `.agents/` and
`.serena/memories/codex_long_task_protocol_run_state.md`; leave untouched.
- Branch was created from the current merged `master` after sandbox approval.

## Blockers

- None. The owner approved C2 execution and confirmed that C4 may add durable
  import-job progress later.

## Next actions

1. Commit the C2 expanded-source RTL/data/validation evidence and this
   checkpoint after `06d5f32`, following `docs/lessons.md` L-027.
2. Audit Tasks 5–7 against the full plan before marking any complete: add the
   route characterization/E2E checks, compare desktop/mobile renders with
   Figma, amend the stale collection-driven Hub screen doc per spec §8, and
   run task plus whole-branch reviews.
