# Branch Run State

Branch `practice-pronunciation`, worktree `.worktrees/practice-pronunciation`, base master `03a3b400`.

## Goal and scope

B1 of the Shadowing practice modes: the shared practice frame + Pronunciation (Part 2), with its Summary, Dashboard
and Mission changes. Listening Practice (Part 3) is B2 `practice-listening`, branched after this one merges.

## Authorities

- `AGENTS.md`, `.codex/docs/workflow.md`, `docs/lessons.md` (L-051, L-052).
- Spec `docs/superpowers/specs/2026-10-15-shadowing-practice-modes-design.md` — sections approved by the owner in
  conversation 2026-10-15; written spec approved after review round 1 (owner: "Viết plan đi", 2026-10-15).
- Plan `docs/superpowers/plans/2026-10-15-practice-pronunciation.md` (15 tasks) — approved by the owner 2026-10-15; execution: subagent-driven, authorized by the owner 2026-10-17.

## Accepted commits

| Task | Status | Commit |
|---|---|---|
| spec | approved after review round 1 (lease token, pre-201 guard, hint unit, unscored trigger, D25) | `d278843a`, `f8580170` |
| 1 | DB gates, isolated fresh chain, compatibility, lease/ownership mutations; task + fix reviews APPROVE | `5698c58a`, `d0e3ecbb` |
| 2 | WAV parser, audio regression, boundary mutations, TypeScript/lint; fix review APPROVE | `10c01022`, `c8414bd3` |
| 3 | Shared alignment, assessment, Unicode word spans; caller regressions/mutations and fix review APPROVE | `9cbf5a13`, `1e764bc9` |
| 4 | WAV-only saves, privileged row insert, history/cache headers; mutation/regression and fix review APPROVE | `e665d3b1`, `536d47f3` |
| 5 | Lease scoring, stored WAV/server text, timeout/retry metadata, conversation preserved; review APPROVE WITH NITS | `c2d704d9` |
| 6 | Mode-aware shell, controller/wiring, saved loops and sentence-bound playback; review APPROVE WITH NITS | `77c1ecf3` |
| 7a | Authenticated SQL stats adapter/API, null handling and private responses; review APPROVE | `3de4c3cd` |
| 7b | Stable shared stats provider, responsive strip and EN/VI copy; review APPROVE WITH NITS | `30f34a43` |
| 8 | Scrolling practice panel and accessible, state-aware sentence navigator; review APPROVE WITH NITS | `3e1e68b6` |
| 9 | Durable per-line attempts, session-routed results and controller locks; review APPROVE WITH NITS | `3b39eff7` |
| 10 | Mode body, capture/sessions hooks, details, scored sentence, take limit; Claude review 2026-10-19 APPROVE WITH NITS | `f2db6ecc` |

## Contracts and decisions

- Owner decisions D1–D25 are in spec §2. Gates by branch in spec §9.
- Ruling (2026-10-17): AGENTS §6 overrides Task 1's duplicate function definitions: edit
  `lesson_summary_evidence` in migration 043 and `practice_activity` in 045 in place; migration 047
  owns only new objects. Apply those canonical function definitions to the existing local DB without
  resetting owner data. A fresh-reset gate requires a separate isolated database; report it as unmet
  if that isolation cannot be established (L-050).
- Task 1 ownership test was corrected under AGENTS §7/L-004: the foreign session is unscored and
  unleased; removing ownership produced the intended failure. Separate fix review approved it.
- Task 2 ruling: spec §4.3/AGENTS input validation overrides the sample parser's early success.
  Verify RIFF/chunk extents and finish the bounded chunk walk before admitting the uploaded bytes;
  accept valid metadata, reject truncated or ambiguous chunks. This tightens admission for malformed
  files; the app's existing PCM encoder remains supported.
- Task 3 ruling: fix the sample's asymmetric NFKC normalization, which rejects identical half-width
  or decomposed kana. Preserve raw code-point offsets while composing voicing marks consistently.
  Incorrect or absent word detail must still fall back to no colouring.
- Task 5 ruling (2026-10-18, caller audit L-023): voice conversation actively calls the old multipart
  scorer, contradicting the plan's caller inventory. Preserve that ephemeral feature at
  `/api/conversation/pronunciation`, with its existing audio/reference validation and shared per-user
  quota, private responses, and no shadowing-session write path. The practice scorer remains strict
  JSON `{ sessionId }`, with server-owned reference text and stored WAV revalidation. Update the
  conversation caller/tests; do not remove its score or retain client-supplied session scoring.
- Task 6 preflight: the current controller's play/toggle resumes in place, and Previous/Next/seek
  do not pause. The packet's auto-pause-only hook cannot alone satisfy spec §3.3/D17. Include the
  smallest mode-aware controller/wiring changes and regression tests: practice play starts at the
  current line, sentence navigation cancels loops and stays paused, Shadowing behavior unchanged.
- Task 8 ruling: move the eight-chip window from its displayed start, rather than the sample's
  anchor plus/minus eight, which shifts fewer than eight at clamped ends. Shared selection changes
  only on chip activation. Focused end-window regressions failed first, then passed.
- Task 9 contract: pre-save actions carry only `lineId`; Tasks 10/11 must cancel or ignore an old
  conversion/save callback after discard and a new take on that same line. Session-addressed late
  outcomes are already owner-routed. Microphone cleanup and actual browser Back/Forward remain owed.
- Task 10 implementation `f2db6ecc` is under task review, not yet accepted. It adds the full mode,
  captured-operation cancellation, history reconciliation/polling and real stats refresh after save/score.
  Necessary direct seams preserve one scored sentence with adaptive ruby, translation and lookup.
  Recorder regressions cover failed startup, cancelled grants, old callbacks and double cleanup.
- Task 10 confirmed that natural Shadowing playback could strand a retained unsaved take after Back.
  The controller now bounds navigation-locked playback, including skipped ticks, before publishing a
  different sentence. Ordinary unlocked Shadowing and internal replay regressions passed.
- Task 10 toolbar ruling: the unlabeled Figma list/restart, headphones, waves and bookmark icons map
  to Replay Native, Play my take, Details/intonation and sentence bookmark. Exact SVGs are local;
  the shared header remains the single Reading Settings owner. Final owner look must judge the mapping.
- Deferred review minor: existing Vite CJS Node API deprecation warning in Vitest output; no
  configuration change is included in these product tasks. Reassess at the integration gate.
- Deferred Task 5 minor: await the asynchronous work in ConversationApp's "disables tracking until
  a conversation session exists" test to address its React `act(...)` warning. Origin unestablished;
  do not label it pre-existing without evidence. Four baseline non-null lint warnings are recorded
  in the Task 5 report.
- Deferred Task 6 minor: triage workspace React `act(...)` and server-layout-effect warnings at
  integration; origins unestablished. Await/wrap real asynchronous updates and assert intentionally
  expected SSR warnings narrowly rather than suppressing output.
- Task 7b review carries these warning checks forward, including selection-popover, drawer inspector,
  utility-drawer and korume-overlay paths. Replace the retained `yt.players[0]!` shell-test assertion
  with an explicit existence guard during integration. Browser persistence, type and contrast remain owed.
- Task 9 review confirms nine retained non-null warnings in controller/shell tests are on unchanged
  code. Include those in integration cleanup; final scoped suite was 35 files / 319 passing tests.

## Verification

- Task 1 accepted after task and fix reviews. Evidence and command outputs:
  `.superpowers/sdd/2026-10-15-practice-pronunciation/task-1-report.md` and its cited logs.
- Pre-migration recount 2026-10-17: shadowing `208|0|0` (total/webm/unscored), dictation `107|0`
  (total/unscored). Legacy score dumps before/after match SHA-256
  `C83D9F9D68FC5B9375BC22BD7C6D0920BA7DD70E3537148CDA3A06DC4DED2950`.
- Practice, Summary, Dashboard, erasure and shadowing live gates passed, including two-session
  scoring and existing parallel gates. Both stale-token mutations failed at the intended guard;
  restoring the canonical definitions returned the gates to green.
- Full product migration chain and gates passed on an isolated disposable DB with an empty public
  schema. Down/up and transactional rollback checked there; disposable DB removed. Owner DB was
  not reset.
- Worktree dependencies installed from lockfile. Typecheck, lint (warnings), protocol, and reruns of
  the dependency-affected suites passed. Initial full suite failed from missing installed dependencies;
  a final full suite remains required after the last product edit (L-044).

## Working tree and environment

- Owner: Claude
- Docker Desktop + `npx supabase start` needed from the first migration task; build and serve only in this worktree.
- This worktree has its own ignored `node_modules` installed by `npm ci`; no parent dependency edits.

## Blockers

- No external blocker. Save/score contracts are now implemented; the inactive orphan recorder is
  removed in Task 14. Summary still requires its Task 13 adapter update. Practice UI and integrated
  gates remain incomplete; do not treat the branch as ready for use or merge.

## Next actions

0. 2026-10-19: the owner asked Claude to review the branch and finish it ("xem có vấn đề gì không và làm tiếp").
   Codex task 10 review verdict was never recorded; Claude reviewed `f2db6ecc` (tsc clean, 53 files / 506
   tests in lib/pronunciation + workspace + video-player green) and accepted it. Nit carried: unmounting
   during `saving` marks the take `save-failed` while the request may still reach 201, so "Save again"
   can create a second row; Task 11's guard blocks in-workspace links, leaving only browser Back.
   Claude now owns Tasks 11-15 in a cloud session (no worktree; branch pushed as
   `claude/quirky-maxwell-h86erz` from `practice-pronunciation`).

1. Codex takes implementation ownership as requested on 2026-10-17; protocol gate passed before handoff.
2. Task 10 implementation `f2db6ecc` is being reviewed by `task_10_review`; read its verdict before
   accepting/checkpointing or starting Task 11. Focused 79 files / 1,140 tests passed; TypeScript,
   scoped lint (46 baseline-proven warning sites) and protocol passed. Browser/full gates remain owed.
3. Tasks 1–9 accepted. Keep one implementer/reviewer at a time; Tasks 11–15 follow after Task 10 review.
