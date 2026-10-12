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
| T1 | accepted (Codex; Claude fixed a same-transaction S7 test) | see git log |
| T2 | accepted (Codex; Claude moved its gate block out of the migration) + T1 review nits | see git log |
| T3 | accepted (Codex until its quota stop; Claude: reserved-word fix, gate) + T2 review nits | see git log |
| T4 | accepted (Claude, Codex out of quota) + T3 review fixes | see git log |
| T5 | accepted (Claude) | see git log |
| T6 | accepted (Claude) + T4/T5 review fixes | see git log |
| T7a | accepted (Claude): progress, claim, award helper, P1 | see git log |
| T7b | accepted (Codex): mission pre-write wiring + invalid-reference guard | 2026-10-09 |
| T8 | accepted (Codex): two-phase 20-worker mission race + privilege sweep | 2026-10-09 |
| T9a | accepted (Codex): pure dashboard facts, S6 RPCs/gate, review fix wave | 2026-10-09 |
| T9b | accepted (Codex): request-cached facts, continuation taxonomy slugs, achievement cap, review fixes | `67c4d388` |
| T10 | accepted (Codex): deterministic Korume cue resolver and D6 copy | `973fd9d5` |
| T11 | accepted (Codex): page shell, container layout, header, Quick Access, card boundary | `665f7a17` |
| T12 | accepted (Codex): Continue, Mission, Journey cards + review fixes | `64d31f21` |
| T13 | accepted (Codex): Korume, Weakness, Weekly, Activity, Achievement cards + two review-fix passes | `ad1287f0` |
| T14 | accepted (Codex): legacy-card retirement, registry/inventory reconciliation, scoped review + re-review | `ce2cca05` |
| T15 | accepted (Codex): E2E states, focus, geometry, fan-out, isolation fix + scoped review | `3c369cbf` |
| T16 | accepted (Claude): gates, whole-branch review + fix wave + scoped re-review, owner Chrome approval 2026-10-13 | see git log |

## Contracts and decisions

- Owner rulings D1–D12: spec §1. Schema S1–S7 §2, mission engine M1–M5 §3, curriculum C1–C5 §4, layout L1–L5 §7,
  states/tests/gates E1–E4 §8–§12. Plan-time corrections P1–P9: plan header.
- Continuation authority (user, 2026-10-09): Codex owned this worktree and implemented/checkpointed T7b–T15;
  user 2026-10-12: Codex is no longer available, Claude owns and finishes T16 alone.
- Packets/briefs/reports: `.superpowers/sdd/2026-10-08-port-dashboard/` (git-ignored).
- D8 reading (T16): an in-progress badge needs `current > 0`; zero progress is not "in progress", so a new account
  shows the empty state. Stricter than spec §5.9's text; the code is the authority.
- Weakness label (T16): listening/reading show the family; pronunciation shows its weakest metric (as the Korume cue).
- One SQL home for the study-timezone fallback: `fallback_study_timezone()` in the dashboard migration, pinned to
  `FALLBACK_STUDY_TIMEZONE` by `lib/time/no-vn-hardcode.test.ts`.
- Follow-ups (not built): Journey shows `plus.total` only (`plus.accessible` unused, spec C4); `ensure_daily_mission`
  accepts a null target (`least` ignores NULL); repeated full ensure when no slot qualifies; `transcript_lines_read`
  calls `can_open_lesson` twice per line (seed-sized EXPLAIN 5.4 ms, large transcripts unmeasured); avatar-initial
  rule duplicated in dashboard-header and profile identity-card; taxonomy slug missing from the catalog shows a raw key.

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

- T9b: focused facts/cache/activity gate PASS (5 files, 17 tests); lint PASS with existing warnings; typecheck,
  protocol and diff checks PASS. Fresh reset + dictionary import yielded one active snapshot (218849 entries, 13108
  kanji); live dashboard gate PASS, including S6 and the 20-worker race. Mutations red: timezone conversion made
  prior weekly history available, omitted weekly RPC failed the cache assertion, `r <= p_dates` returned 29 rows in
  the S6 gate, and threshold `5 -> 6` returned level 1. All source hashes restored; see task-9b-report.md.
- T10: resolver/copy focused gate PASS (46 tests); lint PASS with existing warnings; typecheck and diff check PASS.
  Mutations red: `>=` to `>` rejected +5, and a punctuation change broke the EN copy pin. Reviewer approved with no
  findings; no DB gate applies because T10 is pure TS and catalogs only. Task 13 must add the `dashboard.skills`
  catalog that renders the resolver's skill keys; see task-10-report.md.
- T11: focused dashboard/header/catalog gate PASS (9 files, 29 tests); lint PASS with existing warnings; typecheck,
  protocol and diff checks PASS. Mutations red: 401 swallowed as card error, zero-streak chip, fewer than four Quick
  Access links, copy pin, and profile achievements target. Reviewer approved after context-fallback and deferred
  legacy-catalog compatibility fixes. No DB gate applies; see task-11-report.md.
- T12: focused card/data/catalog gate PASS (7 files, 27 tests); typecheck, protocol, and diff checks PASS; lint PASS
  with existing warnings. Reviewer fix pass added real `learner_videos` playback projection, rendered continuation
  taxonomy slugs, named playback progress, nullable next-milestone handling, and a two-consumer request-cache test.
  Mutations red: continuation clamp, reward authority, mission cache removal, and playback percentage multiplier.
  No DB reset or Playwright applies; see task-12-report.md.
- T13: focused dashboard facts/cache/cards/catalog suite PASS (8 files, 28 tests); typecheck, protocol, and diff checks
  PASS; lint exits 0 with existing warnings only. Two review-fix passes added the RSC client boundary, 4x14 visible
  activity grid with live roving-cell announcement, correct calendar yesterday, ten-bar fallback, localized weakness
  metrics, local card errors, visible bar/cell states, and full EN/VI pins. No DB reset or Playwright applies; see
  task-13-report.md.
- T14: removed the four zero-caller legacy Dashboard cards and their tests, retired their unused CSS/test hooks, and
  reconciled the Dashboard registry, inventory, and screen documentation. Focused suite PASS (34 files, 369 tests),
  typecheck, lint with existing warnings only, protocol, and diff checks PASS. Registry metadata mutation was RED then
  restored. Scoped review APPROVE; the one JSDoc nit was amended and re-review marked ADDRESSED. No DB or browser gate
  applies; see task-14-report.md.
- T15: dashboard E2E, geometry/focus and fan-out coverage passed; final clean provider-none full E2E was 162/162.
  Review found a capped-shelf fixture collision and signup cleanup leak; both were fixed, mutation-checked and
  re-reviewed. Fan-out measured 30 requests with 14 distinct RPC primitives once each; see task-15-report.md.
- T16: fresh local reset + dictionary import PASS; all 12 `verify:db:*` gates PASS. Full bounded Vitest:
  3 failed / 5460 passed. Two stale guard pins were corrected and independently approved (9 scoped tests PASS;
  collection enum mutation RED then restored); the shared SQL/TS timezone-fallback invariant remains RED.
  Lint exits 0 with warnings; typecheck, protocol, build and diff checks PASS. Fresh provider-none full E2E:
  162 passed (5.3m). Four desktop state/viewport captures PASS geometry, but visual inspection requires card
  interior corrections and localized real badge names. No visual approval. Claude Opus whole-branch review
  attempted read-only from main: exit 1, HTTP 429 usage_limit_reached; no verdict. Raw evidence and exact
  outstanding owner-review handoff: `.superpowers/sdd/2026-10-08-port-dashboard/task-16-report.md`.
- T16 (Claude, 2026-10-12/13, after Codex left): owner handed the worktree to Claude (`53ef84b`). An aborted Codex E2E
  run had left six `e2e-ws-*` videos that filled the capped Recently-added shelf (provider-identity spec failed);
  deleted, spec green. Whole-branch code-reviewer (opus): CHANGES REQUIRED, no Critical — pronunciation practice
  href 404, float hours, raw Korume skill key, ensure failure rendered as onboarding, UTC earned date, raw tag slugs.
  Fix wave also: D8 zero-progress badges, weekly bar order/scale, ICU plurals, h2 card titles, activity role/ring,
  avatar initial, dead catalog keys, admin stats excludes mission rewards, context failure bubbles. Mutations RED
  for 7 fixes. Scoped re-review APPROVE WITH NITS; nits 1-3 folded in. Final after the last edit: full bounded
  Vitest 653 files / 5476 tests PASS; typecheck, lint (warnings only), build, protocol PASS; full E2E 162/162 on the
  previous build, dashboard spec 6/6 + four captures (lead row bottom 372/435 at 1280x529, 388/467 at 1440x900).
  Owner reviewed in Chrome and approved 2026-10-13 ("Được rồi"), which also stood as the resetability answer.

## Working tree and environment

- Worktree created from master `b89f49d`. `node_modules` = junction to `.worktrees/port-profile/node_modules`.
- Local Supabase reset/imported 2026-10-12; owner demo account and fixture videos deleted after review.

## Blockers

None.

## Next actions

1. Merge `--no-ff` into master (Claude), protocol green before. Owner pushes by hand.
