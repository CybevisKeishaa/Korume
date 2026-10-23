# Listening: word pieces, drag to insert, video on by default, progress strip — design

Date 2026-10-23. Branch `practice-listening` (B2, not merged). Amends the B2 spec
`docs/superpowers/specs/2026-10-15-shadowing-practice-modes-design.md` (§5) and the owner rulings recorded during Task 9c.
Figma frame `123:2835` (file `IwFHZDZdHW7qsSFiNbWrkd`) stays the composition authority for the panel.

## 1. Why

At the first Chrome look of the Figma pass (Task 9c, 2026-10-23) the owner asked for four changes:

1. **Smaller pieces.** Word Bank cuts a line into at most 8 phrase chunks (`検索すると / お店を / 思うんですけど`). The owner
   wants one piece per word, as the frame shows (ご / あ / が / ざ / とう …): `お / 店 / を / 検索 / する / と / 思う / ん / です / けど。` (punctuation rides on the word before it).
   Smaller pieces make the puzzle a real listening exercise instead of a three-piece shuffle.
2. **Drag to insert, tap to remove.** With many pieces the learner must be able to put a piece *between* two placed
   pieces and take one out with a single tap. This replaces the Task 9c ruling "tap selects + Remove Selected Word".
3. **Video visible by default.** The listen-only cover ("Chỉ nghe / Hiện video") is on by default today; the owner
   wants the video shown. Burned-in subtitles that reveal the answer are acceptable: "người học sẽ tự hiểu họ cần và
   nên làm gì".
4. **The frame's bottom progress bar**, for looks only. Agreed alternative (owner 2026-10-23, "Được đấy"): no new
   fixed bar; the existing lesson stat strip under the video takes the bar's look and content.

## 2. Goals, non-goals, anti-goals

Goals
- Word Bank pieces = words, as the Japanese tokenizer (kuromoji, already used by the chunker) cuts the line.
- Placing a piece anywhere in the answer, removing any placed piece with one tap, reordering placed pieces.
- Listening opens with the video visible; the app's own subtitle surfaces stay concealed until Check / Show answer.
- The stat strip looks like the frame's bottom bar (orange progress line + four stats) in Pronunciation and Listening.

Non-goals
- Typing format: unchanged (its hint unit already works per chunk / 4 graphemes; see §3.6 for the hint unit only).
- The "Optional reports" section and the other frame cards under the video: still out (D1/D3).
- Re-scoring stored attempts. Stored scores stay as they were scored.

Anti-goals (a failure even if it works)
- A piece list so long it does not fit the panel at the owner's 1280×529 viewport without scrolling the bank out of
  sight for an ordinary subtitle line.
- Drag as the *only* way to place a piece (a learner without a precise pointer or on a keyboard must finish a line).
- Any answer leak while answering through the app's own surfaces (subtitle overlay, transcript, CC, feedback text).
- Word Bank drifting back to long phrases through a piece cap or a merge rule (owner review 2026-10-23).
- Losing the learning feedback layer: P14 messages and the small Korume after Check / Show answer (§3.8).
- Praising a hinted or wrong piece, or a score the client computed.

Owner review 2026-10-23 (second pass, pasted into the session): approved the direction and asked for §3.1 no cap,
§3.2 identity by index, §3.3 I1 closure, §3.4 server-side LCS with duplicate and hint tests, §3.5 no player remount
and the D19/E2E amendment, §3.7 a position marker that does not read as completion and real-data stats, §3.8.

## 3. The design

### 3.1 Pieces (chunker v2) — owner decided the granularity
- New chunker **version 2** beside v1 (`lib/dictation/chunk.ts`, `CHUNKERS[2]`, `CURRENT_CHUNKER = 2`). v1 stays
  registered unchanged: stored attempts reference their version (the file's own rule: a version is never edited once
  an attempt references it; v1 is now referenced by real attempts).
- v2 = one piece per **kuromoji token** (a dictionary word: `検索` is one piece), after the same normalisation and
  the same reliability checks as v1 (mismatch, latin/digit, unknown token → unreliable → Typing fallback with the D9
  notice, unchanged). It is **never** a split per Unicode character. Pieces show the line's original characters
  (`display` from raw `text_jp`, P13), not the normalised text.
- Deterministic and versioned: v2 depends only on the line text and the installed kuromoji dictionary (pinned by the
  lockfile); the server re-chunks with the attempt's stored `chunker_version` to score, as v1 does. A future rule
  change ships as v3, never as an edit of v2 once an attempt references it.
- **Punctuation is never a piece (owner 2026-10-23):** `。、！？…` and closing brackets bind to the piece before them
  (`けど。`); an opening bracket binds to the piece after it; a line-initial run of punctuation binds forward (as v1
  R18). The owner's `"` rule (odd opens, even closes) carries over. **What counts as punctuation (controller's call,
  frozen with v2):** every kuromoji `記号` token (so `♪ 〜 → ※` too) and every token made only of `PUNCTUATION`
  characters (`listening-score.ts`) — the same set v1 already attached to a neighbour. Openers (`「『（(【`, an opening
  `"`) bind forward; everything else binds to the piece before. The measured numbers below were re-counted with this
  exact set (unchanged: median 8, max 20). The owner's full example:
  `お店を検索すると思うんですけど。` → `お / 店 / を / 検索 / する / と / 思う / ん / です / けど。`
- Prefix: the owner's example splits `お / 店`, so a 接頭詞 token is its own piece.
- **No piece cap and no merging (owner review 2026-10-23).** Measured on the local DB's 875 non-empty transcript
  lines (494 without Latin letters or digits, i.e. the lines Word Bank serves; kuromoji tokens minus punctuation-only
  tokens): median 8 pieces, p75 10, p90 12, p95 13, p99 17, max 20; 1.4% of lines exceed 16, none exceed 20. So v2
  keeps every token as a piece. The panel must hold the longest real line (20 pieces): tray and bank wrap onto
  several rows and the practice panel scrolls (it already scrolls). Acceptance: a Chrome trial at 1280×529 with the
  longest real line and a median line, screenshots in front of the owner before the branch is merged. If that trial
  shows a real problem, the remedy is a layout change (smaller chip padding, bank collapse), brought to the owner
  and reviewed — not a merge back into long phrases.
- A line with fewer than 2 pieces is unreliable (`single_chunk`), as today.
- Since no piece is punctuation-only, every piece is scored and hintable alike.

### 3.2 Answer model — a sequence, not fixed slots
- The answer is an ordered list of placed pieces (no empty numbered slots, as in the frame). "N words remaining" =
  pieces still in the bank.
- Hints (D10 unchanged in meaning): each Hint locks the next correct piece **at the start** of the answer, after the
  already-hinted ones. Because D10 takes the lowest unhinted piece, hinted pieces always form a locked prefix
  `0..k-1`. If that piece was already placed elsewhere, it moves into the prefix. Locked pieces cannot be removed or
  moved; nothing can be inserted before or between them.
- Check is enabled when every piece is placed (as today: a full arrangement is submitted). The request body is
  unchanged in shape: `chunkOrder` = piece indices in answer order, `version` = 2.
- **Identity:** a piece is identified by its index in the chunker output, never by its text. Two pieces with the same
  text (two `を`) are two pieces with two ids: React keys, drag payloads, hint locks and `chunkOrder` all use the
  index.
- Server validation for v2 (in addition to today's: full permutation, version known, line unchanged): the hinted
  indices are exactly `0..k-1` and sit at answer positions `0..k-1`; anything else is rejected `400`.

### 3.3 Interaction
- **Drag** a bank piece into the answer: a drop indicator shows the insertion point between placed pieces; drop
  inserts there. Drag a placed piece to reorder it. Drop outside the answer returns it to the bank (placed piece) or
  does nothing (bank piece).
- **Tap** a bank piece: appends it at the end of the answer.
- **Tap** a placed (non-hinted) piece: returns it to the bank. "Remove Selected Word" and the whole selection state
  are deleted from the code (not hidden).
- **Closes Task 9c review finding I1** (a stale selection resurfacing on a chip the learner never tapped) only when
  (a) no selection state remains in `word-bank-panel` (grep with a positive control, L-019), and (b) a regression
  test drives the I1 sequence on the new model — place X, place piece 0, Hint (piece 0 moves into the locked prefix),
  place X again — and asserts that tapping a placed piece removes exactly that piece and nothing else, and that no
  placed piece reports a pressed/selected state. Seen RED against 0665d585's selection logic or an equivalent
  mutation. B2 does not merge before this.
- **Keyboard / single pointer alternative to drag** (WCAG 2.1.1, 2.5.7): Enter/Space on a bank piece appends it; on
  a placed piece removes it; **Alt+ArrowLeft / Alt+ArrowRight** on a focused placed piece moves it one place (focus
  follows the piece). A polite announcement says the new position ("お, position 3 of 10"). Inserting in the middle by
  keyboard = append, then move.
- Drag implementation: native pointer events or an already-installed library — the builder checks `package.json`
  first; no new dependency without the owner. Touch is not required (desktop-only web app).
- After Check / Show answer the answer is locked; correct / wrong / hinted tones as today (colour + non-colour cue).

### 3.4 Scoring (Word Bank, v2 attempts)
- **Server-side only**, as today: the client sends `chunkOrder` + `hintedUnits`; the server re-chunks the line with
  the stored version, validates, scores and stores. The client never sends or computes a score.
- A placed piece counts as **correct** if it belongs to the longest subsequence of the answer that is in the
  reference order — an LCS between the answer's piece **texts** and the reference piece texts, so two identical
  pieces (`を`, `は`, `です`) are interchangeable. Example: reference `A B C D`, answer `B C D A` → `B C D` correct,
  `A` wrong (positional scoring would mark all four wrong). Ties between equally long LCS alignments are broken
  deterministically (earliest reference match) so a re-score gives the same colouring.
- Hinted pieces (the locked prefix) count as hinted, never as correct (D10); they are excluded from the LCS input so
  they cannot inflate it; a fully hinted line scores 0.
- Score = correct non-hinted pieces / all pieces (same formula as today). Metrics: Recall + Slots (`correct/total`).
- v1 attempts keep the v1 positional scorer (the server picks the scorer by the attempt's chunker version); stored
  v1 scores are never recomputed.
- Required tests (unit, `listening-score`): duplicates `を`/`は`/`です` in swapped positions score as correct; `B C D A`
  example; a hinted prefix is excluded from self-recall; all-hinted → 0; the tie-break is stable; v1 attempts still
  score positionally. Route test: a non-prefix `hintedUnits` → 400.

### 3.5 Video visible by default (amends D4 / §5.9 D19)
- Listening opens with **no cover**; the video plays visibly. The cover stays available as an optional "Chỉ nghe"
  (listen only) switch the learner turns on. The switch **persists for the session** (a learner who wants audio-only
  should not re-press it each line). While the switch is on, each line starts covered and the cover's "Hiện video"
  lifts it **for that line only** (§5.9 as today); the switch stays on. Turning the switch off removes the cover.
  (Controller's call: switch = session preference, "Hiện video" = a peek for the current **attempt**, as the code
  keys it today: Next or Try again covers again while the switch is on.)
- **Where the switch sits (owner 2026-10-23):** the frame's headphones button at the end of the Replay row (restores
  the button Task 9c dropped), icon only — the frame's own vector, downloaded to
  `public/images/practice/listening-only.svg`. Hover (and keyboard focus) shows the text "Chỉ nghe" / "Listen only"
  through the existing `components/ui/tooltip.tsx`; the button's accessible name is the same text and
  `aria-pressed` reflects the switch. Pressed look = the Loop button's pressed look.
- Still concealed while answering (D4/§5.8 unchanged): the app's subtitle overlay, YouTube CC, transcript, drawer,
  LiveSentence, feedback text. Burned-in subtitles inside the video are accepted (owner).
- Toggling the switch (or lifting the cover) never remounts the YouTube player and never changes the current
  sentence or the attempt in progress: the cover is an overlay sibling of the iframe, as today. E2E proves it with
  the existing one-player marker (`fake-yt` marker kept, `onReady` fired once) across switch on/off.
- **Amends the B2 spec:** D19 and §5.9 ("cover on by default; a line change or new attempt restores it") become: no
  cover by default; with "Chỉ nghe" on, every line starts covered and "Hiện video" lifts it for that line. The B2
  spec file gets a dated amendment note pointing here, so the two documents do not contradict.
- **E2E to change** (`tests/e2e/practice-listening.spec.ts`): case 2 (asserted "the cover is on" from the first frame
  and controls working "with the cover on") → video visible on entry, then the same control checks with "Chỉ nghe"
  on; case 3 and any case asserting "cover back" after Next / Try again → only with "Chỉ nghe" on. Concealment of
  the subtitle surfaces stays asserted everywhere.

### 3.6 Typing hint unit
Typing's chunk hint (`hintUnit: "chunk"`) shows one piece per press. With v2 the pieces are words, so a hint shows
one word. No other Typing change.

### 3.7 Stat strip = the frame's bottom bar (owner agreed)
- `LessonStatStrip` (shared by Pronunciation and Listening) gets the bar's look: an orange line on the left, then
  four stats. Each value comes from real data that exists today:
  - **Orange line = position, not completion.** It shows where the current sentence sits in the lesson
    (`(index + 1) / total`). To keep it from reading as "done", it is a thin track with a **marker** at the position
    (no filled bar implying the earlier sentences are finished), with an accessible name "Vị trí: câu 31/431" /
    "Position: sentence 31 of 431".
  - **Câu** `n/total`.
  - **Đã hoàn thành** = lines with at least one valid submitted attempt in this mode/format (`practice_stats.scoredLines`:
    Listening counts `status = 'submitted'` only, so Show answer / `revealed` does not count; Pronunciation counts
    scored takes).
  - **Độ chính xác** = mean of each line's latest valid score in this mode/format (`practice_stats.mean`), `%` in
    Listening, `—` when there is none.
  - **Video còn lại** (labelled as video time, not time to finish the practice) = `video.durationSeconds` minus the
    current sentence's start, else the last line's end minus that start; shown in whole minutes ("15 phút"),
    "<1 phút" under a minute, `—` when neither duration is known.
- The strip stays where it is (under the video), not fixed to the screen bottom. One row at the narrowest column; numbers
  use the shared type tokens (L-052).

### 3.8 Live Feedback and Korume after Check (P14 / P15 kept)
- The P14 messages keep their ids and rules, computed from the new LCS result, from real data only:
  - `wb_perfect` only when every non-hinted piece is correct **and** no piece was hinted (a hinted piece is never
    praised as the learner's work, D10);
  - `wb_partial` gives the learner's own correct count, the total and the wrong count (pieces outside the LCS), and
    now also **names the wrong pieces** (their original text, up to 8 characters then "…", as `ty_errors` does) — this
    appears only after Check, when the answer is on screen anyway;
  - `wb_hinted` gives the number of hinted pieces;
  - `wb_fixed` = pieces wrong in the previous submitted attempt of this line and format (by piece index) that are now
    correct and not hinted; shown only when above zero (real progress only).
- While answering, feedback carries counts only and never a piece's text (unchanged rule); a hint message says how
  many pieces were hinted, never which.
- Korume (P15): the small figure in Live Feedback appears only after Check or Show answer for the current attempt,
  hidden while answering, mood from `feedbackMood` (joy never for a hinted or partial result), unchanged component.
- Tests: each message for v2 results (including duplicates and a hinted prefix), the named-wrong-pieces text only
  after Check, no piece text in the live region while answering (existing observer case extended), Korume absent
  while answering and present after Check / Show answer.

## 4. Constraints
- Owner's branch rules: never reset or mutate the owner's DB (at 048); any DB change is proven on disposable DBs
  first. **This design needs no migration**: `chunk_order int[]` and `chunker_version smallint` already exist.
- Every test seen RED once; every mutation RED; build/serve only in the worktree; no merge before the owner's Chrome look.
- Type on `--text-*` tokens, colours on theme keys, classes that exist in `tailwind.config.ts` (L-051/52/53).
- Desktop-only web app; owner viewport 1280×529.

## 5. What this supersedes
- Task 9c owner ruling "tap selects + Remove Selected Word" → §3.3.
- Task 9c's empty dashed slot placeholders → §3.2 (no slots).
- D19 / §5.9 "cover on by default, restored on each line" → §3.5.
- Spec D1/D3 "bottom strip out" → §3.7 (as a restyle of the existing strip, not a new bar).

## 6. Baseline
Build on `practice-listening` at `4d0dfd3d` (Task 9c + its narrowed fix round 1, all committed). The Task 9c
selection code (select + Remove, review finding I1) is replaced by §3.3, not fixed; I1 closes only as §3.3 says.

## 7. Known code consequences (from the builder checks)
- `lib/validation/dictation.ts` caps `chunkOrder` at `.max(8)` (v1's cap): raise it to a bound above the longest
  possible line (e.g. 64), with a test; the server's permutation check still binds it to the real piece count.
- The result's `slots` carry one verdict per answer position; `wb_fixed` compares by piece index.
- The hinted-prefix check applies to v2 Word Bank submits and reveals; Typing's hint validation is unchanged.
- The "Chỉ nghe" switch lives in `ListeningRevealProvider` for the page visit; the strip's line uses `primary`.

## 8. Left to the builder
Drag mechanics and library choice within §3.3; the announcement wording; the position marker's exact geometry
against the frame; test layout.
