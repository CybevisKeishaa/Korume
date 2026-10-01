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

- `6ec1133` `8c8f2f6` spec · `e8d4b13` `797b35e` `5cec887` plan · T1 `7f1d4bf` · T2 `2b18574` · T3 `a623da5` ·
  T4a `a4020dc` · T4b `8c6c083` · T5 `e643374` · T6a `22cff1e` · T6b `1822788`. Per-task evidence (REDs, mutations,
  review verdicts and what each closed) is in those commit messages.

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

Every accepted task above ended with tsc 0, lint 0, `verify:protocol` 0 and full vitest 0 (after T5:
423 files / 3858 tests; vitest runs `--minWorkers=1 --maxWorkers=2` — see Working tree). Each had an
independent `code-reviewer`; fixes were re-reviewed when they touched logic (the T5 re-review caught a
regression the fixes introduced). DB gates after T1/T2: fresh reset, `verify:db:shadowing`,
`lesson-jobs`, `settings`, `pronunciation` all 0. Browser checks (worktree `next dev -p 3001`, temp auth
user, Playwright Chrome at 1280×529, script in the session scratchpad `ws-check.mjs` / `ws-6a.mjs`):
T4b route + shell, T6a player (video 485×273, Live Sentence slot y=378, no scroll).
- T7 (Claude, Codex at limit): tsc/lint/protocol 0, full vitest 427 files 0; browser Ep.729 282 rows, current row
  centred (offset 0), pill clears, page 1280×529 no scroll. Review: 0C/4I/9M, all fixed by Claude
  in `fix(shadowing): T7 review` (every fix mutation-proven red). Re-review: 0C/1I (I-A: a `has-[]` pin
  the M-5 fix added would keep a mined row's toolbar up for the session — removed) + minors fixed; gates
  re-run after the last edit. NOT browser-checked (Docker off): the CSS-only fixes M-3/M-4/M-5/M-7 are
  proven only by a Tailwind compile — T9/T11's Playwright pass must look at them.

### Carried forward (open, owned by a later task)

- **T9/T11 (from T7 review):** browser-check the transcript row CSS (current-row warm bg under
  focus-within, a single focus ring on the row body, hidden actions not tappable, translation text
  selectable) and Back-to-current keyboard focus. Known quirk, accepted: the per-line あ press flips the
  row's VIEW mode (`hidden` in normal view), so an override made in one view can look like a no-op in the
  other while still showing pressed (honest). Not fixed (low risk): a no-op skip while a smooth scroll is
  mid-flight leaves that scroll running to the previous row.

- **T11:** prove live on Ep.729 that `getCurrentTime()` right after `seekTo` does not return the pre-seek
  time (T5's post-seek guard is defensive; T0 never measured it). Prove the §4.3 stale-bootstrap mechanism
  (`router.refresh()` after a successful write) with a client-side leave-and-return; if browser Back still
  restores a stale payload, add `experimental.staleTimes.dynamic = 0`.
- **T9:** `isInteractiveTarget` treats anything inside `[role="dialog"]` as interactive — Focus Mode /
  fullscreen must not render the workspace inside a dialog. The loop pill and speed label keep their own
  copy of state: an `L` shortcut (or YouTube's own controls) will not update them — lift into PlaybackRoot.
- **T10:** speed label starts from the preference, not the rate `onReady` snapped to; `muted` starts false
  even if the embed starts muted.
- **Owner question (T6b review, a11y):** toggles whose accessible name follows their state AND carry
  `aria-pressed` (Live Sentence hide-Japanese, subtitle toggle, mute) read as "Show Japanese, pressed" — the
  ARIA practices advise one or the other. Built as the plan specifies; flip to fixed names if the owner agrees.
- **Accepted gaps:** duplicate `start_time` lines — controller pins the earlier, `useCurrentSentence` shows
  the later; a PLAYING queued between `pause()` and PAUSED can show the next line for one frame.
- **Plan corrections so far:** no `lucide-react` in the repo (inline SVG glyphs); `lib/data/transcripts.test.ts`
  and the progress-route test were new files; `LessonCreationContent` lives in `store.ts`; token-scale scans
  `(workspace)` only, not all of `(focus)/shadowing`; transcript `!ok` keeps the lesson on its empty state.

## Working tree and environment

- Worktree `.worktrees/shadowing-workspace-1a`; `.env.local` copied; `npm ci` run 2026-10-01.
- Codex: never commit (sandbox ACL), never run Playwright, never build or `next start`.
- Port 3000 may hold an orphan `next start` from the `pronunciation-show-more` worktree; Claude uses it
  for T0 probing only, and kills it before T11.
- Local DB holds Ep.729 (`videos.id = 85351ebd-714e-44af-9ba0-89efd8589c00`, re-seeded after the T1 review resets); any `db reset` wipes it —
  re-seed from the session scratchpad script until Task 11 ships `scripts/seed-real-lesson.ts`.
- `npx supabase db reset` on this branch is approved by the owner.

- Owner: Claude (T7 review fixed; T8 next)

## Blockers

- none (T0 recorded above; T3–T5 unblocked).

## Next actions

1. Done: T7 review fixed (`fix(shadowing): T7 review`).
2. Next: dispatch T8 (header) — packet `task-8-brief.md` ready (Codex, or Claude if Codex is limited) → T9 → write T10 packet.
