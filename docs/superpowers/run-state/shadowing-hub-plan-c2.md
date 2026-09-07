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

- None yet. C1 foundation merged earlier at `bd7f574`; landing motion merged
to the base at `bfd52c0`.

## Contracts and decisions

- The Hub is an `(app)` page using `TwoColumnShell`; rail width is the C1
layout token and it disappears below `xl`.
- Building rows carry a real current step only: no invented percentage/ETA.
- Recommendation reasons are derived learning facts, not Figma sample copy.
- All video remains official YouTube IFrame playback; no media download/proxy.

## Verification

- Planning only. No product code or test has changed.
- Figma design context fetched for `149:2`, `149:1072`, and `149:1162`.

## Working tree and environment

- User-owned untracked paths: `.agents/` and
`.serena/memories/codex_long_task_protocol_run_state.md`; leave untouched.
- Branch was created from the current merged `master` after sandbox approval.

## Blockers

- The implementation plan requires user review before execution, per the
approved architectural workflow.

## Next actions

1. Commit the C2 implementation plan and run-state only after reviewing their
scope against the locked design.
2. Ask the owner to approve the plan, then execute Task 1 with TDD.
