# Branch Run State

Branch `port-dashboard`, worktree `.worktrees/port-dashboard`, base master `b89f49d`.

- Owner: Codex

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
| T1 | accepted (Codex; Claude fixed a same-transaction S7 test) | see git log |
| T2 | accepted (Codex; Claude moved its gate block out of the migration) + T1 review nits | see git log |
| T3 | accepted (Codex until its quota stop; Claude: reserved-word fix, gate) + T2 review nits | see git log |
| T4 | accepted (Claude, Codex out of quota) + T3 review fixes | see git log |
| T5 | accepted (Claude) | see git log |
| T6 | accepted (Claude) + T4/T5 review fixes | see git log |
| T7a | accepted (Claude): progress, claim, award helper, P1 | see git log |
| T7b | accepted (Codex): mission pre-write wiring + invalid-reference guard | 2026-10-09 |
| T8 | accepted (Codex): two-phase 20-worker mission race + privilege sweep | 2026-10-09 |
| T9–T16 | not started | — |

## Contracts and decisions

- Owner rulings D1–D12: spec §1. Schema S1–S7 §2, mission engine M1–M5 §3, curriculum C1–C5 §4, layout L1–L5 §7,
  states/tests/gates E1–E4 §8–§12. Plan-time corrections P1–P9: plan header.
- Continuation authority (user, 2026-10-09): Codex owns this worktree and implements/checkpoints the remaining
  packets because Claude's quota is exhausted.
- Packets/briefs/reports: `.superpowers/sdd/2026-10-08-port-dashboard/` (git-ignored).

## Verification

- T1: `verify:db:dashboard` PASS; `verify:db:shadowing`, `verify:db:pronunciation` PASS; mutations red: PLUS
  `status <> 'active'`, S7 drop keep-branch. Dictionary NOT re-imported after resets (deferred to the last reset
  before Playwright/Chrome).
- T2: gate PASS (sync order/idempotent/authoritative/PRIVATE/atomic/empty, rollback keeps the seed fixture);
  mutations red (S7 INSERT branch, sync delete); script with a missing id prints all of them and exits 1.
- Contract (T1 review): a legacy completed row keeps a null `first_completed_at` even after re-completion;
  `finish_lesson` counts only first completions after mission creation. Perf to measure at T16:
  `transcript_lines_read` evaluates `can_open_lesson` twice per line (nested transcripts RLS + explicit call).
- T3: gate PASS (journey core vs PLUS, placement); mutations red (core_total without FREE filter, two-curricula
  check, null-manifest guard). Plan snippet bug: `position` is reserved in `returns table` -> `lesson_position`.
- Plan Step 8 scan test (T2) dropped: `listCollections` now requires `kind`, so tsc is the guard.
- T4: gate PASS (lexical_key parity, min-before-filter, sentence excluded, mining mastered_at kept); Profile gate
  PASS with Words learned = `current_mastered_count`; mutations red (filter before min, keep trigger dropped,
  journey `next` without FREE filter, mining masteryTransition input). Profile label: Vocabulary mastered / Từ & cụm từ đã học.
  Known: `mastered_at` is client-writable through RLS while still null (same as curated vocab since port-profile).
- T5: gate PASS (kanji/mining due, exactly-at boundary, cross-learner RLS); mutations red (`<=`→`<`, kanji filter,
  TS recency tie-break).
- T6: gate PASS (ensure idempotent, review 20 of 25 frozen, single-rule skipped hints, tz change keeps the cycle,
  window continuity, onboarding = no row); erasure gate PASS; mutations red (access check, transcript check, active
  lookup, review cap). Gate idempotency checks use `is distinct from` (a NULL second call passed `<>`).
- S3 decision (T4 review): a key currently mastered on a row with no `mastered_at` (pre-tracking) is never "new".
- T7a: gate PASS (incomplete no award; distinct eligible keys in [created_at, window_end); one +50 XP; no outcome
  row; second claim 0); mutations red (count distinct, window end, rewarded guard, P1 neq). buildBadgeSnapshot moved
  to `lib/data/badge-snapshot.ts`, awardNewBadges + afterXpAward to `lib/data/xp-award.ts` (no import cycle);
  existing gamification tests unchanged and green. Mission XP counts toward the weekly leaderboard (it is XP).
- T6 review fixes: S4 RLS/grant gate, openable practice fallback, completed-lesson and window-bound cases
  (mutations red). Accepted minors listed in `.superpowers/sdd/2026-10-08-port-dashboard/followups.md`.
- Codex hit its usage limit 2026-10-08 ~21:40 (resets 2026-10-09 01:41); Claude continues per owner rule.
- T7b: targeted learning/mission writers PASS (10 files, 54 tests); `npm run lint` PASS with pre-existing warnings,
  `npm run typecheck` PASS, `npm run verify:protocol` PASS, and `npm run verify:db:dashboard` PASS. The M1 regression
  test proves missing SRS/video/transcript references return 400 without ensuring a mission, writing a row, or uploading audio.
  Independent reviewer approved the follow-up fix; its verification was source-only because its runner was unavailable.
- T8: live gate PASS with function-privilege sweep and a two-phase 20-worker race (one mission, one +50 XP award,
  20 outcomes). Mutations red: removing ensure's lock produced the mission-cycle unique violation; removing claim's
  lock produced `xp_events_once_only_uq`. Both locks restored and the final fresh-reset gate passed.

## Working tree and environment

- Worktree created from master `b89f49d`; clean after `74f2e55` + this file.
- `node_modules` = junction to `.worktrees/port-profile/node_modules`; `.env.local` copied; `verify:protocol` valid.
- Local Supabase (Docker) was running on 2026-10-08; local DB holds only demo/e2e videos.

## Blockers

None. `npx supabase db reset` needs the owner's approval in auto mode.

## Next actions

1. Continue with T9 from `task-9-packet.md`; read its direct dependency graph before dispatch.
