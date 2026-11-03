# Practice playback: one play per sentence, autoplay on every sentence change — design

Date 2026-10-31. Branch `practice-listening` (B2, not merged, tip `86b61441`). Amends the practice modes' playback
(Nghe and Phát âm; Shadowing is unchanged). Owner decisions of 2026-10-31 (session 13), recorded in the ledger
`.superpowers/sdd/2026-10-26-listening-two-exercises/progress.md`.

## 1. Why

The owner, typing a sentence in Nghe: it "runs on into the next sentence" and the half-typed answer is lost. Measured
on build `86b61441` with real YouTube:
- On the old Teppei lesson (rolling auto-captions, each line ends where the line after next starts) a sentence's audio
  overlaps the next one and the UI switches sentence mid-play. Owner: old-style video, **no fix**.
- On the owner's imported lesson (`b78ce634`) the play stops at the sentence end, but the player really stops
  0–0.2 s **past** it (708.64 → 708.84). Once in 5 runs the UI then moved to the next sentence ~2.7 s later and the
  typed input was wiped; reopening the lesson resumed on the next sentence. The stopped player sitting inside the next
  sentence is the hazard.

The owner also wants practice to start by itself: every move to a sentence plays it, opening a practice mode plays the
current sentence, and nothing ever plays on or loops.

## 2. Decisions (owner, 2026-10-31)

- **D1 One play.** In Nghe and Phát âm every play is the current sentence, once, then stop. No continuous play, no
  infinite loop, no loop count.
- **D2 Replay = once.** "Nghe lại câu" (and the player's ▶ / Space) plays the current sentence from its start, once.
- **D3 No Lặp in practice.** The Lặp toggle leaves the practice replay row and the listen-only dock; the `L` shortcut
  does nothing in practice. *(Claude's reading of "nút lặp sẽ không có lặp vô tận nữa … không có chạy vô cực": a loop
  button with nothing to loop is removed. Shadowing's Sentence loop pill is untouched.)*
- **D4 Autoplay on sentence change.** Câu tiếp theo, the sentence navigator (a number, ‹ ›), and Phát âm's own
  previous/next move to the sentence **and play it once**. Scrubbing the progress bar and rewind do not autoplay.
  *(Claude's call: those are position moves, not sentence moves.)*
- **D5 Autoplay on entry.** Opening a practice mode plays its current sentence once: switching from Shadowing at
  sentence 20 to Nghe or Phát âm lands on sentence 20 and plays it; a full page load of a practice URL plays once the
  player is ready. Video shown and listen-only both; the remembered Ẩn video choice is unchanged (default: video shown).
- **D6 Stop inside the sentence.** When a play stops at the sentence end, the player is put back just inside that
  sentence, so nothing that later reads the player (UI, saved resume position) can land on the next sentence.

## 3. Behaviour details

- A recording in Phát âm (`lock.play`) blocks autoplay exactly as it blocks ▶ today; an unsaved take still blocks
  navigation (`UnsavedTakeGuard`), so no autoplay is attempted.
- Browsers may refuse sound before the learner has interacted with the page (a fresh tab). Then the player stays
  paused at the sentence start with ▶ shown; no error, no retry loop. A client-side switch from Shadowing is a click,
  so it plays.
- Check, Show answer, Thử lại and toggling Chế độ dễ do not play anything (not sentence changes).
- Rate (0.75× / 1×) is kept across autoplay.
- Returning to Shadowing restores its own session loop exactly as today (`usePracticePlayback`).

## 4. Tests the design requires

Unit (controller): in a sentence-bound mode, `nextSentence` / `previousSentence` / `seekToSentence` play the target
once; `seekTo` and `rewind` do not; `lock.play` blocks the autoplay; a boundary pause seeks the player to just inside
the sentence (`end - 0.001`) and the published sentence stays the played one; Shadowing (not sentence-bound) keeps
today's behaviour (no autoplay on navigation, loops as configured). Component: no Lặp button in `ReplayLoopRates`
in practice; `L` is a no-op in practice. E2E (×1, fake YouTube): Next sentence plays the new sentence and stops at
its end with the input kept; entering Nghe from Shadowing at sentence N plays sentence N; a stopped play leaves the
current sentence unchanged after a further 3 s. Mutations RED for: autoplay on navigation, no autoplay on scrub, the
seek-back on stop, the Lặp removal.

## 5. Constraints

Owner DB untouched (no data change); build and serve only in the worktree; tokens and classes that exist; desktop
1280×529; every test seen RED; E2E ×1 (Ruling C1).
