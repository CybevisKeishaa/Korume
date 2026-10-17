# Branch Run State

Branch `practice-pronunciation`, worktree `.worktrees/practice-pronunciation`, base master `03a3b400`.

## Goal and scope

B1 of the Shadowing practice modes: the shared practice frame + Pronunciation (Part 2), with its Summary, Dashboard
and Mission changes. Listening Practice (Part 3) is B2 `practice-listening`, branched after this one merges.

## Authorities

- `AGENTS.md`, `.codex/docs/workflow.md`, `docs/lessons.md` (L-051, L-052).
- Spec `docs/superpowers/specs/2026-10-15-shadowing-practice-modes-design.md` — sections approved by the owner in
  conversation 2026-10-15; written spec approved after review round 1 (owner: "Viết plan đi", 2026-10-15).
- Plan `docs/superpowers/plans/2026-10-15-practice-pronunciation.md` (15 tasks) — approved by the owner 2026-10-15; execution: subagent-driven, authorized by the owner 2026-10-17.

## Accepted commits

| Task | Status | Commit |
|---|---|---|
| spec | approved after review round 1 (lease token, pre-201 guard, hint unit, unscored trigger, D25) | `d278843a`, `f8580170` |

## Contracts and decisions

- Owner decisions D1–D25 are in spec §2. Gates by branch in spec §9.

## Verification

- None yet. Before any migration: count legacy rows on the owner's local DB (spec §4.7, §9).

## Working tree and environment

- Owner: Codex
- Docker Desktop + `npx supabase start` needed from the first migration task; build and serve only in this worktree.

## Blockers

- None.

## Next actions

1. Codex takes implementation ownership as requested on 2026-10-17; protocol gate passed before handoff.
2. Start Task 1 (needs Docker Desktop + `npx supabase start`; Step 0 counts legacy rows first).
