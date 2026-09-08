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
- Fix-wave source `6541609` corrects the Figma shelf order to Popular,
  Continue Learning, Recently Added; removes non-shadowing global statistics
  from the empty weekly region; preserves the active locale on discovery
  submission; and moves Hub taxonomy labels to their catalog authority.
  `a057de8` adds the consequent RTL/data and EN/VI catalog pins after that
  content commit, per L-027.
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
- Fix-wave RED and GREEN: the shelf, empty weekly card, locale-aware search,
  localized hero metadata, taxonomy catalog, and selected discovery-query
  contracts all went red before `6541609`; focused Hub Vitest now passes 10
  files / 31 tests and `npm run typecheck` passes. `npm run lint` exits 0
  with baseline warnings outside this scope. Production build cannot yet be
  asserted: this host's shell runner terminates `next build` after lint and
  before `BUILD_ID` is written; rerun in a persistent terminal.
- Production build was subsequently run in a persistent hidden process and
  completed with a fresh `.next/BUILD_ID`. `tests/e2e/shadowing-hub.spec.ts`
  now covers a newly registered learner at 390px and 1536px: one main
  landmark, search/import keyboard reachability, no horizontal overflow, a
  rail hidden below `xl`, and no fabricated progress copy. Its initial 1/1
  browser result was obtained through port 3000, but the server ownership was
  not then verified. The spec now also covers a controlled 422 import-error
  alert and reduced motion; rerun it only against a newly built isolated
  production artifact.
- Whole-branch review caught a real encoding defect in that expanded browser
  spec: its pending-label selector was mojibake while the UI uses the message
  catalog value. The selector now derives from `messages/en/videos.json`;
  `npm run typecheck` and `playwright --list` pass.
- The corrected expanded spec passed against a fresh, isolated production
  build on port 3001. It includes a non-empty control: all rendered lesson
  actions are present and individually receive keyboard focus. The same spec
  failed as expected against the isolated `bfd52c0` legacy artifact because
  its `Shadowing Hub` heading did not exist. This is the RED/GREEN proof for
  the Task 8 route port, not a result from the untrusted port-3000 process.
- The lesson-action proof now uses sequential `Tab` traversal from the known
  YouTube URL field, not programmatic `locator.focus()`. A temporary
  `tabIndex={-1}` mutation made the assertion fail with no reached lesson
  actions; after restoration, the same check passed on a clean isolated
  production artifact on port 3004.
- Whole-branch review through `f2dc18d` approved the C2 implementation after
  an isolated build, focused browser run, typecheck, lint, focused Hub suite,
  full Vitest suite, and diff check. It identified the lesson-action browser
  coverage gap; `17f2fd3` closes that specific gap and needs its narrow
  follow-up review before merge.
- Fresh 390px and 1536px captures from the isolated `17f2fd3` production
  artifact were compared with Figma node `149:2`. They preserve the C2
  hierarchy, responsive shell/rail behavior, shelf order, and four rail cards.
  The no-data cards are the intentional truthful C2 divergence; no Figma
  sample progress, job, goal, or mascot was introduced. Reduced motion was
  active for the capture and for the passing browser spec.

## Working tree and environment

- User-owned untracked paths: `.agents/` and
`.serena/memories/codex_long_task_protocol_run_state.md`; leave untouched.
- Branch was created from the current merged `master` after sandbox approval.

## Resolved environment note

- Port 3000 is occupied by an existing workspace server which serves stale
  client chunks after a shared `.next` rebuild. Do not stop that unknown
  process. Final verification used separately configured production artifacts
  instead.

## Remaining action

1. Obtain the narrow follow-up review for `17f2fd3`; then Task 8 and this C2
   branch are ready for merge under the existing whole-branch approval.

## Historical next actions (superseded by the verification above)

1. Run the expanded focused Playwright Hub spec against a newly built isolated
   production server; this verifies the controlled import-error alert.
2. The Task 5–7 audit and docs reconciliation are in the current diff. Run
   task and whole-branch reviews before a merge claim.
