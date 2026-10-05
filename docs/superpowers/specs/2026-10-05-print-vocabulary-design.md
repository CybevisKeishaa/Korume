# Print Vocabulary (In từ vựng) — Design

- Date: 2026-10-05
- Branch: `print-vocabulary` (worktree `.worktrees/print-vocabulary`), from master `22226d9`
- Figma: none. Composition comes from the owner's sketch (§6) and existing tokens; the owner approves it in Chrome
  and on a real printout (§9).
- Status: brainstormed with the owner 2026-10-05 in Q1–Q4 and sections (1)–(5) + (3b), each approved with
  amendments, all folded in below — **frozen pending the owner's review of this text**. Next: `writing-plans`.
- Parents: `2026-10-04-summary-analysis-design.md` (R5 lazy analysis, R6 grounded facts come from the database).
- Implementer: Claude (Codex is out of quota until 2026-10-10).

## 0. Rulings

| # | Ruling (owner, 2026-10-05) |
|---|---|
| P1 | **Purpose.** Two modes on ONE template: `Ôn tập` (review) and `Tự kiểm tra` (self-test). Self-test keeps the review geometry and replaces one field (Meaning by default, or Reading) with a fixed-height writing line. Paper flashcards are a future third template, not V1. |
| P2 | **One print workspace, not a three-step wizard.** Borrowed from the owner's handwriting-sheet concept: *selection → live A4 preview → In / Lưu PDF*. Only the flow is borrowed; handwriting controls (stroke weight, cell count) are not. |
| P3 | **Examples are real lesson lines.** Nothing is generated at print time. |
| P4 | **Generic workspace, Lesson adapter only in V1.** The workspace knows only `VocabularyPrintItem[]`; it never knows lesson analysis, mining cards or Summary. Summary is the first launcher. Saved Vocabulary, decks and collections are later adapters that need no workspace rewrite. |
| P5 | **Fix the shared lexical resolver in V1.** Contextual-reading disambiguation of JMdict entries; POS-based eligibility, never "drop single kana"; a meaning that states its locale and source; no AI anywhere in reading or meaning. Summary and Print consume the same fixed resolver. |
| P6 | **Meaning sources.** Curated `vocab.meaning_vi` when `(word, reading)` equals the resolved headword + reading; otherwise JMdict English, visibly labelled `EN`. Print **never** reads the AI `word_gloss_vi` cache; the source union has no `ai-cache` member. |
| P7 | **Printed materials are Korume learning artifacts, not browser screenshots.** They retain Korume's typography, mascot/mark, hierarchy, spacing and document voice, while minimizing decorative ink and keeping learning content dominant. |
| P8 | **Print never triggers AI.** `set=all` may use a lesson analysis that is already ready; opening `/vocab/print` never generates, reserves or leases one. |

## 1. Shared lexical resolver

### 1.1 Where it lives

`lib/analysis/lexical-resolver.ts` — pure functions, no DB, no `server-only` I/O:

```ts
resolveLexeme(token: ResolverToken, entries: EntryRow[], vocabRows: VocabRow[]): ResolvedLexeme | null
isAutomaticLookupEligible(token): boolean   // popup: permissive
isLessonVocabularyEligible(token): boolean  // lists: strict
```

`ResolvedLexeme` = `{ entSeq, headword, reading, readingMatch: "exact" | "stem" | "fallback", glossEn, jlpt,
vocabId: string | null, curatedVi: string | null }` plus the up-to-three ranked `DictionaryMatch`es the popup already
shows. `readingMatch` is internal (tests, debugging); no UI reads it.

`staticAnalyses` (`lib/analysis/line-analysis.ts`) keeps its batched DB reads and calls the resolver per token. Its
`vocab` query widens from `id, word` to `id, word, reading, meaning_vi`. `entriesFor` and `toMatch` move into the
resolver; `entriesFor(term, term, entries)` keeps its current signature for reading-less callers.

Callers, all on the same resolution: Shadowing word popup (via `staticAnalyses`), `aggregateVocabulary`
(`lib/analysis/lesson-vocabulary.ts`), `buildAnalysisInput` (`lib/summary/analysis/input.ts`), `hydrateAnalysis`
(`lib/summary/analysis/hydrate.ts`), Ask Korume tools (`lib/korume/tools/dictionary.ts`, `exposure.ts`), and the Print
lesson adapter (§2).

### 1.2 Contextual reading

The tokenizer (`lib/japanese/tokenizer.ts`) gains `posDetail1` from kuromoji's `pos_detail_1`. A token's contextual
reading is `katakanaToHiragana(token.reading)`; a token with no reading skips disambiguation.

Measured 2026-10-05 with the repo's kuromoji: 人 in 「苦手な人」 reads ヒト (`名詞/一般`); ん in 「話すんです」,
「好きなんだ」, 「いるんじゃない」 is `名詞/非自立`.

### 1.3 Entry selection — match quality, not a flat sort key

For each form in `[base, surface]` (unchanged order), candidates are entries whose kanji or kana forms contain the
form. Ranked:

1. headword match + **exact** contextual reading (some `kana_form` equals the reading);
2. headword match + **stem** reading match (§1.4);
3. headword match;
4. legacy tie-break: written (kanji) match → `common` → `ent_seq`.

A homophone with the right reading but another headword never beats the token's own written form. With no reading
(Ask Korume), only 3–4 apply, which is today's behaviour.

### 1.4 Stem match for inflected tokens

Only when `surface !== base`:

- strip from the contextual reading as many trailing kana as the **surface** has trailing kana (okurigana);
- strip from each candidate `kana_form` as many trailing kana as the **base** has trailing kana;
- compare the two stems for equality.

`話し/はなし → はな`, `話す/はなす → はな`. `行った/いった → い`, `行く/いく → い`. No "long enough common
prefix" heuristic. Kana-only irregulars (`する → して`) may not stem-resolve; headword matching then decides.

### 1.5 Displayed reading

- exact match → that kana form;
- stem match → the **dictionary-form** kana of the matched entry (`はなす`, not `はなし`);
- fallback → `kana_forms[0]` (legacy).

`kana_forms[0]` is never used when a contextual match exists.

### 1.6 Eligibility (outside the resolver)

- `isLessonVocabularyEligible` — strict. Content POS (`名詞 動詞 形容詞 副詞 連体詞 感動詞 接続詞`) **and**
  `posDetail1` not in `非自立`, `接尾`, `数`. Governs `aggregateVocabulary`, Summary candidates and Print.
- `isAutomaticLookupEligible` — permissive. Content POS, minus targeted known-misleading dependent uses: `ん`
  (`名詞/非自立`) and the auxiliary use of `いる` / `しまう` (`動詞/非自立`). Other `非自立` tokens keep their popup;
  `接尾` and `数` keep theirs (アメリカ人's 人 "-ian" is correct there).

### 1.7 `vocabId` and curated meaning

Joined on `(word, reading)` = (resolved headword, resolved reading), both normalised to hiragana. Replaces
`vocabByWord.get(token.base)`. When `readingMatch = "fallback"` and the entry has more than one kana form, no
`vocabId` / `curatedVi` is attached unless exactly one `vocab` row has that `word` — a missing mastery is safer than a
wrong one. `vocab` has no `ent_seq`; `(word, reading)` is its unique key (`vocab_word_reading_key`).

### 1.8 Meaning at the edge

Line analysis stays learner- and locale-free. Each consumer applies the locale:

```ts
meaningFor(lexeme, locale) -> { meaning: string; meaningLocale: "vi" | "en"; meaningSource: "curated" | "jmdict" }
```

`vi` + `curatedVi` → curated Vietnamese; everything else → JMdict English. `locale = "en"` never returns
`meaning_vi`. The future `canonical-vocab` source slots in before `jmdict` without changing any consumer.

### 1.9 Summary hydration

`hydrateAnalysis` must not read `kanji_forms[0]` / `kana_forms[0]` (today `hydrate.ts:40`). A stored word carries
`entSeq`, `surface`, `sourceLineId`; hydration resolves the token with that surface in the source line's static
analysis and takes `written` / `reading` / meaning from that `ResolvedLexeme`. If no token on the line resolves to the
stored `entSeq`, the word is dropped from the view (as an unknown `entSeq` is today).

`WordRow` (`lib/summary/word-list.ts`) gains `meaningLocale` and `meaningSource`; the Summary list and card show the
`EN` chip when `meaningLocale = "en"`.

### 1.10 Cache and regeneration

`LEXICAL_RESOLVER_VERSION` joins the in-process memo key in `staticAnalyses`. Changing candidates changes the Summary
analysis fingerprint (`analysisFingerprint(input)`), so every lesson's cached analysis misses once and regenerates
**lazily** on its next Summary open (R5). No backfill. With `AI_PROVIDER=none` the existing unavailable state shows.

## 2. Source adapter and route

### 2.1 Route

`app/[locale]/(protected)/(app)/vocab/print/page.tsx` — inside `(app)`, so the sidebar shows on screen (hidden in
print), login required like `/vocab`. The static `print` segment wins over `/vocab/[id]`; a test pins it.

```
/vocab/print?source=lesson&lesson=<uuid>&set=all|saved      (set defaults to all)
```

Validated with zod. Invalid query, unknown lesson, and a lesson the learner may not read all render `notFound()` —
the route never reveals whether a lesson exists.

`generateMetadata` sets the title to `Từ vựng – <lesson title>` / `Vocabulary – <lesson title>`; Chrome uses it as the
default PDF file name. It is server metadata, so leaving the route restores the next page's own title.

### 2.2 Contract

`lib/vocabulary/print/`:

```ts
type PrintSource = { kind: "lesson"; lessonId: string; set: "all" | "saved" };

resolvePrintSource({ source, locale, userId, db }):
  Promise<{ kind: "ok"; doc: PrintDocument } | { kind: "not_found" } | { kind: "unauthorized" }>;

interface PrintDocument {
  title: string;          // lesson title
  backHref: string;       // the launcher, e.g. the lesson's Summary
  backLabel: string;
  items: VocabularyPrintItem[];
}

interface VocabularyPrintItem {
  id: string;             // stable within the source: lexical identity, or the saved card's identity when raw
  surface: string;
  reading?: string;
  meaning?: string;
  meaningLocale?: "vi" | "en";
  meaningSource?: "curated" | "canonical-vocab" | "jmdict";
  resolution: "resolved" | "saved_raw";
  example?: { text: string; sourceLabel?: string };
}
```

`userId` comes from the session on the server; the client never sends it. Every field is a string or a string
union: the document is JSON-safe (no `Date`, `Map`, `BigInt`, class instance or function).

### 2.3 `set=all`

Exactly the Summary Words list: `wordRows(aiWords, lessonWords)` from `lib/summary/word-list.ts`, cap 24, same order.
Print does not build its own list, so a Words ranking change never drifts from Print.

- `aiWords` come from `requestLessonAnalysis(lessonId, locale, "read")` — the read-only path. A ready analysis is
  used; `pending`, `not_ready`, `unavailable` or an error means no AI words. Never `"generate"` (P8).
- `lessonWords` come from `getLessonVocabulary(lessonId, { limit: LESSON_WORDS_FETCH })`.
- `example.text` is the row's source line text (`lineId`); `sourceLabel` is unset in V1 (the title names the lesson).

### 2.4 `set=saved`

The learner's saved cards for this lesson from `lesson_summary_evidence` (`saved: { cardId, kind, ref, lineId }`),
`kind = "vocabulary"` only — expressions have no JMdict identity and are not printed in V1.

For each card: the token on `lineId` whose surface equals `ref` → `resolveLexeme` → `resolution: "resolved"`.
Dedupe by `entSeq + reading`; the kept example is the **earliest transcript line** among the duplicates.

A card that no longer resolves (transcript changed, token not found) is kept as `resolution: "saved_raw"`:
`surface = ref`, `example.text` = the line text when the line still exists, no reading, no meaning — never a
first-JMdict-entry guess. Raw cards dedupe by `normalizeRef(ref)`. The workspace notes "N mục không tìm được cách
đọc/nghĩa" before printing; the paper does not print "unresolved".

### 2.5 Launcher and empty state

Summary's Words section gains an "In từ vựng" link to `?set=all`. Switching `Tất cả | Đã lưu` in the workspace is a
link: the server resolves again and the selection resets.

An empty document shows an empty state with `backHref` / `backLabel` from the adapter — the workspace never names
Summary.

## 3. Workspace and A4 pagination

### 3.1 Layout

At ≥1024px, two columns: a left panel (~320px, scrolls on its own) and the paper stack on the right. Below 1024px
they stack, settings first. The owner's viewport is 1280×529, too short for settings above the preview.

Left panel, top to bottom: `Tất cả | Đã lưu` (links); mode `Ôn tập | Tự kiểm tra` (`segmented-control`); toggles
`Cách đọc · Nghĩa · Ví dụ` (`switch`); in self-test only, hide `Nghĩa | Cách đọc`; density `Thoáng | Gọn`; the word
list with checkboxes and "Chọn tất cả / Bỏ chọn"; the count "18/24 từ · 3 trang"; the `saved_raw` and oversize
notices; **In / Lưu PDF** sticky at the bottom (`window.print()`).

Selection ("Tự chọn") and settings are transient workspace state: a reload returns to the defaults. Nothing persists
in V1.

### 3.2 One paper config

`lib/vocabulary/print/paper.ts` — `{ widthMm: 210, heightMm: 297, marginMm }`. Emitted as `mm` CSS variables used by
the preview sheet, the measurement tree and `@page`. Margins are sheet padding.

### 3.3 Measurement

A measurement tree, `visibility: hidden`, off-screen, **not** `display: none`, exactly the sheet's content width,
renders with the same components: the **first-page header**, the **continuation header**, the footer, and every
selected item. Item spacing is padding, not margin (no margin collapse in the numbers).

Order: render the tree → `await document.fonts.ready` → measure with `getBoundingClientRect().height`. Noto Sans JP
loads in `unicode-range` slices that are requested only when a glyph renders, so `fonts.ready` before the render would
resolve too early.

Every measurement carries a generation token:

```ts
const generation = ++currentGeneration;
await document.fonts.ready;
if (generation !== currentGeneration) return;
```

`document.fonts` `loadingdone` triggers a debounced re-measure. Two rapid font loads, or a setting change during one,
commit only the newest result.

### 3.4 Pagination

```ts
type PageCapacity = { firstPage: number; continuationPage: number };
paginate(itemHeights: number[], capacity: PageCapacity): { pages: number[][]; oversized: number[] }
```

`firstPage = content − firstHeader − footer`, `continuationPage = content − continuationHeader − footer`, all
measured (a long title can wrap to two lines). Greedy, one pass, each item placed exactly once — no loop can run
forever. The footer's `x / y` has a stable height, so 9 → 10 pages does not change the layout.

An item taller than its page's capacity is placed alone on a page and reported in `oversized`. That is a **blocking**
state: a warning names the item, and Print is disabled until the learner picks `Gọn`, turns off `Ví dụ`, or deselects
it. Content is never clipped and never shrunk.

### 3.5 Re-pagination and swap

Selection, settings and font-load changes re-measure. A viewport resize does not. The preview keeps the last complete
page set on screen while the hidden tree measures, then swaps to the new set **once**. Print is disabled while
re-paginating, while anything is oversized, and until the first-page mascot's `decode()` resolves.

### 3.6 Preview scale

The paper is always laid out at 210×297mm. A `ResizeObserver` on the preview column computes
`scale = min(1, columnWidth / paperWidth)` and applies `transform: scale()` to a wrapper whose height is corrected.
Measured heights never depend on the scale.

## 4. Print contract

### 4.1 Isolation

The committed page set renders twice from the same data and the same components: once in the preview column, once
through a React portal into `<div data-print-root>`, a direct child of `<body>`.

```css
@media screen { [data-print-root] { display: none } }
@media print  { body > :not([data-print-root]) { display: none } }   /* print-only isolation rule */
```

Global portals (toast, dialog) vanish in print too, which is correct. The measurement tree lives in the app tree and
is never printed. `Ctrl+P` always prints the last complete page set; before the first commit the root is empty.

Font variables are set on `<body>` (`app/[locale]/layout.tsx:134`), so the portal inherits `--font-jp` and
`--font-display`; a test reads the computed font-family inside the print root.

The page and item components are **presentational only**: no buttons, inputs, fixed DOM ids or ARIA references —
rendering them twice must not duplicate ids. Workspace controls live outside them.

### 4.2 Page

```css
@page { size: A4; margin: 0 }
@media print { html, body { margin: 0; padding: 0 } }
```

The print root has no gap or margin outside the sheets. Each sheet is `210mm × 297mm`, `box-sizing: border-box`,
`overflow: hidden` (absorbs sub-pixel rounding only; oversize is already blocked), `break-after: page` except the
last.

Korume renders the complete page, header and footer itself and requests A4 with zero CSS page margin. Browser
print-dialog options remain controlled by the browser and the user.

### 4.3 Paper palette

The sheet uses its own palette, not theme tokens: white paper, `#111` text, grey secondary text and rules. Preview
and print are identical in light and dark theme. No `print-color-adjust: exact` — nothing needs a background.

### 4.4 Type

`--font-jp` (Noto Sans JP) and `--font-sans` / `--font-display`, already loaded; no new font. Japanese spans carry
`lang="ja"`. Sizes in `pt` / `mm`, never `rem`, so the app's text-size setting does not move the paper.

## 5. Item template

One template for both modes:

```
苦手　にがて
không giỏi; yếu về                       [EN] chip when meaningLocale = en
今回はね「私の苦手な人」について話します
───────────────────────────────────────
```

Headword largest and bold (`--font-jp`); reading lighter grey; meaning medium weight; example smaller; thin rule
between items. Toggled-off fields are not rendered. In self-test the hidden field becomes one fixed-height writing
line (~10mm). `Gọn` tightens item padding and type steps; it never changes the template. No bold target in the
example in V1.

## 6. Print visual identity (Korume DNA)

```
┌──────────────────────────────────────┐
│  [mascot] KORUME                     │   first page only: mascot 18mm + full header
│  Ôn tập từ vựng                      │
│  <lesson title>                      │
│  ─────────────────────────────────── │
│  items…                              │
│                          [faint mark]│
│  Korume · Ôn tập từ vựng       1 / 3 │   footer on every page
└──────────────────────────────────────┘
```

- **Mandatory:** first-page header (mascot, wordmark `KORUME` in `--font-display`, the localized document name
  "Ôn tập từ vựng" / "Tự kiểm tra từ vựng", the lesson title, a rule); continuation header on pages 2+ (one compact
  line: wordmark · lesson title, no mascot); footer on every page (`Korume · <document name>` left, `x / y` right).
- **Mascot:** `public/mascot/poses/quill-writing.png` at a fixed 18mm box — layout never waits on the image's
  intrinsic size. Print is enabled only after `decode()` resolves.
- **Footer mark:** the same PNG with `grayscale(1)` and low opacity (~6–8%) in a fixed box inside the footer, clear of
  the wordmark and the page number, on every page. No new asset; no outline mark exists and none is invented. A design
  constant, on by default, not a learner setting; turned off in the design if the owner's real printout finds it
  noisy.
- **Ink:** no fills, no cards, thin rules only. The only colour on paper is the first-page mascot; the sheet must read
  cleanly in grayscale.
- **Shape language:** spacing, rule weight and the `EN` chip radius come from the app's tokens; card chrome is not
  carried over.

## 7. Files

| Area | Files |
|---|---|
| Resolver | `lib/analysis/lexical-resolver.ts` (new), `lib/analysis/line-analysis.ts`, `lib/japanese/tokenizer.ts`, `lib/analysis/types.ts`, `lib/analysis/lesson-vocabulary.ts` |
| Summary | `lib/summary/analysis/input.ts`, `lib/summary/analysis/hydrate.ts`, `lib/summary/word-list.ts`, `components/lesson-summary/word-list.tsx`, `components/lesson-summary/analysis-blocks.tsx` (EN chip, launcher link) |
| Korume tools | `lib/korume/tools/dictionary.ts`, `lib/korume/tools/exposure.ts` (import path only) |
| Print | `lib/vocabulary/print/{source,lesson-source,paper,paginate}.ts` (new), `app/[locale]/(protected)/(app)/vocab/print/page.tsx` (new), `components/vocabulary-print/*` (new: workspace, sheet, item, print root) |
| Copy | `messages/{vi,en}/*.json` |

No migration.

## 8. Tests

Written first, layer by layer.

**Resolver (vitest).** 人 in 「苦手な人」 → ひと; 話し → 話す/はなす and 行った → 行く/いく; exact beats stem; a
right-reading homophone with another headword does not beat the right headword; ん excluded from lesson vocabulary and
from automatic lookup; one useful `非自立` token keeps its popup; アメリカ人's 人 keeps its popup and is not listed;
Ask Korume without a reading ranks as today; same `word`, two `reading`s → two `vocabId`s, never cross-attached;
fallback + ambiguous → no `vocabId`.

**Meaning (vitest, each with a mutation that turns it red).** `vi` + matching `(word, reading)` → curated, `vi`;
`vi` without curated → JMdict EN, `meaningLocale: "en"`; curated row with the same word but another reading → not
used; the Print source never reads `word_gloss_vi`; `en` never returns `meaning_vi`.

**Summary (vitest).** Hydration never falls back to `kana_forms[0]` when the line resolves; the analysis fingerprint
changes with the resolver version.

**Source (vitest).** Bad query → 404; unreadable lesson → 404 (same as not found); `all` equals `wordRows` order and
cap; `all` calls `requestLessonAnalysis` with `"read"` only — never `"generate"`, no reserve path; `saved` skips
expressions, dedupes by `entSeq + reading` keeping the earliest line; an unresolvable card → `saved_raw` without
reading or meaning; `JSON.parse(JSON.stringify(doc))` deep-equals `doc`; the `print` route wins over `[id]`.

**Pagination (vitest).** Empty list; exact fit; first and continuation capacities differ; a two-line title shrinks
`firstPage`; an oversized item is alone and reported; 9 → 10 pages leaves the layout unchanged; same input → same
pages.

**Workspace (component).** A setting change re-paginates; a resize does not; two quick `loadingdone`s commit only the
newest; rapid setting changes never let a stale page set win; Print is disabled while re-paginating, when oversized,
and before the mascot decodes.

**Playwright (real Chrome, `AI_PROVIDER=none`, Ep.729).** `page.pdf()` page count equals DOM sheet count; no item's
box crosses its sheet's bottom; at 1280×529 and at 375px wide the item heights are identical and only the scale
differs; under `emulateMedia({ media: "print" })` only `[data-print-root]` is visible and the measurement tree is
absent; **dark theme + print-root computed font (Noto Sans JP) + page count in one case**, with paper text `#111` on
white; a long lesson title still paginates correctly. Mutations: removing `await document.fonts.ready` and changing
the paper height must each turn a test red.

## 9. Merge gates (AGENTS.md §9)

- `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:e2e` (summary + print specs), `npm run
  verify:protocol` — all exit 0, output shown.
- `code-reviewer` per layer, **and** a separate whole-branch review before merge (L-011).
- Owner Chrome + paper review: a 2–3 page PDF — page 1 mascot + full header, pages 2+ compact header, footer aligned
  across pages, footer mark legible in grayscale, dark theme does not change the paper; Shadowing popup 人 → ひと and
  ん without a wrong popup.
- Lessons recorded in `docs/lessons.md`.
- No migration, so no `verify:db:*` gate is added for this branch.

Visible consequence: each lesson's cached Summary analysis regenerates once, lazily, on its next open (§1.10).

## 10. Out of scope (V1)

Paper flashcard template; Saved Vocabulary / deck / collection sources; mixed multi-lesson selection (a later
server-side selection token, with the workspace unchanged); expressions in print; bold target in the example
(`targetSpan`); persisted settings or selection; AI-generated Vietnamese meanings in print; a user toggle for the
footer mark.
