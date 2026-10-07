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
| T4 | accepted | `24bf403`, `970d3ce`, `600499c` |
| T5 | accepted | `5cb4478`, `02b5fc7` (R-5a amends spec §5.2 start hygiene) |
| T6 | accepted | `9583e50`, `73195dc` (Codex; fix round 1 pinned gaps, window clipping, DST-day midnight) |
| T7 | accepted | `40090f0`, `37df9aa` (Codex quota stop mid-task; Claude finished + fix round 1; R-7a kanji owner-visible) |
| T8 | accepted | `2365ad5`, `9e7636d`, `2406d8a` (R-8b: UPDATE revoked on user_test_attempts; R-8a: table is certification_tests) |
| T9 | accepted | `5ab2cbf`, `d0eac07` (first video milestone survives a hidden lesson) |
| T10 | accepted | `3dba0e9`, `157f50d` (R-10a: reader allowlists practices/language) |
| T11 | accepted | `0cb6965`, `fa036a6`, `121187c` (R-11a frame fidelity; layout proof in T16) |
| T12–T16 | not started | — |

## Contracts and decisions

- Owner rulings R1–R12 and corrections C1–C5: spec §0.
- Plan-time corrections P1–P5: plan header.
- Execution: Codex implements via Paseo (ruling R-route2: every task from T6 on, DB tasks included); Claude
  reviews (opus), re-runs the gates, commits. Ledger: `.superpowers/sdd/2026-10-07-port-profile/progress.md`.

## Verification

After T11 (`121187c`): profile/mascot/route/messages/product vitest 45 files 507/507, tsc 0, lint 0.
After T10 (`157f50d`): vitest lib/korume + lib/data/korume 103/103, tsc 0, `verify:db:korume` PASS.
After T9 (`d0eac07`): fresh reset, `verify:db:profile` + `verify:db:erasure` PASS; profile vitest 11/11; tsc 0.
After T8 (`2406d8a`): fresh reset, `verify:db:profile` + `verify:db:erasure` PASS; T8 vitest files 82/82; tsc 0.
After T7 (`37df9aa`): T7 vitest dirs 75 files / 617 tests, tsc 0, lint 0; 13 hook + 9 surface mutations RED.
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

1. Task 12 (save path + avatar pipeline): brief from the plan; Codex if its quota is back (after 23:27
   2026-10-07), otherwise a Claude implementer. Carry: 512 KiB bucket limit — test the WebP encode with noise.
2. Review, gates, commit, checkpoint this file; then Task 13.
3. Owner decisions queued in the ledger (`Owner decision` / `Owner note` lines, R-5a, R-7a) — list them at finish.
