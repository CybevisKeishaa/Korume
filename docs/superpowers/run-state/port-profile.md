# Branch Run State

Branch `port-profile`, worktree `.worktrees/port-profile`, base master `2cee918`.

- Owner: Claude

## Goal and scope

Port Figma Profile `66:166` and Edit Profile `67:595` as a complete, private learner archive, plus two
foundations `port-dashboard` will consume: study timezone (canonical day boundary) and study time (heartbeat-backed
UTC session intervals). Not in scope: visibility tiers (deferred beside G2), reminder controls (`study-reminders`),
Dashboard blocks (`port-dashboard`), Layer 8.

## Authorities

- Spec `docs/superpowers/specs/2026-10-07-port-profile-design.md` — frozen `66d6519` (R1–R12, C1–C5).
- Plan `docs/superpowers/plans/2026-10-07-port-profile.md` — `b313a41`, approved by the owner 2026-10-07,
  including plan-time corrections P1–P5.
- `AGENTS.md`, `.codex/docs/workflow.md`, `docs/lessons.md`.

## Accepted commits

| Task | Status | Commit |
|---|---|---|
| Spec | frozen | `f642803`, `66d6519` |
| Plan | approved | `b313a41` |
| T1 | accepted | `27eca6b` |
| T2 | accepted | `6486526`, `28d6632` (Codex draft, quota stop; Claude finished) |
| T3 | accepted | `f3b105a`, `0d387d8` |
| T4–T16 | not started | — |

## Contracts and decisions

- Owner rulings R1–R12 and corrections C1–C5: spec §0.
- Plan-time corrections P1–P5: plan header.
- Execution method: not chosen yet (Claude recommended subagent-driven). Codex is out of quota until 2026-10-10.

## Verification

Plan-time only: `lib/time/study-day.ts` was run on Node 24 against the Task 1 assertions (DST 23 h / 25 h days,
skipped midnight, canonicalisation) — all pass. No live gate has run on this branch yet.

## Working tree and environment

- `node_modules` is a junction to `.worktrees/verify-db-erasure/node_modules` (sharp 0.35.4, yauzl, playwright);
  never `npm install` here. `.env.local` copied from the main checkout.
- Docker Desktop was not running at plan time; start it before the first live gate
  (`Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"`), then `npx supabase db reset`.

## Blockers

None. Waiting on the owner's choice of execution method.

## Next actions

1. Owner picks the execution method (subagent-driven recommended).
2. Start Task 1 (study timezone foundation) from this run-state commit; checkpoint this file after every accepted
   task.
