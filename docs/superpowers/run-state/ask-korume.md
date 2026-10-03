# Branch Run State

Branch `ask-korume`.

## Goal and scope

Ask Korume: one Korume conversation in two viewports — a floating-mascot side sheet in Shadowing (anchored to
the sentence) and the full page `/korume/chat` — via a two-stage retrieval planner over the Knowledge core, with
per-turn economics, idempotency and grounding. Removes "Sensei" from every user-facing surface. `/companion`
(Korume Memory home) is OUT of scope.

## Authorities

- Spec (LOCKED `bafeea6`, 2026-10-03): `docs/superpowers/specs/2026-10-03-ask-korume-design.md`
- Plan (APPROVED by the owner 2026-10-03, `9f1bd85`): `docs/superpowers/plans/2026-10-03-ask-korume.md` —
  Task 0 probe + Tasks 1–11; its "Corrections to the spec found while planning" 1–9 are binding.
- `AGENTS.md`, `docs/lessons.md`, `.codex/docs/workflow.md` §8

## Accepted commits

- `0e29fcb` spec draft · `bafeea6` spec locked · `9f1bd85` plan

## Contracts and decisions

- Owner approvals 2026-10-03: plan approved; **`npx supabase db reset` is approved on this branch**.
- Live Gemini runs still need the owner's go-ahead each time (spec §7.7).
- Execution: Claude writes a packet per task in `.superpowers/sdd/ask-korume/`, Codex implements, Claude reviews
  and commits; Codex never runs Playwright (Claude does); if Codex hits its quota, Claude finishes the task.

## Verification

None yet (no product code).

## Working tree and environment

- Owner: Claude
- Worktree `.worktrees/ask-korume`, branched from master `ede3833`.

## Blockers

None.

## Next actions

1. Task 0 probe (Claude): Opus price via the `claude-api` skill for `claude-opus-4-8`; confirm `/shadowing/[id]` +
   `?line=`; Gemini env names; `npm ci` + baseline gates in the worktree.
2. Write Task 1's packet (migration 041 + `verify:db:korume`), hand to Codex.
