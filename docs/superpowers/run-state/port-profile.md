# Run state — port-profile

- Owner: Claude
- Branch: `port-profile`, worktree `.worktrees/port-profile`, base master `2cee918`
- Spec: `docs/superpowers/specs/2026-10-07-port-profile-design.md` — frozen `66d6519` (R1–R12, C1–C5)
- Plan: `docs/superpowers/plans/2026-10-07-port-profile.md` — `b313a41`, approved by the owner 2026-10-07,
  including plan-time corrections P1–P5
- Execution method: not chosen yet (Claude recommended subagent-driven). Codex is out of quota until 2026-10-10.

## Environment

- `node_modules` is a junction to `.worktrees/verify-db-erasure/node_modules` (has `sharp` 0.35.4, `yauzl`,
  `playwright`). Never `npm install` here.
- `.env.local` copied from the main checkout.
- Docker Desktop was not running at plan time: start it before Task 2
  (`Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"`), then `npx supabase db reset`.

## Tasks

| # | Task | Status | Commit |
|---|---|---|---|
| T1 | Study timezone foundation | not started | |
| T2 | Learning outcomes, date-free XP identity, locked award | not started | |
| T3 | Derived, schedule-aware streak | not started | |
| T4 | Pronunciation metrics on the study timezone + VN guard | not started | |
| T5 | `study_sessions` + heartbeat RPC | not started | |
| T6 | Reading study time | not started | |
| T7 | Study presence on the eight surfaces | not started | |
| T8 | Profile schema, validators, first-transition timestamps, avatar bucket | not started | |
| T9 | Profile read model | not started | |
| T10 | Learner-profile context for Korume | not started | |
| T11 | `/profile` | not started | |
| T12 | Save path + avatar pipeline | not started | |
| T13 | `/profile/edit` | not started | |
| T14 | Integration, E2E, mutation | not started | |
| T15 | Documentation and registries | not started | |
| T16 | Gates, whole-branch review, owner review | not started | |

## Next

Owner picks the execution method in the next session, then start Task 1 at BASE `b313a41` (plus this run-state
commit).
