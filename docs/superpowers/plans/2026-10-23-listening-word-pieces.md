# Listening word pieces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Word Bank pieces become words (chunker v2) placed by drag / tap with server-side LCS scoring; Typing ignores ♪ 〜 ～ → ※; Listening opens with the video visible behind a remembered "Chỉ nghe" switch; the stat strip takes the frame's bottom-bar look.

**Architecture:** A new chunker version (v2) beside v1, chosen by `CURRENT_CHUNKER`; the server picks the Word Bank scorer by the attempt's version (v1 positional, v2 LCS). The client answer becomes a pure ordered list of piece indices (`lib/dictation/word-bank-answer.ts`) driven by native HTML5 drag-and-drop, taps and Alt+Arrow keys. The listen-only switch moves out of the per-attempt reveal key into session state in `ListeningRevealProvider`.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind (theme tokens), kuromoji, zod, vitest + RTL (jsdom), Playwright.

**Spec:** `docs/superpowers/specs/2026-10-23-listening-word-pieces-design.md` (read it whole first; § numbers below refer to it). B2 base spec: `docs/superpowers/specs/2026-10-15-shadowing-practice-modes-design.md`.

## Global Constraints

- Worktree `C:\Users\tplon\Documents\GitHub\JPWeb\japan-web\.worktrees\practice-listening`, branch `practice-listening`, base `92f6767d`. Every shell call `Set-Location`/`cd` into it in the same call; never build/serve/npm in the main checkout; no Serena edit tools.
- Never reset, migrate or write SQL to the owner's DB (at 048). This plan has **no migration**.
- Every new assertion seen RED once; every listed mutation RED, restored from `<file>.mutbak` (never `git checkout --`).
- vitest `--minWorkers=1 --maxWorkers=2`; Playwright `--workers=2` with `AI_PROVIDER=none`; check :3000 is free first, never reuse/kill a server you did not start (R37).
- Type only on `text-caption/body/body-lg/heading` (L-052); colours only theme keys; radius only `sm/md/lg/full`; no `min-w-control-*`/`size-control-*` (L-053).
- No new dependency (no drag-and-drop library is installed; use native HTML5 DnD — desktop-only app).
- A version of a chunker is never edited once an attempt references it; v1 stays registered byte-for-byte.
- Scores are computed on the server only; stored scores are never recomputed.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Ponytail in every dispatch; lessons block (L-051/52/53, L-044, L-004, L-019, L-025) in every brief.

## Review Focus

1. A drop or tap while a Check is in flight (`submitting`) → nothing moves; no piece duplicated or lost (Task 5 test `locks the answer while submitting`).
2. Hint pressed while the next piece is placed in the middle → it moves into the locked prefix, the answer keeps every other piece once (Task 5 test `hint moves a placed piece into the prefix`; Task 2 property test).
3. A late drop / drag end after the line changed (Next pressed mid-drag) → applies to nothing; the new line starts empty (Task 5 E2E case `drag across a line change`).
4. A client still holding v1 chunks posts `version: 1` after deploy → the server scores it with the v1 positional scorer, not LCS (Task 3 route test `v1 attempts keep positional scoring`).
5. One long piece (an 8+ character katakana word) or a 20-piece line at 1280×529 → chips wrap inside the panel, nothing overflows horizontally (Task 5 unit `wraps`, Task 8 Chrome trial with the longest real line).

---

### Task 1: Chrome trial — how "Chỉ nghe" hides the video (controller + owner, no product code)

**Files:** none committed except the ledger line in `.superpowers/sdd/2026-10-21-practice-listening/progress.md`.

**Interfaces:**
- Produces: the owner's choice `LISTEN_ONLY_LAYOUT ∈ {"collapse", "full-transcript", "cover"}` recorded in the ledger, read by Task 6.

- [ ] **Step 1:** Build and serve the branch from the worktree on :3001 (`npx next build`, `npx next start -p 3001`, `AI_PROVIDER=none`); open `/vi/shadowing/<id>/listening` in the owner's Chrome at 1280×529 (nav collapsed).
- [ ] **Step 2:** Inject `<style id="trial">` for (a) **collapse**: `#workspace-player-pane` video box height to the control bar only (iframe kept in the DOM, `height:0`/`visibility:hidden` on its frame box, never `display:none`), stat strip moves up; (b) **full-transcript**: the existing `group/pip` restyle of the same pane (`workspace-shell.tsx:238`) with the practice column taking the width; (c) today's cover. Measure with JS: practice panel height/width, tray + bank visible rows for the longest real line (20 pieces) and a median line, control bar position.
- [ ] **Step 3:** Show the owner screenshots + numbers; record the choice and the measured numbers as a ruling in the ledger. Stop the server.

---

### Task 2: Chunker v2 and the answer model

**Files:**
- Modify: `lib/dictation/chunk.ts` (add `chunkV2`, `CHUNKERS[2]`, `CURRENT_CHUNKER = 2`), `lib/validation/dictation.ts:19` (`chunkOrder` `.max(8)` → `.max(64)`)
- Create: `lib/dictation/word-bank-answer.ts`
- Test: `lib/dictation/chunk.test.ts`, `lib/dictation/word-bank-answer.test.ts`, `lib/validation/dictation.test.ts` (create if absent)

**Interfaces:**
- Produces: `CHUNKERS[2]: (textJp: string) => Promise<ChunkResult>`; `CURRENT_CHUNKER === 2`.
- Produces (`word-bank-answer.ts`, all pure, `answer` = piece indices in answer order, hinted prefix first):
  - `withHints(answer: number[], hinted: number[]): number[]` — hinted (a prefix `0..k-1`) first, then `answer` minus hinted, order kept.
  - `insertPiece(answer: number[], piece: number, at: number, hintedCount: number): number[]` — `at` clamped to `[hintedCount, len]`; a piece already in `answer` is moved (removed first, index adjusted).
  - `removePiece(answer: number[], piece: number, hintedCount: number): number[]` — no-op for a piece in the prefix.
  - `movePiece(answer: number[], piece: number, delta: -1 | 1, hintedCount: number): number[]` — never crosses into the prefix or past the end.

- [ ] **Step 1: Failing tests, chunker** (`chunk.test.ts`, `describe("v2")`):
  - `chunkLine("お店を検索すると思うんですけど。", 2)` → `chunks` equal `["お","店","を","検索","する","と","思う","ん","です","けど。"]`, `reliable: true`, `version: 2`.
  - `今日は楽しいですね♪` → last piece ends with `♪` (no `♪` piece); `「こんにちは」と言った` → `「こんにちは」` bound (opener forward, closer back), no piece is punctuation-only.
  - `"…"` line-initial run binds forward; `"` odd opens / even closes (copy v1's quote test with v2).
  - The longest real-line shape: a 20-token line yields 20 pieces (no merge; build the fixture from `お店を検索すると思うんですけど。` ×2 → 20).
  - Latin/digit / unknown-token / single-token lines → unreliable with the same reasons as v1.
  - v1 results unchanged: every existing v1 test still passes with an explicit `version: 1` argument.
- [ ] **Step 2: Failing tests, answer model** (`word-bank-answer.test.ts`): insert at 0 with `hintedCount 2` lands at 2; insert of an already placed piece moves it; remove of a prefix piece is a no-op; `movePiece` at either edge is a no-op; `withHints([5,0,3],[0,1])` → `[0,1,5,3]`; property: for random sequences of insert/remove/move/withHints on n ≤ 20, the answer never holds a duplicate and the prefix stays `0..k-1`.
- [ ] **Step 3: Failing test, schema:** a 20-index `chunkOrder` parses; 65 does not.
- [ ] **Step 4: Run** `npx vitest run lib/dictation lib/validation --reporter=dot` → the new tests FAIL.
- [ ] **Step 5: Implement.** `chunkV2` reuses v1's normalisation, reliability checks, the `UNKNOWN`-punctuation split (R20) and the quote rule; then one piece per token, where a token is "punctuation" iff `pos === "記号"` or every char matches `PUNCTUATION` (spec §3.1); punctuation binds to the previous piece, an opener (`isOpenBracket`) binds forward, a line-initial punctuation run binds forward. No `mergeDownTo`. `< 2` pieces → `single_chunk`.
- [ ] **Step 6: Run** the same command → PASS; full `npx vitest run --reporter=dot --minWorkers=1 --maxWorkers=2` (the chunks API and summary tests may pin `version: 1`: update pins that mean "current", keep pins that mean "v1").
- [ ] **Step 7: Mutation:** drop the punctuation-binding branch in `chunkV2` → the `けど。` test RED. Restore.
- [ ] **Step 8: Commit** `feat(listening): chunker v2 — one piece per word; pure word-bank answer model`.

---

### Task 3: Server scoring — LCS for v2, hinted-prefix validation

**Files:**
- Modify: `lib/dictation/listening-score.ts` (add `scoreWordBankLcs`), `lib/data/dictation.ts:76-82,110-119`
- Test: `lib/dictation/listening-score.test.ts`, `app/api/dictation/attempt/route.test.ts` (or `lib/data/dictation.test.ts`, wherever the submit path is tested today)

**Interfaces:**
- Consumes: Task 2 `CHUNKERS[2]`.
- Produces: `scoreWordBankLcs(chunks: string[], order: number[], hintedCount: number): ReturnType<typeof scoreWordBank>` — same shape as `scoreWordBank`: `slots[p] = { chunkIndex: order[p], correct, hinted: p < hintedCount }`, `score = pct(correct, n)`, `metrics = { recall: score, slots: { correct, total: n } }`.

- [ ] **Step 1: Failing tests** (`listening-score.test.ts`, `describe("scoreWordBankLcs")`):
  - `["A","B","C","D"]`, order `[1,2,3,0]`, k 0 → `slots.map(s => s.correct)` = `[true,true,true,false]`, score 75.
  - duplicates: chunks `["私","を","見","を","待つ"]`, order `[0,3,2,1,4]` (the two `を` swapped) → all correct, score 100; same for two `は` and two `です`.
  - hinted prefix: chunks `["A","B","C"]`, order `[0,2,1]`, k 1 → slot 0 `hinted:true, correct:false`; score counts only one of B/C as correct → 33.3.
  - all hinted (k = n) → score 0.
  - stable tie-break: chunks `["A","B"]`, order `[1,0]` (answer `B A`, two equally long LCS) → `correct` = `[false,true]` (the earliest reference piece `A` is the match), identical on a second call.
  - Typing hint unit with v2 (spec §3.6): `typingHintUnit` of a reliable v2 cut is `"chunk"` and `chunkUnits(v2 chunks)` gives one range per word.
- [ ] **Step 2: Failing route tests:** (a) v2 submit with `hintedUnits: [1]` → 400; (b) v2 submit with `hintedUnits: [0,1]` but `chunkOrder` not starting `[0,1]` → 400; (c) v2 reveal with `hintedUnits: [2]` → 400; (d) `v1 attempts keep positional scoring`: a `version: 1` submit of `[1,2,3,0]`-shaped order scores 0 positional, not 75.
- [ ] **Step 3: Run** → FAIL.
- [ ] **Step 4: Implement `scoreWordBankLcs`.** The algorithm (the tie-break is the part tests pin):

```ts
// a = texts at answer positions k..n-1, r = reference texts k..n-1 (prefix positions hold pieces 0..k-1, validated)
// dp[i][j] = LCS length of a[i..], r[j..]; walk forward:
// if a[i] === r[j] && dp[i][j] === dp[i+1][j+1] + 1 → match (answer position k+i correct), i++, j++
// else if dp[i+1][j] >= dp[i][j+1] → i++  else → j++
```

- [ ] **Step 5: Wire the server** (`submitListeningAttempt`): for `format === "word_bank"` and `input.version >= 2`, require `[...hintedUnits].sort()` equal `0..k-1` (submit and reveal) and, on submit, `chunkOrder.slice(0, k)` equal `0..k-1`, else `{ ok:false, status:400 }`; scorer = `input.version === 1 ? scoreWordBank(cut.chunks, order, new Set(hinted)) : scoreWordBankLcs(cut.chunks, order, k)`.
- [ ] **Step 6: Run** → PASS. **Mutations:** (a) tie-break `>=` → `>` → stable-tie test RED; (b) skip the prefix check → route test (a) RED. Restore.
- [ ] **Step 7: Commit** `feat(listening): server LCS scoring for word pieces; hinted prefix validated`.

---

### Task 4: Typing ignores optional symbols

**Files:**
- Modify: `lib/dictation/listening-score.ts` (`stripPunctuation`, `scoreTyping`)
- Test: `lib/dictation/listening-score.test.ts`

**Interfaces:**
- Produces: `export const TYPING_OPTIONAL = /[♪〜～→※]/u;` and `stripPunctuation(base: string, extra?: RegExp)` — a char is dropped if it matches `PUNCTUATION` or `extra`. `scoreTyping` passes `TYPING_OPTIONAL` for both reference and input. No other caller changes.

- [ ] **Step 1: Failing tests:** `scoreTyping(normalizeJa("今日は楽しいですね♪"), "今日は楽しいですね", [], [])` → score 100, no `missing` op; same for each of `〜 ～ → ※`; typing the symbol → no `extra` op; `50%` reference with `50` typed → one `missing` op (`%` stays required), same for `¥ + −`; a hinted range covering the characters after a stripped `♪` still marks exactly those characters `hinted`; Kanji ratio for `漢字♪` typed `漢字` is 100.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS; mutation: pass `TYPING_OPTIONAL` only for the reference → the "typed symbol → no extra" test RED. Restore.
- [ ] **Step 5: Commit** `feat(listening): Typing does not require ♪ 〜 → ※`.

---

### Task 5: Word Bank panel — sequence answer, drag, tap, keyboard; feedback for v2

**Files:**
- Modify: `components/shadowing-workspace/practice/word-bank-panel.tsx`, `listening-mode-body.tsx` (props), `use-listening-attempt.ts` (`summarize`, feedback event), `lib/dictation/listening-feedback.ts` (`checked_word_bank`), `messages/{en,vi}/shadowing.json` (by line edit: drop `removeSelected`, `slotState.selected`; add `moved`, `wb_partial` gains `{pieces}`), `tests/e2e/practice-listening.spec.ts`
- Test: `word-bank-panel.test.tsx`, `listening-mode-body.test.tsx`, `lib/dictation/listening-feedback.test.ts`

**Interfaces:**
- Consumes: Task 2 `withHints`, `insertPiece`, `removePiece`, `movePiece`; Task 3 result `slots` (per answer position, `chunkIndex`).
- Produces: `WordBankPanel` props unchanged except `results` is per answer position; `PreviousResult.wrongPieces?: number[]` (chunk indices of wrong, non-hinted pieces) replaces `wrongSlots`; feedback event `{ kind: "checked_word_bank"; slots; display: string[]; previous: { wrongPieces: number[] } | null }`.

- [ ] **Step 1: Failing unit tests** (`word-bank-panel.test.tsx`), each by name:
  - `tap in the bank appends`; `tap on a placed piece returns exactly that piece` (with two identical-text pieces placed, tapping the second returns the second: assert by `data-piece` index);
  - `no selection state`: after any taps no element has `aria-pressed="true"`; there is no "Remove Selected Word" button;
  - **I1 closure** `a hint never makes another piece removable by proxy`: place X, place piece 0, Hint (0 moves to the prefix), place X again → tapping X removes X only, piece 0 stays locked, nothing reports pressed (spec §3.3) — seen RED against `0665d585`'s panel (run it on a `.mutbak`-restored copy of that file or by reintroducing the slot-index selection as a mutation);
  - `Alt+ArrowLeft moves a placed piece one place and keeps focus on it` and announces `"{text}, position {n} of {total}"` in a polite region; Alt+Arrow never enters the prefix;
  - `hint moves a placed piece into the prefix` (Review Focus 2); `locks the answer while submitting` (taps and drops do nothing; Review Focus 1);
  - `drop inserts at the indicated index`: fire `dragstart` on a bank chip with `dataTransfer` mock, `dragover` on placed chip 1's right half, `drop` → piece inserted at 2 (the index math is a pure helper `dropIndex(rects: DOMRect[], x: number): number` exported from the panel file and unit-tested directly);
  - `wraps`: the tray and bank use `flex-wrap` and chips `max-w-full break-all` (class assertion; the visual check is Task 8).
- [ ] **Step 2: Failing feedback tests** (`listening-feedback.test.ts`): `wb_partial` carries `pieces` = wrong pieces' display joined (≤ 8 chars + "…"); `wb_fixed` counts previous `wrongPieces` now correct and not hinted; `wb_perfect` never when any piece is hinted; while answering (hint event) no piece text appears.
- [ ] **Step 3: Run** → FAIL.
- [ ] **Step 4: Implement.** Panel state = `answer: number[]` (piece indices, prefix enforced by `withHints` on every render from `hinted`); bank = `bankOrder(n, lineId)` minus `answer`; chips carry `data-piece={index}`, keys by index; native DnD (`draggable`, `onDragStart` sets `text/plain` = index, `onDragOver` `preventDefault` + indicator at `dropIndex`, `onDrop` → `insertPiece`; a drop outside the tray of a placed piece → `removePiece`); locked when `submitting || results || revealed`. Delete the selection state, the Remove button and their copy. Check enabled when `answer.length === n`; `onCheck(answer)`. `onProgress` true when any non-hinted piece is placed. Feedback: `summarize` → `wrongPieces`; `listeningFeedback` per Step 2 (`wb_partial` VI/EN copy gains `{pieces}`, e.g. vi "…Mảnh sai: {pieces}").
- [ ] **Step 5: E2E** (`practice-listening.spec.ts`, L-025): replace case 14 (select + Remove) with `drag a bank piece between two placed pieces` (`locator.dragTo` with a target position), `tap a placed piece returns it`, and `drag across a line change` (Review Focus 3: start a drag, press Next via keyboard, drop → new line's answer empty); cases 3/4/5/8 place pieces by tap in order from `chunks` (they now have word pieces: read the order from the `GET …/chunks` response the page made, never hard-code); scores in `%`.
- [ ] **Step 6: Run** unit → PASS; E2E `npx playwright test tests/e2e/practice-listening.spec.ts --workers=2` → PASS ×2. **Mutations:** (a) `removePiece` ignores `hintedCount` → I1/prefix test RED; (b) `dropIndex` off by one → drop test RED. Restore.
- [ ] **Step 7: Grep** (L-019, positive control in the same call): `rg -n "selected|removeSelected|aria-pressed" components/shadowing-workspace/practice/word-bank-panel.tsx` together with `rg -n "bankOrder" …` (must hit) → no selection code remains. Paste the output in the report.
- [ ] **Step 8: Commit** `feat(listening): word pieces by drag, tap and keyboard; selection removed (closes 9c I1)`.

---

### Task 6: "Chỉ nghe" — a remembered switch, video visible by default

**Files:**
- Modify: `components/shadowing-workspace/practice/listening-reveal-context.tsx`, `listen-cover.tsx` (or the Task 1 layout), `components/shadowing-workspace/workspace-player.tsx:55-58,98`, `listening-mode-body.tsx` (replay row), `messages/{en,vi}/shadowing.json` (`replay.listenOnly` "Listen only" / "Chỉ nghe"), `docs/superpowers/specs/2026-10-15-shadowing-practice-modes-design.md` (dated amendment note at D19 and §5.9 pointing to the new spec §3.5), `tests/e2e/practice-listening.spec.ts`
- Test: `listening-reveal-context.test.tsx`, `listening-mode-body.test.tsx`, `workspace-player.test.tsx`

**Interfaces:**
- Consumes: Task 1 `LISTEN_ONLY_LAYOUT`.
- Produces: `ListeningReveal` loses `videoVisible` / `showVideo`, gains `listenOnly: boolean` and `setListenOnly(on: boolean): void`; `listenOnly` is NOT part of `RevealState`'s key reset (it survives line, format and attempt changes for the provider's lifetime).

- [ ] **Step 1: Failing tests:** provider — `listenOnly` starts false; survives a key change (line), a format change and `newAttempt()`; player — no cover on entry; with `listenOnly` true the cover (or the Task 1 layout's hidden state) renders; its "Hiện video" calls `setListenOnly(false)` and focus moves to the play button; mode body — the headphones button (`aria-label` "Chỉ nghe", `aria-pressed` reflects the switch, wrapped in `Tooltip` with the same text) toggles it.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** (icon `listening-only` via `PracticeGlyph`; pressed look = the Loop button's classes; layout per Task 1: `cover` = today's `ListenCover`; `collapse` / `full-transcript` = a `data-listen-only` attribute on `#workspace-player-pane` with the CSS trialled in Task 1 in `globals.css`, iframe never `display:none`).
- [ ] **Step 4: E2E:** case 2 → video visible on entry (no `listen-cover`), controls checked again with "Chỉ nghe" on; new `listen-only survives Next and Try again`; `Hiện video turns it off and it stays off across Next and Try again`; the one-player marker holds across every toggle (marker kept, `onReady` once). Remove every "cover back" assertion. Subtitle concealment assertions unchanged.
- [ ] **Step 5: Run** unit + E2E → PASS ×2. **Mutation:** reset `listenOnly` in `concealed()` → `survives Next` RED. Restore.
- [ ] **Step 6: Commit** `feat(listening): video visible by default; Chỉ nghe is a remembered switch`.

---

### Task 7: Stat strip with the frame's bar look

**Files:**
- Modify: `components/shadowing-workspace/practice/lesson-stat-strip.tsx`, `messages/{en,vi}/shadowing.json` (`workspace.practice.strip`: `position` "Position: sentence {n} of {total}" / "Vị trí: câu {n}/{total}", `completed` "Completed" / "Đã hoàn thành", `accuracy` "Accuracy" / "Độ chính xác", `videoLeft` "Video left" / "Video còn lại", `minutes` "{count} min" / "{count} phút", `underMinute` "<1 min" / "<1 phút"), E2E specs that read the strip's old labels (sweep `tests/e2e/` for "Đã nộp", "Điểm TB", `strip`)
- Create: `lib/shadowing-workspace/video-remaining.ts`
- Test: `lesson-stat-strip.test.tsx`, `lib/shadowing-workspace/video-remaining.test.ts`

**Interfaces:**
- Produces: `videoRemainingSeconds(lines: { startTime: number; endTime: number | null }[], index: number | null, durationSeconds: number | null): number | null` — seconds (line times are seconds): `(durationSeconds ?? last line's endTime) − lines[index].startTime`, floored at 0; `null` when `index` is null or no end is known.

- [ ] **Step 1: Failing tests:** helper — duration 900, current start 0 → 900; no duration, last end 600, start 120 → 480; both unknown → null. Strip — four cells `sentence`, `completed`, `accuracy`, `videoLeft`; `completed` = `stats.scoredLines`, `accuracy` = rounded `stats.mean` (+`%` in Listening), `—` without stats; `videoLeft` "15 phút" for 900 s, "<1 phút" for 59 s, `—` for null; the position line is a marker (no fill width) with `role="img"` and `aria-label` "Vị trí: câu 31/431"; Pronunciation renders the same four cells.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** (marker `left: calc((n-1)/(total-1) * 100%)`, `bg-primary`; track `bg-border`; one row; cells keep `data-stat`). **Step 4: Run** → PASS; E2E sweep updated and run (`practice-listening`, `practice-pronunciation`, `summary`, `dashboard` specs).
- [ ] **Step 5: Mutation:** the marker as a filled bar (`width` instead of `left`) → the marker test RED. Restore.
- [ ] **Step 6: Commit** `feat(practice): stat strip takes the frame's bar look with real data`.

---

### Task 8: Gates, Chrome, review (then the B2 plan's Task 10)

- [ ] **Step 1:** Full vitest, `tsc --noEmit`, `lint`, `verify:protocol`; Playwright `practice-listening`, `practice-pronunciation`, `shadowing-workspace`, `summary`, `dashboard`, `route-rename-redirects` ×2.
- [ ] **Step 2: Chrome (controller, built branch on :3001, 1280×529, nav collapsed, dark and light):** the longest real line (20 pieces) and a median line in Word Bank — tray + bank wrap, Check reachable, no horizontal overflow (Review Focus 5); drag between pieces, tap remove, Alt+Arrow; "Chỉ nghe" on/off across Next / Try again with the video playing (no restart, same position); the strip marker; Typing with ♪. Compare the panel with Figma `123:2835` (L-051). Screenshots to the owner.
- [ ] **Step 3:** Whole-plan review (code-reviewer) over `92f6767d..HEAD`; fix rounds as in the SDD ledger.
- [ ] **Step 4:** Continue with the B2 plan's Task 10 (`docs/superpowers/plans/2026-10-21-practice-listening.md`): G4 typography, R33 Chrome items, whole-branch review, owner look. No merge before the owner approves in Chrome.
