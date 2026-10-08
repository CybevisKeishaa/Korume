# Branch Run State

Branch `port-dashboard`, worktree `.worktrees/port-dashboard`, base master `b89f49d`.

- Owner: Claude

## Goal and scope

Port Figma Dashboard `111:515` to `/dashboard` as a complete, measured learner home: a real daily mission system
(50 XP, locked creation and claim), a curated JLPT curriculum journey (manifest + authoritative sync, production
manifest empty at merge), lexical vocabulary mastery shared with Profile, and eight fact-backed cards on the
`port-profile` study-timezone foundations. Web is desktop-only (owner 2026-10-08): review viewports 1280x529 and
1440x900, no mobile layout. Not in scope: global search, app chrome refresh, unified `/review`, Roadmap, Weekly Report,
Weakness Explorer, conversation missions, N5/N4 content curation (spec §12).

## Authorities

- Spec `docs/superpowers/specs/2026-10-08-port-dashboard-design.md` — written `6cb8c70`, owner spec-review corrections
  `812c7c3`, **approved** (D1–D12, S1–S7, M1–M5, C1–C5, L1–L5, E1–E4).
- Plan `docs/superpowers/plans/2026-10-08-port-dashboard.md` — `74f2e55`, **approved by the owner 2026-10-08**,
  including plan-time corrections P1–P9.
- `AGENTS.md`, `.codex/docs/workflow.md`, `docs/lessons.md`.

## Accepted commits

| Task | Status | Commit |
|---|---|---|
| Spec | approved | `6cb8c70`, `812c7c3` |
| Plan | approved | `74f2e55` |
| T1–T16 | not started | — |

## Contracts and decisions

- Owner rulings D1–D12: spec §1. Schema S1–S7 §2, mission engine M1–M5 §3, curriculum C1–C5 §4, layout L1–L5 §7,
  states/tests/gates E1–E4 §8–§12. Plan-time corrections P1–P9: plan header.
- Execution method: **not chosen yet** — the owner picks it at the start of the next session (Claude recommended
  subagent-driven, Codex via Paseo as implementer, Claude finishes a task if Codex hits its quota).

## Verification

Nothing implemented yet; no gate has run on this branch.

## Working tree and environment

- Worktree created from master `b89f49d`; clean after `74f2e55` + this file.
- `node_modules` NOT linked yet and `.env.local` NOT copied (plan Global Constraints: junction to
  `.worktrees/port-profile/node_modules`, copy `.env.local` from the main checkout).
- Local Supabase (Docker) was running on 2026-10-08; local DB holds only demo/e2e videos.

## Blockers

None. `npx supabase db reset` needs the owner's approval in auto mode.

## Next actions

1. Owner chooses the execution method (subagent-driven recommended, or native).
2. Link `node_modules`, copy `.env.local`, run `npm run verify:protocol`.
3. Start Task 1 (lesson access helper, `first_completed_at`, live gate scaffold).
