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
- Plan `docs/superpowers/plans/2026-10-21-practice-listening.md` (10 tasks, rulings P1–P9). Owner 2026-10-21:
  subagent-driven chosen; P1–P9 accepted in direction with notes (P3 must work on fresh replay AND upgrade, one
  home; P5 label "Nghe (gõ chính tả)"; redirect keeps locale, id, deep links, E2E). Revised plan sent for the
  owner's final review; no product code before that approval. No merge before the owner's Chrome check.
- Owner review round 2 (2026-10-21), applied in the plan: Task 1 proves 048, gates and SQL mutations on disposable
  databases (D1 upgrade copy at 047 with the owner's legacy rows, D2 fresh chain) and only then upgrades the owner's
  DB once — no experiment or mutation on the owner's DB, a disposable DB that cannot be built is an unmet gate;
  Task 9 E2E enumerated in 13 cases; P10 URL is the one source of the format (D9 fallback = URL replace);
  P11 reveal keyed by line + format + attempt, reset during render; P12 chunks memo only after the RLS read.

## Accepted commits

| Task | Status | Commit |
|---|---|---|
| plan | written 2026-10-21, awaiting owner review | this commit |

## Contracts and decisions

- Plan-time rulings P1–P9 are in the plan. P3 revised 2026-10-21 after measuring: 043/045/047 are applied on the
  owner's DB; nothing in 044–047 calls the five read functions; `check_function_bodies = on` rejects a `language
  sql` body naming a missing column. So all five functions that read B2 columns (incl. `practice_stats` from 047)
  have their single home in 048; Task 1 gates both the upgrade path and a fresh replay.

## Verification

- None yet. Worktree dependencies installed from the lockfile (`npm ci`, 2026-10-21).

## Working tree and environment

- Owner: Claude
- Docker Desktop + `npx supabase start` needed from Task 1; build and serve only in this worktree; every shell
  command `Set-Location`s here first (the tool cwd is the main checkout).

## Blockers

- Owner review of the plan.

## Next actions

1. Owner's final review of the revised plan; then subagent-driven execution from Task 1.
2. Task 1 Step 0: count legacy `dictation_attempts` on the owner's DB before migrating.
