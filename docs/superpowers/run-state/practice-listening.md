# Branch Run State

Branch `practice-listening`, worktree `.worktrees/practice-listening`, base master `5c076987`.

## Goal and scope

B2 of the Shadowing practice modes: Listening Practice (Part 3) — Word Bank (default) + Typing — with its Summary,
Dashboard and Mission changes, the D25 privilege change for `dictation_attempts`, and the legacy `/dictation` route
retired. B1 `practice-pronunciation` is merged (`036ca621`, 2026-10-19).

## Authorities

- `AGENTS.md`, `.codex/docs/workflow.md`, `docs/lessons.md`.
- Spec `docs/superpowers/specs/2026-10-15-shadowing-practice-modes-design.md` (approved 2026-10-15; B2 = §5, §6.2,
  B2 rows of §7–§9).
- Plan `docs/superpowers/plans/2026-10-21-practice-listening.md` (11 tasks, rulings P1–P9) — awaiting the owner's
  review. Execution method not chosen yet.

## Accepted commits

| Task | Status | Commit |
|---|---|---|
| plan | written 2026-10-21, awaiting owner review | this commit |

## Contracts and decisions

- Plan-time rulings P1–P9 are in the plan. P3 (four SQL read functions move from 043/045 to 048) and P5 (Dashboard
  copy lands on the `skills.listening` label) are flagged for the owner.

## Verification

- None yet. Worktree dependencies installed from the lockfile (`npm ci`, 2026-10-21).

## Working tree and environment

- Owner: Claude
- Docker Desktop + `npx supabase start` needed from Task 1; build and serve only in this worktree; every shell
  command `Set-Location`s here first (the tool cwd is the main checkout).

## Blockers

- Owner review of the plan.

## Next actions

1. Owner reviews the plan and chooses the execution method.
2. Task 1 Step 0: count legacy `dictation_attempts` on the owner's DB before migrating.
