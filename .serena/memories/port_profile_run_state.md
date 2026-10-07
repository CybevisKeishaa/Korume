# Port Profile — run state (2026-10-07, ▶ RESUME POINT)

Branch `port-profile`, worktree `.worktrees/port-profile`, base master `2cee918`. NOT merged. Owner: Claude.
Authoritative branch run state: `docs/superpowers/run-state/port-profile.md` (on the branch) — read it first.

## Where it stands
- Spec `docs/superpowers/specs/2026-10-07-port-profile-design.md` FROZEN at `66d6519`: owner rulings R1–R12 over
  five design sections + corrections C1–C5 (C1 streak evidence = new `learning_outcomes`; C2 streak honours
  `schedule_days`, badges never revoked; C3 XP write in one locked SQL fn; C4 Today's Memory candidates frozen at
  study-day start; C5 "Learning with Korume since" = `firstKnownLearningAt` over canonical tables).
- Plan `docs/superpowers/plans/2026-10-07-port-profile.md` at `b313a41`, **approved 2026-10-07** with plan-time
  corrections P1–P5 (review-tomorrow → study tz; 4th VN display site; leaderboard week was offset math; ICU
  canonicalises `Asia/Ho_Chi_Minh` → `Asia/Saigon`; community surfaces keep OAuth `avatar_url`).
- Execution method NOT chosen yet (recommended: subagent-driven). Codex out of quota until 2026-10-10.
- Next: owner starts in a new session → pick method → Task 1.

## Scope in one breath
Profile `66:166` + Edit Profile `67:595` (private archive; no visibility tiers; reminder controls deferred to
`study-reminders`), plus two foundations `port-dashboard` will consume: study timezone (IANA, canonical day
boundary, one-shot browser detection) and study time (heartbeat → UTC `study_sessions`, merged and split at local
midnight on read). Successor branch: `port-dashboard` (`111:515`).

## Owner rules this session (apply to every port)
- Viewport normalization: reflow, never shrink; review 1280×529 + 1440×900 + 375×812; hierarchy, not pixels.
- Port = complete: real data/backend for every approved capability; undecided semantics decided first, never
  rendered as inert controls.
- Look at the Figma frame before asking a field-level question.

## Environment
- Worktree node_modules = junction → `.worktrees/verify-db-erasure/node_modules` (sharp 0.35.4). No npm install.
- Docker Desktop was not running; start it before the first live gate.
