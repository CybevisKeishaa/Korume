# Print Vocabulary — Writing Worksheet amendment — Design

- Date: 2026-10-06
- Branch: `print-vocabulary` (unmerged; V1 has not shipped, so this changes V1's requirement, not a V2)
- Parent: `2026-10-05-print-vocabulary-design.md` (frozen). This document **supersedes** the parent's P1, P2's
  "In / Lưu PDF" action, §3.1 controls, §5 and §6, and extends §3.4–§3.5, §4, §8 and §10. Everything else in the
  parent — the resolver (§1), the source adapter (§2), measurement, generation tokens, isolation and the paper
  palette — still holds.
- Status: design approved by the owner 2026-10-06 with seven amendments (W2, W5, W6, W8, W9, W10, W12), all folded
  in below. Awaiting the owner's review of this text, then `writing-plans`.
- Implementer: Claude.

## 0. Rulings

| # | Ruling (owner, 2026-10-06) |
|---|---|
| W1 | **Purpose.** Print V1 is primarily a **handwriting worksheet**, not a vocabulary reference sheet. Every selected item reserves substantial physical writing space. Priority when space competes: writing cells > target/prompt > example > branding. |
| W2 | **Two modes, one geometry.** `Luyện viết` (practice): stroke guide → black model → grey trace → own repetitions. `Tự kiểm tra` (self-test): prompts → blank cells → answer key at the end. |
| W3 | **Display form follows the lesson surface** (owner ruling 2026-10-06, parent amendment): JMdict kanji forms are metadata, never a replacement display form. The target written on paper is `item.surface`. |
| W4 | **Words with kanji by default.** Items without kanji are excluded until the learner turns on `Bao gồm từ chỉ có kana`. No warning — it is a preference, not an error. |
| W5 | **Stroke order is V1**, from KanjiVG data already imported (`dict_kanji_strokes`), never AI. One complete-character diagram per grapheme with numbered stroke starts and a start dot; **no progressive diagrams**. Stroke data is its own capability; the lexical resolver knows nothing about it. |
| W6 | **Self-test never reveals the target before the answer key**: no target, no grey trace, no stroke guide, and the example is masked or dropped. |
| W7 | **Answer key** (self-test only): the last page(s), `n. target  reading`, no writing cells, no stroke diagrams. |
| W8 | **A repetition is atomic**: one repetition of `話します` is one unbroken group `話|し|ま|す`. A group that does not fit at the row's end moves whole to the next row; a word is never split across rows. |
| W9 | **Centre watermark = Korume mascot + `KORUME` wordmark**, one very faint grouped layer on every page. The footer mascot mark is removed. |
| W10 | **Korume learning prompt** (`printQuote`): curated, localized microcopy owned by Korume, chosen deterministically by page index, in a fixed-height band above the footer. Not AI, not random, not a quotation of a person. |
| W11 | **Two actions: `Tải PDF` (primary) and `In` (secondary).** Both use the same committed page set; neither re-paginates. |
| W12 | **`Tải PDF` produces a real PDF file** from server-side Chromium: vector text, embedded fonts, never rasterised kanji, never a print dialog. The server treats every client field as untrusted. Chromium is a production dependency. |

## 1. Data

### 1.1 Stroke guides — `lib/strokes/`

A new capability, independent of `lib/analysis`:

```ts
export interface StrokeGuide {
  character: string;
  viewBox: 109;                                    // KanjiVG's grid
  strokes: { d: string; start: [number, number] }[]; // KanjiVG order, never re-ordered
}
export async function getStrokeGuides(characters: string[]): Promise<Map<string, StrokeGuide>>;
```

- Reads `dict_kanji_strokes.paths` for the **active** snapshot in one batched `in("literal", …)` query. The active
  local snapshot holds 6 703 rows, 184 of them kana, so kanji and kana are both covered.
- `start` is the first `M`/`m` coordinate of the stored, already-sanitised path. A path without a leading move is
  skipped from numbering (drawn, not numbered); the renderer never infers stroke order.
- A character without a row is simply absent from the map.
- Plain data only (strings and numbers), so it crosses the RSC boundary safely. Future `/kanji` handwriting practice
  or stroke animation can reuse it.

### 1.2 Graphemes

`graphemes(text) = [...new Intl.Segmenter("ja", { granularity: "grapheme" }).segment(text)].map(s => s.segment)`.
One writing cell and one stroke guide per grapheme. Small kana (`ょ`, `っ`, `ャ`) get their own cell; never UTF-16
code units.

### 1.3 Kanji detection

`hasKanji(form)` is true when the form contains `\p{Script=Han}` or `々` (an ideographic iteration mark, so a word
with `々` is never "kana-only"). Items without kanji — hiragana, katakana, `ー`, kana iteration marks `ゝゞヽヾ`,
and mixed forms such as `Tシャツ` — are the "kana" bucket that `Bao gồm từ chỉ có kana` adds back.

### 1.4 Example masking

The adapter adds `targetSurfaces: string[]` to `example`: the surfaces of the tokens **in that example line** whose
resolved `entSeq` equals the item's (for `saved_raw`, the saved `card.ref`). In self-test every occurrence of every
target surface is replaced by a fixed `＿＿` (the owner's sketch; the cell group already tells the character count,
so the blank need not mirror it, and an inflected surface's length would mislead). If
`targetSurfaces` is empty, or none of them occurs in the text, the example is **not rendered** in self-test — the
example never risks revealing the answer. Practice mode prints the example unmasked.

### 1.5 Attribution

KanjiVG is CC BY-SA 3.0. The last page's footer carries one small credit line built from
`getDictionaryAttribution` (real version and licence, never hard-coded): e.g. `Stroke data: KanjiVG <version>
(CC BY-SA 3.0)`. Present in preview, print and PDF.

## 2. Settings and prompts

```ts
export interface PrintSettings {
  mode: "practice" | "selfTest";   // Luyện viết | Tự kiểm tra
  density: "airy" | "compact";      // Thoáng | Gọn — writing rows per item (§3.3)
  includeKanaOnly: boolean;         // default false (W4)
  showReading: boolean;             // practice: metadata; self-test: prompt
  showMeaning: boolean;
  showExample: boolean;
}
DEFAULT = { mode: "practice", density: "airy", includeKanaOnly: false, showReading: true, showMeaning: true, showExample: true }
```

`hide: "meaning" | "reading"` is removed.

**Practice.** The target is always shown; reading, meaning and example are optional metadata.

**Self-test.** Reading, meaning and example are prompts. The workspace never lets the learner turn off the last
enabled prompt (that switch is `aria-disabled` with a hint). The **effective prompts** of an item:

1. the enabled prompts, minus `reading` when the item has no kanji (the reading *is* the answer), minus a field the
   item lacks, minus an example that cannot be masked (§1.4);
2. if that leaves nothing: the first available of meaning, then masked example;
3. if still nothing: the item is **excluded from self-test**, and the workspace shows "N từ không có gợi ý nên không
   đưa vào Tự kiểm tra".

## 3. Item geometry

### 3.1 Practice (`Luyện viết`)

```text
苦手   にがて   không giỏi                     ← meta line (target largest, reading/meaning smaller)
Thứ tự nét   [苦 ¹²³…]  [手 ¹²³⁴]             ← one diagram per grapheme
┌──┬──┐ ┌──┬──┐ ┌──┬──┐ ┌──┬──┐ ┌──┬──┐
│苦│手│ │苦│手│ │  │  │ │  │  │ │  │  │       ← writing rows
└──┴──┘ └──┴──┘ └──┴──┘ └──┴──┘ └──┴──┘
 model   trace   own …
苦手な人について話します                        ← example, optional
```

- **Stroke guide row.** One fixed-size box per grapheme (target ≈ 14mm): every stroke drawn in thin dark grey, a
  start dot at each stroke's `start`, and its number `1, 2, 3…` beside the dot (≥ 5pt). A grapheme without a guide
  gets no box. The row wraps only between boxes. Final box size, number size and offsets are set by the A4
  measurement in the plan and the owner's paper review.
- **Writing rows.** Each cell is a square (target ≈ 12mm, final value from the A4 measurement) with a dashed centre
  cross. One repetition = one atomic group of `graphemes(target).length` adjacent cells (W8); groups are separated by
  a gap; a row holds `groupsPerRow = floor((W + gap) / (n·cell + gap))` groups.
- **Repetition content.** Repetition 1: the target in solid black (`--font-jp`); repetition 2: the same in very light
  grey for tracing; all others blank. For a multi-grapheme word this is the whole group, not one cell.
- **Rows.** `rows = max(densityRows, ceil(minRepetitions / groupsPerRow))`, with `densityRows` = 2 (`Thoáng`) or 1
  (`Gọn`) and `minRepetitions` = 3 in practice (model, trace, one own) and 2 in self-test.
- **Long words.** If one group is wider than the content width `W`, the item's cells shrink to `W / n`, down to a
  floor of 8mm; below that the item is **oversized** (parent §3.4: placed alone, reported, PDF and Print disabled
  until deselected). A word is never split.

### 3.2 Self-test (`Tự kiểm tra`)

```text
1.  にがて
    không giỏi
┌──┬──┐ ┌──┬──┐ ┌──┬──┐
│  │  │ │  │  │ │  │  │
└──┴──┘ └──┴──┘ └──┴──┘
＿＿な人について話します
```

Same writing geometry (group width comes from the hidden target's grapheme count — the learner knows how many
characters to write). A number `n.` in document order, the effective prompts (§2), blank cells only. **No target, no
grey trace, no stroke guide anywhere before the answer key** (W6).

### 3.3 Density

`Gọn` / `Thoáng` primarily set `densityRows` (§3.1); they also keep the parent's tighter/looser item padding. Writing
area remains the largest part of every item in both.

### 3.4 Answer key (self-test only)

Starts on a new page after the last item page, headed `Đáp án` / `Answers`. A compact multi-column list: `n.` + target
(`--font-jp`) + reading (small, grey; omitted when the item has no kanji). No writing cells, no stroke diagrams, no
meanings. Answer pages use the continuation header, the quote band and the footer, and are paginated by the same
greedy pass as item pages (answer rows are the measured units). Practice has no answer key.

## 4. Visual identity

```text
┌─────────────────────────────────────────┐
│ [mascot] KORUME                         │  page 1: colour mascot + full header (parent §6)
│ Luyện viết từ vựng · <lesson title>     │
│ ─────────────────────────────────────── │
│ items…                                  │
│              (mascot)                   │  centre watermark: mascot + KORUME, ~4 %, grey
│              K O R U M E                │
│ items…                                  │
│ “Viết chậm cũng là đang tiến lên.”      │  fixed-height quote band
│ Korume · Luyện viết từ vựng       1 / 3 │  footer: text + page number only
└─────────────────────────────────────────┘
```

- **Headers.** Unchanged from the parent, with the document names `Luyện viết từ vựng` / `Tự kiểm tra từ vựng`
  (en: `Vocabulary Writing Practice` / `Vocabulary Self-test`).
- **Centre watermark (W9).** One group, `public/mascot/poses/neutral.png` (full-body, transparent) above the
  `KORUME` wordmark in `--font-display`, centred on the sheet, `position: absolute`, behind the content (`z-index`
  below the body), `filter: grayscale(1)`, opacity ≈ 4 %, `pointer-events: none`, fixed mm size. It is not in the
  measurement tree and changes no height. Its image `decode()` joins the mascot readiness of the commit lifecycle
  (parent §3.5). Identical in preview, print and PDF. If the owner's printout shows it competing with the cells,
  opacity or size drops — the writing area never does.
- **Footer.** `Korume · <document name>` left, `x / y` right; the footer mascot mark is removed (W9). The last page
  adds the KanjiVG credit (§1.5) in a reserved line, so every page's footer keeps one fixed height.
- **Quote band (W10).** Directly above the footer, fixed height (2 lines of its type), on every page.
  `printQuote(pageIndex, locale)` returns `quotes[pageIndex % quotes.length]` from `messages/{vi,en}/vocab.json`
  `print.quotes` (`q1…q8`). Rendered with quotation marks; in code it is a learning prompt, not an attributed quote.
  Proposed copy, for the owner's review of this spec:

  | vi | en |
  |---|---|
  | Viết chậm cũng là đang tiến lên. | Writing slowly is still moving forward. |
  | Một chữ đẹp bắt đầu từ một nét chắc. | A good character starts with one sure stroke. |
  | Nhớ bằng tay, không chỉ bằng mắt. | Remember with your hand, not just your eyes. |
  | Mỗi lần viết lại là một lần nhớ sâu hơn. | Every rewrite makes the memory deeper. |
  | Đúng thứ tự nét, chữ tự khắc vững. | Get the stroke order right and the shape follows. |
  | Hôm nay một trang, mai thêm một chữ quen. | One page today, one more familiar word tomorrow. |
  | Sai một nét cũng không sao — viết lại thôi. | A wrong stroke is fine — just write it again. |
  | Từng ô nhỏ, từng bước vững. | Small squares, steady steps. |

## 5. Pagination and commit

- `PageCapacity` subtracts the measured quote band and footer as well as the header:
  `firstPage = content − firstHeader − quoteBand − footer`, `continuationPage = content − continuationHeader −
  quoteBand − footer`. Both bands have fixed heights, so capacity stays deterministic and a different quote never
  moves an item.
- The measurement tree renders the items in the current mode (practice: guide row + writing rows; self-test: prompts
  + writing rows) and, in self-test, the answer rows. Heights are re-measured from scratch; nothing from the old
  review layout or page count is kept.
- Item heights are now dominated by fixed mm writing rows, so typical pages hold far fewer items than before; this is
  expected.
- The committed page set becomes a list of typed pages:

  ```ts
  type CommittedPage = { kind: "items"; ids: string[] } | { kind: "answers"; ids: string[] };
  ```

- Lifecycle unchanged: `render measurement tree → fonts.ready → measure → paginate → mascot + watermark decode →
  commit`. `Tải PDF` and `In` are enabled only with a complete committed page set, nothing re-paginating and nothing
  oversized; `Tải PDF` is also disabled while its own request is in flight.

## 6. Actions

### 6.1 Layout

Sticky at the bottom of the left panel: `[ Tải PDF ]` (primary) `[ In ]` (secondary). The `In / Lưu PDF` button is
removed. The left panel's controls become: `Tất cả | Đã lưu`; mode `Luyện viết | Tự kiểm tra`; switches `Cách đọc ·
Nghĩa · Ví dụ` (labelled as prompts in self-test); `Thoáng | Gọn`; `Bao gồm từ chỉ có kana`; the word list; the count;
the notices (`saved_raw`, oversized, "N ký tự chưa có hướng dẫn nét", "N từ không có gợi ý…").

### 6.2 `In`

`window.print()` on the existing `[data-print-root]` portal of the committed page set (parent §4), unchanged.

### 6.3 `Tải PDF`

`POST /api/vocab/print/pdf`:

```ts
{ lessonId: uuid; set: "all" | "saved"; locale: "vi" | "en"; settings: PrintSettings; pages: CommittedPage[] }
```

1. **Validate.** zod with size caps (≤ 60 pages, ids ≤ the document's item count). Unauthenticated → 401.
   `rateLimit` (`lib/rate-limit.ts`) per user, ≈ 5 PDFs per minute → 429.
2. **Never trust the client.** Re-resolve the source with `loadPrintDocument` as the learner (unreadable → 404).
   Every id must belong to the document, appear at most once across item pages, answer pages must list exactly the
   item pages' ids in order, and `answers` pages only in self-test → otherwise 400. No text from the client is ever
   rendered.
3. **Render.** One shared `playwright-core` Chromium, at most **one render at a time**, a queue of at most 4 (full →
   503 with `Retry-After`), a 30s render timeout (→ 504). A fresh browser context per request receives the learner's
   auth cookies scoped to `PRINT_PDF_ORIGIN` (default `http://127.0.0.1:$PORT`), and **aborts every request whose
   origin is not `PRINT_PDF_ORIGIN`**. It opens `/{locale}/vocab/print?source=lesson&lesson=…&set=…&render=pdf` with
   the validated `{ settings, pages }` injected by `addInitScript`.
4. **Render mode** (same route, same `PrintSheets`). The page re-resolves the source itself, re-validates the
   injected ids against it, and renders exactly the injected page assignment — **no measurement, no pagination** —
   then awaits `document.fonts.ready` and both image decodes, checks that no sheet's body overflows its capacity, and
   sets `data-pdf-ready` (or `data-pdf-error`).
5. **PDF.** `page.pdf({ preferCSSPageSize: true, printBackground: false })`. On overflow → 409 and the client says
   "Bố cục vừa thay đổi, hãy thử lại" — never a silently broken PDF.
6. **Response.** `Content-Type: application/pdf`, `Content-Disposition: attachment;
   filename="Korume-Writing-Practice.pdf"; filename*=UTF-8''<percent-encoded name>`, with the name
   `Korume - Luyện viết từ vựng - <lesson title>.pdf` (vi) or `Korume - Vocabulary Writing Practice - <lesson
   title>.pdf` (en); self-test uses its document name. Characters invalid in file names (`/\:*?"<>|` and control
   characters) are replaced by a space.
7. **Client.** `fetch` → `blob` → `<a download>` click → revoke the object URL. Busy state on the button; errors map to
   a toast (429 / 503 "đang bận, thử lại sau", 409 as above, others generic).

### 6.4 Ops

- `playwright-core` (same version as `@playwright/test`) moves into `dependencies`.
- The server needs Chromium: `npx playwright install --with-deps chromium`, recorded in the deploy docs together with
  `PRINT_PDF_ORIGIN`. Without Chromium, the route returns 503 and the workspace hides nothing — `In` still works.
- Memory: one browser, one render at a time; the browser closes after 5 idle minutes.

## 7. Files

| Area | Files |
|---|---|
| Strokes | `lib/strokes/{types,guides}.ts` (new) |
| Print lib | `lib/vocabulary/print/{settings,source,lesson-source,paginate}.ts`, `lib/vocabulary/print/{graphemes,prompts,mask,quotes,filename,layout}.ts` (new) |
| Renderer | `components/vocabulary-print/{print-sheets,print-workspace}.tsx`, `components/vocabulary-print/{writing-cells,stroke-guide,answer-key,watermark}.tsx` (new) |
| Route | `app/[locale]/(protected)/(app)/vocab/print/page.tsx` (render mode), `app/api/vocab/print/pdf/route.ts` (new), `lib/vocabulary/print/pdf/{renderer,queue}.ts` (new) |
| CSS / copy | `app/globals.css` (`.vp-*`), `messages/{vi,en}/vocab.json` |
| Ops | `package.json`, deploy docs |

No migration.

## 8. Tests

Written first; each guarantee below also gets a mutation that turns it red.

- **Unit.** `graphemes` (small kana, `ー`, surrogate pairs); `hasKanji` (`々` counts as kanji, `Tシャツ` does not);
  `getStrokeGuides` (order kept, `start` from the first move, missing character absent, active snapshot only);
  masking (every occurrence, fixed `＿＿`, unmaskable → no example); effective prompts (kana item drops reading; empty
  → fallback; nothing → excluded); repetition layout (atomic groups, `groupsPerRow`, min repetitions, shrink floor →
  oversized); `printQuote` deterministic; filename (`filename*`, unsafe characters); PDF route validation (401,
  foreign id, duplicate id, answers mismatch, answers in practice, oversize caps, 429).
- **Component.** Practice renders guide → model → trace → blanks; self-test renders no target text, no `.vp-trace`,
  no stroke guide before the answer key (asserted on the whole sheet's text and SVG); the last prompt switch cannot be
  turned off; `Tải PDF` and `In` disabled until commit; kana toggle default off.
- **Playwright (Ep.729).**
  - Real A4 geometry re-measured: no item crosses the quote band; quote band and footer at the same y on every
    page; watermark present and centred on every page and does not change any measured height.
  - Self-test: the target surface of every item appears nowhere on item pages (text content, including examples)
    and appears on the answer pages; answer pages are last.
  - A group never spans two rows (every cell of a group shares one row box).
  - `Tải PDF`: the download is a file starting `%PDF`, its page count equals the preview's sheet count, and
    extracted text contains a lesson kanji (vector text, not an image); a forged id → 400.
- **Gates** (unchanged from the parent §9) plus the owner's Chrome + real-paper review of both modes and a
  downloaded PDF.

## 9. Out of scope (V1)

Progressive stroke diagrams; stroke guides in the answer key; stroke animation; a learner setting for the number of
cells; persisted settings; paper flashcards; non-lesson sources; client-side PDF.
