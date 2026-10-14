# Branch Run State

Branch `app-chrome-refresh`, worktree `.worktrees/app-chrome-refresh`, base master `a3df0220`.

## Goal and scope

Port the learner sidebar from Figma page `655:2` (structure) with Claude's visual refinement on Korume tokens
(owner 2026-10-14). Out: FAQ/Quickstart content, a unified `/review` hub, mobile, marketing site header.

## Authorities

- `AGENTS.md`, `.codex/docs/workflow.md`, `docs/lessons.md` (L-051, L-052).
- Spec `docs/superpowers/specs/2026-10-14-app-chrome-refresh-design.md` — approved by the owner 2026-10-14 (two review rounds).

## Accepted commits

| Task | Status | Commit |
|---|---|---|

## Contracts and decisions

- Owner decisions D1–D12 are in spec §1; size lock in spec §2 (`--nav-u` = 1.125 × density unit, 240/72 at 1280).

## Verification

- None yet (no product code).

## Working tree and environment

- Owner: Claude
- `node_modules` is a junction to the main checkout's; adding `lucide-react` must go through the main
  checkout's `package.json` decision in the plan (the junction shares the install).

## Blockers

- None.

## Next actions

- Write the plan (writing-plans) → owner approves it and picks the execution method → Task 1.
