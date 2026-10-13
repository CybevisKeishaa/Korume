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
| 3 | accepted | c77628ab |
| 4 | Dashboard on tokens + base text-body; committed, pending review | see git log |

## Baseline / measurements

- Master baseline build: `.worktrees/type-baseline` @ c648bff0, served on :3101 (`E2E_ROUTE_ERROR=1`), left running for Task 11.
- Capture `.superpowers/typography/baseline-v1/`: 144 PNG (132 route + 3 nav-collapsed + 9 out-of-scope), `ratios.json`, `log.txt`.
- log.txt: `every route captured`
- baseline-v1 was captured before CAPTURE_TIME became required (it used the real clock); Task 11 recaptures both sides with one CAPTURE_TIME.
- Cleanup confirmed: 0 `e2e_typography` users left in auth.users.

- Task 3 work list (lib/typography-scan.test.ts, step 3 red): 442 unique file:line violations (planning dry-run said 443; same tree) -> .superpowers/typography/work-list-v1.txt (git-ignored). 51 are app/globals.css rules; 391 are TSX. Every violation falls under a prefix of the brief PENDING list; none added, none deleted.
- Task 3 mutation (settings-row.tsx text-body -> text-sm, file confirmed changed): red line `components/settings/settings-row.tsx:50  text-sm`; restored from .mutbak, green again.
- Task 4: 16 Dashboard rules moved to tokens (roles per brief table; no unlisted hits). Mutation (dash-title -> calc(11 * var(--d)), grep count of that string 1 -> 2 so sed changed the file): red `app/globals.css:1695  .dashboard-layout .dash-title { font-size: calc(11 * var(--d)) }`; restored from .mutbak, green. Dashboard E2E 6/6 passed incl. the fold test at 1280x529 (no overshoot).

## Open owner calls
