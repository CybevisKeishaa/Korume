# Listening two exercises Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Listening becomes a picker of two exercises — Chép chính tả (typing + star mask; easy mode = word pieces) and Điền từ (cloze, ≤ 3 vocabulary blanks) — with a toolbar, card toggles, honest help accounting, Korume nudges after help, drafts that survive navigation, a scroll rail navigator, and migration 049 with every SQL/app consumer updated.

**Architecture:** The URL `?format=` carries the exercise (`dictation` | `cloze`, none → picker); the DB keeps formats `typing` / `word_bank` and adds `cloze`. "Helped" is one SQL function `dictation_attempt_helped(easy_mode, hinted_units)` mirrored by one TS function, used by stats, Summary, weekly skill and feedback. Cloze blanks are chosen on the server by a versioned selector over kuromoji tokens and stored on the attempt; scores stay server-side. Session state (listen-only, easy mode, drafts) lives in providers above the per-attempt reveal key, so it survives line, exercise and picker changes without remounting the player.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind (theme tokens), Supabase Postgres + pgTAP, kuromoji, `wanakana` (new, pinned), zod, vitest + RTL (jsdom), Playwright.

**Spec:** `docs/superpowers/specs/2026-10-26-listening-cloze-dictation-design.md` ("spec", § numbers below). It amends `docs/superpowers/specs/2026-10-23-listening-word-pieces-design.md` ("WP") and the B2 spec `docs/superpowers/specs/2026-10-15-shadowing-practice-modes-design.md`. Read the spec whole first; read WP §3 for Tasks 2, 3, 4, 8.

This plan **replaces** `docs/superpowers/plans/2026-10-23-listening-word-pieces.md` (never executed). Its Tasks 1–4 and 7 are carried over below (amended); its Task 5 becomes Task 8 here; its Task 6 is folded into Task 9.

## Global Constraints

- Worktree `C:\Users\tplon\Documents\GitHub\JPWeb\japan-web\.worktrees\practice-listening`, branch `practice-listening`, base `69037d58`. Every shell call `Set-Location`/`cd` into it in the same call; never build/serve/npm in the main checkout; no Serena edit tools.
- Never reset, migrate or write SQL to the owner's DB (at 048). Migration 049 and every SQL gate run only on disposable DBs `listening_t1_*` built with `.superpowers/sdd/2026-10-21-practice-listening/build-fresh.sh` and checked with `run-gates.sh`, then dropped (ruling R35); `npm run verify:db:*` scripts hit the owner's DB and are NOT run. If docker/psql is denied, the gate is UNMET and reported (L-050).
- Every new assertion seen RED once; every listed mutation RED, restored from `<file>.mutbak` (never `git checkout --`).
- vitest `--minWorkers=1 --maxWorkers=2`; Playwright `--workers=2` with `AI_PROVIDER=none`; check :3000 is free first, never reuse/kill a server you did not start (R37).
- Type only on `text-caption/body/body-lg/heading` (L-052); colours only theme keys; radius only `sm/md/lg/full`; no `min-w-control-*`/`size-control-*` (L-053). Korume's DNA, not the reference app's look (spec §0 header, §3.7).
- New dependency: `wanakana` only, exact version pinned in `package.json`, lockfile updated (spec §4). No drag-and-drop library (native HTML5 DnD).
- A chunker or cloze-selector version is never edited once an attempt references it; v1 chunker stays byte-for-byte.
- Scores are computed on the server only; stored scores are never recomputed.
- One YouTube player instance across picker, exercise switch, toggles (`onReady` once); the iframe is never `display:none`.
- Copy given by the owner is used verbatim (spec §3.0 picker texts, §3.7 examples); other VI/EN copy is drafted and listed for the owner.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Ponytail directive in every dispatch; lessons block (L-051/52/53, L-044, L-004, L-019, L-025) in every brief.

## Review Focus

1. Toggling Chế độ dễ mid-sentence (typed text present) → the typed draft is kept and returns when easy mode is turned off; the pieces draft likewise (Task 14 test `easy toggle keeps both drafts`).
2. Opening a cloze line whose blanks changed since the draft was made (known words grew, or a refetch) → the stale draft is dropped, never applied to other blanks (Task 14 test `cloze draft with other blanks is discarded`).
3. A late submit response arriving after the learner went back to the picker → it updates stats but never shows a result on the picker or on another exercise (Task 9 test `late response after Đổi bài tập`).
4. A line with Latin letters/digits in Điền từ (e.g. `ABCを買う`) → Latin tokens are never blanks; the rest of the line still works (Task 6 test `latin tokens are never candidates`).
5. A lesson of 431 lines → the rail scrolls the current chip into view on entry and after Next; wheel scrolls horizontally; no layout shift on hover (Task 14 tests `current chip in view`, `wheel scrolls horizontally`; Chrome in Task 16).

---

### Task 1: Chrome trial — how "Ẩn video" hides the video (controller + owner, no product code)

**Files:** none committed except the ledger line in `.superpowers/sdd/2026-10-21-practice-listening/progress.md`.

**Interfaces:**
- Produces: the owner's choice `LISTEN_ONLY_LAYOUT ∈ {"collapse", "full-transcript", "cover"}` recorded in the ledger, read by Task 9.

- [ ] **Step 1:** Build and serve the branch from the worktree on :3001 (`npx next build`, `npx next start -p 3001`, `AI_PROVIDER=none`); open `/vi/shadowing/<id>/listening` in the owner's Chrome at 1280×529 (nav collapsed).
- [ ] **Step 2:** Inject `<style id="trial">` for (a) **collapse**: `#workspace-player-pane` video box height to the control bar only (iframe kept, `height:0`/`visibility:hidden` on its frame box, never `display:none`), stat strip moves up; (b) **full-transcript**: the existing `group/pip` restyle of the same pane (`workspace-shell.tsx:238`) with the practice column taking the width; (c) today's cover. Measure with JS: practice panel height/width, rows visible for the longest real line (20 pieces) and a median line, control bar position.
- [ ] **Step 3:** Show the owner screenshots + numbers; record the choice and the numbers as a ruling in the ledger. Stop the server.

---

### Task 2: Chunker v2 and the word-bank answer model (WP plan Task 2, unchanged)

**Files:**
- Modify: `lib/dictation/chunk.ts` (add `chunkV2`, `CHUNKERS[2]`, `CURRENT_CHUNKER = 2`), `lib/validation/dictation.ts:19` (`chunkOrder` `.max(8)` → `.max(64)`)
- Create: `lib/dictation/word-bank-answer.ts`
- Test: `lib/dictation/chunk.test.ts`, `lib/dictation/word-bank-answer.test.ts`, `lib/validation/dictation.test.ts`

**Interfaces:**
- Produces: `CHUNKERS[2]: (textJp: string) => Promise<ChunkResult>`; `CURRENT_CHUNKER === 2`.
- Produces (`word-bank-answer.ts`, pure; `answer` = piece indices, hinted prefix first): `withHints(answer: number[], hinted: number[]): number[]`; `insertPiece(answer: number[], piece: number, at: number, hintedCount: number): number[]` (`at` clamped to `[hintedCount, len]`, an already placed piece is moved); `removePiece(answer: number[], piece: number, hintedCount: number): number[]` (no-op in the prefix); `movePiece(answer: number[], piece: number, delta: -1 | 1, hintedCount: number): number[]` (never enters the prefix or passes the end).

- [ ] **Step 1: Failing tests, chunker** (`describe("v2")`): `chunkLine("お店を検索すると思うんですけど。", 2)` → `chunks` `["お","店","を","検索","する","と","思う","ん","です","けど。"]`, `reliable: true`, `version: 2`; `今日は楽しいですね♪` → last piece ends with `♪`; `「こんにちは」と言った` → `「こんにちは」` bound, no punctuation-only piece; line-initial `"…"` binds forward; `"` odd opens / even closes; the ×2 fixture → 20 pieces (no merge); Latin/digit / unknown / single-token → unreliable with v1's reasons; every v1 test passes with explicit `version: 1`.
- [ ] **Step 2: Failing tests, answer model:** insert at 0 with `hintedCount 2` lands at 2; insert of a placed piece moves it; remove of a prefix piece is a no-op; `movePiece` at either edge is a no-op; `withHints([5,0,3],[0,1])` → `[0,1,5,3]`; property test (n ≤ 20, random insert/remove/move/withHints) → no duplicate, prefix stays `0..k-1`.
- [ ] **Step 3: Failing test, schema:** a 20-index `chunkOrder` parses; 65 does not.
- [ ] **Step 4: Run** `npx vitest run lib/dictation lib/validation --reporter=dot` → new tests FAIL.
- [ ] **Step 5: Implement.** `chunkV2` reuses v1's normalisation, reliability checks, the `UNKNOWN`-punctuation split (R20) and the quote rule; one piece per token; a token is punctuation iff `pos === "記号"` or every char matches `PUNCTUATION`; punctuation binds back, an opener (`isOpenBracket`) binds forward, a line-initial run binds forward. No `mergeDownTo`. `< 2` pieces → `single_chunk`.
- [ ] **Step 6: Run** → PASS; full vitest (update pins that mean "current" version, keep pins that mean "v1").
- [ ] **Step 7: Mutation:** drop the punctuation-binding branch → `けど。` test RED. Restore.
- [ ] **Step 8: Commit** `feat(listening): chunker v2 — one piece per word; pure word-bank answer model`.

---

### Task 3: Server LCS scoring for v2, hinted-prefix validation (WP plan Task 3, unchanged)

**Files:**
- Modify: `lib/dictation/listening-score.ts` (add `scoreWordBankLcs`), `lib/data/dictation.ts:76-82,110-119`
- Test: `lib/dictation/listening-score.test.ts`, `app/api/dictation/attempt/route.test.ts`

**Interfaces:**
- Consumes: Task 2 `CHUNKERS[2]`.
- Produces: `scoreWordBankLcs(chunks: string[], order: number[], hintedCount: number): ReturnType<typeof scoreWordBank>` — `slots[p] = { chunkIndex: order[p], correct, hinted: p < hintedCount }`, `score = pct(correct, n)`, `metrics = { recall: score, slots: { correct, total: n } }`.

- [ ] **Step 1: Failing tests** (`describe("scoreWordBankLcs")`): `["A","B","C","D"]`, `[1,2,3,0]`, k 0 → correct `[true,true,true,false]`, 75; duplicates `["私","を","見","を","待つ"]`, `[0,3,2,1,4]` → 100 (same with two `は`, two `です`); `["A","B","C"]`, `[0,2,1]`, k 1 → slot 0 hinted, 33.3; k = n → 0; **hinted prefix leaves the reference too**: `["A","B","A"]`, k 1, `[0,2,1]` → correct `[false,false,true]`, 33.3 (66.7 would be the mutation); stable tie: `["A","B"]`, `[1,0]` → `[false,true]` on two calls; `typingHintUnit` of a reliable v2 cut is `"chunk"`.
- [ ] **Step 2: Failing route tests:** v2 submit `hintedUnits: [1]` → 400; `hintedUnits: [0,1]` with `chunkOrder` not starting `[0,1]` → 400; v2 reveal `hintedUnits: [2]` → 400; `v1 attempts keep positional scoring` (`version: 1`, `[1,2,3,0]`-shaped → 0).
- [ ] **Step 3: Run** → FAIL.
- [ ] **Step 4: Implement `scoreWordBankLcs`** (the tie-break is what tests pin):

```ts
// a = texts at answer positions k..n-1, r = reference texts k..n-1
// dp[i][j] = LCS length of a[i..], r[j..]; walk forward:
// if a[i] === r[j] && dp[i][j] === dp[i+1][j+1] + 1 → match, i++, j++
// else if dp[i+1][j] >= dp[i][j+1] → i++  else → j++
```

- [ ] **Step 5: Wire** `submitListeningAttempt`: for `word_bank` and `version >= 2`, sorted `hintedUnits` must equal `0..k-1` (submit and reveal) and `chunkOrder.slice(0,k)` equal `0..k-1`, else 400; scorer by version.
- [ ] **Step 6: Run** → PASS. **Mutations:** `>=` → `>` (stable-tie RED); skip the prefix check (route test RED); LCS against the full reference (`A B A` test RED). Restore.
- [ ] **Step 7: Commit** `feat(listening): server LCS scoring for word pieces; hinted prefix validated`.

---

### Task 4: Typing ignores optional symbols; one-grapheme hint units; star mask model

**Files:**
- Modify: `lib/dictation/listening-score.ts`
- Create: `lib/dictation/star-mask.ts`
- Test: `lib/dictation/listening-score.test.ts`, `lib/dictation/star-mask.test.ts`

**Interfaces:**
- Produces: `export const TYPING_OPTIONAL = /[♪〜～→※]/u;` and `stripPunctuation(base: string, extra?: RegExp)` (WP §3.6); `scoreTyping` passes `TYPING_OPTIONAL` for both sides.
- Produces: `grapheme1Units(base: string): Range[]` — one range per grapheme of the filtered reference (after `stripPunctuation(base, TYPING_OPTIONAL)`), mapped back to `base` offsets; emoji never split.
- Produces (`star-mask.ts`): `type MaskCell = { kind: "star"; unit: number } | { kind: "shown"; text: string }`; `starMask(base: string): MaskCell[]` — a `star` per `grapheme1Units` entry (in order, `unit` = its index), punctuation and `TYPING_OPTIONAL` characters as `shown` cells in place (spec §3.3).

- [ ] **Step 1: Failing tests (optional symbols, WP plan Task 4):** `今日は楽しいですね♪` typed without `♪` → 100, no `missing`; same for `〜 ～ → ※`; typing the symbol → no `extra`; `50%` typed `50` → one `missing` (also `¥ + −`); a hinted range after a stripped `♪` marks exactly those chars; Kanji ratio of `漢字♪` typed `漢字` = 100.
- [ ] **Step 2: Failing tests (units, mask):** `grapheme1Units(normalizeJa("今は英語"))` → 4 ranges; `starMask("みなさん、こんにちは♪")` → 4 stars, `shown "、"`, 5 stars, `shown "♪"`, star `unit`s 0..8 in order; an emoji line keeps the emoji as one star; `scoreTyping` with hinted = `grapheme1Units(base)[2]` marks exactly char 2 hinted.
- [ ] **Step 3: Run** → FAIL. **Step 4: Implement.** **Step 5: Run** → PASS. **Mutations:** `TYPING_OPTIONAL` only on the reference side ("typed symbol → no extra" RED); `starMask` stars the `、` ("shown" test RED). Restore.
- [ ] **Step 6: Commit** `feat(listening): Typing ignores ♪〜→※; one-grapheme hint units and the star mask model`.

---

### Task 5: Migration 049 — cloze, easy mode, helped, every SQL consumer (disposable DBs only)

**Files:**
- Create: `supabase/migrations/20261026000049_listening_two_exercises.sql`, `supabase/migrations/20261026000049_listening_two_exercises.test.ts` (static pins, as `…048….test.ts`), `supabase/tests/listening-two-exercises.sql` (pgTAP)
- Modify: `scripts/verify-listening-gate.ps1` (also runs the new pgTAP file — for the owner's later use; not run here), `.superpowers/sdd/2026-10-21-practice-listening/run-gates.sh` (includes the new file)

**Interfaces:**
- Produces (SQL):
  - `dictation_attempts.format` ∈ `word_bank | typing | cloze`; `hint_unit` ∈ `chunk | grapheme4 | grapheme1` (drop/re-add the 048 inline checks; read their real names with `\d dictation_attempts` on the disposable DB first).
  - `easy_mode boolean not null default false`, backfilled `true` for `word_bank`; check `format <> 'word_bank' or easy_mode`.
  - `cloze_selector_version smallint`, `cloze_blanks smallint[]`, `cloze_answers text[]`; check `(format = 'cloze') = (cloze_selector_version is not null and cloze_blanks is not null)` and `format <> 'cloze' or status = 'revealed' or cloze_answers is not null`.
  - `dictation_attempt_helped(p_easy boolean, p_hinted int[]) returns boolean` — `language sql immutable`, body `select p_easy or cardinality(p_hinted) > 0`; execute granted to `authenticated` only (revoke from `public, anon`).
  - `practice_stats(p_video, p_mode, p_review_below)`: modes `dictation` (formats `typing`,`word_bank`; per line the latest submitted across both, latest of any status across both), `cloze`, `pronunciation`; any other mode raises `22023`. Listening JSON adds `helpedLines` (latest submitted helped) and line state `helped` = latest attempt submitted, helped, score ≥ threshold. Order: `revealed` > `unscored` > `needs_review` > `helped` > `scored`.
  - `lesson_summary_evidence`: drops `wordBankMean`/`typingMean`; adds `dictation` and `cloze` objects `{ mean, done, selfDone }` (`done` = lines with a latest submitted attempt in that exercise, `selfDone` = those not helped; `mean` over those latest scores; nulls/0 when none); per-line `listening[]` items gain `helped boolean`; `format` may be `cloze`.
  - `practice_activity`: unchanged body (already counts every format, `submitted` only, distinct lines) — the pgTAP pins it with a cloze row.
  - `weekly_skill_windows`, `weakness_scores`: Listening = `format = 'typing' and status = 'submitted' and not dictation_attempt_helped(easy_mode, hinted_units)`.

- [ ] **Step 1: Failing pgTAP** (`listening-two-exercises.sql`, fixtures per the 048 test style, own user + lesson): a `cloze` row inserts; a `cloze` row without `cloze_blanks` fails `23514`; a `word_bank` row with `easy_mode false` fails; `dictation_attempt_helped(false,'{}')` false, `(true,'{}')` true, `(false,'{1}')` true; `practice_stats(..,'dictation',80)` with a typing row (score 90, no hints) then a later word_bank row (score 95) on the same line → that line `helped`, `scoredLines` 1, `mean` 95, `helpedLines` 1; a helped row scoring 50 → `needs_review`; `'cloze'` mode sees only cloze rows; `'typing'` mode raises `22023`; `lesson_summary_evidence` with one unhelped typing (80), one helped typing (100, hinted `{0}`), one cloze (60) on three lines → `dictation.done` 2, `dictation.selfDone` 1, `dictation.mean` 90, `cloze.done` 1, `cloze.mean` 60; `practice_activity` counts the cloze line, not a revealed one; `weekly_skill_windows` and `weakness_scores` count the unhelped typing row only.
- [ ] **Step 2: Build disposable `listening_t1_t5` from 048** (`build-fresh.sh` with migrations up to 048), run the pgTAP file → FAIL (no 049).
- [ ] **Step 3: Write the migration.** Function bodies keep 048's shape; only the parts above change.
- [ ] **Step 4: Rebuild disposable from all migrations, run `run-gates.sh`** (048 + 049 files + every other pgTAP file the script runs) → 0 failures. Also apply 049 on a disposable DB that already holds 048-era rows (typing, word_bank, revealed, legacy unscored) and assert the backfill (`word_bank` → `easy_mode true`, others false).
- [ ] **Step 5: Mutations (disposable DB):** state order `helped` before `needs_review` → the 50-score test RED; weekly skill without the helped filter → its test RED. Restore; drop every `listening_t1_*` DB and show `\l` has none.
- [ ] **Step 6: Commit** `feat(db): 049 — cloze attempts, easy mode, helped; stats, summary, skill updated`.

---

### Task 6: Cloze selector, cloze scorer, romaji (pure, server-side)

**Files:**
- Modify: `package.json`, `package-lock.json` (`wanakana` exact version, `npm install wanakana@<latest stable> --save-exact` in the worktree)
- Create: `lib/dictation/cloze.ts`, `lib/japanese/romaji.ts`
- Test: `lib/dictation/cloze.test.ts`, `lib/japanese/romaji.test.ts`

**Interfaces:**
- Consumes: `tokenize` (`lib/japanese/tokenizer.ts`, `Token { surface, reading, base, pos, posDetail1 }`), `normalizeJa`, `displayMap`.
- Produces (`cloze.ts`):
  - `export const CURRENT_CLOZE_SELECTOR = 1;`
  - `clozeCandidates(tokens: Token[]): number[]` — spec §3.4 rule exactly.
  - `selectBlanks(tokens: Token[], known: Set<string>, max?: number /* 3 */): number[]` — ascending token indices; preference unknown (`base` and hiragana reading not in `known`) → longer surface → earlier; never two adjacent indices.
  - `type ClozeBlank = { token: number; surface: string; reading: string /* hiragana */ }`
  - `scoreCloze(blanks: ClozeBlank[], answers: string[], hinted: number[][]): { score: number; blanks: { correct: boolean; hinted: number }[]; metrics: { recall: number; slots: { correct: number; total: number } } }` — `hinted[b]` = hinted grapheme indices of blank b's reading (must be a prefix `0..h-1`, the caller validates); correct iff `normalizeJa(answer)` equals `normalizeJa(surface)` or `reading` (and equals `reading` when `h > 0`); blank score `(len − h) / len` if correct else 0; `score = round1(mean × 100)`; `slots.correct` = correct blanks with `h === 0`.
- Produces (`romaji.ts`): `toRomaji(katakanaOrHiragana: string): string` (wanakana `toRomaji`, Hepburn, `ん` before vowel/y → `n'`); `toHiraganaReading(katakana: string): string`; `lineRomaji(tokens: Token[]): string` (particles は/へ/を as `wa/e/o` when `pos === "助詞"`; tokens joined with spaces; punctuation kept).

- [ ] **Step 1: Failing tests, selector:** tokens of `泣いて帰った` → `泣い` never a candidate; `勉強して` → candidate `勉強`, not `し`/`て`; `食べる` candidate; `三つ` (数) and `それ` (代名詞) and `こと` (非自立) not; `ABCを買う` → `ABC` not a candidate (Review Focus 4), `買う` is; a 5-candidate line → exactly 3, ascending; two adjacent candidates → only the preferred; known `{ "英語" }` → `英語` chosen last; no candidate → `[]`.
- [ ] **Step 2: Failing tests, scorer:** blank `勉強/べんきょう`: answer `勉強` → correct 100; `べんきょう` → 100; `べんきょ` → 0; hinted `[0]` + answer `べんきょう` → `(5−1)/5` = 80; hinted `[0]` + answer `勉強` → wrong 0; all hinted → 0; two blanks (100, 0) → 50; `slots.correct` excludes hinted blanks.
- [ ] **Step 3: Failing tests, romaji:** `キャ`→`kya`; `ガッコウ`→`gakkou`; `ラーメン`→`raamen`; `シンヨウ`→`shin'you`; `コンニチハ` as one token → `konnichiha`; `lineRomaji` of `私は学校へ行く` → `watashi wa gakkou e iku`.
- [ ] **Step 4: Run** → FAIL. **Step 5: Implement** (install `wanakana` first; `npm ls wanakana` shows one exact version). **Step 6: Run** → PASS.
- [ ] **Step 7: Mutations:** drop `surface === base` → `泣い` test RED; drop the adjacency rule → adjacent test RED; ignore `h` in blank score → 80 test RED. Restore.
- [ ] **Step 8: Commit** `feat(listening): cloze selector + scorer; romaji via wanakana`.

---

### Task 7: Server routes — cloze payload and submit; typing star hints; easy mode stored

**Files:**
- Create: `app/api/lines/[lineId]/cloze/route.ts`, `lib/data/line-cloze.ts`
- Modify: `lib/validation/dictation.ts`, `lib/data/dictation.ts`, `lib/data/line-chunks.ts` (adds `romaji`), `lib/dictation/types.ts`, `lib/dictation/listening-score.ts` types (`ListeningSubmitData` gains `blanks?`), `lib/data/practice-stats.ts`, `app/api/shadowing/[id]/practice-stats/route.ts`, `lib/shadowing-workspace/learning-modes.ts`
- Test: `app/api/lines/[lineId]/cloze/route.test.ts`, `app/api/dictation/attempt/route.test.ts`, `lib/validation/dictation.test.ts`, `lib/data/practice-stats.test.ts`, `lib/shadowing-workspace/learning-modes.test.ts`, `lib/helped.test.ts`

**Interfaces:**
- Consumes: Task 5 columns/functions; Task 6 `selectBlanks`, `scoreCloze`, `lineRomaji`, `toHiraganaReading`; `getKnownVocabLemmas` (`lib/data/difficulty.ts:63`).
- Produces:
  - `lib/helped.ts`: `isHelped(attempt: { easyMode: boolean; hintedUnits: readonly number[] }): boolean` — the TS twin of `dictation_attempt_helped`.
  - `LineChunks` gains `romaji: string`.
  - `LineCloze` (`lib/dictation/types.ts`): `{ version: number; textHash: string; blanks: number[]; segments: { text: string; blank: number | null; romaji: string }[]; readings: string[] }` — `segments` cover the raw `text_jp` in order (display characters, P13); `blank` = index into `blanks`; a blank segment's `romaji` is `"___"`; `readings[b]` hiragana of blank b. Lines with no candidate → `blanks: []`.
  - `GET /api/lines/[lineId]/cloze` → `{ data: LineCloze }`, `Cache-Control: private, no-store`, same 400/401/404/500 shape as the chunks route.
  - Validation adds `{ kind: "submit", format: "cloze", ...head, blanks: number[] (1..3), answers: string[] (each ≤ 50, same length), easy: boolean }` and `{ kind: "reveal", format: "cloze", ...head, blanks, easy }`; `head.version` = cloze selector version for cloze; typing `hintUnit` enum adds `"grapheme1"`.
  - `submitListeningAttempt` for `cloze`: re-tokenise, `blanks` must equal a subset of `clozeCandidates` (ascending, non-adjacent) else 400; `hintedUnits` = flat indices over the blanks' readings concatenated, per blank a prefix, else 400; insert `format 'cloze'`, `cloze_selector_version`, `cloze_blanks`, `cloze_answers` (null on reveal), `easy_mode = easy`, `hint_unit 'grapheme1'` when hinted, `chunker_version` = current chunker, `chunk_snapshot` = blank surfaces. Typing accepts `hintUnit "grapheme1"` (units `grapheme1Units(base)`) as well as the legacy `typingHintUnit(cut)`. `word_bank` inserts `easy_mode true`. Response `ListeningSubmitData` for cloze: `{ kind: "submit", score, blanks: { correct, hinted }[], metrics, answer: text, helped: boolean }`; every submit response gains `helped: boolean` (from `isHelped`).
  - `learning-modes.ts`: `type ListeningExercise = "dictation" | "cloze"`; `type ListeningFormat = "word_bank" | "typing" | "cloze"`; `listeningExercise(param: string | null): { exercise: ListeningExercise | null; easyFromLegacy: boolean; legacy: boolean }` (`dictation`/`cloze` → as is; `typing` → dictation, legacy; `word_bank` → dictation, easyFromLegacy, legacy; else `null`); `dictationFormat(easy: boolean): "typing" | "word_bank"`; `PracticeStatsMode = "pronunciation" | ListeningExercise`; `practiceStatsMode(mode: PracticeModeId, exercise: ListeningExercise | null): PracticeStatsMode | null` (Listening with `null` → `null`).
  - `loadPracticeStats(videoId, mode: PracticeStatsMode)`: `REVIEW_BELOW` keys `pronunciation | dictation | cloze`; schema accepts state `helped` and optional `helpedLines`; `PracticeLineState` adds `"helped"`; `PracticeStats` gains `helpedLines: number | null`.

- [ ] **Step 1: Failing tests:** cloze route — 400 bad id, 401, 404, ok payload for `泣いて勉強した` has one blank on `勉強`, `segments` join back to the raw text, blank `romaji` `___`; known words passed through (mock `getKnownVocabLemmas`) change which blank is picked; submit — cloze with a non-candidate index → 400; adjacent blanks → 400; hinted not a prefix → 400; a valid cloze submit inserts `easy_mode` from the body and the cloze columns and returns `helped`; cloze reveal inserts `cloze_answers null`; typing with `hintUnit "grapheme1"` and `hintedUnits [2]` scores char 2 as hinted; word_bank insert has `easy_mode true`; schema — 4 answers rejected, a 51-char answer rejected; `isHelped` table matches the SQL function's three cases; `listeningExercise` table (incl. `"foo"` → null); `practiceStatsMode("listening", null)` → null; `loadPracticeStats` rejects `"typing"`, parses `helped`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS, full vitest (fix every caller of the old `ListeningFormat`/`practiceStatsMode`/`listeningFormat` that tsc names; `workspace-shell.tsx:145-146` passes the exercise).
- [ ] **Step 5: Mutations:** accept a non-candidate blank (its test RED); `word_bank` insert without `easy_mode` (its test RED). Restore.
- [ ] **Step 6: Commit** `feat(listening): cloze route + submit, star hints, easy mode stored, exercise-level stats`.

---

### Task 8: Word pieces panel — sequence answer, drag, tap, keyboard; WB feedback for v2 (WP plan Task 5)

Carried over from the WP plan's Task 5 without change of behaviour; read WP §3.2–§3.3 and §3.8. Differences only: the panel is rendered by Chép chính tả when Chế độ dễ is on (wiring in Task 10), and `wb_perfect` is never produced for an easy-mode attempt — Task 13 adds the helped family that replaces it, so Task 8 keeps today's `wb_perfect` rule and Task 13 changes it.

**Files:**
- Modify: `components/shadowing-workspace/practice/word-bank-panel.tsx`, `use-listening-attempt.ts` (`summarize`, feedback event), `lib/dictation/listening-feedback.ts` (`checked_word_bank`), `messages/{en,vi}/shadowing.json` (drop `removeSelected`, `slotState.selected`; add `moved`; `wb_partial` gains `{pieces}`), `tests/e2e/practice-listening.spec.ts`
- Test: `word-bank-panel.test.tsx`, `listening-mode-body.test.tsx`, `lib/dictation/listening-feedback.test.ts`

**Interfaces:**
- Consumes: Task 2 answer helpers; Task 3 `slots` per answer position.
- Produces: `WordBankPanel` props unchanged except `results` per answer position; `PreviousResult.wrongPieces?: number[]` replaces `wrongSlots`, `PreviousResult` gains `version: number; textHash: string` (`wb_fixed` / `ty_fewer` only against the same line, format, version, textHash); feedback event `{ kind: "checked_word_bank"; slots; display: string[]; previous: { wrongPieces: number[] } | null }`; exported pure `dropIndex(rects: DOMRect[], x: number): number`.

- [ ] **Step 1: Failing unit tests** (by name): `tap in the bank appends`; `tap on a placed piece returns exactly that piece` (two identical-text pieces, by `data-piece`); `no selection state` (no `aria-pressed="true"`, no Remove button); **I1** `a hint never makes another piece removable by proxy` (place X, place 0, Hint, place X → tapping X removes X only) seen RED against `0665d585`'s selection logic as a mutation; `Alt+ArrowLeft moves a placed piece one place and keeps focus on it` + polite `"{text}, position {n} of {total}"`, never into the prefix; `hint moves a placed piece into the prefix`; `locks the answer while submitting`; `drop inserts at the indicated index` (+ `dropIndex` unit); `wraps` (`flex-wrap`, chips `max-w-full break-all`).
- [ ] **Step 2: Failing feedback tests:** `wb_partial` `pieces` (≤ 8 chars + "…"); `wb_fixed` from `wrongPieces`; `no comparison across versions`; `wb_perfect` never with a hinted piece; no piece text while answering.
- [ ] **Step 3: Run** → FAIL. **Step 4: Implement** per WP plan Task 5 Step 4 (native DnD, keys by index, locked while `submitting || results || revealed`, selection code deleted).
- [ ] **Step 5: E2E:** replace case 14 with `drag a bank piece between two placed pieces`, `tap a placed piece returns it`, `drag across a line change` (start drag, Next by keyboard, drop → new line empty); cases placing pieces read the order from the page's `GET …/chunks` response. (These cases open `?format=dictation` with Chế độ dễ on once Task 10 lands; until then `?format=word_bank` still reaches the panel.)
- [ ] **Step 6: Run** unit → PASS; E2E `practice-listening.spec.ts` → PASS ×2. **Mutations:** `removePiece` ignores `hintedCount` (I1 RED); `dropIndex` off by one (drop RED). Restore.
- [ ] **Step 7: Grep (L-019, positive control in the same call):** `rg -n "selected|removeSelected|aria-pressed" components/shadowing-workspace/practice/word-bank-panel.tsx; rg -n "bankOrder" components/shadowing-workspace/practice/word-bank-panel.tsx` → only the positive control hits. Paste output.
- [ ] **Step 8: Commit** `feat(listening): word pieces by drag, tap and keyboard; selection removed (closes 9c I1)`.

---

### Task 9: Picker, exercise shell, toolbar (Ẩn video, Phím tắt, Chế độ dễ)

**Files:**
- Create: `components/shadowing-workspace/practice/listening-picker.tsx`, `listening-toolbar.tsx`, `listening-shortcuts.tsx`
- Modify: `listening-mode-body.tsx`, `listening-reveal-context.tsx`, `components/shadowing-workspace/workspace-shell.tsx`, `workspace-player.tsx` / `listen-cover.tsx` (per `LISTEN_ONLY_LAYOUT`), `app/globals.css` (only if Task 1 chose collapse/full-transcript), `messages/{en,vi}/shadowing.json`, the B2 spec (dated amendment note at D19 and §5.9 → spec §3.2 / WP §3.5), `tests/e2e/practice-listening.spec.ts`
- Delete: `listening-format-switch.tsx` and its test
- Test: `listening-picker.test.tsx`, `listening-toolbar.test.tsx`, `listening-reveal-context.test.tsx`, `listening-mode-body.test.tsx`, `workspace-player.test.tsx`

**Interfaces:**
- Consumes: Task 1 `LISTEN_ONLY_LAYOUT`; Task 7 `listeningExercise`, `dictationFormat`, `ListeningFormat`; practice stats for the picker's progress.
- Produces:
  - `ListeningRevealProvider({ lineId, format: ListeningFormat | null, children })`; `ListeningReveal` loses `videoVisible`/`showVideo`, gains `listenOnly: boolean`, `setListenOnly(on: boolean)`, `easy: boolean`, `setEasy(on: boolean)` — both outside the reveal key (survive line, exercise, picker, attempt).
  - `ListeningPicker({ onChoose(exercise: ListeningExercise): void })` — two `button` cards with the owner's copy (spec §3.0) and, per exercise, `"{done}/{total} câu đã làm"` from that exercise's stats when `done > 0`.
  - `ListeningToolbar()` — Ẩn video (`aria-pressed`=listenOnly), Phím tắt (popover via the existing popover/tooltip primitives in `components/ui`), Chế độ dễ (`aria-pressed`=easy; `disabled` with the D9 notice as tooltip when the current dictation line is unreliable).
  - Exercise rendering until Tasks 10/11: `dictation` renders today's `TypingPanel` / `WordBankPanel` by `dictationFormat(easy)`; `cloze` renders a placeholder notice (replaced in Task 11). The exercise header shows the name, "Đổi bài tập", and `n/total` only if the strip does not already show it at 1280×529 (measure, record in the report).
  - URL rules in `ListeningModeBody`: `exercise === null` → picker; legacy → `router.replace` to `format=dictation` (+ `setEasy(true)` for `word_bank`); choose → `router.replace(?format=…)`; "Đổi bài tập" (exercise header) → `router.replace` without `format`. All with `{ scroll: false }`.
  - VI/EN keys (namespace `shadowing.workspace.practice.listening`): `picker.heading`, `picker.dictation.{title,body,tag}`, `picker.cloze.{title,body,tag}`, `picker.progress`, `exercise.dictation`, `exercise.cloze`, `changeExercise` ("Đổi bài tập" / "Change exercise"), `toolbar.hideVideo` ("Ẩn video" / "Hide video"), `toolbar.shortcuts` ("Phím tắt" / "Shortcuts"), `toolbar.easy` ("Chế độ dễ" / "Easy mode").

- [ ] **Step 1: Failing unit tests:** `no format shows the picker` (heading + 2 cards, owner copy verbatim); `choosing Chép chính tả replaces the URL with format=dictation` (router mock, `scroll:false`); same for cloze; `unknown format shows the picker`; `format=word_bank maps to dictation with easy on`; `format=typing maps to dictation`; `Đổi bài tập removes format`; `picker progress only from real stats` (absent with no stats); provider — `listenOnly` and `easy` start false and survive a line change, an exercise change, `newAttempt()` and a `format: null` (picker) render; toolbar — Ẩn video toggles `aria-pressed`, Phím tắt opens a popover listing `Alt+H` and closes on Escape with focus back on the button, Chế độ dễ disabled with the notice on an unreliable dictation line; `late response after Đổi bài tập` (Review Focus 3: submit pending, go to picker, resolve → no result rendered, stats `refresh` called).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** (delete the format switch; the Replay row loses any listen-only button; layout of the hidden state per Task 1; iframe never `display:none`).
- [ ] **Step 4: E2E:** `picker on entry`, `deep link opens the exercise`, `Đổi bài tập returns to the picker`, `one player across picker, exercises and Ẩn video` (`fake-yt` marker, `onReady` once), `Ẩn video survives Next and Try again`, `turning it off stays off`; remove every "cover back" assertion; subtitle concealment assertions unchanged; existing cases enter via `?format=dictation`.
- [ ] **Step 5: Run** unit + E2E → PASS ×2. **Mutations:** reset `listenOnly` in `concealed()` (`survives` RED); picker shown when `format=dictation` (deep link RED). Restore.
- [ ] **Step 6: Commit** `feat(listening): exercise picker, Đổi bài tập, toolbar with Ẩn video / Phím tắt / Chế độ dễ`.

---

### Task 10: Chép chính tả — star mask, star reveal, 💡 = show answer, easy mode wiring

**Files:**
- Create: `components/shadowing-workspace/practice/star-mask.tsx`
- Modify: `typing-panel.tsx`, `listening-mode-body.tsx`, `use-listening-attempt.ts`, `messages/{en,vi}/shadowing.json`, `tests/e2e/practice-listening.spec.ts`
- Test: `star-mask.test.tsx`, `typing-panel.test.tsx` (create if absent), `listening-mode-body.test.tsx`

**Interfaces:**
- Consumes: Task 4 `starMask`, `grapheme1Units`; Task 7 typing `hintUnit "grapheme1"`; Task 9 `easy`; Task 8 `WordBankPanel`.
- Produces:
  - `StarMask({ cells: MaskCell[], revealed: ReadonlySet<number>, display: (unit: number) => string, onReveal?(unit: number): void })` — `onReveal` absent = not tappable (easy mode); roving tabindex, Arrow keys, Enter reveals; names `"Ký tự {n} trên {total}, ẩn"` / `"Character {n} of {total}, hidden"`; revealed cells in the hinted tone.
  - `useListeningAttempt(lineId, format)` gains `revealUnit(unit: number): void` (adds to `hinted`, typing only, unit `grapheme1`); typing submissions send `hintUnit: "grapheme1"`.
  - In dictation (format already `dictationFormat(easy)` from Task 9): 💡 button (Alt+H) calls `reveal()`; the old Hint button and the Show answer button are not rendered for dictation; after 💡 the full sentence shows as plain text in place of the mask. Easy mode: `WordBankPanel` with the mask above it (not tappable) and WP's piece Hint.
  - Keys: `dictation.placeholder` ("Nhập những gì bạn nghe được…" / "Type what you hear…"), `dictation.showAll` (tooltip "Hiện cả câu (Alt+H)" / "Show the sentence (Alt+H)"), `star.hidden`, `star.shown`.

- [ ] **Step 1: Failing tests:** mask renders 14 stars for `今は英語だけに集中しています`; clicking star 5 reveals `だ` only and posts nothing; Enter on a focused star reveals it; the submit body carries `hintUnit "grapheme1"`, `hintedUnits [4]`; Alt+H calls `reveal`, after which no star is in the DOM and the sentence text is; no Hint / Show answer button in dictation; easy on → `WordBankPanel` renders, stars have no button role; easy off → typing returns.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: E2E:** `tap a star reveals one character`, `💡 shows the sentence and labels Đã xem đáp án`, `easy mode shows word pieces`. **Step 5: Run** → PASS ×2.
- [ ] **Step 6: Mutation:** `revealUnit` adds `unit + 1` → star-5 test RED. Restore.
- [ ] **Step 7: Commit** `feat(listening): Chép chính tả star mask, per-character reveal, 💡 shows the sentence`.

---

### Task 11: Điền từ panel

**Files:**
- Create: `components/shadowing-workspace/practice/cloze-panel.tsx`, `components/shadowing-workspace/practice/use-line-cloze.ts`
- Modify: `listening-mode-body.tsx`, `use-listening-attempt.ts` (cloze submit/reveal/hint), `messages/{en,vi}/shadowing.json`, `tests/e2e/practice-listening.spec.ts`
- Test: `cloze-panel.test.tsx`, `listening-mode-body.test.tsx`

**Interfaces:**
- Consumes: Task 7 `LineCloze`, cloze submit/reveal bodies, response `blanks`; Task 9 `easy`.
- Produces:
  - `useLineCloze(lineId: string | null): { cloze: LineCloze | null; status: "loading" | "ready" | "error"; reload(): void }` — same abort/stale rules as the chunks fetch in `use-listening-attempt.ts:76-94`.
  - `ClozePanel({ cloze, easy, answers, hinted, results, revealed, submitting, onChange(answers: string[]), onUseChip(), onCheck() })` — inline inputs (`aria-label` "Chỗ trống {n}" / "Blank {n}", min width `5ch`, grows with input), hinted characters prefilled and read-only at the start of the box; easy mode: shuffled chips of `cloze.segments` blank texts (`bankOrder`-style deterministic shuffle by line id), tap → fills the focused or first empty blank, tap a filled blank → returns its chip; results: correct / wrong / hinted tone + icon per blank.
  - `useListeningAttempt` for `cloze`: `hintCloze()` (next grapheme of the lowest unfinished blank's `readings[b]`), `easyUsed` latched true on the first chip use, submit body `{ format: "cloze", version: cloze.version, blanks: cloze.blanks, answers, easy: easyUsed, hintedUnits }`, reveal body likewise.
  - No-candidate line: `"Câu này không có từ để điền"` / `"This sentence has no word to fill"` + a Câu tiếp button; no Kiểm tra.
  - Keys: `cloze.blank`, `cloze.noBlank`, `cloze.check` ("Kiểm tra" / "Check"), `cloze.showAnswer` ("Xem đáp án" / "Show answer"), `cloze.hint` ("Gợi ý (Alt+H)" / "Hint (Alt+H)").

- [ ] **Step 1: Failing tests:** two blanks render as inputs in sentence order; Kiểm tra disabled until both have text; Alt+H twice on blank `べんきょう` prefills `べん`, read-only; easy on → chips; tapping a chip fills the first empty blank and latches `easy: true` in the submit body; tapping a filled blank returns the chip; results show per-blank tone + a non-colour icon; 👁 calls reveal and fills every blank with the surface; no-candidate line shows the notice and Câu tiếp, no inputs.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: E2E:** `cloze: fill and check`, `cloze: easy chips`, `cloze: hint prefills kana`, `cloze: show answer`. **Step 5: Run** → PASS ×2.
- [ ] **Step 6: Mutation:** `easyUsed` resets on chip return → latch test RED. Restore.
- [ ] **Step 7: Commit** `feat(listening): Điền từ panel — inline blanks, easy chips, kana hints, show answer`.

---

### Task 12: Card toggles — sentence audio, translation, romaji

**Files:**
- Create: `components/shadowing-workspace/practice/listening-card-toggles.tsx`
- Modify: `listening-mode-body.tsx`, `cloze-panel.tsx`, `typing-panel.tsx`, `listening-reveal-context.tsx` (toggle state), `messages/{en,vi}/shadowing.json`
- Test: `listening-card-toggles.test.tsx`, `listening-mode-body.test.tsx`

**Interfaces:**
- Consumes: `line.textTranslation`; `LineChunks.romaji`, `LineCloze.segments[].romaji` (Task 7); `controller.seekToSentence(index, { play: true })`.
- Produces: `ListeningReveal` gains `showTranslation: boolean`, `showRomaji: boolean`, `setShowTranslation`, `setShowRomaji` (page-visit state, outside the reveal key); `ListeningCardToggles({ index, translationAvailable, answerSurfacesAllowed })` — 🔊 / Bản dịch / Romaji buttons (`aria-pressed`, tooltips "Âm thanh" / "Bản dịch" / "Phiên âm"); `answerSurfacesAllowed = exercise === "cloze" || answerVisible` (spec §3.5, D4).

- [ ] **Step 1: Failing tests:** 🔊 calls `seekToSentence(index, { play: true })`; Bản dịch hidden when `textTranslation` is null; in dictation, translation and romaji buttons are disabled and nothing renders before Check, enabled after Check and after 💡; in cloze both work while answering and a blank's romaji is `___`; toggles survive Next.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Mutation:** `answerSurfacesAllowed` always true → the dictation-before-Check test RED. Restore.
- [ ] **Step 6: Commit** `feat(listening): card toggles — sentence audio, translation, romaji (D4-safe)`.

---

### Task 13: Feedback — helped family, cloze messages, Korume nudges

**Files:**
- Modify: `lib/dictation/listening-feedback.ts`, `use-listening-attempt.ts`, `listening-feedback.tsx`, `listening-feedback-korume.tsx` (mood only if needed), `messages/{en,vi}/shadowing.json`
- Test: `lib/dictation/listening-feedback.test.ts`, `listening-feedback-korume.test.tsx`, `listening-mode-body.test.tsx`

**Interfaces:**
- Consumes: response `helped` (Task 7), `blanks` (Task 7/11), the help kinds used in the attempt (client knows: stars/hints count, `easy`).
- Produces: feedback events gain `help: { stars: number; hints: number; easy: boolean } | null`; new ids `ty_helped`, `wb_helped`, `cz_helped` (each with `all` / `partial` variants), `cz_perfect`, `cz_partial` (`{correct}`, `{total}`, `{words}` = wrong blanks' surfaces after Check), `cz_hinted`; `feedbackMood` never `joy` when `help !== null`; `*_perfect` only when `help === null`; `*_fixed` / `ty_fewer` only with a valid previous result (same line, format, version, textHash — Task 8 rule; for cloze: same `blanks`).
- VI copy (owner's examples are the model; final strings drafted and listed for the owner):
  - `wb_helped.partial`: "Bạn đã làm đúng {correct}/{total} mảnh. Lần này có sử dụng trợ giúp. Hãy thử nghe lại và tự hoàn thành câu mà không dùng gợi ý nhé!"
  - `cz_helped.all` (easy): "Bạn đã điền đúng cả {total} từ! Lần tới, thử tự gõ những từ này xem sao nhé."
  - The others follow the same pattern: real counts, the help used named plainly, an invitation, no judging words.

- [ ] **Step 1: Failing tests:** a word_bank (easy) result 8/10 → `wb_helped.partial` with 8 and 10, mood not joy, no `wb_perfect`; a typing result with 2 stars and 100% → `ty_helped.all`, not `ty_perfect`; cloze easy 3/3 → `cz_helped.all`; unhelped cloze 3/3 → `cz_perfect`, joy allowed; cloze 1/3 → `cz_partial` naming the two wrong answers; no `*_fixed` on a first attempt; Korume absent while answering and present after Check / 💡 / 👁; the live region holds no answer text while answering (existing observer case extended to cloze).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Mutation:** allow `*_perfect` when helped → the 100%-with-stars test RED. Restore.
- [ ] **Step 6: Commit** `feat(listening): Korume nudges after help; cloze feedback; perfect praise only when unhelped`.

---

### Task 14: Drafts across navigation and the picker; chip rail; helped tone

**Files:**
- Create: `components/shadowing-workspace/practice/listening-drafts.tsx`
- Modify: `workspace-shell.tsx` (provider above the Listening body and the picker), `use-listening-attempt.ts`, `typing-panel.tsx`, `word-bank-panel.tsx`, `cloze-panel.tsx`, `sentence-navigator.tsx`, `app/globals.css` (rail scrollbar), `messages/{en,vi}/shadowing.json` (`navigator.state.helped` "có trợ giúp" / "with help", `navigator.draft` "đang làm dở" / "in progress")
- Test: `listening-drafts.test.tsx`, `sentence-navigator.test.tsx`, `listening-mode-body.test.tsx`

**Interfaces:**
- Consumes: Task 7 `PracticeLineState "helped"`; Tasks 10/11 panel state.
- Produces:
  - `type ListeningDraft = { hinted: number[]; input?: string; answer?: number[]; blanks?: number[]; answers?: string[]; easyUsed?: boolean }`.
  - `ListeningDraftsProvider({ children })`; `useListeningDraft(key: string | null): { draft: ListeningDraft | undefined; save(d: ListeningDraft): void; clear(): void }` with `key = \`${lineId}|${format}\``; `useDraftLineIds(format: ListeningFormat | null): ReadonlySet<string>`. In-memory only (a `Map` in a ref + a version counter for re-render); nothing touches storage.
  - `useListeningAttempt` restores `hinted` from the draft on a fresh key that is not a Try again; panels initialise from the draft and `save` on change; a successful submit or reveal `clear`s. A cloze draft whose `blanks` differ from the current `LineCloze.blanks` is discarded (Review Focus 2). The D12-era discard comment in `listening-mode-body.tsx` is updated.
  - Navigator: a horizontal scroll rail of all chips (`overflow-x-auto`, `scroll-snap` optional), current chip `scrollIntoView({ inline: "center", block: "nearest" })` on index change, ‹ › scroll by the rail's `clientWidth`, wheel `deltaY` → `scrollLeft` when the rail overflows, thin scrollbar visible on hover/focus-within only (no layout shift: reserve `scrollbar-gutter: stable` or an overlay track), tone `helped`, a draft dot (`aria-label` adds "đang làm dở").

- [ ] **Step 1: Failing tests:** typed text on line 3, go to line 4 and back → text restored; `easy toggle keeps both drafts` (Review Focus 1); picker round-trip keeps the draft; reload (provider remount) drops it; hints restored with the draft and sent on submit; submit clears the draft; `cloze draft with other blanks is discarded` (Review Focus 2); navigator — 431 chips render, `current chip in view` (scrollIntoView called with `inline: "center"` on mount and after Next), `wheel scrolls horizontally`, `helped` tone + label, draft dot + label.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: E2E:** `draft survives sentence change`, `draft survives Đổi bài tập`, `rail scrolls to the current chip`. **Step 5: Run** → PASS ×2.
- [ ] **Step 6: Mutations:** key drafts by line only (the easy-toggle test RED); skip the blanks check (Review Focus 2 test RED). Restore.
- [ ] **Step 7: Commit** `feat(listening): drafts survive navigation and the picker; scroll rail navigator; helped tone`.

---

### Task 15: Stat strip and Summary rows (WP plan Task 7 + spec §3.10 app side)

**Files:**
- Modify: `components/shadowing-workspace/practice/lesson-stat-strip.tsx`, `lib/summary/snapshot.ts`, `lib/summary/load-snapshot.ts`, `components/lesson-summary/lesson-status-card.tsx`, every reader of `listeningWordBank` / `listeningTyping` / `wordBankMean` / `typingMean` (grep `rg -n "listeningWordBank|listeningTyping|wordBankMean|typingMean" app components lib tests`), `messages/{en,vi}/*.json` (strip keys per WP plan Task 7; Summary rows "Chép chính tả" / "Dictation", "Điền từ" / "Fill the gaps", `selfDone` "Tự làm {count}/{total} câu" / "On your own {count}/{total}"; review reason `cloze` "Điền từ" / "Fill the gaps")
- Create: `lib/shadowing-workspace/video-remaining.ts`
- Test: `lesson-stat-strip.test.tsx`, `lib/shadowing-workspace/video-remaining.test.ts`, `lib/summary/snapshot.test.ts`, `lib/summary/load-snapshot.test.ts`, the status card test, E2E `summary.spec.ts`, `dashboard` spec

**Interfaces:**
- Consumes: Task 5 `lesson_summary_evidence` shape; Task 7 `PracticeStats.helpedLines`.
- Produces: `videoRemainingSeconds(lines, index, durationSeconds): number | null` (WP plan Task 7); `lessonEvidenceSchema` with `dictation`/`cloze` `{ mean: number | null; done: number; selfDone: number }` and listening items `format: "word_bank" | "typing" | "cloze"`, `helped: boolean`; `LessonSnapshot.status.listeningDictation` / `listeningCloze` = `ModeState` whose `scored` kind carries `selfDone: { count: number; of: number }`; review reason `cloze` for a weak cloze line (focus span falls back to grammar).

- [ ] **Step 1: Failing tests:** WP plan Task 7 Step 1 (helper + strip cells, marker not a fill); strip `completed` for dictation counts typing + word_bank lines; snapshot — evidence with a `cloze` listening row parses (the regression: today it throws at `snapshot.ts:111`); two independent rows, never averaged (dictation 90, cloze 60 stay 90 and 60); `selfDone` 1/2 shown; a weak cloze line → reason `cloze`; status card renders both rows and the self-done line.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS; E2E `summary`, `dashboard`, `practice-listening`, `practice-pronunciation` → PASS ×2.
- [ ] **Step 5: Mutations:** marker as a filled bar (marker test RED); drop `cloze` from the schema enum (cloze-row test RED). Restore.
- [ ] **Step 6: Commit** `feat(practice): strip with the frame's bar look; Summary rows Chép chính tả + Điền từ with self-done`.

---

### Task 16: Gates, Chrome, review (then the B2 plan's Task 10)

- [ ] **Step 1:** Full vitest, `tsc --noEmit`, `lint`, `verify:protocol`; Playwright `practice-listening`, `practice-pronunciation`, `shadowing-workspace`, `summary`, `dashboard`, `route-rename-redirects` ×2; disposable-DB `run-gates.sh` once more on a fresh `listening_t1_t16`, dropped after.
- [ ] **Step 2: Chrome (controller, built branch on :3001, 1280×529, nav collapsed, dark and light):** picker → each exercise → Đổi bài tập (video keeps playing, same position); Chép chính tả: stars, 💡, easy pieces with the 20-piece line and a median line (wrap, no horizontal overflow); Điền từ: blanks, chips, kana hint, show answer; toggles; Korume after a helped and an unhelped Check; drafts; the rail on a 431-line lesson (hover scrollbar, wheel); the two success-tone options (spec §3.7) for the owner to pick; compare with Figma `123:2835` (L-051). Screenshots to the owner.
- [ ] **Step 3:** Whole-plan review (code-reviewer) over `69037d58..HEAD`; fix rounds as in the SDD ledger.
- [ ] **Step 4:** Continue with the B2 plan's Task 10 (`docs/superpowers/plans/2026-10-21-practice-listening.md`): G4 typography, R33 Chrome items, whole-branch review, owner look. The owner applies 049 to their DB only when they choose. No merge before the owner approves in Chrome.
