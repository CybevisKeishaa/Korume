# Branch Run State

Branch `shadowing-workspace-1a`.

## Goal and scope

Shadowing workspace Part 1a: the core Shadowing loop at `/[locale]/shadowing/[id]`, ported from Figma
`105:3088`, proven live on the real Ep.729 lesson. Web only. Parts 1b/2/3/4 are separate branches.

## Authorities

- Spec (locked): `docs/superpowers/specs/2026-10-01-shadowing-workspace-part-1a-design.md` @ `8c8f2f6`
- Plan: `docs/superpowers/plans/2026-10-01-shadowing-workspace-part-1a.md` @ `5cec887`
- Packets: `.superpowers/sdd/shadowing-workspace-1a/<task>-brief.md`
- `AGENTS.md`, `docs/lessons.md`, `.codex/docs/workflow.md` §8

## Accepted commits

- `6ec1133` `8c8f2f6` spec · `e8d4b13` `797b35e` `5cec887` plan · Task 1 (this commit)

## Contracts and decisions

- Owner rulings in spec §2 (Q1–Q5, architecture option 1, lesson bookmark) and §3 deviation register.
- 2026-10-01 header source line = option (b): nullable `videos.channel_title` from oEmbed `author_name`,
  fallback `YouTube · N3 · 23 min`; no render-time oEmbed; no backfill.
- Execution (owner, 2026-10-01): two-harness. Claude does T0 and T11; Codex does T1–T10 and T12 from
  packets; Claude reviews after every task and commits (`Co-Authored-By: Codex`); whole-branch review at
  the end. T1–T2 may run while T0 runs; **T3/T4/T5 wait for T0's recorded ruling below**. T12 removes
  `ShadowingView` only after parity + deterministic e2e + live Ep.729 gates.

### T0 — YouTube clock and paused initialisation (Claude, 2026-10-01, measured)

Probe: headless Chrome (`channel: "chrome"`), real IFrame API, Ep.729 `Fwj3tH4Uls8`, origin
`localhost:3000`, 10 s rAF sampling per rate. Throwaway files in the session scratchpad.

- **`getCurrentTime()` is interpolated, not 250 ms-stepped:** value changed 1442 times in 10 s at 1×
  (median gap 6.9 ms, p95 7.3 ms, max 8.7 ms) and 1440 times at 0.75× (median 6.9, max 8.9) — i.e. every
  animation frame. The existing 250 ms `setInterval` tick is therefore the only thing that could miss
  300 ms; the clock itself is frame-accurate.
- **Ruling — clock source:** while PLAYING, read `getCurrentTime()` in a `requestAnimationFrame` loop
  (store-only writes; React re-renders only on sentence change). Stop the loop when not PLAYING.
  Keep `onTick` (250 ms) unused by the workspace; other callers keep it.
- **Paused initialisation:** all three candidates stayed paused at exactly 612.34 s until `playVideo()`
  (states: `-1 → 3 → -1` for seekTo variants, `-1 → 5 (CUED)` for `cueVideoById`), and the first play
  started from ≈612.3 s (2.3–2.5 s later at ≈614.5–614.7).
- **Ruling — initialisation call:** in `onReady`, `seekTo(position, true)` then `pauseVideo()`. It uses
  only existing `YtPlayerLike` members, so `cueVideoById` is NOT added (plan Task 5 marked it optional).
- Available rates on this video: `[0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]` (0.25 is not in
  `PLAYBACK_RATE_OPTIONS`; `setRate` clamps to the intersection).
- Not measured here: unmuted autoplay (the workspace only plays on a user gesture, so it is not needed).

## Verification

- Task 3 (Codex): test files were written before production modules. The prescribed bare-node focused command exited 1 before Vitest (`node` is not on this shell PATH); the usable local equivalent `& 'C:\nvm4w\nodejs\node.exe' node_modules/vitest/vitest.mjs run lib/shadowing-workspace --reporter=dot` exited 0 twice (13 files, 42 tests), once after all restores. Mutations each red then restored: lookup `<=`â†’`<` (two sentence boundary assertions); stale keyed rollback (latest-success test); server/session `>`â†’`<` (arbitration + invalid-winner tests); remove slider selector (interactive-target test). `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/verify-codex-protocol.ps1` â†’ 0. Report: `.superpowers/sdd/shadowing-workspace-1a/task-3-report.md`. Claude-only: full suite, tsc, lint, full protocol, review, commit.

- Task 1 failure-first: `npx vitest run supabase/migrations --reporter=dot` — exit 1 before SQL; shell could not resolve `npx`, so Vitest did not start.
- Task 1 mutation: renaming `create table sentence_marks` to `sentence_marks_broken` made the local migration test exit 1 on the exact table assertion; restored.
- Task 1: local-node equivalent of `npx vitest run supabase/migrations --reporter=dot` — exit 0 (8 files, 39 tests).
- Task 1: full Vitest, `tsc --noEmit`, and lint each had no exit code because this environment ended commands at 30 seconds; Claude must run the prescribed commands.
- Task 1: `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/verify-codex-protocol.ps1` — exit 0 (`Codex protocol: valid`).
- Task 1 (Claude review): Codex's "failure-first" never ran (no `npx` in its shell); the table-rename
  mutation stands in as the seen-failing proof. Claude ran: tsc 0, lint 0, protocol 0; full vitest
  first RED 2 tests in `lib/user-export/tables.test.ts` — the two new user-owned tables were not in the
  GDPR export registry. Fixed by Claude: `lib/user-export/tables.ts` + paging keys in
  `lib/data/user-export.ts` + counts 28→30 / 30→32 in the test; then vitest green.
- Task 1 live: fresh `npx supabase db reset` 0; `verify:db:shadowing` 0, `lesson-jobs` 0, `settings` 0,
  `pronunciation` 0. Mutation: removing the sentence_marks insert `exists` → gate exit 1 at
  `FAIL 4: B marked A private line`; restored → 0.

- Task 1 independent review (code-reviewer): CHANGES REQUIRED, 0 Critical / 2 Important / 5 Minor,
  all fixed by Claude: I-1 gate F6 could not fail (NULL <> x, non-strict select, perform) → strict
  select, `is distinct from`, asserts `state = succeeded`; I-2 a >200-char oEmbed author would fail the
  whole lesson on the CHECK → finalize stores `left(nullif(btrim(x, E' 	
　'), ''), 200)`
  (M-1 full-width blank → null), live cases for 201 chars and whitespace-only; M-2 bookmark spoof/update
  cases added to gate 6/7; M-3 case 9 asserts the rows exist first; M-4 comment reworded.
- Task 1 final: mutation `channel_title → null` in finalize → lesson-jobs gate exit 1
  (`F6 channel title was <NULL>`); restored. Fresh reset; verify:db lesson-jobs/shadowing/settings/
  pronunciation all 0; tsc 0, lint 0, protocol 0, vitest 0 (3700 tests).

- Task 2 (Codex resume): focused data/API test batch exited 1 as expected before fix because an insert `42501` refusal was returned as success. Removing that success case made the focused marks/routes batch pass (13 tests); required mutation restoring it exited 1 at the 404 assertion and restore passed. Pipeline/store/worker/videos/progress: 0 (5 files, 104 tests); preferences/transcripts/marks/bookmarks/routes: 0 (7 files, 41 tests); VideoRow fixture tests: 0 (5 files, 76 tests); videos/bookmarks: 0 (13 tests). No-row resume/bookmark mutations both failed, then restored and passed. `git diff --check`: 0; `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/verify-codex-protocol.ps1`: 0 (`Codex protocol: valid`). Full Vitest, tsc, lint, protocol, reset/lesson-jobs, independent review, and live embedded-filter verification remain Claude-only. Report: `.superpowers/sdd/shadowing-workspace-1a/task-2-report.md`.
- Task 2 command ledger: `node node_modules/vitest/vitest.mjs run lib/data/preferences.test.ts lib/validation/preferences.test.ts lib/data/transcripts.test.ts lib/data/videos.test.ts lib/data/sentence-marks.test.ts lib/data/lesson-bookmarks.test.ts app/api/sentence-marks/route.test.ts app/api/videos/[id]/bookmark/route.test.ts app/api/videos/[id]/progress/route.test.ts --reporter=dot` -> 1 (expected audit RED); marks/routes -> 0; marks mutation -> 1; marks restore -> 0; pipeline/store/worker/videos/progress -> 0 (104); preferences/transcripts/marks/bookmarks/routes -> 0 (41); VideoRow fixtures -> 0 (76); videos/bookmarks -> 0 (13); videos/bookmarks mutations -> 1; restore -> 0; `git diff --check` -> 0; `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/verify-codex-protocol.ps1` -> 0. Exact expanded commands: `.superpowers/sdd/shadowing-workspace-1a/task-2-report.md`.

- Task 2 (Claude review): Codex run 1 stopped at its usage limit; run 2 resumed the partial tree
  (174k tokens). Claude fixes: oEmbed author >200 code points is truncated (was nulled; matches the plan
  and finalize's `left(…,200)`); `author_name` missing/non-string → `authorName: null` in
  `lib/youtube/oembed.ts` (was a whole-job `metadata_unavailable`); `options.test.ts` defaults pin gained
  the 14 new fields (full vitest had 1 red); Codex's unrequested `docs/lessons.md` edit reverted.
  Independent review: 0 Critical / 2 Important / 7 Minor-nit, all test gaps — added: unknown insert/delete
  error throws (marks + bookmarks), `!inner` select pinned, bookmark insert/delete/read shape,
  `getMyLessonResume` user/video filters, route 400 for bad uuid / unknown kind. Mutations, each red then
  restored: drop `!inner`; swallow insert error; drop resume `video_id` filter.
  Live: embedded filter `transcript_lines!inner(transcript_id)` against local PostgREST with a temp auth
  user — transcript A returned exactly its two marks in (line, kind) order, transcript B's mark absent;
  temp user deleted. `verify:db:lesson-jobs` 0 (no SQL change in Task 2, so no reset).
- Task 2 final (after the last edit): tsc 0, lint 0, protocol 0, vitest 0 (402 files, 3738 tests).

- Task 3 (Claude review): Codex 129k tokens; its failure-first RED was never observed (bare `node`
  missing in its shell — packets now name `C:/nvm4w/nodejs/node.exe`); its 4 plan mutations stand in.
  Full gates found `tsc` red (loop-machine test `state` typed as `{sentenceIndex: number}`) — fixed.
  Independent review: 1 Critical (that tsc) / 2 Important / 8 Minor. Fixed: exactly-1.5 s ⏮ test;
  `nextTarget(null)` → first line (⏭ during an intro; was a no-op); shortcut guard adds ARIA widget roles
  and excludes `contenteditable="false"`; keyed mutator survives a throwing `apply`/`rollback` and stays
  pending until the latest settles (tested); coalescer never writes a non-finite position; SRT end never
  precedes start + hour formatting test; NFD search test made explicit. Not changed (nits): redundant
  `> duration` check, extra session-record cases, `localeCompare` tie-break.
  Mutations, each red then restored: `>`→`>=` in ⏮; `nextTarget(null)`→null; drop `:not(contenteditable=false)`;
  drop finite guard; drop SRT `Math.max`.
  **Note for Task 9:** `isInteractiveTarget` treats anything inside `[role="dialog"]` as interactive — Focus
  Mode / fullscreen must not render the workspace inside a `role="dialog"` or every shortcut goes dead.
- Task 3 final: tsc 0, lint 0, protocol 0, vitest 0 (415 files, 3783 tests); keyed-mutations test re-run after its lint fix.

## Working tree and environment

- Worktree `.worktrees/shadowing-workspace-1a`; `.env.local` copied; `npm ci` run 2026-10-01.
- Codex: never commit (sandbox ACL), never run Playwright, never build or `next start`.
- Port 3000 may hold an orphan `next start` from the `pronunciation-show-more` worktree; Claude uses it
  for T0 probing only, and kills it before T11.
- Local DB holds Ep.729 (`videos.id = 85351ebd-714e-44af-9ba0-89efd8589c00`, re-seeded after the T1 review resets); any `db reset` wipes it —
  re-seed from the session scratchpad script until Task 11 ships `scripts/seed-real-lesson.ts`.
- `npx supabase db reset` on this branch is approved by the owner.

- Owner: Codex

## Blockers

- none (T0 recorded above; T3–T5 unblocked).

## Next actions

1. Codex: Task 4a (bootstrap DTO, loader, position store, contexts/hooks) from
   `.superpowers/sdd/shadowing-workspace-1a/task-4a-brief.md`. Plan Task 4 is split 4a/4b for Codex's
   ~288k context window; 4b = route group, shell, legacy page removal, messages, token-scale.
2. Claude: review 4a, gates, commit; dispatch 4b (packet already written); dev-server check after 4b.
