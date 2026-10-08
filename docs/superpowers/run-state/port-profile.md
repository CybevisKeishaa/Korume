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
| T12 | accepted | `044dd01`, `2855a84` (R-12a: no localeChanged; body guard before parse) |
| T13 | accepted | `2ee4a23`, `385a089`, `adbb500` (R-13a frame fidelity; one Back sentinel; refresh after save) |
| T14 | accepted | `46e172a` (e2e 7/7; 11 mutations red; fresh `db reset` still owed — denied by the auto-mode classifier) |
| T15 | accepted | this commit (Codex; Claude repointed ruling citations to this file) |
| T16 | in progress — owner review | `da2c943` lessons (Codex), `668b557` review r0 fixes (Codex), `6c00745` review r1 C1 security fix |

## Contracts and decisions

- Owner rulings R1–R12 and corrections C1–C5: spec §0.
- Plan-time corrections P1–P5: plan header.
- Execution rulings (full text in the git-ignored ledger; summaries here are the committed record, decision
  register P26–P31):
  - R-5a: heartbeat `start` hygiene closes stale sessions only for the starting presence (spec §5.2 amendment).
  - R-7a: kanji study time only on curated kanji pages (context must be a uuid; dictionary-only kanji have none).
  - R-8a: the JLPT tests table is `certification_tests` (renamed in `20260814000027`).
  - R-8b: `user_test_attempts` is insert-only for learners (UPDATE revoked from anon, authenticated).
  - R-10a: learner-profile practice/language codes are allowlist-filtered in the reader, not a DB CHECK (R8).
  - R-11a / R-13a: frame fidelity — row icons, Korume art, photo badges as real controls, preview follows unsaved state.
  - R-12a: `PATCH /api/profile` returns no `localeChanged`; the client decides a locale change from its pathname.
  - R-16a (reverses plan T8 grant step): learners hold no UPDATE on the seven Edit Profile columns nor on
    `name`, `email`, `created_at`; `save_profile` (service_role) is the only write path (review r0 I1, r1 C1).
  - R-16b: `record_learning_outcome` serialises on the per-user advisory lock alone (row lock dropped, r0).
  - R-16c: admin bootstrap (`ADMIN_EMAILS`) trusts the GoTrue email only. Ops: with `enable_confirmations =
    false`, register each admin account before setting `ADMIN_EMAILS` in a deployment (r2 nit 4).
- Execution: Codex implements via Paseo (ruling R-route2: every task from T6 on, DB tasks included); Claude
  reviews (opus), re-runs the gates, commits. Ledger: `.superpowers/sdd/2026-10-07-port-profile/progress.md`.

## Verification

Final tree `6c00745`: fresh `npx supabase db reset` (owner-approved 2026-10-08) → `verify:db` profile, erasure,
pronunciation, korume, settings, summary, shadowing all PASS; live mutation (advisory lock removed) → `FAIL XP race`,
restored PASS; full vitest 620 files / 5347 tests after the last edit;
tsc 0; lint 0 errors; `verify:protocol` valid. E2E on the `6c00745` build: 156/156 (also on `668b557`) (the 4 landing timeouts seen earlier
were a wedged image optimizer in a long-running server — 24/24 on a fresh server; ledger T16 Step 4).
Capture (§13.4, Playwright Chromium — the Chrome extension was not connected): no horizontal scroll at any viewport;
2-column profile at 1280 and 1440; 375×812 shows the mobile store handoff by product rule.

After T14 (`46e172a`): full vitest 616 files / 5338 tests, tsc 0, lint 0, `verify:protocol` valid; `verify:db:profile` (79 PASS + XP race) and `verify:db:erasure` PASS on the EXISTING local DB (not fresh); e2e profile 7/7; full e2e 130 passed / 26 failed outside the profile port (19 print-vocabulary + 3 shadowing-intelligence on an empty `dict_entries`/`dict_kanji`, 4 landing untraced, 2 load-sensitive) — diagnosed in T16 Step 4.

After T13 (`adbb500`): 92 files 1051/1051 (profile, route, messages, product, korume, mascot, ui, settings), tsc 0, lint 0.
After T12 (`2855a84`): fresh reset, `verify:db:profile` + `verify:db:erasure` PASS; 14 files 143/143; tsc 0.
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

1. Owner review (T16 Step 8): serve the worktree build, hand over URLs + demo learners, list every ledger
   `Owner decision` / `Owner note` / `T16 / owner` line and rulings R-5a, R-7a, R-16a–c. Merge `--no-ff` only after approval.
2. After merge: update memory (`port_profile_run_state`, `project_status`, MEMORY.md); next branch `port-dashboard`.
