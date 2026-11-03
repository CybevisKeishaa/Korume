# Listening: Latin words in word pieces, a character-piece fallback, and pieces that fill the stars — design

Date 2026-10-31. Branch `practice-listening` (B2, not merged, tip `73cec782`). Amends
`docs/superpowers/specs/2026-10-26-listening-cloze-dictation-design.md` ("2E") §3.3 and §3.9, and
`docs/superpowers/specs/2026-10-23-listening-word-pieces-design.md` ("WP") §3.1. Everything there that this document
does not change still holds. Ledger rulings: L1, L2, S1 (session 12) in
`.superpowers/sdd/2026-10-26-listening-two-exercises/progress.md`.

## 1. Why

Chế độ dễ (word pieces) is switched off for a whole line whenever the chunker calls it unreliable, and the learner is
told "Câu này không tách cụm chính xác được, nên chỉ luyện gõ chính tả". Measured on the owner's DB (2026-10-31, 535
non-test lines): 39 lines carry Latin letters and every one is locked; 36 of them sit in one video
(【偏見】Googleマップ狂…, 431 lines), e.g. `ああいうのをその場ですぐGoogleマップで調べて` → v2 reason `latin_or_digit`.
A learner on that video meets the lock again and again. The owner (2026-10-31): one word like `Google`, or one token
the dictionary does not know, must not lock the whole line; Chế độ dễ should only be off when no trustworthy pieces
can be made at all.

Separately, in Chế độ dễ the pieces go into a placed-pieces box while the star mask above stays a static length cue.
The owner wants the stars to fill as pieces are chosen, so the learner sees their answer take the sentence's shape.

## 2. Goals, non-goals, anti-goals

Goals
- **G1** Lines with Latin words get word pieces; a run of consecutive Latin letters is one piece.
- **G2** A line the word chunker still cannot cut gets **character pieces** instead of losing Chế độ dễ.
- **G3** In Chế độ dễ, placed pieces fill the star row in the order the learner chose them.
- **G4** The action row never sits under the listen-only dock at 1280×529 (E2E case 22, red since Task 12).
- **G5** A before/after coverage number: how many of the 535 lines (and of the 39) are easy-eligible after this.

Non-goals
- No change to Typing (unhelped dictation), Điền từ, the cloze selector, or the star reveal in normal mode.
- No rescoring of any stored attempt; no data migration of old rows.
- Word pieces stay the default. Character pieces never replace them on a line the word chunker can cut.

Anti-goals (a failure even if it "works")
- Two answer states: the bank/placed box saying one order, the star row another, the server scoring a third.
- A Latin word cut into letters (`G / o / o / g / l / e`) in either cut.
- Non-Latin `UNKNOWN` tokens waved through wholesale to raise the coverage number.
- Pieces shrunk below a comfortable tap size to fit a long line; Check / Hint / 💡 / Try again / Next hidden under the
  dock.
- Progress compared across the two cut kinds (a v2 or word-cut attempt "improved on" by a character-cut one).

## 3. The design

### 3.1 Word cut v3 (owner L1)
- A new chunker version **v3**. v1 and v2 are frozen from now on (v1 had one in-place edit on 2026-10-21, before
  attempts referenced it): never edited, still registered, still able to recompute their own cuts for stored attempts.
  Today v1 and v2 share one `tokenize()` whose `/[A-Za-z0-9]/` test rejects Latin and digits together, so v3 needs its
  own tokenize path (or a parameter whose default keeps v1/v2 byte-identical).
- v3 = v2's rules plus: a maximal run of Latin letters (ASCII and full-width) is **one token / one piece**, original
  characters kept, and it is not an `UNKNOWN` failure. It joins pieces like any word: punctuation attaches by the
  settled rule (openers start the next piece, other marks attach left, a line-initial run binds forward).
- **Digits keep today's rule** in v3: a line with a digit is unreliable there, as in v2 (owner 2026-10-21, re-confirmed
  L1), and so falls to the character cut (§3.2), where digits are pieces.
- Any other `UNKNOWN` non-punctuation token still makes the line unreliable. `mismatch`, `single_chunk`,
  `too_many_pieces` unchanged.
- Expected for the owner's line: `ああいう / のを / その場で / すぐ / Google / マップで / 調べて` (illustrative; the
  real boundaries are whatever v3's kuromoji pipeline gives, pinned by a test).

### 3.2 Character cut (owner L2)
- When v3 is unreliable, the line falls back to a **character cut**, its own registered version (stable id, never
  edited once attempts reference it).
- Pieces are **grapheme clusters** of the line (`Intl.Segmenter`, granularity `grapheme`): combining marks never split;
  small kana (`っ`, `ゃ`) may be pieces of their own.
- A run of consecutive Latin letters stays **one piece** here too.
- Cap: the existing `MAX_WORD_PIECES` (64) applies; above it the line stays locked (`too_many_pieces`). The owner's
  longest line today is 38 graphemes. *(Claude's call.)*
- Punctuation and optional symbols attach by the same settled rule as word pieces (no piece that is only `、`).
- **Digits are pieces here** (owner Q1, 2026-10-31): a run of consecutive digits (ASCII or full-width) is **one
  piece**, like a Latin run (`今 / 日 / は / 2026 / 年 / で / す。`), never `2 / 0 / 2 / 6`. In pieces the number is
  given as written, so the `3` / `三` / `さん` ambiguity that locks digit lines in Typing does not arise. The learner
  sees the original characters (`２０２６` stays full-width) through the display path of §3.3; NFKC is internal only.
- A mixed run of Latin letters and digits (`G7`, `4K`, `COVID19`) is **one piece**: one maximal run of ASCII letters
  and digits after NFKC, so no Latin word is ever cut. Punctuation inside or beside it (`Wi-Fi`) follows the usual
  attachment rule. *(Claude's call.)*
- The character cut catches every line v3 cannot cut (`latin_or_digit`, `unknown_token`, `mismatch`,
  `single_chunk`, `too_many_pieces`), as the owner intended ("only when the word cut is not reliable"). The anti-goal
  on `UNKNOWN` tokens is about the **word** cut: v3 never turns an unknown token into a word piece; the character
  cut does not need the token at all. The coverage report (§3.7) shows how many lines land in each cut.
- A line with fewer than 2 pieces after this is still locked (nothing to order), with today's notice.
- The VI notice for a character-cut line (owner's copy): **"Câu này được chia theo từng ký tự để bạn tiếp tục luyện
  tập."** It replaces the lock notice for those lines; the lock notice stays for lines that are still locked.
  EN: builder drafts, owner reviews.

### 3.3 Which cut a line uses; versions; scoring (owner L2)
- The server chooses per line: v3 if reliable, else the character cut, else locked. The choice is deterministic from
  the line's text. **One** chunks request resolves it: `GET /api/lines/[lineId]/chunks` returns the chosen cut and its
  version id (plus which kind it is, for the notice); the client never picks a cut. *(Claude's call.)*
- Version ids are numbers ≥ 3 (v3 word cut; the character cut its own id after it), so the existing `version >= 2`
  branches (hinted prefix, LCS) apply to both. Hint and Show answer on a character-cut line use unit `chunk` (one
  character piece). *(Claude's call.)*
- Pieces are cut from the normalised text (`normalizeJa`, NFKC), as v2's are; what the learner **sees** is restored
  from the raw line through the existing `chunkDisplays` / `displayMap` path, so a full-width `Ｇｏｏｇｌｅ` in the
  line shows as written. "Original characters kept" (§3.1, §3.2) means this display path. *(Claude's call.)*
- Typing (normal Chép chính tả) is unaffected for the learner (owner Q1: no `3` / `三` / `さん` equivalence, no rule
  change): its star hints are `grapheme1`, which the server
  accepts for any version. Its submissions name whatever version the chunks payload served, as today.
- Moving the current version from 2 to 3 resets the version-keyed comparisons (`wb_fixed`, `ty_fewer`) once for every
  line, exactly as v1→v2 did; accepted. Cloze rows keep writing chunker version 2 (their tokens come from the v2
  pipeline; `lib/data/dictation.ts:134`). *(Claude's calls.)*
- The chunks payload carries the version id of the cut it served (as today's `version`); a submission names it; the
  server recomputes that version's cut from the text (today's `CHUNKERS[input.version]` path, `textHash` check, 409
  `chunker_version` on an unknown id) and scores with LCS as today, which handles repeated characters (時 ×4).
- Old v1/v2 attempts keep their stored `chunker_version`, snapshot and score.
- Comparisons that already key on chunker version (`wb_fixed`, `ty_fewer`: same line + format + chunker version +
  textHash) therefore never compare a word-cut attempt with a character-cut one. No other progress figure may compare
  across cut kinds.
- Both cuts are Chế độ dễ = **helped** (2E §3.6); Summary and the weekly skill rules are unchanged.

### 3.4 Pieces fill the stars (owner S1)
- The **ordered list of placed piece ids** is the one answer. The star row is **derived** from it on every render;
  it holds no state of its own and is never sent to the server.
- Derivation: walk the placed pieces in order; take each piece's **scored** characters (the same filtering the mask
  uses: punctuation and optional symbols are not scored); fill the mask's star cells left to right with them. Stars
  past the placed text stay stars.
- Punctuation and optional symbols in the star row stay **fixed in place** as landmarks of the original line. A
  piece's own punctuation (e.g. `けど。`) is never copied into the row, so nothing shows twice.
- Example: answer `お店を`, the learner taps `を` first → the row shows `を★★`. It is never snapped to the right
  position; only Check tells right from wrong.
- Every change to the placed list (tap add, tap remove, drag insert, drag reorder, Alt+Arrow, Hint) re-derives the
  row in the same render. In the bank the pieces keep their own punctuation.
- Hint (WP's piece Hint, unit `chunk`) keeps the locked prefix exactly as approved: if the learner placed the third
  piece first and asks for a Hint, the hinted piece moves into the locked prefix and both the placed box and the star
  row reflow at once; hinted pieces never count as recalled.
- Check scores the **placed piece order**, and right/wrong tints after Check come from that order, never from the
  star row's text. *(Claude's call: after Check the star row behaves as today's easy-mode mask does after Check.)*
- In easy mode the star row stays non-interactive (2E §3.3: one attempt never mixes two hint units). Its accessible
  name per filled cell names the character, as normal mode does for a revealed star. *(Claude's call.)*

### 3.5 Drafts (owner, amends 2E §3.9; lands with plan Task 14)
- Leaving a line with, say, 7 of 15 pieces placed and coming back restores the same 7 in the same order, the same
  hints, and therefore the same star row (it is derived). No silent reset, no new attempt created by the return.
- A draft is keyed by line + exercise + **cut version**, so a draft never restores onto a different cut.

### 3.6 Layout at 1280×529 (owner L2 + case 22)
- **Card toggles** (audio / translation / romaji, 2E §3.5) move into the **existing star/💡 row** in Chép chính tả,
  instead of their own row (case 22 option 1, owner 2026-10-31). The same placement in Điền từ is the builder's call
  if it fits Figma 123:2835's composition.
- The bank wraps to as many rows as it needs; pieces keep today's size. When the panel content is taller than the
  space, the **panel scrolls inside**; the action row (Check, Hint, 💡, Try again / Làm lại, Next) is **always fully
  visible** without scrolling, in listen-only (above the dock) and with the video shown. Mechanism (pinned row,
  scroll region) is the builder's call.
- Measured cases that must pass in a real browser at 1280×529, listen-only and video shown: an 8-piece word line, the
  longest word line (20 pieces), and a 30–40-piece character-cut line.

### 3.7 Coverage report (owner L1, L2)
- Before/after on the owner's DB, **read-only** (`begin read only`, no writes): per reason, how many of the 535 lines
  were locked under v2, how many are word-cut (v3), character-cut, or still locked now; the same for the 39 Latin
  lines and the 2 digit lines (both expected easy-eligible). The numbers go in the task report and the ledger.

## 4. Tests the design requires
Unit and component:
- v3: Latin run one piece (ASCII and full-width), mixed Latin + kana + kanji + punctuation, the owner's line pinned,
  a non-Latin UNKNOWN still unreliable, digits still unreliable, v1/v2 outputs unchanged on a fixed corpus.
- Character cut: grapheme clusters (a combining-mark case), small kana alone, Latin run one piece, punctuation
  attachment, the <2-piece lock, determinism (same text → same pieces, same version); digits: a single digit, a
  multi-digit run as one piece, full-width digits shown as written, digits next to kana/kanji, repeated characters,
  punctuation beside a number.
- Server: a character-cut submission scored by LCS with repeated characters; a v2 / v3 / character-cut attempt each
  recomputed and scored by its own version; unknown version → 409.
- S1: wrong piece first (`を★★`), add / remove / insert / reorder / Alt+Arrow, punctuation never doubled, repeated
  characters, a Latin piece filling its stars, Hint reflow, the star row always equal to the derivation of the placed
  list (one property-style test over random sequences is enough), Check payload = placed order.
- Draft restore across navigation (with Task 14).
E2E (once, per Ruling C1): the owner's Latin line in easy mode; a character-cut line; case 22 updated to the three
measured lines of §3.6.
Mutations RED for each new rule (Latin run, v3 digit rule, digit run in the character cut, grapheme split, derivation
source, punctuation de-dup).

## 5. Constraints
2E §4 holds: owner DB never mutated (reads only, as in §3.7); build/serve only in the worktree; tokens and classes
that exist; desktop-only 1280×529; every test seen RED. No new dependency (`Intl.Segmenter` is built in).

## 6. Owner decisions recorded 2026-10-31
- L1: Latin words get word pieces on this branch (chunker v3), own task with spec, plan, tests, review.
- L2: word pieces first, character pieces only as the fallback; both helped; versions kept apart.
- S1: placed pieces fill the stars in the chosen order; the placed list is the one answer.
- Q1: digits are pieces in the character cut (a digit run is one piece); v3 and Typing keep today's digit rule.

## 7. Left to the builder
Version id values; where the derivation lives; the scroll/pin mechanism; EN strings; whether the character cut is a
separate `CHUNKERS` entry or a mode of the v3 entry, as long as each cut has its own stored version id.
