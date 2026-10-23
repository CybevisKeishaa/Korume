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

## 3. The design

### 3.1 Pieces (chunker v2) — owner decided the granularity
- New chunker **version 2** beside v1 (`lib/dictation/chunk.ts`, `CHUNKERS[2]`, `CURRENT_CHUNKER = 2`). v1 stays
  registered unchanged: stored attempts reference their version (the file's own rule: a version is never edited once
  an attempt references it; v1 is now referenced by real attempts).
- v2 = one piece per kuromoji token after the same normalisation and the same reliability checks as v1 (mismatch,
  latin/digit, unknown token → unreliable → Typing fallback with the D9 notice, unchanged).
- **Punctuation is never a piece (owner 2026-10-23):** `。、！？…` and closing brackets bind to the piece before them
  (`けど。`); an opening bracket binds to the piece after it; a line-initial run of punctuation binds forward (as v1
  R18). The owner's `"` rule (odd opens, even closes) carries over. The owner's full example:
  `お店を検索すると思うんですけど。` → `お / 店 / を / 検索 / する / と / 思う / ん / です / けど。`
- Prefix: the owner's example splits `お / 店`, so a 接頭詞 token is its own piece.
- **Cap (builder's call within this rule):** if a line yields more than **16** pieces, merge the most tightly bound
  neighbours using v1's `boundaryRank` order until 16 remain. Rationale: 16 round chips fit the tray and bank at
  1280×529 in two rows each; subtitle lines rarely exceed it. Measure it in Chrome; change the number only with the
  owner.
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

### 3.3 Interaction
- **Drag** a bank piece into the answer: a drop indicator shows the insertion point between placed pieces; drop
  inserts there. Drag a placed piece to reorder it. Drop outside the answer returns it to the bank (placed piece) or
  does nothing (bank piece).
- **Tap** a bank piece: appends it at the end of the answer.
- **Tap** a placed (non-hinted) piece: returns it to the bank. "Remove Selected Word" and selection are removed.
- **Keyboard / single pointer alternative to drag** (WCAG 2.1.1, 2.5.7): Enter/Space on a bank piece appends it; on
  a placed piece removes it; **Alt+ArrowLeft / Alt+ArrowRight** on a focused placed piece moves it one place (focus
  follows the piece). A polite announcement says the new position ("お, position 3 of 10"). Inserting in the middle by
  keyboard = append, then move.
- Drag implementation: native pointer events or an already-installed library — the builder checks `package.json`
  first; no new dependency without the owner. Touch is not required (desktop-only web app).
- After Check / Show answer the answer is locked; correct / wrong / hinted tones as today (colour + non-colour cue).

### 3.4 Scoring (Word Bank, v2 attempts)
- A placed piece counts as **correct** if it belongs to the longest subsequence of the answer that is in the
  reference order (LCS over piece *text*, so two identical pieces like two `を` are interchangeable). Positional
  scoring would mark everything after one early misplacement wrong, which with 10–16 pieces is unfair.
- Hinted pieces count as hinted, never as correct (D10); a fully hinted line scores 0.
- Score = correct non-hinted pieces / all pieces (same formula as today). Metrics: Recall + Slots (`correct/total`).
- v1 attempts keep the v1 positional scorer (scoring is chosen by the attempt's chunker version on the server).
- P14 feedback messages keep their ids; "wrong" counts = placed pieces outside the LCS. `wb_fixed` compares the
  previous attempt's wrong pieces by piece index as today.

### 3.5 Video visible by default (amends D4 / §5.9 D19)
- Listening opens with **no cover**; the video plays visibly. The cover stays available as an optional "Chỉ nghe"
  (listen only) switch the learner turns on. The switch **persists for the session** (a learner who wants audio-only
  should not re-press it each line). While the switch is on, each line starts covered and the cover's "Hiện video"
  lifts it **for that line only** (§5.9 as today); the switch stays on. Turning the switch off removes the cover.
  (Controller's call: switch = session preference, "Hiện video" = per-line peek.)
- **Where the switch sits (owner 2026-10-23):** the frame's headphones button at the end of the Replay row (restores
  the button Task 9c dropped), icon only — the frame's own vector, downloaded to
  `public/images/practice/listening-only.svg`. Hover (and keyboard focus) shows the text "Chỉ nghe" / "Listen only"
  through the existing `components/ui/tooltip.tsx`; the button's accessible name is the same text and
  `aria-pressed` reflects the switch. Pressed look = the Loop button's pressed look.
- Still concealed while answering (D4/§5.8 unchanged): the app's subtitle overlay, YouTube CC, transcript, drawer,
  LiveSentence, feedback text. Burned-in subtitles inside the video are accepted (owner).

### 3.6 Typing hint unit
Typing's chunk hint (`hintUnit: "chunk"`) shows one piece per press. With v2 the pieces are words, so a hint shows
one word. No other Typing change.

### 3.7 Stat strip = the frame's bottom bar (owner agreed)
- `LessonStatStrip` (shared by Pronunciation and Listening) gets the bar's look: an orange progress line on the left
  (current sentence / total sentences), then four stats: **Câu** `n/total` · **Đã hoàn thành** (lines submitted in this
  mode/format, today's "Đã nộp" value) · **Độ chính xác** (today's average, `%` in Listening) · **Còn lại** (minutes of
  video left from the current sentence's start to the end: `video.durationSeconds`, else the last line's end).
- It stays where it is (under the video), not fixed to the screen bottom. One row at the narrowest column; numbers
  use the shared type tokens (L-052).

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
selection code (select + Remove, review finding I1) is replaced by §3.3, not fixed.

## 7. Left to the builder
Drag mechanics and library choice within §3.3; the merge cap's exact tie-breaks; the announcement wording; the
progress line's exact geometry against the frame; test layout.
