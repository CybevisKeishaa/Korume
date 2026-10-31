# Listening: Latin word pieces, character-piece fallback, pieces fill the stars — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chế độ dễ works on lines with Latin words and digits (word cut v3, else a character cut), and placed pieces fill the star row in the chosen order.

**Architecture:** Two new registered chunker versions (3 = word cut with Latin runs, 4 = character cut); the server resolves one per line and serves it through the existing `GET /api/lines/[lineId]/chunks`, scoring stays the v2 LCS path for every version ≥ 2. On the client the placed piece list stays the one answer; the star row is a pure derivation of it. Case 22's layout fix (toggles into the star/💡 row, action row always visible) lands with the E2E that measures it.

**Tech Stack:** Next.js App Router, TypeScript, kuromoji (existing), `Intl.Segmenter` (built in), Vitest + RTL, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-31-listening-latin-and-character-pieces-design.md` (amends `…/2026-10-26-listening-cloze-dictation-design.md` §3.3/§3.9 and WP §3.1). Read both.

**Place in the branch plan:** these are Tasks **A1–A3**, run after Task 13 and **before** Task 14 of
`docs/superpowers/plans/2026-10-26-listening-two-exercises.md` (Task 14's draft key gains the cut version, see A3
Step 9). Ledger: `.superpowers/sdd/2026-10-26-listening-two-exercises/progress.md` (rulings L1, L2, S1, Q1, C1).

## Global Constraints

- v1 and v2 chunkers byte-identical in behaviour (a pinned corpus proves it); a rule change ships as a new version number.
- Version ids: `3` word cut (Latin runs), `4` character cut. `MAX_WORD_PIECES` = 64 applies to both.
- Digits: unreliable in v3 (reason `latin_or_digit`, as v2); pieces in the character cut, a digit run one piece.
- A maximal run of ASCII letters and digits after NFKC is one piece in both new cuts; Latin is never split into letters.
- Punctuation attachment unchanged: openers start the next piece, other marks attach left, a line-initial run binds forward.
- Learner sees raw `text_jp` characters (`chunkDisplays` / `displayMap`); NFKC is internal.
- VI copy, exact: `Câu này được chia theo từng ký tự để bạn tiếp tục luyện tập.` (EN: draft `This sentence is split into characters so you can keep practising.`, owner reviews).
- Both cuts are Chế độ dễ = helped; Typing, Điền từ, Summary and weekly rules unchanged; no stored attempt rescored.
- Cloze rows keep writing chunker version 2.
- Owner DB: reads only (`begin read only` / the read-only coverage script); build and serve only in the worktree; tokens and classes that exist; desktop 1280×529.
- Ponytail in every dispatch (governs how, not scope); every test seen RED first; one mutation per new rule, RED; E2E ×1 per task (C1).

## Review Focus

1. Full-width Latin or digits in the raw line (`Ｇｏｏｇｌｅ`, `２０２６`) → pieces and the filled stars show the raw characters, scoring uses the normalised text (A1 Step 1 `displays rebuild the raw line`, A2 Step 1 `full-width piece fills as written`).
2. Identical pieces in the character cut (`時` ×3) placed in swapped order → score 100, and the stars show the same characters either way (A1 Step 6, A2 Step 1).
3. Hint whose next locked piece is already placed later in the answer → the piece jumps into the locked prefix and the star row reflows in the same render (A2 Step 1 `hint reflows the stars`).
4. A line that is still locked (one grapheme, or > 64 pieces) → Chế độ dễ disabled with today's notice, never the character-cut notice (A1 Step 1 locks, A3 Step 6 case 10).
5. A character-cut line with Chế độ dễ turned off → Typing exactly as today: star mask, `grapheme1` hints, no piece UI (A3 Step 6 `char-cut line types normally with easy off`).

---

### Task A1: Word cut v3, character cut v4, one resolved cut per line, coverage report

**Files:**
- Modify: `lib/dictation/chunk.ts` (tokenize option, `chunkV3`, `chunkChars`, registry, `currentCut`, `cutKind`), `lib/dictation/types.ts` (`CutKind`, `LineChunks.cut`), `lib/data/line-chunks.ts`, `lib/data/dictation.ts:134`, `lib/dictation/cloze.ts` (constant), `scripts/dictation/chunk-coverage.ts`
- Test: `lib/dictation/chunk.test.ts`, `lib/dictation/chunk-frozen.test.ts` (new, corpus pin), `lib/data/line-chunks.test.ts`, `lib/data/dictation.test.ts`

**Interfaces:**
- Produces (A2, A3 rely on these):
  - `types.ts`: `export type CutKind = "word" | "char";` and `LineChunks` gains `cut: CutKind`.
  - `chunk.ts`: `CURRENT_CHUNKER = 3`; `export const CHAR_CHUNKER = 4`; `CHUNKERS` = `{ 1, 2, 3: chunkV3, 4: chunkChars }`; `export function cutKind(version: number): CutKind` (`4` → `"char"`, else `"word"`); `export function currentCut(textJp: string): Promise<ChunkResult>` = v3 if reliable, else the v4 result (reliable or locked), memoised through `chunkLine`.
  - `cloze.ts`: `export const CLOZE_TOKENS_CHUNKER = 2;` written as cloze rows' `chunker_version` (`dictation.ts:134`).

- [ ] **Step 1: Capture the frozen corpus first, before any edit.** Create `chunk-frozen.test.ts` holding ~30 lines (the 6 E2E lines, the owner's `ああいうのをその場ですぐGoogleマップで調べて`, `今日は2026年です。`, the unreliable cases already in `chunk.test.ts`, the 20-piece line from `COVERAGE_DUMP`) and an inline snapshot of `await CHUNKERS[1](l)` and `await CHUNKERS[2](l)` for each. Run it on the untouched code → PASS; this is the pin for "v1/v2 unchanged".
- [ ] **Step 2: Write the failing tests in `chunk.test.ts`:**
  - `v3 keeps a Latin run as one piece`: the owner's line → `reliable: true, version: 3`, `chunks` contains `"Google"`, `chunks.join("") === normalizeJa(line)` (pin the exact array the pipeline gives).
  - `v3 full-width Latin`: `すぐＧｏｏｇｌｅで` → a chunk `"Google"`; `chunkDisplays(displayMap(raw), normalizeJa(raw), chunks)` contains `"Ｇｏｏｇｌｅ"` (Review Focus 1).
  - `v3 keeps the digit rule`: `今日は2026年です。` → `{ version: 3, reliable: false, reason: "latin_or_digit" }`.
  - `v3 still rejects a non-Latin unknown`: `ぱぽぴぷぺ` → `reason: "unknown_token"`.
  - `chunkChars` (call `CHUNKERS[4]`): `今日は2026年です。` → `["今","日","は","2026","年","で","す。"]`; `検索する` → `["検","索","す","る"]`; `きって` → `["き","っ","て"]`; `COVID19です` → `["COVID19","で","す"]`; `「はい」` → `["「は","い」"]`; `あ👍🏽い` → no piece is a lone `🏽` and `join` equals the base; `２０２６年` → first chunk `"2026"` and its display `"２０２６"`; `あ。` → `{ version: 4, reliable: false, reason: "single_chunk" }`; a 65-grapheme kana line → `reason: "too_many_pieces"`.
  - `currentCut`: owner line → version 3; `今日は2026年です。` → version 4 reliable; `あ。` → version 4 locked; `cutKind(3) === "word"`, `cutKind(4) === "char"`.
- [ ] **Step 3: Run** `npx vitest run lib/dictation/chunk.test.ts --maxWorkers=2 --minWorkers=1` → FAIL (no v3/v4).
- [ ] **Step 4: Implement.** `tokenize(textJp, version, isPunct, latin = false)`: with `latin` the ASCII-alnum test only rejects digits (`/[0-9]/` → `latin_or_digit`), adjacent tokens matching `/^[A-Za-z]+$/` merge into one token treated as a word (never `UNKNOWN`, never split by the R20 per-code-point step). `chunkV3` = `chunkV2`'s piece loop over `tokenize(…, 3, isSymbol, true)`, version 3. `chunkChars`: graphemes of `normalizeJa(text)` via `Intl.Segmenter("ja", { granularity: "grapheme" })`, maximal `/[A-Za-z0-9]/` runs merged, then the v2 attachment loop with `isSymbol` per grapheme, version 4, same `single_chunk` / `too_many_pieces` locks. Frozen corpus (Step 1) must still pass.
- [ ] **Step 5: Wire the resolved cut.** `loadLineChunks` uses `currentCut(text)` and returns `cut: cutKind(result.version)`; `dictation.ts:134` writes `CLOZE_TOKENS_CHUNKER`. Tests in `line-chunks.test.ts`: owner line → `version: 3, cut: "word"`; `今日は2026年です。` → `version: 4, cut: "char", reliable: true`; existing payload test's `version` becomes 3.
- [ ] **Step 6: Server scoring tests (`lib/data/dictation.test.ts`):** a `word_bank` submit at `version: 4` on `1時と2時と3時` with the two `時` pieces swapped → score 100 (Review Focus 2); a `version: 2` submit on an existing line still scores by v2 (chunk_snapshot is v2's); `version: 5` → 409 `chunker_version`; a `version: 4` reveal returns `display` with raw characters. Run → PASS.
- [ ] **Step 7: Coverage report (read-only).** `scripts/dictation/chunk-coverage.ts`: env `CHUNKER=<n>` runs `CHUNKERS[n]`; default runs `currentCut` and prints counts per `cutKind` and per reason, plus the same for lines matching `/[A-Za-zＡ-Ｚａ-ｚ]/` and `/[0-9０-９]/`. Run `CHUNKER=2` and default against the owner DB with `COVERAGE_DUMP` for each; put both outputs in the task report (spec §3.7; expected: the 39 Latin and 2 digit lines easy-eligible).
- [ ] **Step 8: Mutations** (each RED, restore via `.mutbak`): drop the Latin merge (v3 Google test RED); let v3 accept digits (digit-rule test RED); split digit runs in `chunkChars` (`2026` test RED); segment by code point instead of grapheme (`👍🏽` test RED); edit v2's tokenize call to pass `latin = true` (frozen corpus RED).
- [ ] **Step 9: Gates + commit.** Full vitest, `tsc --noEmit`, lint. `git commit -m "feat(listening): word cut v3 keeps Latin words; character-cut fallback v4; one resolved cut per line"`.

---

### Task A2: Placed pieces fill the stars; the character-cut notice

**Files:**
- Modify: `lib/dictation/star-mask.ts` (`starFill`), `components/shadowing-workspace/practice/star-mask.tsx` (`filled` prop), `word-bank-panel.tsx` (renders the filled mask), `listening-mode-body.tsx` (hint row no longer carries the mask; notice), `messages/{vi,en}/shadowing.json` (`listening.charCut`)
- Test: `lib/dictation/star-mask.test.ts`, `components/shadowing-workspace/practice/word-bank-panel.test.tsx`, `listening-mode-body.test.tsx`

**Interfaces:**
- Consumes: A1 `LineChunks.cut`, `LineChunks.chunks` (normalised) and `display` (raw).
- Produces:
  - `star-mask.ts`: `export function starFill(pieces: readonly { chunk: string; display: string }[]): string[]` — the raw text of each **scored** grapheme of the pieces in order (punctuation and optional symbols skipped, the same units `grapheme1Units` scores; raw text through each piece's own `displayMap`).
  - `StarMask` / `DictationMask` gain `filled?: readonly string[]`: star unit `u < filled.length` shows `filled[u]` in the placed tone (non-interactive; accessible name `star.shown` with that text); shown cells unchanged.
  - `WordBankPanel` gains `text: string` (raw line) and `chunks: string[]`; it renders `<DictationMask text hinted={[]} revealed filled={starFill(placed…)} />` in its header row before `hint`. No new state: the mask reads `placed` (= `withHints(answer, hinted)`).

- [ ] **Step 1: Write the failing tests.**
  - `star-mask.test.ts`: `starFill([{chunk:"を",display:"を"}])` → `["を"]`; `[{chunk:"けど。",display:"けど。"}]` → `["け","ど"]` (no `。`); `[{chunk:"Google",display:"Ｇｏｏｇｌｅ"}]` → `["Ｇ","ｏ","ｏ","ｇ","ｌ","ｅ"]`; property: for 200 random permutations/prefixes of the pieces of 3 fixed lines, `starFill(prefix).join("")` equals the scored graphemes of the concatenated displays.
  - `word-bank-panel.test.tsx` (chunks `["お","店","を"]`, text `お店を`): tap `を` → the mask reads `を＊＊` (cell text in order); tap `お` → `をお＊`; Alt+ArrowLeft on placed `お` → `おを＊`; tap placed `を` → `お＊＊`; drag `店` to index 0 → `店お＊`; `hint reflows the stars`: tap `を`, tap `店` (`を店＊`), rerender with `hinted=[0]` → placed `[お, を, 店]` and the mask `おを店` (`withHints` puts the hinted prefix first); `punctuation shown once`: chunks `["行く","けど。"]` all placed → the mask's text contains exactly one `。`; `full-width piece fills as written`; Check payload equals the placed order, not the mask; after Check the mask behaves as before (gone when `results` set — match today's easy-mode behaviour).
  - `listening-mode-body.test.tsx`: easy on + chunks `{ reliable: true, cut: "char" }` → `getByTestId("listening-char-cut")` has the VI copy exactly; `cut: "word"` → no notice; `reliable: false` → today's `listening-unreliable` notice only.
- [ ] **Step 2: Run** the three files → FAIL.
- [ ] **Step 3: Implement** per the Interfaces block; `listening-mode-body.tsx` stops rendering `DictationMask` in the word-bank hint slot and passes `text={line?.textJp ?? ""}` and `chunks={chunks.chunks}`; the notice is a sibling of `listening-unreliable`, same classes.
- [ ] **Step 4: Run** → PASS; full vitest, tsc, lint.
- [ ] **Step 5: Mutations** (RED each): `starFill` over the reference order instead of `placed`; keep punctuation in `starFill`; notice shown for `cut: "word"`.
- [ ] **Step 6: Commit** `feat(listening): placed pieces fill the stars in the chosen order; character-cut notice`.

---

### Task A3: Layout at 1280×529 (case 22), E2E for Latin, digits and long character cuts

**Files:**
- Modify: `components/shadowing-workspace/practice/listening-card-toggles.tsx` (split), `listening-mode-body.tsx`, `word-bank-panel.tsx` / `typing-panel.tsx` / `practice-panel.tsx` as the layout needs, `tests/e2e/practice-listening.spec.ts`
- Test: `listening-card-toggles.test.tsx`, E2E cases 10, 22 and new 31–33

**Interfaces:**
- Consumes: A1 cuts, A2 filled mask.
- Produces: `listening-card-toggles.tsx` exports `ListeningCardToggleButtons` (the icon buttons only, same props as today) and `ListeningCardSurfaces` (the translation/romaji paragraphs, same props); `ListeningCardToggles` is removed. Tooltip/disabled behaviour unchanged (case 30).

- [ ] **Step 1 (controller, before dispatch): Chrome trial** on a worktree build served on :3001, 1280×529, listen-only and video shown: move the toggle buttons into the star/💡 row and pin the action row by CSS injected in the page; measure an 8-piece line, the 20-piece line, and a ≥30-piece character-cut line. Owner picks if more than one variant fits. The chosen CSS goes in the brief.
- [ ] **Step 2: Failing unit tests:** the two exports render the same buttons/paragraphs as today's component tests (port the existing tests); in `listening-mode-body.test.tsx` the toggle buttons render inside the row that holds the 💡 button (`data-puzzle-header`), the surfaces under the answer box.
- [ ] **Step 3: Implement** the split and the trial's layout: toggles in the star/💡 row; the bank wraps to as many rows as needed with today's piece size; the action row (Check, 💡, piece Hint, Try again / Làm lại, Next sentence) always fully visible; the panel scrolls inside when taller than its space.
- [ ] **Step 4: E2E fixtures:** add lines to `LINES` / the `beforeAll` update loop: the owner's Latin line; the 20-piece line (text from Task A1's `COVERAGE_DUMP`); a ≥30-grapheme line with a digit run (character cut, pin its piece count from the chunks response); `あ。` as the locked line. Adjust the counters other cases assert if indices move.
- [ ] **Step 5: Rewrite case 22** over the three measured lines (8-piece, 20-piece, character cut), listen-only and video shown: for each, the bottom of every action-row button ≤ dock top (listen-only) or ≤ 529 (video shown); `panel bottom ≤ dock top`; no bank-row-count assertion. Keep the `T9-MEASURE` logs.
- [ ] **Step 6: New and updated cases:**
  - 31 `Latin line in easy mode`: the owner's line, Chế độ dễ on → a bank piece `Google`; tap it first → the star row starts with `Google`; place all in order, Check → score 100.
  - 32 `digit line uses character pieces with its notice`: a default fixture line (`今日は5番目の文を読みます。`) → `listening-char-cut` visible with the EN draft, pieces include `5`, `Chế độ dễ` enabled; `char-cut line types normally with easy off` (Review Focus 5).
  - 33 `long character-cut line`: the ≥30 line in listen-only → all pieces placeable, action row visible after placing (bounds as case 22).
  - case 10: the locked line is now `あ。` (default lines are character-cut); expectations otherwise unchanged.
- [ ] **Step 7: Run** the spec ×1 with `--workers=2`, `AI_PROVIDER=none` (server built and served from the worktree, :3000) → PASS except the known case 6 (Task 15).
- [ ] **Step 8: Mutations:** toggles back to their own row (case 22 RED on the 20-piece line); remove the action-row pin (case 33 RED).
- [ ] **Step 9: Amend Task 14 in the branch plan** (one line in its Interfaces): the draft key is `${lineId}|${format}|${chunks.version}` for word pieces, so a draft never restores onto another cut; the star row needs no draft (derived).
- [ ] **Step 10: Commit** `feat(listening): toggles in the star row, action row always visible; E2E for Latin, digits and long character cuts`.

---

### Task A4: One play per sentence, autoplay on sentence change and on entry (Nghe, Phát âm)

**Spec:** `docs/superpowers/specs/2026-10-31-practice-playback-once-and-autoplay-design.md` (D1–D6). Runs after A3, before Task 14.

**Files:**
- Modify: `components/shadowing-workspace/use-playback-controller.ts` (autoplay in sentence-bound navigation, seek-back on a boundary pause), `components/shadowing-workspace/use-practice-playback.ts` (play the current sentence on entry), `components/shadowing-workspace/practice/practice-panel.tsx` (`useFirstPracticeSentence`: the first sentence plays once the player is ready), `components/shadowing-workspace/practice/replay-row.tsx` (`ReplayLoopRates` loses the Lặp button), `components/shadowing-workspace/workspace-shell.tsx` (`L` is a no-op in practice), `tests/e2e/practice-listening.spec.ts`
- Test: `use-playback-controller.test.tsx`, `use-practice-playback.test.tsx`, `practice-panel.test.tsx`, `workspace-shell.test.tsx`, the replay-row/dock tests that assert the Lặp button

**Interfaces:**
- Controller, sentence-bound modes only: `nextSentence`, `previousSentence`, `seekToSentence` (any `options`) seek to the target sentence and play it once unless `lock.play`; `seekTo` and `rewind` stay position moves (no play). Not sentence-bound (Shadowing): unchanged.
- Boundary pause (`decision.kind === "pause"`, both the tick path and the ENDED path): after `adapter.pause()`, `adapter.seekTo(end - 0.001, true)`; the published sentence stays the played one.
- `ReplayLoopRates` renders only the two rates; `usePlayerWiring().toggleLoop` is no longer reachable from practice UI or the `L` key in practice.

- [ ] **Step 1: Failing unit tests** (controller, sentence-bound): `nextSentence` → `seekTo(next.start)` then `play()` once; `previousSentence` and `seekToSentence(i)` the same; `seekTo(t)` and `rewind(s)` → no `play()`; with `setLock({ play: true })` → no `play()`; a tick crossing the end → `pause()` then `seekTo(end - 0.001, true)`, current sentence unchanged after a later tick at `end + 0.2` while paused; Shadowing (`sentenceBound: false`): `nextSentence` → no `play()`, loop config honoured as today.
- [ ] **Step 2: Failing tests for entry:** `usePracticePlayback` switching `shadowing` → `listening` at sentence 20 calls `controller.play()` once (sentence-bound play = from sentence 20's start); `useFirstPracticeSentence` on a fresh mount plays once the player is ready (adapter `onReady`), once only; `ReplayLoopRates` has no Lặp button; `L` in a practice mode does not change `loop`.
- [ ] **Step 3: Run** → FAIL.
- [ ] **Step 4: Implement** per Interfaces; no new state beyond a "played on entry" guard; the browser refusing autoplay leaves the player paused (nothing to handle).
- [ ] **Step 5: Run** → PASS; full vitest, tsc, lint.
- [ ] **Step 6: E2E** (fake YouTube, ×1): Next sentence plays the new sentence and stops at its end with the typed input kept and the navigator unchanged 3 s later; deep-link entry `?line=` plays that sentence once; switching Shadowing → Nghe at sentence N plays N; any existing case that asserted "paused after Next" or the Lặp button is updated (list each edit in the report).
- [ ] **Step 7: Mutations** (RED each): drop the play in `navigateTo`'s sentence moves; let `seekTo` autoplay; drop the seek-back; render the Lặp button again.
- [ ] **Step 8: Commit** `feat(practice): one play per sentence; autoplay on sentence change and on entry`.
