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
| 11 | Unsaved-take guard: beforeunload + same-origin link confirm, discard on leave; mutation (`saving` out of UNSAVED_PHASES) fails | `5ffda80a`, `fea2ccb8` |
| 12 | "Practice this sentence" row action, only while Pronunciation is complete; seek then route | `a5862230` |
| 13 | `reachedLine` evidence → "Watched to sentence n/total", practised never complete (D7); mission → `/pronunciation`, speaking copy; mutation (complete at last line) fails | `0f416e4a` |
| 14 | Mode on (D24), orphan recorder panel deleted, loopback-only recognition override, speech stub, E2E 8/8 | `4e89542f`, `b11d10d5` |
| 15 | Gates; owner-look screenshots (token fix `493fdd08`); whole-branch review REQUEST CHANGES → fix wave `ceb5660b` (I-1, I-2, M-1..M-6) → REQUEST CHANGES (R-1..R-4) → `0f40ae49` → APPROVE WITH NITS | `493fdd08`, `ceb5660b`, `0f40ae49` |

## Contracts and decisions

- Owner round 2026-10-19 (screenshots from the owner's machine, `e919a7e9` + E2E follow-up): analysis card per the
  owner's sample (sentence score + grade, Accuracy / Fluency / Completeness, heard text with play, per-word chips,
  mismatch note); no derived "average" tile, because PronScore is already Azure's aggregate (offered to the owner).
  TakePlayer replaces native <audio>; stat strip has no lesson title; pitch contour bridges unvoiced gaps ≤ 8 % of
  the line. Rhythm copy reads Fluency/Độ trôi chảy (it is Azure FluencyScore; spec §4.1 says "Rhythm (Azure
  fluency)"). The analysis card is always visible once scored, not behind Details (owner request over D13 layering).
- 422 from Azure (NoMatch, no speech heard) is its own state `unscored-unheard`: says so, offers a new take, hides
  Score again. Every speech failure logs `[pronunciation/score] speech failure: <kind>` server-side, and
  `SPEECH_PROVIDER` off logs once per request. The owner's takes all read "Chưa chấm"; cause not yet established.

- Whole-branch review N-1 ruling (Claude, 2026-10-19): `saving` is not discardable. A client navigation lets it
  finish (the request outlives the mode and lands on the shell's store); the link guard and "Leave and discard" skip
  it; `beforeunload` still warns. Spec §4.6 carries a dated build note.
- Review I-1: the guard listens on the document (nav rail is outside the workspace root) and exposes
  `useGuardedNavigation()` for code that navigates itself (Korume "Open full chat"). Downloads and non-http(s) links
  are not navigations (R-1, transcript export).

- Task 14 E2E ruling (Claude, 2026-10-19): the plan's case 4 assumed an Azure 503 shows "unavailable". The reviewed
  Task 5 route maps an upstream 503 to 502 ("Could not score your take. Your recording is saved.") and keeps its
  own 503 for speech not configured. The contract stands; the E2E asserts it, and D16 (take kept, no fake score) holds.
- Task 14 override: `AZURE_SPEECH_RECOGNITION_URL` is accepted only on a loopback host and throws otherwise. The
  request carries the Azure key and the learner's audio.
- Task 11 scope: the guard confirms same-origin path navigations only; a `#hash` or another origin is left to the
  browser (beforeunload covers a full unload). Review Focus 1 holds for Back/Forward between modes (E2E 6); Back out
  of the workspace unmounts the shell and loses an unsaved take, as the spec's guard set allows.
- Open nit: after a reload, Details closes once the sentence resolves from none to 1, so an immediate click is undone.

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

Claude, 2026-10-19, after the last product edit `0f40ae49`: full vitest 692 files / 5,909 tests; practice E2E +
shadowing-workspace + summary 36/36 on a fresh build; tsc clean; no lint warning in a touched file. Owner-look
screenshots of the whole flow at 1280×529 and 1920×1080 (en + vi) were taken on that build and shared in chat;
they found the undefined `text-destructive` class (mispronounced word rendered black), fixed in `493fdd08`.

Claude, 2026-10-19 (cloud session, after the product edit `fea2ccb8`):

- `npx tsc --noEmit` 0; `npm run lint` 0 errors, 222 warnings, none in a file Claude changed; `npm run verify:protocol` valid.
- Vitest full suite: 692 files / 5,893 tests passed.
- DB gates on a fresh local stack (all 47 migrations applied by `npx supabase start`): practice (incl. two-session
  lease race), summary, dashboard, erasure, shadowing all passed. Before the stack could start, the same five passed on
  a hand-built Postgres + GoTrue + stand-in `storage` schema; the real stack run supersedes it.
- E2E `practice-pronunciation.spec.ts` 8/8, twice in a row; `shadowing-workspace.spec.ts` + `summary.spec.ts` 28/28
  (summary :29, listed as a known red, is green: its fixture now seeds the watched position D7 reads).
- Full Playwright suite: 142 passed, 43 failed, 7 did not run. Every failure is outside this branch (no changed file
  under landing, print, dictionary, kanji or the study-tools drawer) and environmental in this sandbox:
  landing-page (22, `page.goto` never reaches `load` — external assets blocked), print-vocabulary (17, "no words
  to print": no dictionary import in a fresh DB), shadowing-intelligence :94/:185/:290 and typography `kanji/[id]`
  404 (same missing dictionary). Re-run on the owner's machine, where the dictionary is imported.
- Typography gate with `(focus) shadowing/[id]/pronunciation` added (45 routes): at 1280, 1440 and 1920 the only
  finding is the environmental `kanji/[id]` 404; nav-collapsed, XL scale and dialog tests 5/5.
- Layout measure (`/pronunciation`, fresh learner): document scroll = viewport in both axes at 1280×529, 1440×900,
  1920×1080 and nav collapsed. At 1280×529 the sentence ends at y=261, the mic at 363, Replay/Play my take at 137.
  The score label, the stat strip compacting on a divider drag, and a nav-collapsed cookie that actually collapses a
  focus-chrome page were not measured.

Codex, earlier:

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
- 2026-10-19 Claude worked in a cloud container, not in `.worktrees/practice-pronunciation`: the branch was pushed
  as `claude/quirky-maxwell-h86erz` (practice-pronunciation + Tasks 11–15). Fast-forward `practice-pronunciation`
  to it before resuming locally. That container's lockfile needed `npm install` (`npm ci` refused: `@swc/helpers`
  missing from the lock on Linux); the lockfile was not changed.
- This worktree has its own ignored `node_modules` installed by `npm ci`; no parent dependency edits.

## Blockers

- Not ready to merge until the owed items in Next actions are done. No external blocker.

## Next actions

Owed before merge (Claude, 2026-10-19):

a. Done 2026-10-19: whole-branch review, two fix waves, each reviewed; APPROVE WITH NITS (N-1 recorded above).
b. Live Azure smoke (plan Task 15 step 2): `scripts/smoke/practice-pronunciation-live.ts` is not written; it needs
   the owner's Azure key and a spoken Ep.729 WAV.
c. Re-run the full Playwright suite where the dictionary is imported; only the reds named in Verification may remain.
d. Owner approval of the look, including the Task 10 toolbar icon mapping. The owner cannot open Chrome; judge
   from the screenshots shared in chat 2026-10-19 or a later set. Merge only after approval.
e. `practice-pronunciation` must be fast-forwarded to `claude/quirky-maxwell-h86erz` (owner's permission needed to
   push the feature branch from the cloud session).

History:

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
