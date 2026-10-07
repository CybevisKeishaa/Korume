# Branch Run State

Branch `port-profile`, worktree `.worktrees/port-profile`, base master `2cee918`.

- Owner: Codex

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
| T4 | accepted | `24bf403`, `970d3ce`, `600499c` |
| T5 | accepted | `5cb4478`, `02b5fc7` (R-5a amends spec §5.2 start hygiene) |
| T6 | accepted | `9583e50`, `73195dc` (Codex; fix round 1 pinned gaps, window clipping, DST-day midnight) |
| T7 | dispatched to Codex | — |
| T8–T16 | not started | — |

## Contracts and decisions

- Owner rulings R1–R12 and corrections C1–C5: spec §0.
- Plan-time corrections P1–P5: plan header.
- Execution: Codex implements via Paseo (ruling R-route2: every task from T6 on, DB tasks included); Claude
  reviews (opus), re-runs the gates, commits. Ledger: `.superpowers/sdd/2026-10-07-port-profile/progress.md`.

## Verification

After T6 (`73195dc`), Claude re-ran: fresh `npx supabase db reset` + `npm run verify:db:profile` → every notice
PASS (study time 4.1–4.11), gate exit 0; `lib/data/study-time.test.ts` 12/12; `tsc --noEmit` 0.

## Working tree and environment

- `node_modules` is a junction to `.worktrees/verify-db-erasure/node_modules` (sharp 0.35.4, yauzl, playwright);
  never `npm install` here. `.env.local` copied from the main checkout.
- Docker Desktop must be running for live gates
  (`Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"`), then `npx supabase db reset`.

## Blockers

None.

## Next actions

1. Codex executes Task 7 (study presence on the eight surfaces) from
   `.superpowers/sdd/2026-10-07-port-profile/task-7-packet.md`, BASE = this run-state commit, uncommitted.
2. Claude reviews, re-runs the gates, commits, checkpoints this file; then Task 8.
