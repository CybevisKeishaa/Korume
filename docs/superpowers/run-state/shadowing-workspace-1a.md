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
  T4a `a4020dc` · T4b `8c6c083` · T5 `e643374` · T6a `22cff1e` · T6b `1822788` · T7 `7dd2036` + review fix `e1514ed` · T8 (header). Per-task evidence (REDs, mutations,
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

- T9 (Codex, then Claude): first pass by Codex. Review CHANGES REQUIRED: 4 Important, plus 2 Important found only
  in the real browser:
  - a 225px grid gap at the divider max (the `auto` track absorbed flex < 1);
  - the player ⛶ fullscreened the slot, Live Sentence included.

  Fix pass by Codex, which hit its usage limit; Claude finished it. That included a vacuous `/\bauto\b/` test
  regex, PiP control wrap and measured tokens. The re-review's nits were fixed as well (nested-fullscreen focus
  per level, Escape-while-fullscreen and real-drag tests).

  Evidence:
  - 10 mutations red.
  - Gates 0.
  - Browser Ep.729 1280×529 (`ws-9.mjs`): page never scrolls, 1 iframe throughout; grid at max `964/7/284`;
    divider arrows leave the sentence; PiP 284×267 with all controls; second ⛶ click exits with focus back;
    player fullscreen video 802×451.
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
  re-run after the last edit. CSS fixes browser-checked later in the T8 pass (one ring on the row body,
  current-row bg under focus-within, idle actions `pointer-events: none`).
- T8 (Claude, no Codex): tsc/lint/protocol 0, full vitest 430 files 0; 13 mutations red. Browser Ep.729
  1280×529 (`ws-8.mjs`): header 44px, no page scroll, Live Sentence JP line visible; counter follows ⏭;
  bookmark survives reload; one Escape closes Save's panel, the next the popover (focus back on ⋯); .srt
  download 282 blocks. Review: APPROVE WITH NITS (0C/1I/6M) — Save panel overlapped Download (measured,
  fixed: anchored beneath the popover), revoke delay 10 s; Focus Mode carried to T9 (below).

- T10 (Claude, Codex at its usage limit; owner 2026-10-02: "do all remaining tasks, Codex when it is back"):
  reading presets × atmospheres as CSS tokens, ⚙ popover (13 settings), Study Environment, shortcut hint sheet,
  AtmosphereLayer, Mincho via `next/font` on the workspace only. Contrast gate 4 × 7 × 3 emphases on the
  effective surface; it went red on its first run (warm_cream muted on the current-row tint 3.4–4.4:1, sepia
  accent 4.3:1) and the tokens were fixed, not the bar. Gates 0 (435 files / 3982 tests); 9 mutations red
  (pref effects ×2, focus steal, reduce motion, size attr, hint initial state, contrast pair named, particle
  CSS, atmosphere colour). Browser Ep.729 1280×529 (`ws-10.mjs`): XL = ×1.25 (21.33→26.67px), Airy 2.1,
  Mincho loaded, header 44px no overflow, page never scrolls, settings popover 486px tall and scrolls, one
  Escape closes the Select listbox only and the next the popover, speed label 0.75× after a reload, every
  choice survives reload, atmosphere layer z −10 behind content (hit-test lands on rows), 0 console errors.
  Also fixed the T9 leftover: `setLoop` no longer calls the controller inside a setState updater.
- T10 review (independent): CHANGES REQUIRED 0C/2I/5M — all fixed in `fix(shadowing): T10 review` (3 mutations red).
- T11 (Claude): deterministic e2e 13/13 (×3 repeats 36/36 before test 13 was added), hub + explore 8/8, live
  Ep.729 2/2 on a fresh `db reset` (all four `verify:db:*` 0). Boundary latency, 8 consecutive boundaries at 1×:
  deltas −0.1…0 ms (max 0, p95 0; an earlier run max/p95 14.6 ms = one frame) — the row changes in the same
  animation frame the player's clock crosses the line start, because both read `getCurrentTime()` in rAF
  (T0). Not vacuous: the threshold mutated to −1 goes red; a missing/foreign `EP729_VIDEO_ID` fails "fixture
  missing". Found and fixed on the way:
  - **T2 regression (Critical):** `VIDEO_COLUMNS` gained `channel_title` but is also selected from the
    `learner_videos` view, which lacked it → the Hub and Explore 500'd (`42703`). Fixed in the view's migration
    (edited in place) + `lib/data/videos.columns.test.ts` (mutation red). Every unit test was green: they mock
    PostgREST.
  - **Stale bootstrap (spec §4.3, measured):** a setting changed then an immediate client-side leave/return came
    back stale 3/3 (0/3 after a 3 s wait) — `router.refresh()` lost mid-flight. `staleTimes` cannot fix it (Next
    back/forward always reads the router cache), so `workspace-context` now layers this tab's own writes over
    the bootstrap and forgets each once a bootstrap agrees (3 mutations red; e2e test 7 was the natural RED).
  - Post-seek clock (T5 guard, measured live): before the first play the real API keeps reporting the
    pre-seek time (0) after `seekTo(700)`, while the app shows 700; Play then starts at 700.x. The app's store,
    not `getCurrentTime()`, is the truth while unstarted — the guard and the store already behave that way.
  - T7 carry-forward closed in the browser (test 13): the translation sits above the stretched row button and
    is selectable; "Back to current" from the keyboard focuses the current row (both mutation-checked).
  - Known flake, not this branch: `shadowing-explore.spec.ts` "seeded shelf card…" timed out 2/3 alone on this
    build and 1/3 on a master build (`4c2d983`, throwaway worktree) at the same step (waiting for "Add to My
    Lessons"); 8/8 on the fresh-DB run.
- T11 review (independent): CHANGES REQUIRED 0C/3I/9M. Fixed in `fix(e2e): T11 review`: I-1 a rollback that
  lands after leave-and-return now reaches the mounted providers (broadcast; mutation red); I-2 the live
  latency is now measured against the media crossing extrapolated from per-frame (now, currentTime) samples —
  Ep.729 8 boundaries 6.2–18.8 ms (max = p95 18.8), iframe clock update median 8 ms / max 20 ms; I-3 test 7
  reloads and re-asserts (server persistence, not the overlay); M3 one-definition guard; M9 env check in
  beforeAll; M1 race noted in the overlay comment. Kept (accepted): M2 `resetTabWritesForTests` (precedent:
  `resetSchedulerForTests`), M4/M5/M6/M7/M8 (pre-existing or test-data hygiene, no defect).

### Carried forward (open, owned by a later task)

- **Done in T9:** Focus Mode now lays out the focus view, and the shell's Escape handler honours
  `defaultPrevented`. Browser-proven: Escape with ⋯ open in focus view closes only the popover.
- **Open (non-blocking, T9 re-review):** `PlaybackRoot` calls `controller.setLoop` inside a `setState`
  updater. It is idempotent, so it is harmless under StrictMode, but it is impure; make it pure if that code
  is touched again.
- **T9/T11 (from T7 review):** browser-check translation text selectable under the stretched row button
  and Back-to-current keyboard focus (the other row CSS was measured in the T8 pass). Known quirk, accepted: the per-line あ press flips the
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

- T12 (Codex, reviewed by Claude: one doc fix — the Translation language options were restored with a
  deferral note). Full gate 2026-10-02 on a fresh `db reset`: verify:db lesson-jobs/settings/pronunciation/
  shadowing 0/0/0/0; tsc 0, lint 0, protocol 0, vitest 0 (433 files / 3943 tests after the legacy deletions);
  `npm run build` 0; deterministic e2e 13/13; hub + explore 8/8; live Ep.729 2/2 (lesson
  `f885cf07-d6f5-4e01-b38c-236008b2a0a3`), boundary latency 8.7–15 ms (max = p95 15), clock update median 8 ms.

### T12 parity checklist

| Capability | Evidence |
| --- | --- |
| Player controls | T6 `components/shadowing-workspace/workspace-player.test.tsx`; e2e 2 and 11 (`tests/e2e/shadowing-workspace.spec.ts`) |
| Resume | e2e 4, 5, and 6; live Ep.729 acceptance (`tests/e2e/shadowing-workspace.live.spec.ts`) |
| Transcript sync | e2e 2; live Ep.729 latency acceptance (`tests/e2e/shadowing-workspace.live.spec.ts`) |
| Mining / pin | `components/shadowing-workspace/transcript-panel.test.tsx` — “renders Mine and Pin to journal controls in a transcript row” |
| Speed / loop | T6 `components/shadowing-workspace/workspace-player.test.tsx`; e2e 3 |
| Persistence | e2e 7 |
| Player-error overlay | `components/shadowing-workspace/workspace-player.test.tsx` — “replaces the centre button with an alert when the embed fails” |
| No-transcript empty state | T4 `components/shadowing-workspace/shadowing-mode-body.test.tsx` |
### T12 dead-code audit

**Audit:** `shadowing-view.tsx` + test — 0 external importers; `playback-controls.tsx` + test — 1 legacy importer (`shadowing-view.tsx`), 0 surviving; `transcript-pane.tsx` + test — 1 legacy importer (`shadowing-view.tsx`), 0 surviving. All deleted.

## Working tree and environment

- Worktree `.worktrees/shadowing-workspace-1a`; `.env.local` copied; `npm ci` run 2026-10-01.
- Codex: never commit (sandbox ACL), never run Playwright, never build or `next start`.
- Port 3000 may hold an orphan `next start` from the `pronunciation-show-more` worktree; Claude uses it
  for T0 probing only, and kills it before T11.
- Local DB holds Ep.729 (`videos.id = f885cf07-d6f5-4e01-b38c-236008b2a0a3` since the T12 gate reset, 2026-10-02); any
  `db reset` wipes it — re-seed with `npx vite-node --config vitest.config.ts scripts/seed-real-lesson.ts -- --dir
  "C:/Users/tplon/Desktop/Japan/Korume/shadowing" --youtube Fwj3tH4Uls8` (keeps the uuid on a re-run).
- `npx supabase db reset` on this branch is approved by the owner.

- Owner: Claude

## Blockers

- none (T0 recorded above; T3–T5 unblocked).

## Next actions

1. Done: T7 review plus T9-T11 workspace acceptance, including the T2 regression and stale-bootstrap fixes.
2. Done: T8 header (`feat(shadowing): workspace header, …`), built by Claude without Codex.
3. Next: whole-branch review.
