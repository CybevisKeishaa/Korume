# Listening: two exercises (Chép chính tả + Điền từ), picker, toolbar, chip rail — design

Date 2026-10-26. Branch `practice-listening` (B2, not merged, tip `f81483c2`). Amends
`docs/superpowers/specs/2026-10-23-listening-word-pieces-design.md` (the word-pieces spec, "WP") and the B2 spec
`docs/superpowers/specs/2026-10-15-shadowing-practice-modes-design.md` (§5–§7). Everything in WP that this document
does not change still holds (chunker v2, LCS scoring, drag/tap, optional symbols, stat strip, P14/P15 feedback).

**Build order (Claude's call):** none of WP is built yet (`CURRENT_CHUNKER = 1`, no `TYPING_OPTIONAL`). One new plan
covers WP's unbuilt Tasks 2–8 (as amended here; WP Task 6's switch placement is superseded by §3.2) plus this
design, and replaces the WP plan file. WP Task 1 (Chrome trial of the hidden-video look) stays the new plan's first
task. No product code of this design before the owner approves that plan.

Owner references (images, not Figma): `C:\Users\tplon\Desktop\Japan\Korume\image\ref\Chep Chinh ta\` (4) and
`…\ref\Dien tu\` (5). They are **references for features, not for look**: the panel keeps Figma `123:2835`'s
composition and Korume's own DNA (owner 2026-10-26: "ghép vào panel hiện tại … vẫn là ADN của chúng ta").

## 1. Why

The owner wants Listening to be two clearly different exercises the learner **chooses between**, instead of two input
formats of one exercise:

- **Chép chính tả (dictation):** nothing of the sentence is shown; the learner writes what they hear. Typing stays the
  main way; the word pieces (WP) become its **Chế độ dễ**, and using them counts as help, like a hint. Focus: hearing
  the whole sentence.
- **Điền từ (cloze):** the sentence is shown with up to 3 **vocabulary words** missing; the learner fills them in.
  Focus: recognising vocabulary in context, not grammar endings.

Owner's bar (2026-10-26): "tôi không cần app dễ, tôi cần app chất lượng và hiểu người dùng". Accuracy and
self-reliance are two different facts: a 100% answer reached with help is shown honestly as helped, never as the
same thing as hearing and writing it alone.

## 2. Goals, non-goals, anti-goals

Goals
- Entering Listening without a chosen exercise shows a **picker** of the two exercises; a valid deep link opens the
  exercise directly; "Đổi bài tập" returns to the picker.
- Chép chính tả: a per-character star mask, tap a star to reveal that one character, 💡 to show the whole sentence.
- Điền từ: up to 3 blanks on dictionary-form vocabulary, easy mode with word chips, its own score and stats.
- Toolbar: Ẩn video, Phím tắt, Chế độ dễ. Card toggles: 🔊 sentence audio, bản dịch, romaji.
- The sentence chip navigator scrolls fast on hover with a styled scrollbar.
- Work in progress survives moving between sentences and between the picker and an exercise.
- After a helped attempt Korume encourages a try without help, from the real result.
- Summary, missions, weekly skill, weakness and the stats functions all handle `cloze` and "helped" (§3.10).

Non-goals
- "Số câu/lượt" (several sentences per round) and the ⟳ button in the references — owner: not wanted.
- Copying the references' colours, wording or success banner (owner: our own language and colours, Korume speaks).
- Re-scoring stored attempts.

Anti-goals (a failure even if it works)
- An answer leak through the app's own surfaces while answering (D4 unchanged): the star mask shows lengths only; the
  translation and romaji toggles are answer surfaces in Chép chính tả (§3.5).
- A blank on a conjugated form whose writing differs from the dictionary word (泣いて) — the learner cannot know
  what to type.
- Praising help as the learner's own recall; a judging or punishing tone about help; claiming progress without a
  valid comparison.
- A learner losing typed work by tapping a chip or going back to the picker.
- The YouTube player reloading when the learner picks or changes an exercise.
- The first stored `cloze` row breaking Summary, missions or the dashboard.
- A panel that looks like the reference app instead of Korume.

## 3. The design

### 3.0 Picker — "Bạn muốn luyện nghe theo cách nào?" (owner 2026-10-26)
- The Shadowing mode bar keeps one **Nghe** entry. With no valid `?format=` the practice column shows the picker:
  heading "Bạn muốn luyện nghe theo cách nào?" and two large choice cards (buttons):
  - **Chép chính tả** — "Nghe rồi tự viết lại câu tiếng Nhật. Có thể sử dụng gợi ý hoặc bật chế độ dễ." Tag
    "Tập trung vào nghe hiểu toàn câu".
  - **Điền từ** — "Nghe rồi điền những từ còn thiếu trong câu. Luyện nhận biết từ vựng trong ngữ cảnh." Tag "Tập
    trung vào từ vựng".
  The owner's text is the structure and copy; the visual is Korume's (tokens, card style of the workspace), not a
  copy of any reference. EN copy is Claude's draft for the owner to review.
- Choosing sets `?format=dictation` or `?format=cloze` by a URL replace (no navigation to a new page, no remount of
  the workspace or the player: one YouTube player instance, `onReady` once, position and current sentence kept).
- A deep link with a valid `format` opens that exercise directly. An unknown value shows the picker. Old values
  `typing` and `word_bank` map to `dictation` (`word_bank` also turns Chế độ dễ on) by URL replace.
- Inside an exercise, a **"Đổi bài tập"** control (in the panel header beside the exercise name) removes `format`
  and shows the picker again. Drafts of both exercises are kept (§3.9).
- The picker shows each exercise's progress for this lesson from real data only (e.g. "12/194 câu đã làm"), or
  nothing when there is none. *(Claude's call: helps the learner choose; no invented numbers.)*
- The old `ListeningFormatSwitch` segmented control is removed.

### 3.1 Storage of the exercises
- Chép chính tả writes `typing` (normal) or `word_bank` (Chế độ dễ) attempts as today; Điền từ writes a new format
  `cloze` (§3.4, migration 049).
- The exercise header shows the exercise name, "Đổi bài tập", and the counter `n/total` unless the stat strip
  already shows it at 1280×529 (builder checks, no duplicate).

### 3.2 Toolbar (new row at the top of an exercise)
- **Ẩn video** = WP §3.5's remembered "Chỉ nghe" switch, moved from the Replay row to the toolbar (eye-off icon +
  label, `aria-pressed`). How "hidden" looks is still decided by the plan's first task (Chrome trial).
- **Phím tắt** opens a small popover listing the Listening shortcuts that exist (the builder lists them from the code;
  new in this design: Alt+H = 💡 in both exercises). Escape closes it, focus returns to the button.
- **Chế độ dễ** = a switch (`aria-pressed`), remembered for the page visit like Ẩn video, applies to both exercises.
  On an unreliable line (D9) in Chép chính tả it is disabled with the existing notice as its tooltip.

### 3.3 Chép chính tả (dictation)
Normal (Chế độ dễ off) — today's Typing panel plus:
- **Star mask** under the input: one star per scored character of the reference (after the existing
  `stripPunctuation` + `TYPING_OPTIONAL` filtering), each on a dashed underline. Punctuation and optional symbols are
  **shown as themselves** in the mask (never scored, so they give nothing away the stars do not). *(Claude's call.)*
- **Tap a star** → that one character is revealed in place (green chip, today's hinted tone). It is a hint: stored as
  hinted, never counted as recalled. New hint unit `grapheme1` (one grapheme, index into the filtered reference).
  Keyboard: stars are buttons in a roving-tabindex row (Arrow keys move, Enter reveals); accessible name "Ký tự 5
  trên 14, ẩn" / "Character 5 of 14, hidden".
- **💡 (Alt+H)** → the whole correct sentence replaces the mask as plain text (no stars). This is today's **Show
  answer**: status `revealed`, label "Đã xem đáp án", the attempt ends (Try again starts a new one). The separate
  "Show answer" button is removed in Chép chính tả. *(Owner's description; mapping to `revealed` is Claude's call.)*
- Typing's old Hint button (next chunk / grapheme4) is removed from Chép chính tả: tapping stars replaces it.
- Check stays a button (our DNA, today's flow); the result diff renders as today.

Chế độ dễ on — the word pieces of WP §3.1–3.3 (chunker v2, drag/tap, LCS scoring) replace the input; the submission
is a `word_bank` attempt and counts as helped (§3.6). *(Claude's calls, so one attempt never mixes two hint units:)*
the star mask stays above the bank as a length cue but is **not tappable** in easy mode; WP's piece Hint (locks the
next piece, unit `chunk`) is the hint there; 💡 still shows the whole answer (`revealed`).

### 3.4 Điền từ (cloze)

**Blank selection (server, versioned `CLOZE_SELECTORS[1]`, like the chunker):**
- Tokens from the same kuromoji pipeline and normalisation as chunker v2.
- A token is a **candidate** when:
  - `pos = 名詞`, excluding `posDetail1` ∈ {数, 代名詞, 非自立, 接尾}, and excluding kana-only nouns of 1 character
    (includes 形容動詞語幹 and サ変接続 nouns: 勉強して → blank `勉強`, `して` stays — owner's example); or
  - `pos ∈ {動詞, 形容詞}` **and** `surface = base` (dictionary form as written: 食べる yes, 泣いて no — owner).
- Never: particles, auxiliaries, symbols, Latin/digit tokens.
- Pick **up to 3** (owner). Preference *(Claude's call)*: (1) not in the learner's known vocabulary
  (`getKnownVocabLemmas`, matched on `base` and reading), (2) longer `surface`, (3) earlier position. Two blanks never
  touch (if candidates are adjacent, keep the preferred one).
- A line with **no candidate**: the card shows "Câu này không có từ để điền" with a "Câu tiếp" action. Never a silent
  skip.
- Blanks depend on the learner and on time, so the server returns them with the line (`/api/lines/[id]/chunks` or a
  sibling route — builder's choice) and **stores the chosen token indices on the attempt**. Scoring re-tokenises with
  the stored selector version and checks the stored indices are candidates (else 400).

**Answering:**
- The sentence in its original characters (P13 `display`) with inline input boxes at the blanks (box width from a
  minimum, not an exact-length leak).
- A blank is **correct** when the typed text, after the existing normalisation, equals its surface **or** its hiragana
  reading. The answer shown after Check uses the surface (kanji). *(Claude's call: the exercise tests hearing.)*
- **Chế độ dễ:** the blanks' words appear as chips in a shuffled order under the sentence; tap a chip → it fills the
  first empty (or focused) blank; tap a filled blank → it returns to the chips. Counts as helped (owner, §3.6).
- **💡 (Alt+H):** fills the next character of the lowest unfinished blank **from its hiragana reading** (勉強 → べ,
  then the learner types んきょう). Unit `grapheme1`, index into the blank's reading; a blank with hinted characters
  must be finished in kana. *(Claude's call.)*
- **👁 Xem đáp án:** fills every blank with the answer, status `revealed`, attempt ends.
- **Kiểm tra** enabled when every blank has text. Blank score *(Claude's call, D10's per-character idea)*: correct →
  `(reading length − hinted characters) / reading length`; wrong → 0; fully hinted → 0. Line score = mean of blank
  scores, server-side. Each blank shows correct / wrong / hinted with colour **and** a non-colour cue.

### 3.5 Card toggles: audio, translation, romaji
- **🔊** plays the current sentence once (`seekToSentence(index, { play: true })`, same as Replay audio).
- **Bản dịch** shows `line.textTranslation` under the sentence; hidden when the line has none.
- **Romaji** shows Hepburn romaji built from the kuromoji readings with **`wanakana`** (owner 2026-10-26 allows it:
  exact version pinned, lockfile updated). Tests cover yōon (きゃ kya), sokuon (っ → doubled consonant), long vowels
  (ー, おう), ん before a vowel or y (n'), particles は/へ/を as read, and katakana loanwords.
- In **Điền từ** both are available while answering (the sentence is visible; a blank's romaji shows as `___`). In
  **Chép chính tả** they are answer surfaces: available only after Check / 💡 (D4). *(Claude's call, follows D4.)*
- Toggle state is remembered for the page visit.

### 3.6 Help: what counts, how it is shown
- **Help used** on an attempt = any of: a star reveal or a typing hint (`hinted_units` not empty), Chế độ dễ (Chép
  chính tả via `word_bank`, Điền từ via chips), a WP piece Hint, a cloze 💡 character. `revealed` is not "helped", it
  is its own state (Show answer).
- **Accuracy** stays the stored score. Help is a separate fact stored with the attempt (§3.10), never folded into the
  score beyond what D10 already does for hinted units.
- Chép chính tả's stats = `typing` + `word_bank` together: per line, the **latest submitted attempt across both
  formats**; Accuracy = mean of those scores. Điền từ's stats = `cloze` only.
- Line state, new `helped` tone (does not exist today): latest attempt helped → helped; no help → scored.
  **needs_review wins over helped** below the review threshold; a helped attempt still feeds review targets (R2).
  *(Claude's calls.)*

### 3.7 Result moment — Korume speaks, and nudges after help
- No reference-style green banner. After Check or Xem đáp án the result is told by **Korume** (P15 figure, mood from
  `feedbackMood`), only then, never while answering (no content leak before submission).
- Full, unhelped result: our own short praise ("Chính xác!" / "Bạn đã đúng") — `wb_perfect` / `ty_perfect` /
  `cz_perfect`.
- **Helped result (owner 2026-10-26):** a new message family, built from the real attempt, never generic:
  - It states what was right with real counts and that help was used, then invites a try without help. Examples
    (owner's): "Bạn đã làm đúng 8/10 mảnh. Lần này có sử dụng trợ giúp. Hãy thử nghe lại và tự hoàn thành câu mà
    không dùng gợi ý nhé!"; Điền từ easy mode: "Bạn đã điền đúng cả 3 từ! Lần tới, thử tự gõ những từ này xem sao
    nhé."
  - Ids: `wb_helped`, `ty_helped`, `cz_helped`, with variants for all-correct and partial. They replace the
    `*_perfect` praise when help was used; a fully correct helped result is acknowledged as correct, not praised as
    self-done. Mood never `joy` for a helped result.
  - Tone: encouraging, not judging; no "only", no "but you cheated"-style wording. The help named is the help used
    (stars / hints / easy mode), from the stored attempt.
  - No progress claim (`*_fixed`) unless a valid previous attempt of the same line, exercise and version exists.
- New cloze messages follow P14's rules: `cz_perfect`, `cz_partial` (correct count / blanks, names the wrong blanks'
  answers after Check), `cz_hinted`, `cz_helped`.
- Colours: our tokens, not the reference's mint card; the builder trials 2 success tones (from `success` /
  `primary`) in Chrome and the owner picks.
- Actions after Check: Làm lại and Câu tiếp, as the panel has today.

### 3.8 Sentence chip rail
- The navigator (`sentence-navigator.tsx`, paged window of 8) becomes a **horizontal scroll rail** of all chips, the
  current chip scrolled into view; ‹ › page by a visible width.
- On hover (and keyboard focus inside the rail) a **thin styled scrollbar** appears under the chips; dragging it or
  the wheel (vertical wheel → horizontal scroll) moves fast through long lessons (194–431 lines). `scrollbar-width:
  thin` + `::-webkit-scrollbar` on our tokens; hidden when not hovered.
- Chip tones stay data-driven (none / scored / needs_review / unscored / revealed, plus the new helped) and a small
  **"đang làm dở"** dot for a sentence with an unsent draft (§3.9).
- 431 chips render as plain buttons (no virtualisation) unless the builder measures a real cost.

### 3.9 Drafts survive navigation (amends the D12-era discard)
- Today changing sentence discards an in-progress attempt. New: per line **and exercise**, the unsent draft (typed
  text, placed pieces, filled blanks, revealed stars / hints, easy-mode use) is kept **in memory for the page visit**,
  across sentence changes and across the picker. Reload or leaving the lesson drops drafts. *(Claude's call: owner
  left it to "sự hợp lý".)*
- Concealment (D12) still applies: another sentence's answer is never shown; a draft holds only the learner's input
  and the hints they already opened. Hints travel with the submission (`hintedUnits`), so a restored draft never
  "un-opens" a hint.

### 3.10 Data: migration 049 and every consumer (owner 2026-10-26 decisions)
Proven on disposable `listening_t1_*` DBs first; the owner's DB stays at 048 until the owner applies it.

Columns and checks on `dictation_attempts`:
- `format` check adds `cloze`; `hint_unit` check adds `grapheme1`.
- `easy_mode boolean not null default false` — true for every `word_bank` attempt (backfilled) and for a cloze
  attempt answered with chips. **Helped** (SQL and app) = `easy_mode or cardinality(hinted_units) > 0`, one shared
  definition (a SQL function or a single expression the builder reuses; one definition, tested).
- `cloze_selector_version smallint`, `cloze_blanks smallint[]`, `cloze_answers text[]`; a check that a `cloze` row has
  them (a `revealed` cloze row has no answers).

Consumers (all updated in 049 + app code, none may break on a `cloze` row):

| Consumer | Rule after 049 |
|---|---|
| `practice_stats` (strip, navigator) | modes `dictation` (typing + word_bank, latest submitted across both) and `cloze`; line states add `helped`; returns a helped count beside accuracy. Old mode names rejected (no caller left). |
| `lesson_summary_evidence` + `lib/summary/*` | **two independent rows, never averaged: Chép chính tả and Điền từ** (owner). Each row: accuracy mean, lines done, and lines done **without help**, so a 100% reached with help reads honestly. The format allowlist (`snapshot.ts:111`) accepts `cloze`; review targets keep working (weak Chép chính tả lines use the typed input as today). |
| `practice_activity` (missions) | both exercises count; unchanged rule: distinct `transcript_line_id` with a `submitted` attempt in the window; `revealed` never counts (owner). |
| `weekly_skill_windows`, `weakness_scores` (dashboard) | Listening = **Chép chính tả typed without help only**: `format = 'typing' and status = 'submitted' and not helped` (owner). Cloze and easy mode stay out. This narrows D20 (hinted typing used to count). |
| Dashboard / any reader of `wordBankMean` / `typingMean` | moved to the new row shape; copy updated. Builder greps every reader. |

### 3.11 Tests the design requires (beyond WP's)
- Picker: no `format` → picker; choosing each card → the right exercise; a valid deep link opens it directly; an
  unknown value → picker; `typing` / `word_bank` legacy links map to `dictation` (+ easy for `word_bank`); "Đổi bài
  tập" returns to the picker; drafts of both exercises survive picker ↔ exercise and sentence changes (unit + E2E).
- One player instance across picker, exercise switch, Ẩn video and every toggle (`fake-yt` marker, `onReady` once).
- Cloze selector: owner's examples (泣いて never a blank; 勉強して → 勉強), the max 3, adjacency, known-word preference,
  no-candidate line; server rejects non-candidate stored indices (400).
- Cloze scoring: kana or kanji accepted; hinted-character fraction; all-hinted 0; revealed unscored.
- Helped: each help kind sets helped; helped feedback ids and texts from real counts; no `*_perfect` / joy when
  helped; no `*_fixed` without a valid previous attempt; Korume absent while answering.
- SQL (pgTAP on disposable DBs): every consumer in §3.10 with a `cloze` row, a helped typing row and an unhelped one;
  Summary loads with a `cloze` row (the regression the builder check found); weekly skill excludes helped typing.
- Romaji (`wanakana`): the §3.5 cases.
- Each new test seen RED once; each fix's mutation RED.

## 4. Constraints
- Owner branch rules: never reset or mutate the owner's DB (048); migration 049 proven on disposable DBs first; every
  test seen RED; mutations RED; build/serve only in the worktree; no merge before the owner's Chrome look.
- Type on `--text-*` tokens, colours on theme keys, classes that exist (L-051/52/53). Desktop-only, 1280×529.
- New dependency allowed: `wanakana` only (owner 2026-10-26), pinned.

## 5. What this supersedes
- WP's Typing / Word Bank pair behind a segmented switch → picker + two exercises, easy mode inside dictation (§3.0,
  §3.3).
- WP §3.5 switch location (Replay row headphones) → toolbar "Ẩn video" (§3.2); the look trial stays.
- Typing chunk/grapheme4 Hint button in Listening → star reveal + 💡 (§3.3); Show answer button in Chép chính tả → 💡.
- Navigator paged window of 8 → scroll rail (§3.8). D12-era draft discard → §3.9.
- B2 §6.2 / P6 Summary rows Word Bank + Typing → Chép chính tả + Điền từ (§3.10). D20 narrowed to unhelped typing.

## 6. Owner decisions recorded 2026-10-26
- Picker on entering Nghe; deep links; "Đổi bài tập"; one player; drafts kept (§3.0, §3.9).
- Korume nudges after help, from real data, without judging (§3.7).
- Summary: two independent rows; missions: both exercises, distinct lines, no revealed; weekly skill/weakness:
  unhelped typed dictation only; cloze easy mode = helped; `wanakana` allowed (§3.10, §3.5).

## 7. Left to the builder
Picker card layout and the toolbar/card layout inside Figma 123:2835's composition; icons from lucide/existing glyphs;
announcement wording; rail scroll mechanics; where the shared "helped" definition lives; test layout; EN strings and
VI strings beyond those named here (owner reviews them).
