# Branch Run State

Branch `app-chrome-refresh`, worktree `.worktrees/app-chrome-refresh`, base master `a3df0220`.

## Goal and scope

Port the learner sidebar from Figma page `655:2` (structure) with Claude's visual refinement on Korume tokens
(owner 2026-10-14). Out: FAQ/Quickstart content, a unified `/review` hub, mobile, marketing site header.

## Authorities

- `AGENTS.md`, `.codex/docs/workflow.md`, `docs/lessons.md` (L-051, L-052).
- Spec `docs/superpowers/specs/2026-10-14-app-chrome-refresh-design.md` — approved by the owner 2026-10-14 (two review rounds).
- Plan `docs/superpowers/plans/2026-10-14-app-chrome-refresh.md` (`b7ae73ac`, 10 tasks, plan-time corrections P1–P5)
  — delivered to the owner; owner chose **subagent-driven** execution 2026-10-14.

## Accepted commits

| Task | Status | Commit |
|---|---|---|
| spec | approved | `0bc90f55` + round 2 `c976abce` |
| plan | written, execution method chosen | `b7ae73ac` |
| 1 zero-due review -> /kanji | reviewed | `c9656aee` |
| 2 nav-state helpers | reviewed | `a124f1e5` |
| 3 nav summary + `GET /api/nav/summary` | reviewed | `10a9bd71` |
| 4 `useNavSummary` refresh | reviewed | `5b5d4d17` |
| 5 `/help` placeholder | reviewed | `352de23e` |
| 6 AppNav 240/72 shell | reviewed, 2 fix rounds | `a4a1f731`, `286c4169`, `3bcada34` |
| 7 AccountMenu | reviewed | `517cf0d9` |
| 8 rail tooltip | reviewed | `459e9782` |
| 9 E2E + 3 product fixes | reviewed | `f1f8cd1f`, `3688e747`, `d5916d7e`, `9c3a6018` |
| owner logo art (wordmark pill / emblem) | owner-approved in Chrome | `dd002af7` |
| 10 gate fix (sign-out via account menu) | gated | `f5524f45` |
| final review fix wave (I1, I2, M1-M8, M10) | re-reviewed clean | `6e38bea1`..`6328e18b` |

## Contracts and decisions

- Owner decisions D1–D12 are in spec §1; size lock in spec §2 (`--nav-u` = 1.125 × density unit, 240/72 at 1280).

## Verification

- Gates at `f5524f45`: vitest 668 files / 5600 green, typecheck, lint 0 errors, verify:protocol; Playwright 178 pass,
  4 reds pre-existing on master (landing-page :287/:608/:700, summary :29).
- After the fix wave (`6328e18b`): vitest 5603 green, typecheck/lint/verify:protocol; Playwright app-nav 12/12 +
  typography + route-group-provider-identity 22/22; every behavioural fix mutation-checked red -> green.
- A1 (Task 9): nav 240/72 at 1280, 270/81 at 1440, 337.5/101.25 at 1920; rows 44/44/47.81 px.
- Whole-branch review (Opus): 0 Critical, 2 Important (I1 avatar_path, I2 vacuous E6) fixed; scoped re-review clean.

## Working tree and environment

- Owner: Claude
- `node_modules` is a junction to the main checkout's; adding `lucide-react` must go through the main
  checkout's `package.json` decision in the plan (the junction shares the install).

## Blockers

- Owner decision: pronunciation-search card lower bound lowered 200 -> 12rem track (~192, measured 196) because the
  240 nav frees only ~168px when collapsed; supersedes the 2026-10-01 "200-235" acceptance line.

## Next actions

- Owner's Chrome look at 1280x529 (expanded, rail, account menu, rail tooltip, a `(focus)` lesson) + the pronunciation
  bound decision -> merge to master on approval.
- Deferred (ledger rulings): transient Supabase Auth error -> 401 -> one page reload (M9, R11).
