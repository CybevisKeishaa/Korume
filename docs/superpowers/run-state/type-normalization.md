# Branch Run State

Branch `type-normalization`, worktree `.worktrees/type-normalization`, base master `c648bff0`.

- Owner: Claude

## Goal and scope

One type scale on the learner app (spec S/M), uniform zoom 1.0 -> 1.25 between 1440 and 1920, source scan +
browser gate (G1-G4), before/after review for the owner (V1-V5). Out: admin, marketing/landing, auth,
immersive, print sheet, navbar.

## Authorities

- Spec `docs/superpowers/specs/2026-10-14-type-normalization-design.md` — approved by the owner 2026-10-14.
- Plan `docs/superpowers/plans/2026-10-14-type-normalization.md`.
- `AGENTS.md`, `.codex/docs/workflow.md`, `docs/lessons.md` (L-004, L-051, L-052).

## Accepted commits

| Task | Status | Commit |
|---|---|---|
| 1 | done | ca284bbe |

## Baseline / measurements

- Master baseline build: `.worktrees/type-baseline` @ c648bff0, served on :3101 (`E2E_ROUTE_ERROR=1`), left running for Task 11.
- Capture `.superpowers/typography/baseline-v1/`: 144 PNG (132 route + 3 nav-collapsed + 9 out-of-scope), `ratios.json`, `log.txt`.
- log.txt: `every route captured`
- Cleanup confirmed: 0 `e2e_typography` users left in auth.users.

## Open owner calls
