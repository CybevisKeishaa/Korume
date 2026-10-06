# Print Vocabulary — Writing Worksheet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the built Print Vocabulary V1 into a handwriting worksheet (Luyện viết / Tự kiểm tra, KanjiVG stroke guides,
atomic writing repetitions, answer key, watermark, learning prompts, data credit) with two actions: a real server-side
PDF download and browser print, both from the same committed page set.

**Architecture:** A pure *prepare* stage (`prepareDocument`) turns `VocabularyPrintItem[]` + selection + settings into
`PreparedItem[]` / `AnswerRow[]` — the only thing the presentational `Worksheet` renders, in the preview, the print
root, the measurement tree and the PDF render page. The workspace measures and paginates prepared units into a
`PreparedPage[]` commit. `Tải PDF` posts the commit's ids; the server re-resolves the lesson, re-runs
`prepareDocument`, validates the ids against it, stores a single-use render job, and has a shared `playwright`
Chromium open a cookie-less render page that renders exactly those pages and prints them to PDF.

**Tech Stack:** Next.js 14 App Router, React 18.3, TypeScript strict, Tailwind + `app/globals.css` `.vp-*` rules,
next-intl, Supabase, zod, Vitest + jsdom, Playwright (tests) and `playwright` (production PDF).

**Spec:** `docs/superpowers/specs/2026-10-06-print-vocabulary-writing-worksheet-design.md` (frozen `bde0208`), parent
`docs/superpowers/specs/2026-10-05-print-vocabulary-design.md` (resolver, source adapter, measurement lifecycle and print
isolation still hold).

## Global Constraints

- Work only in the worktree `C:\Users\tplon\Documents\GitHub\JPWeb\japan-web\.worktrees\print-vocabulary`, absolute
  paths. Never build or serve in the main checkout.
- Paper sizes in `mm` / `pt` only, never `rem` or theme tokens; the paper palette (`--vp-ink #111`, `--vp-muted`,
  `--vp-rule`, white) holds in every theme.
- Presentational sheet components (`components/vocabulary-print/worksheet.tsx`, `writing-cells.tsx`,
  `stroke-guide.tsx`) render twice: no DOM ids, no buttons, no inputs, no ARIA references. `data-*` attributes are fine.
- Props crossing the RSC boundary are plain data (strings, numbers, booleans, arrays, plain objects) — never
  functions (memory: a formatter fn blanked a page while jsdom stayed green).
- No AI anywhere. Stroke data only from `dict_kanji_strokes` of the active snapshot.
- Settings defaults: `{ mode: "practice", density: "airy", includeKanaOnly: false, showReading: true, showMeaning:
  true, showExample: true }`.
- Writing geometry: content width `W = 182mm` (210 − 2·14), cell `12mm`, cell floor `8mm`, group gap `3mm`, row gap
  `2mm`, `densityRows` airy `2` / compact `1`, `minRepetitions` practice `3` / self-test `2`. Stroke-guide box `16mm`
  (ruling: a 12-unit number on the 109 grid is 5pt only at ≥ 16mm), number font `12` units, start dot `r = 2.6`.
- Mask blank is exactly `＿＿` (two U+FF3F).
- PDF: `rateLimit` `{ limit: 5, windowMs: 60_000 }` per user; one render at a time + 4 waiting (`createQueue(5)`);
  render timeout `30_000ms`; render job TTL `60_000ms`, token `randomBytes(32).toString("base64url")`; browser idle
  close `5 * 60_000ms`; `PRINT_PDF_ORIGIN` default `http://127.0.0.1:${PORT ?? 3000}`.
- Filenames: vi `Korume - Luyện viết từ vựng - <title>.pdf` / `Korume - Tự kiểm tra từ vựng - <title>.pdf`; en
  `Korume - Vocabulary Writing Practice - <title>.pdf` / `Korume - Vocabulary Self-test - <title>.pdf`; ASCII fallback
  `Korume-Writing-Practice.pdf` (practice) / `Korume-Self-Test.pdf` (self-test, ruling).
- Copy: next-intl ICU; the catalog test forbids `#` in messages — use named arguments. vi and en keys stay in parity.
- Tests: `npx vitest run <paths> --minWorkers=1 --maxWorkers=2` (15.8 GB machine). Never run vitest alongside
  Playwright. Playwright needs Docker Desktop + `npx supabase start` + `.env.local` (already in the worktree).
- Every guarantee test gets a mutation proving it can go red: back up as `<file>.mutbak` beside the file, mutate, run,
  restore, paste the raw red output into the report.
- Commits: `git commit -F <file>`, message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A selected word appears inside another item's example in an inflected form** (`話し` for `話す`): self-test must
   mask it everywhere. Pinned in Task 4 (`prepare.test.ts` "masks another printed item's inflected span").
2. **A grapheme with no stroke row** (`T` in `Tシャツ`, a rare kanji): the cells still print, only that guide is
   skipped, and the practice notice counts it. Pinned in Task 5 (`stroke-guide.test.tsx`) and Task 7 (workspace
   notice).
3. **The learner changes the selection while a PDF is generating**: the request carries the page set committed at
   click time and the button stays busy until it returns. Pinned in Task 9 (`print-workspace.test.tsx`).
4. **Chromium is not installed on the server**: the route answers 503 and `In` still works. Pinned in Task 8
   (`route.test.ts` "launch failure → 503").
5. **A lesson title with `/ \ : * ? " < > |`, control characters or emoji**: the download name stays valid and
   `filename*` keeps the Unicode. Pinned in Task 8 (`filename.test.ts`).

---

## File structure

| File | Responsibility | Task |
|---|---|---|
| `lib/vocabulary/print/japanese.ts` | `graphemes`, `hasKanji`, `readingRevealsTarget` (pure) | 1 |
| `lib/strokes/types.ts`, `lib/strokes/guides.ts` | `StrokeGuide`, `strokeStart`, `getStrokeGuides` | 2 |
| `lib/vocabulary/print/resources.ts` | `loadPrintResources(targets)` → stroke guides + credits (server) | 2 |
| `lib/vocabulary/print/source.ts` | `VocabularyPrintItem.entSeq`, `example.spans`, `PrintResources` type | 2, 3 |
| `lib/summary/word-list.ts`, `lib/vocabulary/print/lesson-source.ts` | `WordRow.entSeq`; adapter fills `entSeq` + `spans` | 3 |
| `lib/vocabulary/print/settings.ts` | `WorksheetSettings`, defaults, zod schema | 4 (old type deleted in 7) |
| `lib/vocabulary/print/mask.ts` | document mask set + masking (pure) | 4 |
| `lib/vocabulary/print/prepare.ts` | `prepareDocument` → `PreparedItem[]`, `AnswerRow[]`, `PreparedPage` types | 4 |
| `lib/vocabulary/print/layout.ts` | `writingLayout` (pure) | 5 |
| `components/vocabulary-print/writing-cells.tsx`, `stroke-guide.tsx` | cell rows, guide row | 5 |
| `lib/vocabulary/print/quotes.ts`, `components/vocabulary-print/labels.ts` | `quoteKey`, `useSheetLabels` | 6 |
| `components/vocabulary-print/worksheet.tsx` | the presentational sheets | 6 (`print-sheets.tsx` deleted in 7) |
| `lib/vocabulary/print/mascot.ts` | + `WATERMARK_SRC`, decode both images | 6 |
| `lib/vocabulary/print/paginate.ts` | capacity subtracts the quote band | 7 |
| `components/vocabulary-print/print-workspace.tsx`, `app/[locale]/(protected)/(app)/vocab/print/page.tsx` | new workspace | 7, 9 |
| `lib/vocabulary/print/filename.ts` | `pdfFilename`, `contentDisposition` | 8 |
| `lib/vocabulary/print/pdf/{request,jobs,queue,renderer}.ts`, `app/api/vocab/print/pdf/route.ts` | PDF backend | 8 |
| `app/[locale]/print-render/[token]/page.tsx`, `components/vocabulary-print/pdf-render.tsx` | render target | 9 |
| `lib/product/screen-registry.ts` | `print-render` row | 9 |
| `tests/e2e/print-vocabulary.spec.ts`, `tests/e2e/fixtures/{print-data,pdf-text}.ts` | browser acceptance | 10 |
| `docs/ops/print-pdf.md`, `docs/lessons.md`, run state | ops + docs | 8, 11 |

`middleware.ts` is **not** changed (ruling): route protection is a prefix allow-list (`lib/supabase/route-protection.ts`
`PROTECTED_PREFIXES`) and `/print-render` is in none of them; Task 9 pins that with a test.

---

### Task 1: Japanese text rules

**Files:**
- Create: `lib/vocabulary/print/japanese.ts`
- Test: `lib/vocabulary/print/japanese.test.ts`

**Interfaces:**
- Consumes: `katakanaToHiragana(input: string): string` from `lib/japanese/kana.ts` (leaves `ー` unconverted).
- Produces: `graphemes(text: string): string[]`, `hasKanji(form: string): boolean`,
  `readingRevealsTarget(surface: string, reading: string | undefined): boolean`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/vocabulary/print/japanese.test.ts
import { describe, expect, it } from "vitest";
import { graphemes, hasKanji, readingRevealsTarget } from "./japanese";

describe("graphemes (spec W §1.2)", () => {
  it("gives small kana and the long-vowel mark their own cell", () => {
    expect(graphemes("ちょっと")).toEqual(["ち", "ょ", "っ", "と"]);
    expect(graphemes("コーヒー")).toEqual(["コ", "ー", "ヒ", "ー"]);
  });
  it("counts a surrogate-pair kanji once, never per UTF-16 code unit", () => {
    expect("𠮟る".length).toBe(3);
    expect(graphemes("𠮟る")).toEqual(["𠮟", "る"]);
  });
});

describe("hasKanji (spec W §1.3)", () => {
  it("is true for kanji and for 々, false for kana, katakana and mixed Latin", () => {
    expect(hasKanji("苦手")).toBe(true);
    expect(hasKanji("人々")).toBe(true);
    expect(hasKanji("々")).toBe(true);
    expect(hasKanji("する")).toBe(false);
    expect(hasKanji("コーヒー")).toBe(false);
    expect(hasKanji("Tシャツ")).toBe(false);
    expect(hasKanji("ゝゞヽヾ")).toBe(false);
  });
});

describe("readingRevealsTarget (spec W §2)", () => {
  it("drops a reading that is the answer itself, across scripts", () => {
    expect(readingRevealsTarget("する", "する")).toBe(true);
    expect(readingRevealsTarget("とても", "とても")).toBe(true);
    expect(readingRevealsTarget("カメラ", "かめら")).toBe(true);
    expect(readingRevealsTarget("ｶﾒﾗ", "かめら")).toBe(true); // NFKC folds half-width katakana
  });
  it("keeps a reading that differs from the written form", () => {
    expect(readingRevealsTarget("Tシャツ", "ティーシャツ")).toBe(false);
    expect(readingRevealsTarget("苦手", "にがて")).toBe(false);
    expect(readingRevealsTarget("する", undefined)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/vocabulary/print/japanese.test.ts --minWorkers=1 --maxWorkers=2`
Expected: FAIL — `Failed to resolve import "./japanese"`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/vocabulary/print/japanese.ts
import { katakanaToHiragana } from "@/lib/japanese/kana";

const segmenter = new Intl.Segmenter("ja", { granularity: "grapheme" });

/** Spec W §1.2: one writing cell and one stroke guide per grapheme, never per UTF-16 code unit. */
export function graphemes(text: string): string[] {
  return [...segmenter.segment(text)].map((part) => part.segment);
}

/** Spec W §1.3: 々 is an ideographic iteration mark, so a word containing it is never "kana-only". */
export function hasKanji(form: string): boolean {
  return /[\p{Script=Han}々]/u.test(form);
}

/** Spec W §2: true when writing the reading down IS writing the answer, so self-test must not show it. */
export function readingRevealsTarget(surface: string, reading: string | undefined): boolean {
  if (reading === undefined) return false;
  const normal = (text: string) => katakanaToHiragana(text.normalize("NFKC"));
  return normal(surface) === normal(reading);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/vocabulary/print/japanese.test.ts --minWorkers=1 --maxWorkers=2`
Expected: PASS (6 tests).

- [ ] **Step 5: Mutations** — (a) change `graphemes` to `text.split("")` → the surrogate-pair case goes red; (b) drop `々` from
  the regex and replace `\p{Script=Han}` with `[一-龯]` → `人々` stays true but `々` alone must go red; (c) remove
  `.normalize("NFKC")` → the half-width case goes red. Restore each; paste red output.

- [ ] **Step 6: Commit**

```bash
git add lib/vocabulary/print/japanese.ts lib/vocabulary/print/japanese.test.ts
git commit -F <msg>   # "feat(print): grapheme, kanji and reading-reveals-target rules"
```

---

### Task 2: Stroke guides capability and print resources

**Files:**
- Create: `lib/strokes/types.ts`, `lib/strokes/guides.ts`, `lib/vocabulary/print/resources.ts`
- Modify: `lib/vocabulary/print/source.ts` (add `PrintResources`)
- Test: `lib/strokes/guides.test.ts`, `lib/vocabulary/print/resources.test.ts`

**Interfaces:**
- Consumes: `getActiveSnapshotId(): Promise<string | null>` and `getDictionaryAttribution(snapshotId: string):
  Promise<DictionaryAttribution[]>` from `lib/dictionary/snapshot.ts`; `createClient()` from `@/lib/supabase/server`;
  `graphemes` (Task 1). `DictionaryAttribution = { source: "jmdict" | "kanjidic2" | "kanjivg"; version; url; license }`.
- Produces:
  - `interface StrokeGuide { character: string; viewBox: 109; strokes: { d: string; start: [number, number] | null }[] }`
  - `strokeStart(d: string): [number, number] | null`
  - `getStrokeGuides(characters: string[]): Promise<Record<string, StrokeGuide>>`
  - `interface PrintResources { strokeGuides: Record<string, StrokeGuide>; credits: { jmdict: string | null; kanjivg: string | null } }`
    (in `source.ts`, so client components can import the type)
  - `loadPrintResources(targets: string[]): Promise<PrintResources>`

Note: the spec sketches `Map`; a `Record` is used because the value crosses the RSC boundary (Global Constraints).

- [ ] **Step 1: Write the failing tests**

```ts
// lib/strokes/guides.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const query = { select: vi.fn(), eq: vi.fn(), in: vi.fn() };
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: () => ({ from: () => query }) }));
vi.mock("@/lib/dictionary/snapshot", () => ({ getActiveSnapshotId: vi.fn(async () => "snap-1") }));

import { getActiveSnapshotId } from "@/lib/dictionary/snapshot";
import { getStrokeGuides, strokeStart } from "./guides";

beforeEach(() => {
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.in.mockResolvedValue({ data: [
    { literal: "人", paths: ["M54.5,20c0.37,2.12-0.22,6.27", "m 55 50 c 1 1 2 2 3 3"] },
    { literal: "し", paths: ["c1,2,3,4"] },
  ], error: null });
});

describe("strokeStart (spec W §1.1)", () => {
  it("reads the first absolute or relative move", () => {
    expect(strokeStart("M54.5,20c0.37,2.12")).toEqual([54.5, 20]);
    expect(strokeStart("  m 55 50 c 1 1")).toEqual([55, 50]);
    expect(strokeStart("M-1.5.5L2,3")).toEqual([-1.5, 0.5]);
  });
  it("is null for a path that does not start with a move", () => {
    expect(strokeStart("c1,2,3,4")).toBeNull();
  });
});

describe("getStrokeGuides (spec W §1.1)", () => {
  it("reads the active snapshot once, keeps KanjiVG order, and omits characters without a row", async () => {
    const guides = await getStrokeGuides(["人", "し", "T", "人"]);
    expect(query.eq).toHaveBeenCalledWith("snapshot_id", "snap-1");
    expect(query.in).toHaveBeenCalledWith("literal", ["人", "し", "T"]);
    expect(guides["人"]?.strokes.map((stroke) => stroke.start)).toEqual([[54.5, 20], [55, 50]]);
    expect(guides["人"]?.viewBox).toBe(109);
    expect(guides["し"]?.strokes[0]?.start).toBeNull(); // drawn, never numbered
    expect(guides.T).toBeUndefined();
  });
  it("returns nothing without an active snapshot or characters, without querying", async () => {
    vi.mocked(getActiveSnapshotId).mockResolvedValueOnce(null);
    expect(await getStrokeGuides(["人"])).toEqual({});
    expect(await getStrokeGuides([])).toEqual({});
    expect(query.in).not.toHaveBeenCalled();
  });
});
```

```ts
// lib/vocabulary/print/resources.test.ts
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/strokes/guides", () => ({ getStrokeGuides: vi.fn(async (chars: string[]) => Object.fromEntries(chars.map((c) => [c, { character: c, viewBox: 109, strokes: [] }]))) }));
vi.mock("@/lib/dictionary/snapshot", () => ({
  getActiveSnapshotId: vi.fn(async () => "snap-1"),
  getDictionaryAttribution: vi.fn(async () => [
    { source: "jmdict", version: "2026-09-01", url: "u", license: "CC BY-SA 4.0" },
    { source: "kanjidic2", version: "2026-09-01", url: "u", license: "CC BY-SA 4.0" },
    { source: "kanjivg", version: "r20250816", url: "u", license: "CC BY-SA 3.0" },
  ]),
}));

import { getStrokeGuides } from "@/lib/strokes/guides";
import { loadPrintResources } from "./resources";

describe("loadPrintResources (spec W §1.1, §1.5)", () => {
  it("asks for each grapheme of every target once and formats the credits from the active snapshot", async () => {
    const resources = await loadPrintResources(["苦手", "手紙", "する"]);
    expect(getStrokeGuides).toHaveBeenCalledWith(["苦", "手", "紙", "す", "る"]);
    expect(resources.credits).toEqual({ jmdict: "JMdict 2026-09-01 (CC BY-SA 4.0)", kanjivg: "KanjiVG r20250816 (CC BY-SA 3.0)" });
    expect(Object.keys(resources.strokeGuides)).toHaveLength(5);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/strokes lib/vocabulary/print/resources.test.ts --minWorkers=1 --maxWorkers=2`
Expected: FAIL — unresolved imports `./guides`, `./resources`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/strokes/types.ts
/** Spec W §1.1: normalized KanjiVG geometry, independent of the lexical resolver; reusable by /kanji or animation. */
export interface StrokeGuide {
  character: string;
  /** KanjiVG's 109 × 109 grid. */
  viewBox: 109;
  /** KanjiVG order, never re-ordered. `start` is null when the path does not begin with a move: drawn, not numbered. */
  strokes: { d: string; start: [number, number] | null }[];
}
```

```ts
// lib/strokes/guides.ts
import "server-only";
import { getActiveSnapshotId } from "@/lib/dictionary/snapshot";
import { createClient } from "@/lib/supabase/server";
import type { StrokeGuide } from "./types";

const NUMBER = String.raw`(-?(?:\d+\.?\d*|\.\d+))`;
const START = new RegExp(String.raw`^\s*[Mm]\s*${NUMBER}\s*,?\s*${NUMBER}`);

/** The first move of a sanitised KanjiVG path; the renderer never infers a stroke's start. */
export function strokeStart(d: string): [number, number] | null {
  const match = START.exec(d);
  return match ? [Number(match[1]), Number(match[2])] : null;
}

/** Spec W §1.1: one batched read of the active snapshot; a character without a row is absent. */
export async function getStrokeGuides(characters: string[]): Promise<Record<string, StrokeGuide>> {
  const unique = [...new Set(characters)];
  if (unique.length === 0) return {};
  const snapshotId = await getActiveSnapshotId();
  if (!snapshotId) return {};
  const { data, error } = await createClient()
    .from("dict_kanji_strokes")
    .select("literal, paths")
    .eq("snapshot_id", snapshotId)
    .in("literal", unique);
  if (error) throw error;
  return Object.fromEntries(((data ?? []) as { literal: string; paths: string[] }[]).map((row) => [row.literal, {
    character: row.literal,
    viewBox: 109 as const,
    strokes: row.paths.map((d) => ({ d, start: strokeStart(d) })),
  }]));
}
```

Add to `lib/vocabulary/print/source.ts` (below `PrintSourceResult`):

```ts
import type { StrokeGuide } from "@/lib/strokes/types";

/** Spec W §1.1, §1.5: everything the sheets need besides the items; plain data, crosses the RSC boundary. */
export interface PrintResources {
  strokeGuides: Record<string, StrokeGuide>;
  /** Formatted `<name> <version> (<licence>)`, from the active snapshot; null when that source is not imported. */
  credits: { jmdict: string | null; kanjivg: string | null };
}
```

```ts
// lib/vocabulary/print/resources.ts
import "server-only";
import { getActiveSnapshotId, getDictionaryAttribution } from "@/lib/dictionary/snapshot";
import { getStrokeGuides } from "@/lib/strokes/guides";
import { graphemes } from "./japanese";
import type { PrintResources } from "./source";

const NAMES = { jmdict: "JMdict", kanjivg: "KanjiVG" } as const;

/** Spec W §1.1 + §1.5: stroke guides for every grapheme the sheets may print, and the real data credits. */
export async function loadPrintResources(targets: string[]): Promise<PrintResources> {
  const characters = [...new Set(targets.flatMap(graphemes))];
  const [strokeGuides, snapshotId] = await Promise.all([getStrokeGuides(characters), getActiveSnapshotId()]);
  const attribution = snapshotId ? await getDictionaryAttribution(snapshotId) : [];
  const credit = (source: keyof typeof NAMES) => {
    const row = attribution.find((entry) => entry.source === source);
    return row ? `${NAMES[source]} ${row.version} (${row.license})` : null;
  };
  return { strokeGuides, credits: { jmdict: credit("jmdict"), kanjivg: credit("kanjivg") } };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/strokes lib/vocabulary/print/resources.test.ts --minWorkers=1 --maxWorkers=2` → PASS.
Then `npx tsc --noEmit` → exit 0.

- [ ] **Step 5: Mutations** — (a) in `getStrokeGuides` drop the `.eq("snapshot_id", …)` call → the snapshot assertion
  goes red; (b) make `strokeStart` return `[0, 0]` on no match → the `し` case goes red. Restore; paste output.

- [ ] **Step 6: Commit** — `feat(strokes): KanjiVG stroke guides and print resources (credits)`.

---

### Task 3: Source adapter carries `entSeq` and example spans

**Files:**
- Modify: `lib/summary/word-list.ts` (`WordRow.entSeq`), `lib/vocabulary/print/source.ts`, `lib/vocabulary/print/lesson-source.ts`
- Test: `lib/vocabulary/print/lesson-source.test.ts`, `lib/summary/word-list.test.ts` (if it builds `WordRow` literals, add the field)

**Interfaces:**
- Consumes: `AnalysisToken` (`surface`, `entries: { entSeq; headword; reading; … }[]`) from `lib/analysis/types.ts`;
  `wordRows(...)`.
- Produces:
  - `WordRow.entSeq: number` (set from `word.entSeq` for AI rows and `item.entSeq` for lesson rows).
  - `interface ExampleSpan { surface: string; entSeq: number }` and
    `VocabularyPrintItem.example?: { text: string; spans: ExampleSpan[]; sourceLabel?: string }`,
    `VocabularyPrintItem.entSeq?: number` (resolved items only; absent for `saved_raw`).

- [ ] **Step 1: Write the failing test** — append to `lib/vocabulary/print/lesson-source.test.ts`, reusing its existing
  mocks and fixtures (read the file first; it already builds `analyses` with tokens and runs `resolveLessonSource`):

```ts
it("carries entSeq and every resolved token of the example line as spans (spec W §1.4)", async () => {
  const result = await resolve({ set: "all" }); // the file's existing helper for set=all
  if (result.kind !== "ok") throw new Error(result.kind);
  const item = result.doc.items.find((candidate) => candidate.surface === "苦手")!;
  expect(item.entSeq).toBe(ENT_NIGATE); // the fixture's entSeq for 苦手; define it as a const if the file inlines it
  expect(item.example?.spans).toEqual(expect.arrayContaining([
    { surface: "苦手", entSeq: ENT_NIGATE },
    { surface: "人", entSeq: ENT_HITO },
  ]));
  // particles and auxiliaries have no entries, so they are never spans
  expect(item.example?.spans.every((span) => span.surface !== "な" && span.surface !== "の")).toBe(true);
});

it("gives a raw saved item spans but no entSeq (spec W §1.4)", async () => {
  const result = await resolve({ set: "saved" }); // with a saved card whose ref resolves to nothing
  if (result.kind !== "ok") throw new Error(result.kind);
  const raw = result.doc.items.find((candidate) => candidate.resolution === "saved_raw")!;
  expect(raw.entSeq).toBeUndefined();
  expect(Array.isArray(raw.example?.spans)).toBe(true);
});
```

If the fixture lacks a line with both 苦手 and 人, extend its tokens (`entries: [{ entSeq, headword, reading, … }]`
exactly as existing tokens are built) — the test must exercise two resolved tokens on one line.

- [ ] **Step 2: Run** `npx vitest run lib/vocabulary/print/lesson-source.test.ts --minWorkers=1 --maxWorkers=2` →
  FAIL (`entSeq` undefined / `spans` undefined).

- [ ] **Step 3: Implement**

`lib/summary/word-list.ts`: add `entSeq: number;` to `WordRow` (after `key`), set `entSeq: word.entSeq` in the AI map
and `entSeq: item.entSeq` in the lesson-row object. Run `npx tsc --noEmit` and add the field to any test literal it
flags.

`lib/vocabulary/print/source.ts`:

```ts
/** Spec W §1.4: an analysed token of the example line that resolved to a JMdict entry. */
export interface ExampleSpan { surface: string; entSeq: number }

export interface VocabularyPrintItem {
  /** Stable within the source: the lexical identity, or the saved word's identity when raw. */
  id: string;
  surface: string;
  /** The resolved JMdict entry; absent for `saved_raw`. */
  entSeq?: number;
  reading?: string;
  meaning?: string;
  meaningLocale?: MeaningLocale;
  meaningSource?: MeaningSource;
  resolution: "resolved" | "saved_raw";
  example?: { text: string; spans: ExampleSpan[]; sourceLabel?: string };
}
```

`lib/vocabulary/print/lesson-source.ts` — replace `example()` and its call sites:

```ts
function example(line: { textJp: string } | undefined, analysis: StaticLineAnalysis | undefined): Pick<VocabularyPrintItem, "example"> {
  if (!line?.textJp) return {};
  const spans = (analysis?.tokens ?? []).flatMap((token) => {
    const entry = token.entries[0];
    return entry ? [{ surface: token.surface, entSeq: entry.entSeq }] : [];
  });
  return { example: { text: line.textJp, spans } };
}
```

- `allItems`: build `const lineOf = new Map(lines.map((line) => [line.id, line]));` and map each row to
  `{ id: row.key, surface: row.written, entSeq: row.entSeq, …, ...example(lineOf.get(row.lineId), analyses.get(row.lineId)) }`
  (drop the old `textOf` map).
- `savedItems`: resolved branch adds `entSeq: lexeme.entSeq` and `...example(line, analyses.get(card.lineId))`; raw
  branch `...example(line, analyses.get(card.lineId))`.

- [ ] **Step 4: Run** `npx vitest run lib/vocabulary/print lib/summary --minWorkers=1 --maxWorkers=2` and
  `npx tsc --noEmit` → PASS / exit 0.

- [ ] **Step 5: Mutation** — return `spans: []` from `example()` → the new test goes red. Restore; paste.

- [ ] **Step 6: Commit** — `feat(print): source items carry entSeq and example spans for masking`.

---

### Task 4: Worksheet settings, document masking and the prepare stage

**Files:**
- Modify: `lib/vocabulary/print/settings.ts` (add the new type beside the old one; Task 7 deletes the old)
- Create: `lib/vocabulary/print/mask.ts`, `lib/vocabulary/print/prepare.ts`
- Test: `lib/vocabulary/print/mask.test.ts`, `lib/vocabulary/print/prepare.test.ts`

**Interfaces:**
- Consumes: Task 1 rules; `VocabularyPrintItem` (Task 3).
- Produces:

```ts
// settings.ts
export interface WorksheetSettings {
  mode: "practice" | "selfTest";
  density: "airy" | "compact";
  includeKanaOnly: boolean;
  showReading: boolean;
  showMeaning: boolean;
  showExample: boolean;
}
export const DEFAULT_WORKSHEET_SETTINGS: WorksheetSettings;
export const worksheetSettingsSchema: z.ZodType<WorksheetSettings>;
export const PROMPT_KEYS: readonly ["showReading", "showMeaning", "showExample"];

// mask.ts
export const MASK_BLANK = "＿＿";
export function maskSet(items: VocabularyPrintItem[]): string[];          // longest first
export function maskText(text: string, mask: readonly string[]): string;
export function ownAnswerLocatable(item: VocabularyPrintItem): boolean;

// prepare.ts
export interface PreparedItem {
  id: string;
  number: number;              // 1-based, document order after exclusion
  cells: number;               // graphemes(target).length
  target?: string;             // practice only — never present in self-test (W6)
  glyphs?: string[];           // practice only
  reading?: string;
  meaning?: string;
  meaningLocale?: MeaningLocale;
  example?: string;            // practice: raw; self-test: masked
}
export interface AnswerRow { id: string; number: number; target: string; reading?: string }
export type PreparedPage = { kind: "items"; items: PreparedItem[] } | { kind: "answers"; answers: AnswerRow[] };
export interface PreparedDocument { items: PreparedItem[]; answers: AnswerRow[]; excluded: string[] }
export function prepareDocument(items: VocabularyPrintItem[], selected: ReadonlySet<string>, settings: WorksheetSettings): PreparedDocument;
```

- [ ] **Step 1: Write the failing tests**

```ts
// lib/vocabulary/print/mask.test.ts
import { describe, expect, it } from "vitest";
import type { VocabularyPrintItem } from "./source";
import { MASK_BLANK, maskSet, maskText, ownAnswerLocatable } from "./mask";

const item = (over: Partial<VocabularyPrintItem>): VocabularyPrintItem => ({ id: over.surface ?? "x", surface: "x", resolution: "resolved", ...over });
const line = "苦手な人について話します";
const spans = [{ surface: "苦手", entSeq: 1 }, { surface: "人", entSeq: 2 }, { surface: "話し", entSeq: 3 }];
const nigate = item({ surface: "苦手", entSeq: 1, example: { text: line, spans } });
const hito = item({ surface: "人", entSeq: 2 });
const hanasu = item({ surface: "話す", entSeq: 3 });

describe("document mask (spec W §1.4)", () => {
  it("collects every printed target and every span resolving to a printed item, longest first", () => {
    expect(maskSet([nigate, hito, hanasu])).toEqual(["苦手", "話し", "話す", "人"]); // stable sort: insertion order within a length
  });
  it("masks another printed item's answer and its inflected span inside this item's example", () => {
    expect(maskText(line, maskSet([nigate, hito, hanasu]))).toBe(`${MASK_BLANK}な${MASK_BLANK}について${MASK_BLANK}ます`);
  });
  it("leaves a word that is not printed", () => {
    expect(maskText(line, maskSet([nigate]))).toBe(`${MASK_BLANK}な人について話します`);
  });
  it("masks every occurrence and treats regex characters literally", () => {
    expect(maskText("人と人", ["人"])).toBe(`${MASK_BLANK}と${MASK_BLANK}`);
    expect(maskText("a.b a+b", ["a.b"])).toBe(`${MASK_BLANK} a+b`);
    expect(maskText("そのまま", [])).toBe("そのまま");
  });
  it("locates an item's own answer by its entSeq span or by its written form", () => {
    expect(ownAnswerLocatable(hanasu)).toBe(false); // no example at all
    expect(ownAnswerLocatable(item({ surface: "話す", entSeq: 3, example: { text: line, spans } }))).toBe(true); // via span 話し
    expect(ownAnswerLocatable(item({ surface: "消えた", resolution: "saved_raw", example: { text: "火が消えた", spans: [] } }))).toBe(true);
    expect(ownAnswerLocatable(item({ surface: "行く", entSeq: 9, example: { text: "行った", spans: [] } }))).toBe(false);
  });
});
```

```ts
// lib/vocabulary/print/prepare.test.ts
import { describe, expect, it } from "vitest";
import { DEFAULT_WORKSHEET_SETTINGS, type WorksheetSettings } from "./settings";
import type { VocabularyPrintItem } from "./source";
import { prepareDocument } from "./prepare";

const line = "苦手な人について話します";
const spans = [{ surface: "苦手", entSeq: 1 }, { surface: "人", entSeq: 2 }, { surface: "話し", entSeq: 3 }];
const items: VocabularyPrintItem[] = [
  { id: "a", surface: "苦手", entSeq: 1, reading: "にがて", meaning: "kém", meaningLocale: "vi", resolution: "resolved", example: { text: line, spans } },
  { id: "b", surface: "人", entSeq: 2, reading: "ひと", meaning: "người", meaningLocale: "vi", resolution: "resolved", example: { text: line, spans } },
  { id: "c", surface: "話す", entSeq: 3, reading: "はなす", meaning: "nói", meaningLocale: "vi", resolution: "resolved", example: { text: line, spans } },
  { id: "d", surface: "する", entSeq: 4, reading: "する", meaning: "làm", meaningLocale: "vi", resolution: "resolved" },
  { id: "e", surface: "Tシャツ", entSeq: 5, reading: "ティーシャツ", resolution: "resolved" },
  { id: "f", surface: "消えた", resolution: "saved_raw" },
];
const all = new Set(items.map((item) => item.id));
const selfTest = (over: Partial<WorksheetSettings> = {}) => ({ ...DEFAULT_WORKSHEET_SETTINGS, mode: "selfTest" as const, ...over });

describe("prepareDocument — selection and kana (spec W W4, §1.3)", () => {
  it("keeps document order, numbers from 1, and drops words without kanji by default", () => {
    const doc = prepareDocument(items, all, DEFAULT_WORKSHEET_SETTINGS);
    expect(doc.items.map((item) => [item.id, item.number])).toEqual([["a", 1], ["b", 2], ["c", 3], ["f", 4]]);
  });
  it("adds them back with includeKanaOnly, and respects the selection", () => {
    const doc = prepareDocument(items, new Set(["d", "e", "a"]), { ...DEFAULT_WORKSHEET_SETTINGS, includeKanaOnly: true });
    expect(doc.items.map((item) => item.id)).toEqual(["a", "d", "e"]);
  });
});

describe("prepareDocument — practice (spec W §3.1)", () => {
  it("shows the target and glyphs, the toggled metadata and the raw example, and has no answers", () => {
    const doc = prepareDocument(items, new Set(["a"]), { ...DEFAULT_WORKSHEET_SETTINGS, showMeaning: false });
    expect(doc.items[0]).toEqual({ id: "a", number: 1, cells: 2, target: "苦手", glyphs: ["苦", "手"], reading: "にがて", example: line });
    expect(doc.answers).toEqual([]);
  });
});

describe("prepareDocument — self-test never leaks (spec W W6, §1.4, §2)", () => {
  it("carries no target or glyphs on items, and masks every printed answer in every example", () => {
    const doc = prepareDocument(items, all, selfTest({ includeKanaOnly: true }));
    for (const item of doc.items) {
      expect(item.target).toBeUndefined();
      expect(item.glyphs).toBeUndefined();
    }
    expect(doc.items.find((item) => item.id === "a")?.example).toBe("＿＿な＿＿について＿＿ます");
    expect(doc.items.find((item) => item.id === "c")?.example).toBe("＿＿な＿＿について＿＿ます");
  });
  it("masks another printed item's inflected span: deselecting 話す leaves 話し visible", () => {
    const doc = prepareDocument(items, new Set(["a", "b"]), selfTest());
    expect(doc.items[0]?.example).toBe("＿＿な＿＿について話します");
  });
  it("drops a reading that reveals the target but keeps a differing one", () => {
    const doc = prepareDocument(items, new Set(["d", "e"]), selfTest({ includeKanaOnly: true, showMeaning: false }));
    const suru = doc.items.find((item) => item.id === "d");
    expect(suru?.reading).toBeUndefined();
    expect(suru?.meaning).toBe("làm"); // fallback: no enabled prompt left, meaning exists
    expect(doc.items.find((item) => item.id === "e")?.reading).toBe("ティーシャツ");
  });
  it("drops an example whose own answer cannot be located, then falls back or excludes", () => {
    const doc = prepareDocument(items, new Set(["f"]), selfTest({ showReading: false, showMeaning: false }));
    expect(doc.items).toEqual([]);
    expect(doc.excluded).toEqual(["f"]);
  });
  it("lists answers in item order with the target, and the reading only when it does not reveal it", () => {
    const doc = prepareDocument(items, new Set(["a", "d"]), selfTest({ includeKanaOnly: true }));
    expect(doc.answers).toEqual([
      { id: "a", number: 1, target: "苦手", reading: "にがて" },
      { id: "d", number: 2, target: "する" },
    ]);
  });
});
```

- [ ] **Step 2: Run** `npx vitest run lib/vocabulary/print/mask.test.ts lib/vocabulary/print/prepare.test.ts --minWorkers=1 --maxWorkers=2` → FAIL (unresolved imports).

- [ ] **Step 3: Implement**

Append to `lib/vocabulary/print/settings.ts`:

```ts
import { z } from "zod";

/** Spec W §2: transient worksheet settings; nothing persists. */
export interface WorksheetSettings {
  mode: "practice" | "selfTest";
  density: "airy" | "compact";
  includeKanaOnly: boolean;
  showReading: boolean;
  showMeaning: boolean;
  showExample: boolean;
}

export const DEFAULT_WORKSHEET_SETTINGS: WorksheetSettings = {
  mode: "practice", density: "airy", includeKanaOnly: false, showReading: true, showMeaning: true, showExample: true,
};

/** In self-test these are prompts, and the last enabled one cannot be turned off. */
export const PROMPT_KEYS = ["showReading", "showMeaning", "showExample"] as const;

export const worksheetSettingsSchema = z.object({
  mode: z.enum(["practice", "selfTest"]),
  density: z.enum(["airy", "compact"]),
  includeKanaOnly: z.boolean(),
  showReading: z.boolean(),
  showMeaning: z.boolean(),
  showExample: z.boolean(),
}).strict();
```

```ts
// lib/vocabulary/print/mask.ts
import type { VocabularyPrintItem } from "./source";

/** Spec W §1.4: fixed length — the cell group already tells the count, and an inflection's length would mislead. */
export const MASK_BLANK = "＿＿";

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Spec W §1.4: every printed target, plus every span (in any printed example) that resolves to a printed item. */
export function maskSet(items: VocabularyPrintItem[]): string[] {
  const printed = new Set(items.flatMap((item) => (item.entSeq === undefined ? [] : [item.entSeq])));
  const strings = new Set<string>();
  for (const item of items) {
    strings.add(item.surface);
    for (const span of item.example?.spans ?? []) if (printed.has(span.entSeq)) strings.add(span.surface);
  }
  return [...strings].filter((text) => text.length > 0).sort((a, b) => b.length - a.length);
}

/** One pass, longest alternative first; over-masking a short kana target inside another word is accepted. */
export function maskText(text: string, mask: readonly string[]): string {
  if (mask.length === 0) return text;
  return text.replace(new RegExp(mask.map(escape).join("|"), "gu"), MASK_BLANK);
}

/** An item whose own answer is not found in its example could still leak through an unmasked inflection. */
export function ownAnswerLocatable(item: VocabularyPrintItem): boolean {
  const example = item.example;
  if (!example) return false;
  const bySpan = item.entSeq !== undefined
    && example.spans.some((span) => span.entSeq === item.entSeq && example.text.includes(span.surface));
  return bySpan || example.text.includes(item.surface);
}
```

```ts
// lib/vocabulary/print/prepare.ts
import type { MeaningLocale } from "@/lib/analysis/meaning";
import { graphemes, hasKanji, readingRevealsTarget } from "./japanese";
import { maskSet, maskText, ownAnswerLocatable } from "./mask";
import type { WorksheetSettings } from "./settings";
import type { VocabularyPrintItem } from "./source";

export interface PreparedItem {
  id: string;
  number: number;
  cells: number;
  /** Practice only. Self-test items never carry the answer (spec W W6). */
  target?: string;
  glyphs?: string[];
  reading?: string;
  meaning?: string;
  meaningLocale?: MeaningLocale;
  example?: string;
}
export interface AnswerRow { id: string; number: number; target: string; reading?: string }
export type PreparedPage = { kind: "items"; items: PreparedItem[] } | { kind: "answers"; answers: AnswerRow[] };
export interface PreparedDocument { items: PreparedItem[]; answers: AnswerRow[]; excluded: string[] }

type Prompts = Pick<PreparedItem, "reading" | "meaning" | "meaningLocale"> & { exampleSource?: VocabularyPrintItem };

/** Spec W §2: the enabled prompts that do not reveal the answer, then the meaning / example fallback. */
function selfTestPrompts(item: VocabularyPrintItem, settings: WorksheetSettings): Prompts | null {
  const reading = settings.showReading && item.reading && !readingRevealsTarget(item.surface, item.reading) ? item.reading : undefined;
  const meaning = settings.showMeaning && item.meaning ? item.meaning : undefined;
  const example = settings.showExample && ownAnswerLocatable(item);
  if (reading || meaning || example) {
    return { reading, meaning, meaningLocale: meaning ? item.meaningLocale : undefined, exampleSource: example ? item : undefined };
  }
  if (item.meaning) return { meaning: item.meaning, meaningLocale: item.meaningLocale };
  if (ownAnswerLocatable(item)) return { exampleSource: item };
  return null;
}

const defined = <T extends object>(value: T): T =>
  Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;

/** Spec W §1–§3: the only input the sheets render — preview, print root, measurement tree and the PDF page. */
export function prepareDocument(items: VocabularyPrintItem[], selected: ReadonlySet<string>, settings: WorksheetSettings): PreparedDocument {
  const candidates = items.filter((item) => selected.has(item.id) && (settings.includeKanaOnly || hasKanji(item.surface)));

  if (settings.mode === "practice") {
    return {
      items: candidates.map((item, index) => defined({
        id: item.id, number: index + 1, cells: graphemes(item.surface).length, target: item.surface, glyphs: graphemes(item.surface),
        reading: settings.showReading ? item.reading : undefined,
        meaning: settings.showMeaning ? item.meaning : undefined,
        meaningLocale: settings.showMeaning && item.meaning ? item.meaningLocale : undefined,
        example: settings.showExample ? item.example?.text : undefined,
      })),
      answers: [],
      excluded: [],
    };
  }

  const excluded: string[] = [];
  const kept: { item: VocabularyPrintItem; prompts: Prompts }[] = [];
  for (const item of candidates) {
    const prompts = selfTestPrompts(item, settings);
    if (prompts) kept.push({ item, prompts }); else excluded.push(item.id);
  }
  const mask = maskSet(kept.map(({ item }) => item));
  return {
    items: kept.map(({ item, prompts }, index) => defined({
      id: item.id, number: index + 1, cells: graphemes(item.surface).length,
      reading: prompts.reading, meaning: prompts.meaning, meaningLocale: prompts.meaningLocale,
      example: prompts.exampleSource?.example ? maskText(prompts.exampleSource.example.text, mask) : undefined,
    })),
    answers: kept.map(({ item }, index) => defined({
      id: item.id, number: index + 1, target: item.surface,
      reading: item.reading && !readingRevealsTarget(item.surface, item.reading) ? item.reading : undefined,
    })),
    excluded,
  };
}
```

- [ ] **Step 4: Run** the two test files → PASS; `npx tsc --noEmit` → exit 0.

- [ ] **Step 5: Mutations** — (a) in `maskSet` drop the span loop → "masks another printed item's inflected span"
  goes red; (b) in `prepareDocument` self-test branch add `target: item.surface` → the no-leak test goes red;
  (c) remove `!readingRevealsTarget(...)` in `selfTestPrompts` → the `する` case goes red. Restore; paste.

- [ ] **Step 6: Commit** — `feat(print): worksheet settings, document-level masking and the prepare stage`.

---

### Task 5: Writing layout, writing cells and stroke-guide row

**Files:**
- Create: `lib/vocabulary/print/layout.ts`, `components/vocabulary-print/writing-cells.tsx`, `components/vocabulary-print/stroke-guide.tsx`
- Test: `lib/vocabulary/print/layout.test.ts`, `components/vocabulary-print/writing-cells.test.tsx`, `components/vocabulary-print/stroke-guide.test.tsx`

**Interfaces:**
- Consumes: `PAPER` from `lib/vocabulary/print/paper.ts`; `StrokeGuide` (Task 2); `WorksheetSettings` (Task 4).
- Produces:
  - `WRITING = { cellMm: 12, minCellMm: 8, groupGapMm: 3, rowGapMm: 2, contentWidthMm: 182 }`
  - `interface WritingLayout { cellMm: number; groupsPerRow: number; rows: number; repetitions: number; oversized: boolean }`
  - `writingLayout(cells: number, mode: WorksheetSettings["mode"], density: WorksheetSettings["density"]): WritingLayout`
  - `<WritingRows cells={n} model={string[] | null} mode density />` — `model` null ⇒ every cell blank.
  - `<StrokeGuideRow glyphs={string[]} guides={Record<string, StrokeGuide>} label={string} />`

- [ ] **Step 1: Write the failing tests**

```ts
// lib/vocabulary/print/layout.test.ts
import { describe, expect, it } from "vitest";
import { WRITING, writingLayout } from "./layout";

describe("writingLayout (spec W §3.1, W8)", () => {
  it("fits whole groups only: groupsPerRow = floor((W + gap) / (n·cell + gap))", () => {
    expect(WRITING.contentWidthMm).toBe(182);
    expect(writingLayout(1, "practice", "airy")).toEqual({ cellMm: 12, groupsPerRow: 12, rows: 2, repetitions: 24, oversized: false });
    expect(writingLayout(2, "practice", "compact")).toEqual({ cellMm: 12, groupsPerRow: 6, rows: 1, repetitions: 6, oversized: false });
    expect(writingLayout(4, "selfTest", "compact").groupsPerRow).toBe(3); // floor(185 / 51)
  });
  it("adds rows until the minimum repetitions fit (practice 3, self-test 2)", () => {
    expect(writingLayout(8, "practice", "compact")).toMatchObject({ groupsPerRow: 1, rows: 3, repetitions: 3 });
    expect(writingLayout(8, "selfTest", "compact")).toMatchObject({ groupsPerRow: 1, rows: 2 });
  });
  it("shrinks a group wider than W down to the 8mm floor, then reports it oversized", () => {
    expect(writingLayout(20, "practice", "airy")).toMatchObject({ cellMm: 9.1, groupsPerRow: 1, oversized: false });
    expect(writingLayout(23, "practice", "airy")).toMatchObject({ cellMm: 8, oversized: true });
  });
});
```

```tsx
// components/vocabulary-print/writing-cells.test.tsx
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WritingRows } from "./writing-cells";

describe("WritingRows (spec W §3.1–§3.2, W8)", () => {
  it("practice: repetition 1 is the black model, 2 the grey trace, the rest blank — whole groups", () => {
    const { container } = render(<WritingRows cells={2} model={["苦", "手"]} mode="practice" density="compact" />);
    const groups = [...container.querySelectorAll(".vp-group")];
    expect(groups).toHaveLength(6);
    expect(groups[0]?.querySelectorAll(".vp-model")).toHaveLength(2);
    expect(groups[0]?.textContent).toBe("苦手");
    expect(groups[1]?.querySelectorAll(".vp-trace")).toHaveLength(2);
    expect(groups.slice(2).every((group) => group.textContent === "")).toBe(true);
    expect(container.querySelectorAll(".vp-row")).toHaveLength(1);
    expect([...container.querySelectorAll(".vp-row")].every((row) => row.querySelectorAll(".vp-group").length === 6)).toBe(true);
  });
  it("self-test: every cell is blank and the group width still matches the hidden word", () => {
    const { container } = render(<WritingRows cells={3} model={null} mode="selfTest" density="airy" />);
    expect(container.textContent).toBe("");
    expect(container.querySelector(".vp-group")?.querySelectorAll(".vp-cell")).toHaveLength(3);
  });
  it("sets the cell size as an mm custom property", () => {
    const { container } = render(<WritingRows cells={20} model={null} mode="selfTest" density="airy" />);
    expect((container.firstElementChild as HTMLElement).style.getPropertyValue("--vp-cell")).toBe("9.1mm");
  });
});
```

```tsx
// components/vocabulary-print/stroke-guide.test.tsx
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { StrokeGuide } from "@/lib/strokes/types";
import { StrokeGuideRow } from "./stroke-guide";

const hito: StrokeGuide = { character: "人", viewBox: 109, strokes: [{ d: "M54,20c1,1", start: [54, 20] }, { d: "M55,50c1,1", start: [55, 50] }] };
const shi: StrokeGuide = { character: "し", viewBox: 109, strokes: [{ d: "c1,2", start: null }] };

describe("StrokeGuideRow (spec W W5, §3.1)", () => {
  it("draws every stroke and numbers each start in KanjiVG order", () => {
    const { container } = render(<StrokeGuideRow glyphs={["人"]} guides={{ 人: hito }} label="Stroke order" />);
    const svg = container.querySelector("svg.vp-guide")!;
    expect(svg.getAttribute("viewBox")).toBe("0 0 109 109");
    expect(svg.querySelectorAll("path.vp-guide-stroke")).toHaveLength(2);
    expect([...svg.querySelectorAll("text")].map((text) => text.textContent)).toEqual(["1", "2"]);
    expect(svg.querySelectorAll("circle")).toHaveLength(2);
  });
  it("skips a grapheme without data and a stroke without a start, never guessing", () => {
    const { container } = render(<StrokeGuideRow glyphs={["T", "し"]} guides={{ し: shi }} label="Stroke order" />);
    expect(container.querySelectorAll("svg.vp-guide")).toHaveLength(1);
    expect(container.querySelectorAll("text")).toHaveLength(0);
  });
  it("renders nothing when no grapheme has a guide", () => {
    const { container } = render(<StrokeGuideRow glyphs={["T"]} guides={{}} label="Stroke order" />);
    expect(container.innerHTML).toBe("");
  });
  it("is presentational: no ids and the svg is hidden from assistive tech", () => {
    const { container } = render(<StrokeGuideRow glyphs={["人"]} guides={{ 人: hito }} label="Stroke order" />);
    expect(container.querySelector("[id]")).toBeNull();
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });
});
```

- [ ] **Step 2: Run** `npx vitest run lib/vocabulary/print/layout.test.ts components/vocabulary-print/writing-cells.test.tsx components/vocabulary-print/stroke-guide.test.tsx --minWorkers=1 --maxWorkers=2` → FAIL.

- [ ] **Step 3: Implement**

```ts
// lib/vocabulary/print/layout.ts
import { PAPER } from "./paper";
import type { WorksheetSettings } from "./settings";

/** Spec W §3.1: the writing geometry in mm; the A4 measurement and the owner's paper review may tune these. */
export const WRITING = {
  cellMm: 12,
  minCellMm: 8,
  groupGapMm: 3,
  rowGapMm: 2,
  contentWidthMm: PAPER.widthMm - 2 * PAPER.marginMm,
} as const;

const DENSITY_ROWS = { airy: 2, compact: 1 } as const;
const MIN_REPETITIONS = { practice: 3, selfTest: 2 } as const;

export interface WritingLayout { cellMm: number; groupsPerRow: number; rows: number; repetitions: number; oversized: boolean }

/** A repetition is an atomic group of `cells` squares (W8): rows hold whole groups, never part of a word. */
export function writingLayout(cells: number, mode: WorksheetSettings["mode"], density: WorksheetSettings["density"]): WritingLayout {
  const n = Math.max(1, cells);
  const fit = Math.floor((WRITING.contentWidthMm / n) * 10) / 10; // 0.1mm steps, never wider than W
  const oversized = fit < WRITING.minCellMm;
  const cellMm = oversized ? WRITING.minCellMm : Math.min(WRITING.cellMm, fit);
  const groupsPerRow = Math.max(1, Math.floor((WRITING.contentWidthMm + WRITING.groupGapMm) / (n * cellMm + WRITING.groupGapMm)));
  const rows = Math.max(DENSITY_ROWS[density], Math.ceil(MIN_REPETITIONS[mode] / groupsPerRow));
  return { cellMm, groupsPerRow, rows, repetitions: rows * groupsPerRow, oversized };
}
```

```tsx
// components/vocabulary-print/writing-cells.tsx
import type { CSSProperties } from "react";
import { writingLayout } from "@/lib/vocabulary/print/layout";
import type { WorksheetSettings } from "@/lib/vocabulary/print/settings";

/** Spec W §3.1–§3.2: explicit rows of whole groups (W8). `model` is null in self-test: every cell blank (W6). */
export function WritingRows({ cells, model, mode, density }: {
  cells: number; model: string[] | null; mode: WorksheetSettings["mode"]; density: WorksheetSettings["density"];
}) {
  const layout = writingLayout(cells, mode, density);
  const rows = Array.from({ length: layout.rows }, (_, row) =>
    Array.from({ length: layout.groupsPerRow }, (_, group) => row * layout.groupsPerRow + group));
  return (
    <div className="vp-rows" style={{ "--vp-cell": `${layout.cellMm}mm` } as CSSProperties}>
      {rows.map((repetitions, row) => (
        <div key={row} className="vp-row">
          {repetitions.map((repetition) => (
            <div key={repetition} className="vp-group">
              {Array.from({ length: cells }, (_, index) => (
                <span key={index} className="vp-cell">
                  {model && repetition < 2 && (
                    <span lang="ja" className={repetition === 0 ? "vp-model" : "vp-trace"}>{model[index]}</span>
                  )}
                </span>
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
```

```tsx
// components/vocabulary-print/stroke-guide.tsx
import type { StrokeGuide } from "@/lib/strokes/types";

const GRID = 109;
const clamp = (value: number) => Math.min(GRID - 6, Math.max(6, value));

/** Spec W W5: one complete diagram per grapheme, numbered at each stroke's start; practice only. */
export function StrokeGuideRow({ glyphs, guides, label }: { glyphs: string[]; guides: Record<string, StrokeGuide>; label: string }) {
  if (!glyphs.some((glyph) => guides[glyph])) return null;
  return (
    <div className="vp-guides">
      <span className="vp-guides-label">{label}</span>
      {glyphs.map((glyph, index) => {
        const guide = guides[glyph];
        if (!guide) return null;
        return (
          <svg key={index} viewBox={`0 0 ${GRID} ${GRID}`} className="vp-guide" aria-hidden="true">
            <line x1="54.5" y1="0" x2="54.5" y2="109" className="vp-guide-cross" />
            <line x1="0" y1="54.5" x2="109" y2="54.5" className="vp-guide-cross" />
            {guide.strokes.map((stroke, order) => <path key={order} d={stroke.d} className="vp-guide-stroke" />)}
            {guide.strokes.map((stroke, order) => stroke.start && (
              <g key={order}>
                <circle cx={stroke.start[0]} cy={stroke.start[1]} r="2.6" className="vp-guide-dot" />
                <text x={clamp(stroke.start[0] - 8)} y={clamp(stroke.start[1] - 3)} className="vp-guide-number">{order + 1}</text>
              </g>
            ))}
          </svg>
        );
      })}
    </div>
  );
}
```

Numbering note: a stroke whose `start` is null keeps its place in the order — numbers are `order + 1`, so a later
stroke is never renumbered.

- [ ] **Step 4: Run** the three test files → PASS; `npx tsc --noEmit` → 0.

- [ ] **Step 5: Mutations** — (a) in `writingLayout` use `Math.ceil` for `groupsPerRow` → the 4-cell case goes red;
  (b) in `WritingRows` render the model for `repetition < 3` → the blank-groups assertion goes red; (c) number strokes
  with a running counter that skips null starts → write a one-off test with `[null-start, start]` showing "2", run it
  red, then delete the one-off test (the shipped test file stays as written above). Restore; paste.

- [ ] **Step 6: Commit** — `feat(print): atomic writing rows and numbered stroke-guide row`.

---

### Task 6: The worksheet sheets, labels, quotes, watermark and CSS

**Files:**
- Create: `components/vocabulary-print/worksheet.tsx`, `components/vocabulary-print/labels.ts`, `lib/vocabulary/print/quotes.ts`
- Modify: `lib/vocabulary/print/mascot.ts`, `app/globals.css` (append the new `.vp-*` rules; old rules stay until Task 7), `messages/vi/vocab.json`, `messages/en/vocab.json` (add keys only; removals in Task 7)
- Test: `components/vocabulary-print/worksheet.test.tsx`, `lib/vocabulary/print/quotes.test.ts`

**Interfaces:**
- Consumes: Tasks 2, 4, 5. `MASCOT_SRC` from `mascot.ts`.
- Produces:
  - `quoteKey(pageIndex: number): string` → `quotes.q1` … `quotes.q8`; `QUOTE_COUNT = 8`.
  - `interface SheetLabels { wordmark; documentName; title; footer; englishMeaning; strokeOrder; answers: string; pageNumber(page, count): string; quote(pageIndex): string; credit(sources: string): string }`
  - `useSheetLabels(mode: WorksheetSettings["mode"], title: string): SheetLabels` (client hook, `useTranslations("vocab.print")`).
  - `<Worksheet pages={PreparedPage[]} settings={WorksheetSettings} labels={SheetLabels} resources={PrintResources} />`
  - Building blocks exported for the measurement tree: `FirstHeader`, `ContinuationHeader`, `QuoteBand`, `FooterBlock`,
    `PracticeItem`, `SelfTestItem`, `AnswersHeading`, `AnswerLine`.
  - `WATERMARK_SRC = "/mascot/poses/neutral.png"`; `mascotReady()` now resolves when **both** images decode.
  - DOM contract used by the workspace and e2e: `.vp-sheet` > `.vp-watermark`, header, `.vp-body` (items `.vp-item[data-item-id]`
    or `.vp-answers-title` + `.vp-answer[data-item-id]`), `.vp-quote`, `.vp-foot-block` (`.vp-foot` + `.vp-credit`).

- [ ] **Step 1: Copy** — add to `messages/vi/vocab.json` `print` (and the en mirror; keep both in parity):

| key | vi | en |
|---|---|---|
| `modePractice` | Luyện viết | Writing practice |
| `docPractice` | Luyện viết từ vựng | Vocabulary Writing Practice |
| `docSelfTest` (change value) | Tự kiểm tra từ vựng | Vocabulary Self-test |
| `strokeOrder` | Thứ tự nét | Stroke order |
| `answers` | Đáp án | Answers |
| `credit` | Dữ liệu: {sources} | Data: {sources} |
| `quotes.q1` | Viết chậm cũng là đang tiến lên. | Writing slowly is still moving forward. |
| `quotes.q2` | Một chữ đẹp bắt đầu từ một nét chắc. | A good character starts with one sure stroke. |
| `quotes.q3` | Nhớ bằng tay, không chỉ bằng mắt. | Remember with your hand, not just your eyes. |
| `quotes.q4` | Mỗi lần viết lại là một lần nhớ sâu hơn. | Every rewrite makes the memory deeper. |
| `quotes.q5` | Đúng thứ tự nét, chữ tự khắc vững. | Get the stroke order right and the shape follows. |
| `quotes.q6` | Hôm nay một trang, mai thêm một chữ quen. | One page today, one more familiar word tomorrow. |
| `quotes.q7` | Sai một nét cũng không sao — viết lại thôi. | A wrong stroke is fine — just write it again. |
| `quotes.q8` | Từng ô nhỏ, từng bước vững. | Small squares, steady steps. |

- [ ] **Step 2: Write the failing tests**

```ts
// lib/vocabulary/print/quotes.test.ts
import { describe, expect, it } from "vitest";
import vi from "@/messages/vi/vocab.json";
import en from "@/messages/en/vocab.json";
import { QUOTE_COUNT, quoteKey } from "./quotes";

describe("printQuote (spec W W10)", () => {
  it("is deterministic by page index and cycles through every curated prompt", () => {
    expect(quoteKey(0)).toBe("quotes.q1");
    expect(quoteKey(7)).toBe("quotes.q8");
    expect(quoteKey(8)).toBe("quotes.q1");
    expect(quoteKey(3)).toBe(quoteKey(3 + QUOTE_COUNT));
  });
  it("has exactly QUOTE_COUNT prompts in each locale", () => {
    expect(Object.keys(vi.print.quotes)).toHaveLength(QUOTE_COUNT);
    expect(Object.keys(en.print.quotes)).toHaveLength(QUOTE_COUNT);
  });
});
```

(If `@/messages/...` JSON import is not resolvable in this repo's vitest config, import with a relative path
`../../../messages/vi/vocab.json` — check how `messages/*.test.ts` import catalogs and copy that.)

```tsx
// components/vocabulary-print/worksheet.test.tsx
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { PreparedPage } from "@/lib/vocabulary/print/prepare";
import { DEFAULT_WORKSHEET_SETTINGS } from "@/lib/vocabulary/print/settings";
import type { PrintResources } from "@/lib/vocabulary/print/source";
import { Worksheet } from "./worksheet";
import type { SheetLabels } from "./labels";

const labels: SheetLabels = {
  wordmark: "KORUME", documentName: "Vocabulary Writing Practice", title: "苦手な人", footer: "Korume · Vocabulary Writing Practice",
  englishMeaning: "EN", strokeOrder: "Stroke order", answers: "Answers",
  pageNumber: (page, count) => `${page} / ${count}`, quote: (index) => `quote-${index}`, credit: (sources) => `Data: ${sources}`,
};
const resources: PrintResources = {
  strokeGuides: { 苦: { character: "苦", viewBox: 109, strokes: [{ d: "M1,1c1,1", start: [1, 1] }] } },
  credits: { jmdict: "JMdict v1 (CC BY-SA 4.0)", kanjivg: "KanjiVG r1 (CC BY-SA 3.0)" },
};
const practice: PreparedPage[] = [
  { kind: "items", items: [{ id: "a", number: 1, cells: 2, target: "苦手", glyphs: ["苦", "手"], reading: "にがて", meaning: "poor at", meaningLocale: "en", example: "苦手な人" }] },
  { kind: "items", items: [{ id: "b", number: 2, cells: 1, target: "人", glyphs: ["人"] }] },
];
const selfTest: PreparedPage[] = [
  { kind: "items", items: [{ id: "a", number: 1, cells: 2, reading: "にがて", example: "＿＿な人" }] },
  { kind: "answers", answers: [{ id: "a", number: 1, target: "苦手", reading: "にがて" }] },
];
const sheets = (pages: PreparedPage[], mode: "practice" | "selfTest" = "practice") =>
  render(<Worksheet pages={pages} settings={{ ...DEFAULT_WORKSHEET_SETTINGS, mode }} labels={labels} resources={resources} />).container;

describe("Worksheet (spec W §3–§4)", () => {
  it("page 1 has the colour mascot and full header, later pages the compact header; every page a watermark, quote and footer", () => {
    const root = sheets(practice);
    const pages = root.querySelectorAll(".vp-sheet");
    expect(pages).toHaveLength(2);
    expect(pages[0]?.querySelector(".vp-head-first img")).not.toBeNull();
    expect(pages[1]?.querySelector(".vp-head-cont")).not.toBeNull();
    for (const [index, page] of [...pages].entries()) {
      expect(page.querySelector(".vp-watermark img")?.getAttribute("src")).toBe("/mascot/poses/neutral.png");
      expect(page.querySelector(".vp-watermark")?.textContent).toBe("KORUME");
      expect(page.querySelector(".vp-quote")?.textContent).toBe(`“quote-${index}”`);
      expect(page.querySelector(".vp-foot")?.textContent).toContain(`${index + 1} / 2`);
      expect(page.querySelector(".vp-foot img")).toBeNull(); // footer mascot mark removed (W9)
    }
  });
  it("practice items: target, stroke guide, model + trace cells, example; credit names JMdict and KanjiVG", () => {
    const page = sheets(practice).querySelector(".vp-sheet")!;
    const item = page.querySelector('.vp-item[data-item-id="a"]')!;
    expect(item.querySelector(".vp-word")?.textContent).toBe("苦手");
    expect(item.querySelector(".vp-guide")).not.toBeNull();
    expect(item.querySelectorAll(".vp-model")).toHaveLength(2);
    expect(item.querySelector(".vp-chip")?.textContent).toBe("EN");
    expect(item.querySelector(".vp-example")?.textContent).toBe("苦手な人");
    expect(page.querySelector(".vp-credit")?.textContent).toBe("Data: JMdict v1 (CC BY-SA 4.0) · KanjiVG r1 (CC BY-SA 3.0)");
  });
  it("self-test item pages carry no target, trace, model or stroke guide; answers come last and credit only JMdict", () => {
    const root = sheets(selfTest, "selfTest");
    const [itemsPage, answersPage] = [...root.querySelectorAll(".vp-sheet")];
    expect(itemsPage?.querySelector(".vp-body")?.textContent).not.toContain("苦手");
    expect(itemsPage?.querySelector(".vp-guide, .vp-trace, .vp-model, .vp-word")).toBeNull();
    expect(itemsPage?.querySelector(".vp-number")?.textContent).toBe("1.");
    expect(answersPage?.querySelector(".vp-answers-title")?.textContent).toBe("Answers");
    expect(answersPage?.querySelector('.vp-answer[data-item-id="a"]')?.textContent).toBe("1.苦手にがて");
    expect(itemsPage?.querySelector(".vp-credit")?.textContent).toBe("Data: JMdict v1 (CC BY-SA 4.0)");
  });
  it("is presentational: no ids, buttons, inputs or aria references (it renders twice)", () => {
    const root = sheets(practice);
    expect(root.querySelector("[id], button, input, [aria-labelledby], [aria-describedby], [aria-controls]")).toBeNull();
  });
});
```

- [ ] **Step 3: Run** `npx vitest run lib/vocabulary/print/quotes.test.ts components/vocabulary-print/worksheet.test.tsx --minWorkers=1 --maxWorkers=2` → FAIL.

- [ ] **Step 4: Implement**

```ts
// lib/vocabulary/print/quotes.ts
/** Spec W W10: curated Korume learning prompts (messages vocab.print.quotes.q1…q8), chosen by page index — never random, never AI. */
export const QUOTE_COUNT = 8;
export function quoteKey(pageIndex: number): string {
  return `quotes.q${(pageIndex % QUOTE_COUNT) + 1}`;
}
```

```ts
// components/vocabulary-print/labels.ts
"use client";
import { useTranslations } from "@/lib/i18n";
import { quoteKey } from "@/lib/vocabulary/print/quotes";
import type { WorksheetSettings } from "@/lib/vocabulary/print/settings";

export interface SheetLabels {
  wordmark: string;
  documentName: string;
  title: string;
  footer: string;
  englishMeaning: string;
  strokeOrder: string;
  answers: string;
  pageNumber: (page: number, count: number) => string;
  quote: (pageIndex: number) => string;
  credit: (sources: string) => string;
}

/** Client-only: the labels hold functions, so they are built where they are used, never passed across RSC. */
export function useSheetLabels(mode: WorksheetSettings["mode"], title: string): SheetLabels {
  const t = useTranslations("vocab.print");
  const documentName = mode === "practice" ? t("docPractice") : t("docSelfTest");
  return {
    wordmark: t("wordmark"), documentName, title, footer: t("footer", { document: documentName }),
    englishMeaning: t("englishMeaning"), strokeOrder: t("strokeOrder"), answers: t("answers"),
    pageNumber: (page, count) => t("pageNumber", { page, count }),
    quote: (pageIndex) => t(quoteKey(pageIndex)),
    credit: (sources) => t("credit", { sources }),
  };
}
```

`lib/vocabulary/print/mascot.ts`:

```ts
/** Spec §6 + W W9: the first-page colour mascot, and the full-body pose for the centre watermark. No new artwork. */
export const MASCOT_SRC = "/mascot/poses/quill-writing.png";
export const WATERMARK_SRC = "/mascot/poses/neutral.png";

let ready: Promise<void> | null = null;

/** Spec §3.5: a page set is never committed before both images decode; a failed decode never blocks printing. */
export function mascotReady(): Promise<void> {
  if (!ready) {
    ready = Promise.all([MASCOT_SRC, WATERMARK_SRC].map((src) => {
      const image = new Image();
      image.src = src;
      return image.decode().catch(() => undefined);
    })).then(() => undefined);
  }
  return ready;
}
```

```tsx
// components/vocabulary-print/worksheet.tsx
/* eslint-disable @next/next/no-img-element -- print needs plain, eagerly decoded <img> in fixed mm boxes. */
import type { CSSProperties } from "react";
import { MASCOT_SRC, WATERMARK_SRC } from "@/lib/vocabulary/print/mascot";
import { paperVars } from "@/lib/vocabulary/print/paper";
import type { AnswerRow, PreparedItem, PreparedPage } from "@/lib/vocabulary/print/prepare";
import type { WorksheetSettings } from "@/lib/vocabulary/print/settings";
import type { PrintResources } from "@/lib/vocabulary/print/source";
import type { SheetLabels } from "./labels";
import { StrokeGuideRow } from "./stroke-guide";
import { WritingRows } from "./writing-cells";

/** Presentational only (spec §4.1): rendered in the preview, the print root, the measurement tree and the PDF page. */

export function FirstHeader({ labels }: { labels: SheetLabels }) {
  return (
    <div className="vp-head-first">
      <img src={MASCOT_SRC} alt="" className="vp-mascot" />
      <div>
        <div className="vp-wordmark">{labels.wordmark}</div>
        <div className="vp-docname">{labels.documentName}</div>
        <div lang="ja" className="vp-title">{labels.title}</div>
      </div>
    </div>
  );
}

export function ContinuationHeader({ labels }: { labels: SheetLabels }) {
  return (
    <div className="vp-head-cont">
      <span className="vp-wordmark">{labels.wordmark}</span>
      <span lang="ja" className="vp-title">{labels.title}</span>
    </div>
  );
}

export function QuoteBand({ text }: { text: string }) {
  return <div className="vp-quote">{`“${text}”`}</div>;
}

export function FooterBlock({ labels, page, count, credit }: { labels: SheetLabels; page: number; count: number; credit: string }) {
  return (
    <div className="vp-foot-block">
      <div className="vp-foot">
        <span>{labels.footer}</span>
        <span>{labels.pageNumber(page, count)}</span>
      </div>
      <div className="vp-credit">{credit}</div>
    </div>
  );
}

function Meaning({ item, labels }: { item: PreparedItem; labels: SheetLabels }) {
  if (!item.meaning) return null;
  return (
    <span className="vp-meaning">
      {item.meaningLocale === "en" && <span className="vp-chip">{labels.englishMeaning}</span>}
      {item.meaning}
    </span>
  );
}

export function PracticeItem({ item, settings, labels, resources }: { item: PreparedItem; settings: WorksheetSettings; labels: SheetLabels; resources: PrintResources }) {
  return (
    <div className="vp-item" data-item-id={item.id}>
      <div className="vp-meta">
        <span lang="ja" className="vp-word">{item.target}</span>
        {item.reading && <span lang="ja" className="vp-reading">{item.reading}</span>}
        <Meaning item={item} labels={labels} />
      </div>
      <StrokeGuideRow glyphs={item.glyphs ?? []} guides={resources.strokeGuides} label={labels.strokeOrder} />
      <WritingRows cells={item.cells} model={item.glyphs ?? null} mode="practice" density={settings.density} />
      {item.example && <div lang="ja" className="vp-example">{item.example}</div>}
    </div>
  );
}

export function SelfTestItem({ item, settings, labels }: { item: PreparedItem; settings: WorksheetSettings; labels: SheetLabels }) {
  return (
    <div className="vp-item" data-item-id={item.id}>
      <div className="vp-meta">
        <span className="vp-number">{`${item.number}.`}</span>
        {item.reading && <span lang="ja" className="vp-reading vp-prompt">{item.reading}</span>}
        <Meaning item={item} labels={labels} />
      </div>
      <WritingRows cells={item.cells} model={null} mode="selfTest" density={settings.density} />
      {item.example && <div lang="ja" className="vp-example">{item.example}</div>}
    </div>
  );
}

export function AnswersHeading({ labels }: { labels: SheetLabels }) {
  return <div className="vp-answers-title">{labels.answers}</div>;
}

export function AnswerLine({ answer }: { answer: AnswerRow }) {
  return (
    <div className="vp-answer" data-item-id={answer.id}>
      <span className="vp-number">{`${answer.number}.`}</span>
      <span lang="ja" className="vp-answer-target">{answer.target}</span>
      {answer.reading && <span lang="ja" className="vp-reading">{answer.reading}</span>}
    </div>
  );
}

function creditFor(page: PreparedPage, settings: WorksheetSettings, resources: PrintResources, labels: SheetLabels): string {
  const strokes = page.kind === "items" && settings.mode === "practice";
  const sources = [resources.credits.jmdict, strokes ? resources.credits.kanjivg : null].filter(Boolean);
  return sources.length > 0 ? labels.credit(sources.join(" · ")) : "";
}

export function Worksheet({ pages, settings, labels, resources }: { pages: PreparedPage[]; settings: WorksheetSettings; labels: SheetLabels; resources: PrintResources }) {
  return (
    <div className={`vp-paper${settings.density === "compact" ? " vp-compact" : ""}`} style={paperVars() as CSSProperties}>
      {pages.map((page, index) => (
        <section key={index} className="vp-sheet">
          <div className="vp-watermark" aria-hidden="true">
            <img src={WATERMARK_SRC} alt="" />
            <span>{labels.wordmark}</span>
          </div>
          {index === 0 ? <FirstHeader labels={labels} /> : <ContinuationHeader labels={labels} />}
          <div className="vp-body">
            {page.kind === "items"
              ? page.items.map((item) => settings.mode === "practice"
                ? <PracticeItem key={item.id} item={item} settings={settings} labels={labels} resources={resources} />
                : <SelfTestItem key={item.id} item={item} settings={settings} labels={labels} />)
              : <><AnswersHeading labels={labels} />{page.answers.map((answer) => <AnswerLine key={answer.id} answer={answer} />)}</>}
          </div>
          <QuoteBand text={labels.quote(index)} />
          <FooterBlock labels={labels} page={index + 1} count={pages.length} credit={creditFor(page, settings, resources, labels)} />
        </section>
      ))}
    </div>
  );
}
```

Append to `app/globals.css` after the existing `.vp-*` block (inside nothing — same level as the existing rules):

```css
/* Writing worksheet (spec 2026-10-06 W). Geometry in mm/pt; layout.ts holds the same numbers. */
.vp-paper { --vp-guide: 16mm; }
.vp-sheet { position: relative; }
.vp-body { position: relative; z-index: 1; }
.vp-watermark { position: absolute; inset: 0; z-index: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4mm; opacity: 0.04; filter: grayscale(1); pointer-events: none; }
.vp-watermark img { width: 70mm; height: 70mm; object-fit: contain; }
.vp-watermark span { font-family: var(--font-display); font-weight: 700; font-size: 28pt; letter-spacing: 0.4em; color: #000; }
.vp-meta { display: flex; flex-wrap: wrap; align-items: baseline; gap: 1mm 3mm; }
.vp-meta .vp-reading { margin-inline-start: 0; }
.vp-meta .vp-meaning { margin-top: 0; }
.vp-meta .vp-chip { margin-inline: 0 1.5mm; }
.vp-number { min-width: 6mm; font-weight: 700; }
.vp-prompt { font-size: 12pt; color: var(--vp-ink); }
.vp-guides { display: flex; flex-wrap: wrap; align-items: center; gap: 2mm; margin-top: 1.5mm; }
.vp-guides-label { font-size: 7pt; color: var(--vp-muted); }
.vp-guide { width: var(--vp-guide); height: var(--vp-guide); border: 0.2mm solid var(--vp-rule); }
.vp-guide-cross { stroke: var(--vp-rule); stroke-width: 0.6; stroke-dasharray: 3 3; }
.vp-guide-stroke { fill: none; stroke: #333; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; }
.vp-guide-dot { fill: #111; }
.vp-guide-number { font-family: var(--font-sans); font-size: 12px; fill: #111; }
.vp-rows { display: flex; flex-direction: column; gap: 2mm; margin-top: 2mm; }
.vp-row { display: flex; gap: 3mm; }
.vp-group { display: flex; }
.vp-cell { position: relative; box-sizing: border-box; display: flex; align-items: center; justify-content: center; width: var(--vp-cell); height: var(--vp-cell); border: 0.25mm solid #555; font-family: var(--font-jp); font-size: calc(var(--vp-cell) * 0.72); line-height: 1; }
.vp-cell + .vp-cell { border-inline-start-width: 0; }
.vp-cell::before, .vp-cell::after { content: ""; position: absolute; border: 0 dashed var(--vp-rule); }
.vp-cell::before { inset-block: 0; inset-inline-start: 50%; border-inline-start-width: 0.2mm; }
.vp-cell::after { inset-inline: 0; inset-block-start: 50%; border-block-start-width: 0.2mm; }
.vp-model, .vp-trace { position: relative; z-index: 1; }
.vp-trace { color: #cfcfcf; }
.vp-answers-title { padding-bottom: 2mm; font-size: 12pt; font-weight: 700; }
.vp-answer { display: flex; align-items: baseline; gap: 3mm; padding: 1mm 0; border-bottom: 0.2mm solid var(--vp-rule); }
.vp-answer-target { font-family: var(--font-jp); font-size: 12pt; font-weight: 700; }
.vp-quote { box-sizing: border-box; height: 10mm; padding-top: 2mm; overflow: hidden; font-size: 8.5pt; font-style: italic; line-height: 1.35; color: var(--vp-muted); }
.vp-foot-block { flex: none; }
.vp-credit { height: 3.5mm; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-size: 5.5pt; line-height: 3.5mm; color: var(--vp-muted); }
```

The quote band is `10mm` = two lines of 8.5pt at 1.35 plus 2mm padding; with `overflow: hidden` a longer text
can never change the height (spec W10).

- [ ] **Step 5: Run** `npx vitest run lib/vocabulary/print components/vocabulary-print messages --minWorkers=1 --maxWorkers=2` → PASS (old
  `print-sheets` tests still pass — the old components are untouched); `npx tsc --noEmit`, `npm run lint` → 0.

- [ ] **Step 6: Mutations** — (a) render `PracticeItem` for self-test pages too → the self-test no-leak test goes
  red; (b) put the KanjiVG credit on every page → the self-test credit assertion goes red; (c) `quoteKey` returning
  `quotes.q1` always → the cycle test goes red. Restore; paste.

- [ ] **Step 7: Commit** — `feat(print): writing worksheet sheets — guides, cells, answer key, watermark, prompts, credit`.

---

### Task 7: Workspace on the worksheet; page passes resources; old template removed

**Files:**
- Modify: `components/vocabulary-print/print-workspace.tsx` (rewrite), `components/vocabulary-print/print-workspace.test.tsx` (rewrite),
  `lib/vocabulary/print/paginate.ts`, `lib/vocabulary/print/paginate.test.ts`, `lib/vocabulary/print/settings.ts` (delete `PrintSettings`,
  `DEFAULT_PRINT_SETTINGS`), `app/[locale]/(protected)/(app)/vocab/print/page.tsx`, `app/[locale]/(protected)/(app)/vocab/print/page.test.tsx`,
  `app/globals.css` (delete `.vp-blank`, `.vp-blank-inline`, `.vp-foot-mark`), `messages/{vi,en}/vocab.json`
- Delete: `components/vocabulary-print/print-sheets.tsx`, `components/vocabulary-print/print-sheets.test.tsx`
- Test: `components/vocabulary-print/print-workspace.test.tsx`, `lib/vocabulary/print/paginate.test.ts`, the page test

**Interfaces:**
- Consumes: everything from Tasks 1–6.
- Produces:
  - `pageCapacity({ content, firstHeader, continuationHeader, quote, footer }): PageCapacity`
  - `PrintWorkspace` props: `{ doc: PrintDocument; views: …; source: { lessonId: string; set: PrintSet }; resources: PrintResources }`
  - Committed state (Task 9 reads it): `interface Committed { pages: PreparedPage[]; settings: WorksheetSettings; oversized: PreparedItem[]; printed: number; excluded: number; missingStrokes: number }`
  - Measurement roles: `content`, `first-header`, `continuation-header`, `quote`, `footer`, `answers-heading`, `item`
    (`data-item-id`), `answer` (`data-item-id`).

- [ ] **Step 1: Copy** — in both catalogs: remove `modeReview`, `docReview`, `hide`, `show`; change `print` to `In` /
  `Print`; add:

| key | vi | en |
|---|---|---|
| `metadata` | Thông tin kèm theo | Shown with each word |
| `prompts` | Gợi ý | Prompts |
| `lastPrompt` | Cần giữ ít nhất một gợi ý. | Keep at least one prompt. |
| `includeKanaOnly` | Bao gồm từ chỉ có kana | Include kana-only words |
| `missingStrokes` | {count, plural, other {{count} ký tự}} chưa có hướng dẫn nét. | {count, plural, one {{count} character has} other {{count} characters have}} no stroke guide yet. |
| `noPrompt` | {count, plural, other {{count} từ}} không có gợi ý nên không đưa vào Tự kiểm tra. | {count, plural, one {{count} word has} other {{count} words have}} no prompt, so {count, plural, one {it is} other {they are}} left out of the self-test. |
| `oversized` (change) | “{word}” quá dài để vừa trang. Chọn Gọn, tắt Ví dụ, hoặc bỏ chọn mục này. | “{word}” is too long for the page. Choose Compact, turn off Example, or deselect it. |

- [ ] **Step 2: Update `paginate.ts` + its test first**

```ts
export function pageCapacity(measured: { content: number; firstHeader: number; continuationHeader: number; quote: number; footer: number }): PageCapacity {
  const bands = measured.quote + measured.footer;
  return { firstPage: measured.content - measured.firstHeader - bands, continuationPage: measured.content - measured.continuationHeader - bands };
}
```

Test addition in `paginate.test.ts`:

```ts
it("subtracts the fixed quote band and footer from both capacities (spec W §5)", () => {
  expect(pageCapacity({ content: 1000, firstHeader: 100, continuationHeader: 40, quote: 38, footer: 30 }))
    .toEqual({ firstPage: 832, continuationPage: 892 });
});
```

Update any existing `pageCapacity(...)` call in that file to pass `quote: 0`. Run it red first (`quote` ignored →
832 ≠ 870), then green.

- [ ] **Step 3: Write the failing workspace tests** — rewrite `print-workspace.test.tsx`, keeping the harness at the
  top of the current file (getBoundingClientRect by `data-measure` role, the ResizeObserver stub, the paginate spy, the
  mascot mock). Change: `HEIGHTS = { "first-header": 100, "continuation-header": 40, quote: 30, footer: 30, "answers-heading": 20 }`,
  roles `answer` measured as `answerHeight = 20`; `items()` now builds kanji surfaces (`語${i}`) with `example`
  `{ text: \`語${i}の例\`, spans: [] }`; render with `source={{ lessonId: "L", set: "all" }}` and
  `resources={{ strokeGuides: {}, credits: { jmdict: "JMdict v1 (CC)", kanjivg: null } }}`; the print button is
  `screen.getByRole("button", { name: "Print" })`. Keep every existing behaviour test (commit into preview + print
  root; nothing before mascot decode; re-paginate on setting change not on resize; zero-height guard; content-observer
  no-op; stale generation; font burst; oversized blocks; deselect-all; empty doc back link; raw notice; unmount;
  committed labels; nav label) adapted to the new names, and add:

```tsx
it("starts in Writing practice with words without kanji hidden, and shows them when the toggle is on", async () => {
  render(<PrintWorkspace doc={doc([...items(2), kana("する")])} views={views} source={source} resources={resources} />);
  expect(await screen.findByText("2/2 words · 1 page")).toBeInTheDocument();
  expect(screen.queryByText("する")).toBeNull();
  fireEvent.click(screen.getByRole("switch", { name: "Include kana-only words" }));
  expect(await screen.findByText("3/3 words · 1 page")).toBeInTheDocument();
});

it("self-test: the last enabled prompt cannot be turned off", async () => {
  render(<PrintWorkspace doc={doc(items(2))} views={views} source={source} resources={resources} />);
  fireEvent.click(await screen.findByRole("radio", { name: "Self-test" }));
  fireEvent.click(screen.getByRole("switch", { name: "Reading" }));
  fireEvent.click(screen.getByRole("switch", { name: "Example" }));
  expect(screen.getByRole("switch", { name: "Meaning" })).toBeDisabled();
  expect(screen.getByText("Keep at least one prompt.")).toBeInTheDocument();
});

it("self-test commits item pages then answer pages, the answers measured with the heading", async () => {
  render(<PrintWorkspace doc={doc(items(3))} views={views} source={source} resources={resources} />);
  fireEvent.click(await screen.findByRole("radio", { name: "Self-test" }));
  await waitFor(() => expect(printRoot()?.querySelectorAll(".vp-answer")).toHaveLength(3));
  const sheets = [...printRoot()!.querySelectorAll(".vp-sheet")];
  expect(sheets.at(-1)?.querySelector(".vp-answers-title")).not.toBeNull();
  expect(sheets.slice(0, -1).every((sheet) => sheet.querySelector(".vp-answer") === null)).toBe(true);
  expect(printRoot()?.querySelector(".vp-model, .vp-trace, .vp-guide")).toBeNull();
});

it("notes words left out of self-test for lack of a prompt, and characters without a stroke guide in practice", async () => {
  const bare: VocabularyPrintItem = { id: "raw", surface: "消えた", resolution: "saved_raw" };
  render(<PrintWorkspace doc={doc([...items(1), bare])} views={views} source={source} resources={resources} />);
  expect(await screen.findByText(/characters have no stroke guide yet/)).toBeInTheDocument(); // 語, 0 … and 消, え, た: none in resources
  fireEvent.click(screen.getByRole("radio", { name: "Self-test" }));
  expect(await screen.findByText("1 word has no prompt, so it is left out of the self-test.")).toBeInTheDocument();
});

it("blocks Print when every printed item is excluded, and when a word is too wide even at 8mm cells", async () => {
  const long: VocabularyPrintItem = { id: "long", surface: "語".repeat(23), resolution: "resolved", meaning: "x", meaningLocale: "en" };
  render(<PrintWorkspace doc={doc([long])} views={views} source={source} resources={resources} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("is too long for the page");
  expect(printButton()).toHaveAttribute("aria-disabled", "true");
});
```

with helpers `const kana = (surface: string): VocabularyPrintItem => ({ id: surface, surface, reading: surface, meaning: "m", meaningLocale: "en", resolution: "resolved" });`,
`const source = { lessonId: "L", set: "all" as const };`. Count arithmetic for the first test: content 1000 −
header 100 − quote 30 − footer 30 = 840 ≥ items at `itemHeight = 100`.

- [ ] **Step 4: Run** `npx vitest run components/vocabulary-print lib/vocabulary/print --minWorkers=1 --maxWorkers=2` → the new tests FAIL.

- [ ] **Step 5: Implement the workspace** — replace `print-workspace.tsx` with:

```tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Switch } from "@/components/ui/switch";
import { useTranslations } from "@/lib/i18n";
import { Link } from "@/lib/i18n/navigation";
import { hasKanji } from "@/lib/vocabulary/print/japanese";
import { writingLayout } from "@/lib/vocabulary/print/layout";
import { mascotReady } from "@/lib/vocabulary/print/mascot";
import { pageCapacity, paginate } from "@/lib/vocabulary/print/paginate";
import { MM_TO_PX, PAPER, paperVars } from "@/lib/vocabulary/print/paper";
import { prepareDocument, type PreparedItem, type PreparedPage } from "@/lib/vocabulary/print/prepare";
import { DEFAULT_WORKSHEET_SETTINGS, PROMPT_KEYS, type WorksheetSettings } from "@/lib/vocabulary/print/settings";
import type { PrintDocument, PrintResources, PrintSet } from "@/lib/vocabulary/print/source";
import { useSheetLabels } from "./labels";
import {
  AnswerLine, AnswersHeading, ContinuationHeader, FirstHeader, FooterBlock, PracticeItem, QuoteBand, SelfTestItem, Worksheet,
} from "./worksheet";

const FONT_DEBOUNCE_MS = 150;
const SHEET_GAP_PX = 16;
const SHEET_PX = { width: PAPER.widthMm * MM_TO_PX, height: PAPER.heightMm * MM_TO_PX };

export interface Committed {
  pages: PreparedPage[];
  settings: WorksheetSettings;
  oversized: PreparedItem[];
  printed: number;
  excluded: number;
  missingStrokes: number;
}

function missingStrokes(items: PreparedItem[], resources: PrintResources): number {
  return new Set(items.flatMap((item) => item.glyphs ?? []).filter((glyph) => !resources.strokeGuides[glyph])).size;
}

/** Spec §3 + W §5–§6: selection and settings on the left, the committed A4 worksheet on the right. */
export function PrintWorkspace({ doc, views, source, resources }: {
  doc: PrintDocument;
  views: { label: string; href: string; current: boolean }[];
  source: { lessonId: string; set: PrintSet };
  resources: PrintResources;
}) {
  const t = useTranslations("vocab.print");
  const [settings, setSettings] = useState<WorksheetSettings>(DEFAULT_WORKSHEET_SETTINGS);
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set(doc.items.map((item) => item.id)));
  const visible = useMemo(
    () => (settings.includeKanaOnly ? doc.items : doc.items.filter((item) => hasKanji(item.surface))),
    [doc.items, settings.includeKanaOnly],
  );
  const prepared = useMemo(() => prepareDocument(doc.items, selected, settings), [doc.items, selected, settings]);
  const [committed, setCommitted] = useState<Committed | null>(null);
  const [busy, setBusy] = useState(true);
  const [fontTick, setFontTick] = useState(0);
  const [layoutTick, setLayoutTick] = useState(0);
  const [scale, setScale] = useState(1);
  const [portal, setPortal] = useState<HTMLElement | null>(null);
  const generation = useRef(0);
  const measureRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const labels = useSheetLabels(settings.mode, doc.title);
  // Spec §3.5: the committed page set is atomic, so its labels follow the settings it was measured with.
  const committedLabels = useSheetLabels(committed?.settings.mode ?? settings.mode, doc.title);

  useEffect(() => setPortal(document.body), []);

  // Spec §3.3: a burst of font loads re-measures once.
  useEffect(() => {
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (!fonts?.addEventListener) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onDone = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setFontTick((tick) => tick + 1), FONT_DEBOUNCE_MS);
    };
    fonts.addEventListener("loadingdone", onDone);
    return () => {
      clearTimeout(timer);
      fonts.removeEventListener("loadingdone", onDone);
    };
  }, []);

  // Spec §3.5 + W §5: render tree → fonts.ready → measure + paginate → mascot + watermark decode → commit.
  useEffect(() => {
    const mine = ++generation.current;
    setBusy(true);
    void (async () => {
      await (document as Document & { fonts?: FontFaceSet }).fonts?.ready;
      const root = measureRef.current;
      if (mine !== generation.current || !root) return;
      const height = (role: string) => root.querySelector<HTMLElement>(`[data-measure="${role}"]`)?.getBoundingClientRect().height ?? 0;
      // A tree with no layout (print media, the mobile handoff) reads zeros; commit nothing until the observer sees layout.
      if (height("content") === 0) return;
      const capacity = pageCapacity({
        content: height("content"), firstHeader: height("first-header"), continuationHeader: height("continuation-header"),
        quote: height("quote"), footer: height("footer"),
      });
      // Map back by id read off the measured DOM, never by a closure index.
      const nodes = (role: string) => [...root.querySelectorAll<HTMLElement>(`[data-measure="${role}"]`)];
      const itemNodes = nodes("item");
      const itemById = new Map(prepared.items.map((item) => [item.id, item]));
      const itemAt = (index: number) => itemById.get(itemNodes[index]?.dataset.itemId ?? "");
      const items = paginate(itemNodes.map((el) => el.getBoundingClientRect().height), capacity);
      const pages: PreparedPage[] = items.pages.map((indexes) => ({ kind: "items", items: indexes.flatMap((index) => itemAt(index) ?? []) }));
      if (settings.mode === "selfTest" && prepared.answers.length > 0) {
        const answerNodes = nodes("answer");
        const answerById = new Map(prepared.answers.map((answer) => [answer.id, answer]));
        const room = capacity.continuationPage - height("answers-heading");
        const answers = paginate(answerNodes.map((el) => el.getBoundingClientRect().height), { firstPage: room, continuationPage: room });
        pages.push(...answers.pages.map((indexes): PreparedPage => ({
          kind: "answers", answers: indexes.flatMap((index) => answerById.get(answerNodes[index]?.dataset.itemId ?? "") ?? []),
        })));
      }
      const tooWide = prepared.items.filter((item) => writingLayout(item.cells, settings.mode, settings.density).oversized);
      const oversized = [...new Set([...items.oversized.flatMap((index) => itemAt(index) ?? []), ...tooWide])];
      await mascotReady();
      if (mine !== generation.current) return;
      setCommitted({
        pages, settings, oversized, printed: prepared.items.length, excluded: prepared.excluded.length,
        missingStrokes: settings.mode === "practice" ? missingStrokes(prepared.items, resources) : 0,
      });
      setBusy(false);
    })();
  }, [prepared, settings, resources, fontTick, layoutTick]);

  // Unmount: any in-flight generation becomes stale and commits nothing.
  useEffect(() => () => { generation.current += 1; }, []);

  // Spec §3.5: the content node has a fixed mm height, so its observed height changes only when layout appears or disappears.
  useEffect(() => {
    const content = measureRef.current?.querySelector<HTMLElement>('[data-measure="content"]');
    if (!content || typeof ResizeObserver === "undefined") return;
    let last = content.getBoundingClientRect().height;
    const observer = new ResizeObserver(([entry]) => {
      const next = entry?.contentRect.height ?? last;
      if (next === last) return;
      last = next;
      setLayoutTick((tick) => tick + 1);
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  // Spec §3.6: the paper never reflows with the viewport; only the preview's scale follows the column.
  useEffect(() => {
    const element = previewRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setScale(Math.min(1, entry.contentRect.width / SHEET_PX.width));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const update = useCallback(<K extends keyof WorksheetSettings>(key: K, value: WorksheetSettings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }));
  }, []);

  if (doc.items.length === 0) {
    return (
      <div className="space-y-md py-xl">
        <p className="text-body text-muted-foreground">{t("empty")}</p>
        <Link href={doc.backHref} className="text-body underline">{doc.backLabel}</Link>
      </div>
    );
  }

  const pageCount = committed?.pages.length ?? 0;
  const unresolved = visible.filter((item) => item.resolution === "saved_raw" && selected.has(item.id)).length;
  const blocked = busy || !committed || committed.printed === 0 || committed.oversized.length > 0;
  const previewHeight = pageCount * SHEET_PX.height + Math.max(0, pageCount - 1) * SHEET_GAP_PX;
  const enabledPrompts = PROMPT_KEYS.filter((key) => settings[key]);
  const locked = (key: (typeof PROMPT_KEYS)[number]) => settings.mode === "selfTest" && settings[key] && enabledPrompts.length === 1;
  const measureCredit = labels.credit("JMdict · KanjiVG"); // fixed-height line; its text never changes the height

  return (
    <div className="grid gap-lg py-lg lg:grid-cols-[20rem_minmax(0,1fr)]">
      <aside className="flex max-h-[calc(100dvh-var(--header-height,4rem))] flex-col gap-md overflow-y-auto lg:sticky lg:top-0">
        <h1 className="text-heading font-bold">{t("heading")}</h1>
        <nav aria-label={t("words")} className="flex gap-xs">
          {views.map((view) => (
            <Link key={view.href} href={view.href} aria-current={view.current ? "page" : undefined}
              className="rounded-md border border-border px-sm py-2xs text-caption aria-[current=page]:bg-muted aria-[current=page]:font-semibold">
              {view.label}
            </Link>
          ))}
        </nav>
        <SegmentedControl aria-label={t("mode")} value={settings.mode} onValueChange={(value) => update("mode", value)}
          options={[{ value: "practice", label: t("modePractice") }, { value: "selfTest", label: t("modeSelfTest") }]} />
        <fieldset className="space-y-xs">
          <legend className="text-caption font-semibold text-muted-foreground">{settings.mode === "selfTest" ? t("prompts") : t("metadata")}</legend>
          {PROMPT_KEYS.map((key) => (
            <label key={key} className="flex items-center justify-between gap-sm text-body">
              {t(key)}
              <Switch checked={settings[key]} disabled={locked(key)} aria-describedby={locked(key) ? "vp-last-prompt" : undefined}
                onCheckedChange={(checked) => update(key, checked)} />
            </label>
          ))}
          {enabledPrompts.length === 1 && settings.mode === "selfTest" && (
            <p id="vp-last-prompt" className="text-caption text-muted-foreground">{t("lastPrompt")}</p>
          )}
        </fieldset>
        <SegmentedControl aria-label={t("density")} value={settings.density} onValueChange={(value) => update("density", value)}
          options={[{ value: "airy", label: t("densityAiry") }, { value: "compact", label: t("densityCompact") }]} />
        <label className="flex items-center justify-between gap-sm text-body">
          {t("includeKanaOnly")}
          <Switch checked={settings.includeKanaOnly} onCheckedChange={(checked) => update("includeKanaOnly", checked)} />
        </label>
        <div className="space-y-xs">
          <div className="flex items-center justify-between gap-sm">
            <span className="text-caption font-semibold text-muted-foreground">{t("words")}</span>
            <span className="flex gap-xs">
              <Button variant="ghost" size="sm" onClick={() => setSelected(new Set(doc.items.map((item) => item.id)))}>{t("selectAll")}</Button>
              <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>{t("selectNone")}</Button>
            </span>
          </div>
          <ul className="space-y-2xs">
            {visible.map((item) => (
              <li key={item.id}>
                <label className="flex items-center gap-sm text-body">
                  <input type="checkbox" checked={selected.has(item.id)} onChange={(event) => setSelected((current) => {
                    const next = new Set(current);
                    if (event.target.checked) next.add(item.id); else next.delete(item.id);
                    return next;
                  })} />
                  <span lang="ja" className="font-semibold">{item.surface}</span>
                  {item.reading && <span lang="ja" className="text-caption text-muted-foreground">{item.reading}</span>}
                </label>
              </li>
            ))}
          </ul>
        </div>
        <p role="status" aria-live="polite" className="text-caption text-muted-foreground">
          {!committed ? t("preparing") : t("count", { selected: committed.printed, total: visible.length, pages: committed.printed === 0 ? 0 : pageCount })}
        </p>
        {unresolved > 0 && <p className="text-caption text-muted-foreground">{t("unresolved", { count: unresolved })}</p>}
        {committed && committed.missingStrokes > 0 && <p className="text-caption text-muted-foreground">{t("missingStrokes", { count: committed.missingStrokes })}</p>}
        {committed && committed.excluded > 0 && <p className="text-caption text-muted-foreground">{t("noPrompt", { count: committed.excluded })}</p>}
        {committed?.oversized.map((item) => (
          <p key={item.id} role="alert" className="text-caption text-destructive">
            {t("oversized", { word: doc.items.find((candidate) => candidate.id === item.id)?.surface ?? "" })}
          </p>
        ))}
        <div className="sticky bottom-0 mt-auto flex gap-sm bg-background pt-sm">
          <Button variant="outline" className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
            aria-disabled={blocked || undefined} onClick={() => { if (!blocked) window.print(); }}>
            {t("print")}
          </Button>
        </div>
      </aside>

      <div ref={previewRef} data-preview="" className="min-w-0">
        {prepared.items.length === 0
          ? <p className="text-body text-muted-foreground">{t("empty")}</p>
          : committed && (
            <div style={{ height: previewHeight * scale }}>
              <div className="origin-top-left" style={{ width: SHEET_PX.width, transform: `scale(${scale})` }}>
                <Worksheet pages={committed.pages} settings={committed.settings} labels={committedLabels} resources={resources} />
              </div>
            </div>
          )}
      </div>

      {/* Spec §3.3: the hidden measurement tree, same components and paper width, never scaled, never printed. */}
      <div ref={measureRef} aria-hidden className={`vp-paper vp-measure${settings.density === "compact" ? " vp-compact" : ""}`} style={paperVars() as CSSProperties}>
        <div data-measure="content" className="vp-measure-content" />
        <div data-measure="first-header"><FirstHeader labels={labels} /></div>
        <div data-measure="continuation-header"><ContinuationHeader labels={labels} /></div>
        <div data-measure="quote"><QuoteBand text={labels.quote(0)} /></div>
        <div data-measure="footer"><FooterBlock labels={labels} page={88} count={88} credit={measureCredit} /></div>
        {prepared.items.map((item) => (
          <div key={item.id} data-measure="item" data-item-id={item.id}>
            {settings.mode === "practice"
              ? <PracticeItem item={item} settings={settings} labels={labels} resources={resources} />
              : <SelfTestItem item={item} settings={settings} labels={labels} />}
          </div>
        ))}
        {settings.mode === "selfTest" && <div data-measure="answers-heading"><AnswersHeading labels={labels} /></div>}
        {settings.mode === "selfTest" && prepared.answers.map((answer) => (
          <div key={answer.id} data-measure="answer" data-item-id={answer.id}><AnswerLine answer={answer} /></div>
        ))}
      </div>

      {portal && createPortal(
        <div data-print-root="">
          {committed && committed.printed > 0 && <Worksheet pages={committed.pages} settings={committed.settings} labels={committedLabels} resources={resources} />}
        </div>,
        portal,
      )}
    </div>
  );
}
```

(`source` is consumed by Task 9's download; keep it in the props now and reference it with `void source;` only if
lint flags an unused variable — Task 9 removes that line.)

Page (`vocab/print/page.tsx`): import `loadPrintResources` and pass:

```tsx
const resources = await loadPrintResources(result.doc.items.map((item) => item.surface));
…
<PrintWorkspace key={`${source.lessonId}:${source.set}`} doc={result.doc} source={{ lessonId: source.lessonId, set: source.set }} resources={resources} views={…} />
```

In `page.test.tsx` mock `@/lib/vocabulary/print/resources` (`loadPrintResources: vi.fn(async () => ({ strokeGuides: {}, credits: { jmdict: null, kanjivg: null } }))`)
and assert the workspace receives `resources` and `source` (and that `structuredClone` of every prop succeeds —
the RSC plain-data guard).

Delete `print-sheets.tsx`, `print-sheets.test.tsx`, the old `PrintSettings` / `DEFAULT_PRINT_SETTINGS`, and the
`.vp-blank`, `.vp-blank-inline`, `.vp-foot-mark` CSS rules. `grep -rn "print-sheets\|PrintSettings\|DEFAULT_PRINT_SETTINGS\|vp-blank\|vp-foot-mark" app components lib tests`
must print nothing.

Update `components/ui/token-scale.test.ts` if its lesson-summary / print file count changes (it pinned 19→20 on this
branch; re-run it and adjust only the count with a comment naming the files).

- [ ] **Step 6: Run** `npx vitest run components/vocabulary-print lib/vocabulary/print "app/[locale]/(protected)/(app)/vocab/print" components/ui messages --minWorkers=1 --maxWorkers=2`,
  `npx tsc --noEmit`, `npm run lint` → all green.

- [ ] **Step 7: Mutations** — (a) drop `quote` from `pageCapacity` → paginate test red; (b) in the effect, skip the
  answers block → the answers-last test red; (c) `locked()` always false → the last-prompt test red; (d) remove the
  `tooWide` merge → the too-wide test red. Restore; paste.

- [ ] **Step 8: Commit** — `feat(print): the workspace prints the writing worksheet; review template removed`.

---

### Task 8: PDF backend — request validation, render jobs, queue, Chromium renderer, route, ops

**Files:**
- Create: `lib/vocabulary/print/filename.ts`, `lib/vocabulary/print/pdf/request.ts`, `lib/vocabulary/print/pdf/jobs.ts`,
  `lib/vocabulary/print/pdf/queue.ts`, `lib/vocabulary/print/pdf/renderer.ts`, `app/api/vocab/print/pdf/route.ts`, `docs/ops/print-pdf.md`
- Modify: `package.json`, `package-lock.json` (`playwright` dependency)
- Test: `lib/vocabulary/print/filename.test.ts`, `lib/vocabulary/print/pdf/request.test.ts`, `lib/vocabulary/print/pdf/jobs.test.ts`,
  `lib/vocabulary/print/pdf/queue.test.ts`, `lib/vocabulary/print/pdf/renderer.test.ts`, `app/api/vocab/print/pdf/route.test.ts`

**Interfaces:**
- Consumes: `authenticateSummary()` (`lib/summary/load-snapshot.ts`, returns `{ supabase, userId } | null`),
  `resolveLessonSource({ source, locale, userId, db })` (`lesson-source.ts`), `prepareDocument`, `loadPrintResources`,
  `rateLimit(key, { limit, windowMs })` → `{ ok, retryAfter }`, `getTranslations({ locale, namespace })`.
- Produces:
  - `pdfFilename(documentName: string, title: string): string`; `contentDisposition(filename: string, mode: WorksheetSettings["mode"]): string`
  - `pdfRequestSchema` (zod), `type PdfRequest`; `assignPages(doc: PrintDocument, request: PdfRequest): { ok: true; pages: PreparedPage[]; items: PreparedItem[] } | { ok: false; reason: string }`
  - `interface RenderPayload { locale: "vi" | "en"; title: string; settings: WorksheetSettings; pages: PreparedPage[]; resources: PrintResources }`
  - `createRenderJob(job: { userId: string; lessonId: string; payload: RenderPayload }, now?: number): string`; `takeRenderJob(token: string, now?: number): RenderJob | null`
  - `createQueue(maxPending: number): { run<T>(task: () => Promise<T>): Promise<T> }`; `class QueueFullError`
  - `renderPdf(path: string): Promise<Buffer>`; `printOrigin(): string`; `class PdfLayoutError`, `class PdfUnavailableError`
  - `POST /api/vocab/print/pdf`

- [ ] **Step 1: Dependency** — `npm install playwright@1.61.1 --save` (the version `@playwright/test` resolves to:
  `node -p "require('./node_modules/@playwright/test/package.json').version"` printed `1.61.1`). Then `npm ls playwright-core`
  must show a single `1.61.1`. No `playwright-core` entry in `package.json`.

- [ ] **Step 2: Write the failing tests**

```ts
// lib/vocabulary/print/filename.test.ts
import { describe, expect, it } from "vitest";
import { contentDisposition, pdfFilename } from "./filename";

describe("PDF filename (spec W §6.3 step 7)", () => {
  it("builds the localized name and replaces characters invalid in file names", () => {
    expect(pdfFilename("Luyện viết từ vựng", "Ep.729 苦手な人")).toBe("Korume - Luyện viết từ vựng - Ep.729 苦手な人.pdf");
    expect(pdfFilename("Vocabulary Writing Practice", 'a/b\\c:d*e?f"g<h>i|j\u0007k')).toBe("Korume - Vocabulary Writing Practice - a b c d e f g h i j k.pdf");
    expect(pdfFilename("Vocabulary Self-test", "  ")).toBe("Korume - Vocabulary Self-test.pdf");
  });
  it("sends an ASCII fallback per mode and the UTF-8 name RFC 5987-encoded", () => {
    const header = contentDisposition("Korume - Luyện viết từ vựng - 苦手 (1)'s.pdf", "practice");
    expect(header).toBe(`attachment; filename="Korume-Writing-Practice.pdf"; filename*=UTF-8''Korume%20-%20Luy%E1%BB%87n%20vi%E1%BA%BFt%20t%E1%BB%AB%20v%E1%BB%B1ng%20-%20%E8%8B%A6%E6%89%8B%20%281%29%27s.pdf`);
    expect(contentDisposition("x.pdf", "selfTest")).toContain('filename="Korume-Self-Test.pdf"');
  });
  it("keeps an emoji title intact in filename*", () => {
    expect(contentDisposition(pdfFilename("Vocabulary Writing Practice", "🍣"), "practice")).toContain("%F0%9F%8D%A3");
  });
});
```

```ts
// lib/vocabulary/print/pdf/request.test.ts
import { describe, expect, it } from "vitest";
import { DEFAULT_WORKSHEET_SETTINGS } from "../settings";
import type { PrintDocument } from "../source";
import { assignPages, pdfRequestSchema, type PdfRequest } from "./request";

const doc: PrintDocument = { title: "T", backHref: "/b", backLabel: "b", items: [
  { id: "a", surface: "苦手", entSeq: 1, reading: "にがて", meaning: "kém", meaningLocale: "vi", resolution: "resolved" },
  { id: "b", surface: "人", entSeq: 2, reading: "ひと", meaning: "người", meaningLocale: "vi", resolution: "resolved" },
  { id: "k", surface: "する", entSeq: 3, reading: "する", resolution: "resolved" },
] };
const base: PdfRequest = { lessonId: "00000000-0000-4000-8000-000000000000", set: "all", locale: "vi", settings: DEFAULT_WORKSHEET_SETTINGS,
  pages: [{ kind: "items", ids: ["a"] }, { kind: "items", ids: ["b"] }] };
const selfTest = { ...DEFAULT_WORKSHEET_SETTINGS, mode: "selfTest" as const };

describe("assignPages — the client is untrusted (spec W §6.3 step 2)", () => {
  it("rebuilds the pages from the re-resolved document, keeping the client's page breaks", () => {
    const result = assignPages(doc, base);
    expect(result.ok && result.pages.map((page) => page.kind === "items" && page.items.map((item) => item.target))).toEqual([["苦手"], ["人"]]);
  });
  it.each([
    ["an unknown id", [{ kind: "items", ids: ["a", "zzz"] }]],
    ["a duplicate id", [{ kind: "items", ids: ["a"] }, { kind: "items", ids: ["a", "b"] }]],
    ["an order the document does not have", [{ kind: "items", ids: ["b", "a"] }]],
    ["a word without kanji while the toggle is off", [{ kind: "items", ids: ["a", "k"] }]],
    ["answer pages in practice", [{ kind: "items", ids: ["a"] }, { kind: "answers", ids: ["a"] }]],
    ["an answers page first", [{ kind: "answers", ids: ["a"] }, { kind: "items", ids: ["a"] }]],
  ] as const)("rejects %s", (_, pages) => {
    expect(assignPages(doc, { ...base, pages: pages as unknown as PdfRequest["pages"] }).ok).toBe(false);
  });
  it("self-test: answers must list exactly the item ids in order, and items carry no target", () => {
    const good = assignPages(doc, { ...base, settings: selfTest, pages: [{ kind: "items", ids: ["a", "b"] }, { kind: "answers", ids: ["a", "b"] }] });
    expect(good.ok).toBe(true);
    expect(good.ok && good.items.every((item) => item.target === undefined)).toBe(true);
    expect(assignPages(doc, { ...base, settings: selfTest, pages: [{ kind: "items", ids: ["a", "b"] }, { kind: "answers", ids: ["a"] }] }).ok).toBe(false);
    expect(assignPages(doc, { ...base, settings: selfTest, pages: [{ kind: "items", ids: ["a", "b"] }] }).ok).toBe(false);
  });
});

describe("pdfRequestSchema (spec W §6.3 step 1)", () => {
  it("caps pages and ids and rejects unknown settings keys", () => {
    expect(pdfRequestSchema.safeParse(base).success).toBe(true);
    expect(pdfRequestSchema.safeParse({ ...base, pages: Array.from({ length: 61 }, () => ({ kind: "items", ids: ["a"] })) }).success).toBe(false);
    expect(pdfRequestSchema.safeParse({ ...base, settings: { ...base.settings, hide: "meaning" } }).success).toBe(false);
    expect(pdfRequestSchema.safeParse({ ...base, lessonId: "not-a-uuid" }).success).toBe(false);
    expect(pdfRequestSchema.safeParse({ ...base, pages: [{ kind: "items", ids: [] }] }).success).toBe(false);
  });
});
```

```ts
// lib/vocabulary/print/pdf/jobs.test.ts
import { describe, expect, it } from "vitest";
import type { RenderPayload } from "./request";
import { createRenderJob, takeRenderJob } from "./jobs";

const payload = { locale: "vi", title: "T", settings: {}, pages: [], resources: {} } as unknown as RenderPayload;

describe("render jobs (spec W §6.3 step 3)", () => {
  it("issues an unguessable token that works exactly once", () => {
    const token = createRenderJob({ userId: "u", lessonId: "l", payload }, 1_000);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(takeRenderJob(token, 1_001)?.payload).toBe(payload);
    expect(takeRenderJob(token, 1_002)).toBeNull();
  });
  it("expires after 60 seconds and an unknown token is null", () => {
    const token = createRenderJob({ userId: "u", lessonId: "l", payload }, 0);
    expect(takeRenderJob(token, 60_000)).toBeNull();
    expect(takeRenderJob("nope")).toBeNull();
  });
  it("lives on globalThis, so a second module instance sees the same store", async () => {
    const token = createRenderJob({ userId: "u", lessonId: "l", payload }, Date.now());
    const { vi } = await import("vitest");
    vi.resetModules();
    const fresh = await import("./jobs");
    expect(fresh.takeRenderJob(token)?.userId).toBe("u");
  });
});
```

```ts
// lib/vocabulary/print/pdf/queue.test.ts
import { describe, expect, it } from "vitest";
import { createQueue, QueueFullError } from "./queue";

describe("PDF queue (spec W §6.3 step 4)", () => {
  it("runs one task at a time, in order", async () => {
    const queue = createQueue(5);
    const log: string[] = [];
    let release!: () => void;
    const first = queue.run(() => new Promise<void>((resolve) => { log.push("start1"); release = () => { log.push("end1"); resolve(); }; }));
    const second = queue.run(async () => { log.push("start2"); });
    await Promise.resolve();
    expect(log).toEqual(["start1"]);
    release();
    await Promise.all([first, second]);
    expect(log).toEqual(["start1", "end1", "start2"]);
  });
  it("rejects beyond one running + four waiting, and a failure does not stall the queue", async () => {
    const queue = createQueue(5);
    const never = () => new Promise<void>(() => undefined);
    for (let i = 0; i < 5; i += 1) void queue.run(never);
    await expect(queue.run(async () => 1)).rejects.toBeInstanceOf(QueueFullError);
    const other = createQueue(5);
    await expect(other.run(async () => { throw new Error("boom"); })).rejects.toThrow("boom");
    await expect(other.run(async () => 2)).resolves.toBe(2);
  });
});
```

```ts
// lib/vocabulary/print/pdf/renderer.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const page = {
  emulateMedia: vi.fn(), goto: vi.fn(), waitForSelector: vi.fn(), pdf: vi.fn(async () => Buffer.from("%PDF-1.7")),
};
const context = { route: vi.fn(), newPage: vi.fn(async () => page), close: vi.fn() };
const browser = { newContext: vi.fn(async () => context), close: vi.fn() };
vi.mock("server-only", () => ({}));
vi.mock("playwright", () => ({ chromium: { launch: vi.fn(async () => browser) }, errors: { TimeoutError: class extends Error {} } }));

import { chromium } from "playwright";
import { PdfLayoutError, PdfUnavailableError, printOrigin, renderPdf } from "./renderer";

beforeEach(() => {
  vi.clearAllMocks();
  page.goto.mockResolvedValue({ ok: () => true, status: () => 200 });
  page.waitForSelector.mockResolvedValue({ getAttribute: async (name: string) => (name === "data-pdf-error" ? null : "") });
  process.env.PRINT_PDF_ORIGIN = "http://127.0.0.1:3999";
});

describe("renderPdf (spec W §6.3 steps 4–6)", () => {
  it("opens the render path on the internal origin with print media and no cookies, then prints A4 from CSS", async () => {
    expect(await renderPdf("/vi/print-render/tok")).toEqual(Buffer.from("%PDF-1.7"));
    expect(printOrigin()).toBe("http://127.0.0.1:3999");
    expect(browser.newContext).toHaveBeenCalledWith(expect.not.objectContaining({ storageState: expect.anything() }));
    expect(page.emulateMedia).toHaveBeenCalledWith({ media: "print" });
    expect(page.goto).toHaveBeenCalledWith("http://127.0.0.1:3999/vi/print-render/tok", expect.objectContaining({ timeout: 30_000 }));
    expect(page.pdf).toHaveBeenCalledWith({ preferCSSPageSize: true, printBackground: false });
    expect(context.close).toHaveBeenCalled();
  });
  it("aborts every request to another origin", async () => {
    await renderPdf("/vi/print-render/tok");
    const handler = context.route.mock.calls[0]![1] as (route: { request: () => { url: () => string }; continue: () => void; abort: () => void }) => void;
    const route = (url: string) => ({ request: () => ({ url: () => url }), continue: vi.fn(), abort: vi.fn() });
    const own = route("http://127.0.0.1:3999/_next/static/x.woff2");
    const foreign = route("https://fonts.gstatic.com/x.woff2");
    handler(own); handler(foreign);
    expect(own.continue).toHaveBeenCalled();
    expect(foreign.abort).toHaveBeenCalled();
  });
  it("raises a layout error when the render page reports an overflow, and closes the context", async () => {
    page.waitForSelector.mockResolvedValue({ getAttribute: async (name: string) => (name === "data-pdf-error" ? "" : null) });
    await expect(renderPdf("/vi/print-render/tok")).rejects.toBeInstanceOf(PdfLayoutError);
    expect(context.close).toHaveBeenCalled();
  });
  it("raises unavailable when Chromium cannot launch", async () => {
    vi.mocked(chromium.launch).mockRejectedValueOnce(new Error("Executable doesn't exist"));
    await expect(renderPdf("/vi/print-render/tok")).rejects.toBeInstanceOf(PdfUnavailableError);
  });
});
```

(Because `renderer.ts` caches the browser promise at module level, reset it between tests with an exported
`__resetBrowserForTests()` that sets the cache to null and clears the idle timer; call it in `beforeEach`.)

```ts
// app/api/vocab/print/pdf/route.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/summary/load-snapshot", () => ({ authenticateSummary: vi.fn() }));
vi.mock("@/lib/vocabulary/print/lesson-source", () => ({ resolveLessonSource: vi.fn() }));
vi.mock("@/lib/vocabulary/print/resources", () => ({ loadPrintResources: vi.fn(async () => ({ strokeGuides: {}, credits: { jmdict: null, kanjivg: null } })) }));
vi.mock("@/lib/vocabulary/print/pdf/renderer", async (original) => ({ ...(await original<object>()), renderPdf: vi.fn(async () => Buffer.from("%PDF-1.7")) }));
vi.mock("@/lib/i18n/server", () => ({ getTranslations: vi.fn(async () => (key: string) => ({ docPractice: "Luyện viết từ vựng", docSelfTest: "Tự kiểm tra từ vựng" })[key] ?? key) }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn(() => ({ ok: true, retryAfter: 0 })) }));

import { rateLimit } from "@/lib/rate-limit";
import { authenticateSummary } from "@/lib/summary/load-snapshot";
import { resolveLessonSource } from "@/lib/vocabulary/print/lesson-source";
import { PdfLayoutError, PdfUnavailableError, renderPdf } from "@/lib/vocabulary/print/pdf/renderer";
import { DEFAULT_WORKSHEET_SETTINGS } from "@/lib/vocabulary/print/settings";
import { POST } from "./route";

const lessonId = "00000000-0000-4000-8000-000000000000";
const body = { lessonId, set: "all", locale: "vi", settings: DEFAULT_WORKSHEET_SETTINGS, pages: [{ kind: "items", ids: ["a"] }] };
const post = (data: unknown) => POST(new Request("http://x/api/vocab/print/pdf", { method: "POST", body: JSON.stringify(data) }));

beforeEach(() => {
  vi.mocked(authenticateSummary).mockResolvedValue({ userId: "u1", supabase: {} } as never);
  vi.mocked(resolveLessonSource).mockResolvedValue({ kind: "ok", doc: { title: "Ep.729", backHref: "/b", backLabel: "b", items: [
    { id: "a", surface: "苦手", entSeq: 1, resolution: "resolved", meaning: "kém", meaningLocale: "vi" },
  ] } });
});

describe("POST /api/vocab/print/pdf (spec W §6.3)", () => {
  it("returns the PDF as an attachment named after the document and the lesson", async () => {
    const response = await post(body);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toContain("filename*=UTF-8''Korume%20-%20Luy%E1%BB%87n");
    expect(vi.mocked(renderPdf).mock.calls[0]![0]).toMatch(/^\/vi\/print-render\/[A-Za-z0-9_-]{43}$/);
    expect(resolveLessonSource).toHaveBeenCalledWith(expect.objectContaining({ userId: "u1", source: { kind: "lesson", lessonId, set: "all" } }));
  });
  it("401 without a session, 429 over the rate limit, 400 on a bad body or a foreign id, 404 for an unreadable lesson", async () => {
    vi.mocked(authenticateSummary).mockResolvedValueOnce(null);
    expect((await post(body)).status).toBe(401);
    vi.mocked(rateLimit).mockReturnValueOnce({ ok: false, retryAfter: 12_000 });
    const limited = await post(body);
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("12");
    expect((await post({ ...body, pages: "x" })).status).toBe(400);
    expect((await post({ ...body, pages: [{ kind: "items", ids: ["forged"] }] })).status).toBe(400);
    vi.mocked(resolveLessonSource).mockResolvedValueOnce({ kind: "not_found" });
    expect((await post(body)).status).toBe(404);
  });
  it("maps renderer failures: layout 409, Chromium missing 503, a full queue 503 with Retry-After", async () => {
    vi.mocked(renderPdf).mockRejectedValueOnce(new PdfLayoutError("x"));
    expect((await post(body)).status).toBe(409);
    vi.mocked(renderPdf).mockRejectedValueOnce(new PdfUnavailableError("x"));
    expect((await post(body)).status).toBe(503);
  });
});
```

- [ ] **Step 3: Run** `npx vitest run lib/vocabulary/print/filename.test.ts lib/vocabulary/print/pdf app/api/vocab/print --minWorkers=1 --maxWorkers=2` → FAIL.

- [ ] **Step 4: Implement**

```ts
// lib/vocabulary/print/filename.ts
import type { WorksheetSettings } from "./settings";

const UNSAFE = /[/\\:*?"<>|\u0000-\u001f\u007f]/g;
const ASCII_FALLBACK = { practice: "Korume-Writing-Practice.pdf", selfTest: "Korume-Self-Test.pdf" } as const;

/** Spec W §6.3 step 7: `Korume - <document name> - <lesson title>.pdf`, unsafe characters replaced by a space. */
export function pdfFilename(documentName: string, title: string): string {
  const clean = title.replace(UNSAFE, " ").replace(/\s+/g, " ").trim();
  return clean ? `Korume - ${documentName} - ${clean}.pdf` : `Korume - ${documentName}.pdf`;
}

/** RFC 6266 + 5987: an ASCII `filename` for old clients, the real name in `filename*`. */
export function contentDisposition(filename: string, mode: WorksheetSettings["mode"]): string {
  const encoded = encodeURIComponent(filename).replace(/['()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${ASCII_FALLBACK[mode]}"; filename*=UTF-8''${encoded}`;
}
```

```ts
// lib/vocabulary/print/pdf/request.ts
import { z } from "zod";
import { prepareDocument, type PreparedItem, type PreparedPage } from "../prepare";
import { worksheetSettingsSchema, type WorksheetSettings } from "../settings";
import type { PrintDocument, PrintResources } from "../source";

export const pdfRequestSchema = z.object({
  lessonId: z.string().uuid(),
  set: z.enum(["all", "saved"]),
  locale: z.enum(["vi", "en"]),
  settings: worksheetSettingsSchema,
  pages: z.array(z.object({ kind: z.enum(["items", "answers"]), ids: z.array(z.string().min(1).max(200)).min(1).max(200) }).strict()).min(1).max(60),
}).strict();
export type PdfRequest = z.infer<typeof pdfRequestSchema>;

/** Everything the cookie-less render page needs; built only from the re-resolved document (spec W §6.3 step 3). */
export interface RenderPayload {
  locale: "vi" | "en";
  title: string;
  settings: WorksheetSettings;
  pages: PreparedPage[];
  resources: PrintResources;
}

const same = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((value, index) => value === b[index]);

/** Spec W §6.3 step 2: the client's page breaks are kept; every id is checked against `prepareDocument` on the server. */
export function assignPages(doc: PrintDocument, request: PdfRequest):
  { ok: true; pages: PreparedPage[]; items: PreparedItem[] } | { ok: false; reason: string } {
  const firstAnswers = request.pages.findIndex((page) => page.kind === "answers");
  if (firstAnswers === 0) return { ok: false, reason: "answers before items" };
  if (firstAnswers > 0 && request.pages.slice(firstAnswers).some((page) => page.kind !== "answers")) return { ok: false, reason: "items after answers" };
  const itemPages = request.pages.filter((page) => page.kind === "items");
  const answerPages = request.pages.filter((page) => page.kind === "answers");
  const itemIds = itemPages.flatMap((page) => page.ids);
  const prepared = prepareDocument(doc.items, new Set(itemIds), request.settings);
  if (!same(prepared.items.map((item) => item.id), itemIds)) return { ok: false, reason: "item ids do not match the document" };
  if (request.settings.mode === "practice" && answerPages.length > 0) return { ok: false, reason: "answers in practice" };
  if (request.settings.mode === "selfTest" && !same(answerPages.flatMap((page) => page.ids), itemIds)) return { ok: false, reason: "answers do not match items" };
  const itemById = new Map(prepared.items.map((item) => [item.id, item]));
  const answerById = new Map(prepared.answers.map((answer) => [answer.id, answer]));
  const pages = request.pages.map((page): PreparedPage => (page.kind === "items"
    ? { kind: "items", items: page.ids.map((id) => itemById.get(id)!) }
    : { kind: "answers", answers: page.ids.map((id) => answerById.get(id)!) }));
  return { ok: true, pages, items: prepared.items };
}
```

```ts
// lib/vocabulary/print/pdf/jobs.ts
import "server-only";
import { randomBytes } from "node:crypto";
import type { RenderPayload } from "./request";

export interface RenderJob { userId: string; lessonId: string; payload: RenderPayload; expiresAt: number }

const TTL_MS = 60_000;
// globalThis, not a module variable: the route handler and the page bundle may hold separate module instances.
// ponytail: process-local — valid for the single long-running Node instance (AGENTS.md); a multi-instance deploy needs a shared store.
const store: Map<string, RenderJob> = ((globalThis as { __korumePrintJobs?: Map<string, RenderJob> }).__korumePrintJobs ??= new Map());

/** Spec W §6.3 step 3: a 256-bit single-use capability, valid for 60 seconds. */
export function createRenderJob(job: Omit<RenderJob, "expiresAt">, now = Date.now()): string {
  for (const [token, entry] of store) if (entry.expiresAt <= now) store.delete(token);
  const token = randomBytes(32).toString("base64url");
  store.set(token, { ...job, expiresAt: now + TTL_MS });
  return token;
}

/** Consumed on first read; unknown, used or expired → null. */
export function takeRenderJob(token: string, now = Date.now()): RenderJob | null {
  const job = store.get(token);
  store.delete(token);
  return job && job.expiresAt > now ? job : null;
}
```

(`jobs.test.ts` must mock `server-only`: add `vi.mock("server-only", () => ({}));` at its top.)

```ts
// lib/vocabulary/print/pdf/queue.ts
export class QueueFullError extends Error {}

/** Spec W §6.3 step 4: one task at a time; `maxPending` counts the running task plus the waiting ones. */
export function createQueue(maxPending: number) {
  let tail: Promise<unknown> = Promise.resolve();
  let pending = 0;
  return {
    run<T>(task: () => Promise<T>): Promise<T> {
      if (pending >= maxPending) return Promise.reject(new QueueFullError("print PDF queue is full"));
      pending += 1;
      const result = tail.then(task);
      tail = result.catch(() => undefined);
      return result.finally(() => { pending -= 1; });
    },
  };
}
```

```ts
// lib/vocabulary/print/pdf/renderer.ts
import "server-only";
import { chromium, type Browser } from "playwright";

export class PdfLayoutError extends Error {}
export class PdfUnavailableError extends Error {}

const TIMEOUT_MS = 30_000;
const IDLE_MS = 5 * 60_000;

/** Spec W §6.3: Chromium only ever talks to this origin. */
export function printOrigin(): string {
  return process.env.PRINT_PDF_ORIGIN ?? `http://127.0.0.1:${process.env.PORT ?? 3000}`;
}

let browser: Promise<Browser> | null = null;
let idle: ReturnType<typeof setTimeout> | undefined;

function launch(): Promise<Browser> {
  browser ??= chromium.launch().catch((error: unknown) => {
    browser = null;
    throw new PdfUnavailableError(error instanceof Error ? error.message : String(error));
  });
  return browser;
}

export function __resetBrowserForTests(): void {
  clearTimeout(idle);
  browser = null;
}

/** Spec W §6.3 steps 4–6: a fresh cookie-less context, print media, the render page's own ready signal, then A4 from CSS. */
export async function renderPdf(path: string): Promise<Buffer> {
  clearTimeout(idle);
  const origin = printOrigin();
  const context = await (await launch()).newContext({ viewport: { width: 1280, height: 900 } });
  try {
    await context.route("**/*", (route) => (new URL(route.request().url()).origin === origin ? route.continue() : route.abort()));
    const page = await context.newPage();
    await page.emulateMedia({ media: "print" });
    const response = await page.goto(`${origin}${path}`, { waitUntil: "load", timeout: TIMEOUT_MS });
    if (!response?.ok()) throw new Error(`render page answered ${response?.status() ?? "nothing"}`);
    const marker = await page.waitForSelector("[data-pdf-ready], [data-pdf-error]", { state: "attached", timeout: TIMEOUT_MS });
    if ((await marker.getAttribute("data-pdf-error")) !== null) throw new PdfLayoutError("a sheet overflowed in the PDF render");
    return await page.pdf({ preferCSSPageSize: true, printBackground: false });
  } finally {
    await context.close();
    idle = setTimeout(() => {
      const closing = browser;
      browser = null;
      void closing?.then((instance) => instance.close());
    }, IDLE_MS);
  }
}
```

```ts
// app/api/vocab/print/pdf/route.ts
import { errors } from "playwright";
import { getTranslations } from "@/lib/i18n/server";
import { rateLimit } from "@/lib/rate-limit";
import { authenticateSummary } from "@/lib/summary/load-snapshot";
import { contentDisposition, pdfFilename } from "@/lib/vocabulary/print/filename";
import { resolveLessonSource } from "@/lib/vocabulary/print/lesson-source";
import { createRenderJob } from "@/lib/vocabulary/print/pdf/jobs";
import { createQueue, QueueFullError } from "@/lib/vocabulary/print/pdf/queue";
import { PdfLayoutError, PdfUnavailableError, renderPdf } from "@/lib/vocabulary/print/pdf/renderer";
import { assignPages, pdfRequestSchema } from "@/lib/vocabulary/print/pdf/request";
import { loadPrintResources } from "@/lib/vocabulary/print/resources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LIMIT = { limit: 5, windowMs: 60_000 };
const queue: ReturnType<typeof createQueue> = ((globalThis as { __korumePrintQueue?: ReturnType<typeof createQueue> }).__korumePrintQueue ??= createQueue(5));
const status = (code: number, headers?: Record<string, string>) => new Response(null, { status: code, headers });

/** Spec W §6.3: a real PDF of exactly the committed pages, rendered by server Chromium; nothing from the client is trusted. */
export async function POST(request: Request): Promise<Response> {
  const auth = await authenticateSummary();
  if (!auth) return status(401);
  const limited = rateLimit(`print-pdf:${auth.userId}`, LIMIT);
  if (!limited.ok) return status(429, { "Retry-After": String(Math.ceil(limited.retryAfter / 1000)) });
  const parsed = pdfRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return status(400);
  const { lessonId, set, locale, settings } = parsed.data;
  const source = await resolveLessonSource({ source: { kind: "lesson", lessonId, set }, locale, userId: auth.userId, db: auth.supabase });
  if (source.kind !== "ok") return status(404);
  const assigned = assignPages(source.doc, parsed.data);
  if (!assigned.ok) return status(400);
  const resources = await loadPrintResources(assigned.items.flatMap((item) => (item.target ? [item.target] : [])));
  const token = createRenderJob({ userId: auth.userId, lessonId, payload: { locale, title: source.doc.title, settings, pages: assigned.pages, resources } });
  try {
    const pdf = await queue.run(() => renderPdf(`/${locale}/print-render/${token}`));
    const t = await getTranslations({ locale, namespace: "vocab.print" });
    const name = pdfFilename(settings.mode === "practice" ? t("docPractice") : t("docSelfTest"), source.doc.title);
    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: { "Content-Type": "application/pdf", "Content-Disposition": contentDisposition(name, settings.mode), "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof PdfLayoutError) return status(409);
    if (error instanceof QueueFullError) return status(503, { "Retry-After": "10" });
    if (error instanceof PdfUnavailableError) return status(503);
    if (error instanceof errors.TimeoutError) return status(504);
    throw error;
  }
}
```

Stroke resources: practice pages need guides for the targets; self-test needs none — `item.target` is absent there,
so the list is empty and no stroke query runs. The JMdict credit is still loaded.

`docs/ops/print-pdf.md`:

```markdown
# Print PDF (Tải PDF) — operations

`POST /api/vocab/print/pdf` renders the learner's worksheet with server-side Chromium (spec
`docs/superpowers/specs/2026-10-06-print-vocabulary-writing-worksheet-design.md` §6).

- **Dependency:** `playwright` (production `dependencies`, same version as `@playwright/test`).
- **Install the browser on every server**, after `npm ci`: `npx playwright install --with-deps chromium`.
  Without it the route answers 503 and `In` (browser print) still works.
- **`PRINT_PDF_ORIGIN`** (optional): the origin Chromium loads the render page from. Default
  `http://127.0.0.1:$PORT` (PORT defaults to 3000). Chromium aborts every request to any other origin.
- **Single instance:** render jobs and the queue live in the Node process (one render at a time, four waiting, 30s
  timeout, 5 PDFs per learner per minute). A multi-instance deploy needs a shared job store first.
- **Memory:** one browser; it closes after 5 idle minutes.
```

- [ ] **Step 5: Run** `npx vitest run lib/vocabulary/print app/api/vocab/print --minWorkers=1 --maxWorkers=2`, `npx tsc --noEmit`, `npm run lint` → green.

- [ ] **Step 6: Mutations** — (a) `assignPages` skips the `same(...)` item check → the unknown-id case goes red;
  (b) `takeRenderJob` stops deleting → the single-use test goes red; (c) the route handler builds the payload from
  `parsed.data.pages` text without `assignPages` → the forged-id 400 goes red; (d) the renderer's route handler
  continues every request → the foreign-origin test goes red. Restore; paste.

- [ ] **Step 7: Commit** — `feat(print): server PDF — validated render jobs, one-at-a-time Chromium, attachment response`.

---

### Task 9: Render page, `Tải PDF` in the workspace, registry row

**Files:**
- Create: `app/[locale]/print-render/[token]/page.tsx`, `components/vocabulary-print/pdf-render.tsx`
- Modify: `components/vocabulary-print/print-workspace.tsx`, `lib/product/screen-registry.ts`, `lib/supabase/route-protection.test.ts`, `messages/{vi,en}/vocab.json`
- Test: `components/vocabulary-print/pdf-render.test.tsx`, `app/[locale]/print-render/[token]/page.test.tsx`, `components/vocabulary-print/print-workspace.test.tsx`

**Interfaces:**
- Consumes: `takeRenderJob` (Task 8), `RenderPayload`, `Worksheet`, `useSheetLabels`, `pdfFilename`, `Committed`.
- Produces: `<PdfRender payload={RenderPayload} />` setting `data-pdf-ready` / `data-pdf-error` on `[data-print-root]`;
  `overflowing(root: ParentNode): boolean`.

- [ ] **Step 1: Copy** — add `download` (Tải PDF / Download PDF), `downloading` (Đang tạo PDF… / Creating the PDF…),
  `pdfBusy` (Máy chủ đang bận, hãy thử lại sau. / The server is busy — try again shortly.), `pdfChanged` (Bố cục vừa
  thay đổi, hãy thử lại. / The layout just changed — please try again.), `pdfFailed` (Không tạo được PDF. / Could not
  create the PDF.).

- [ ] **Step 2: Write the failing tests**

```tsx
// components/vocabulary-print/pdf-render.test.tsx
import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_WORKSHEET_SETTINGS } from "@/lib/vocabulary/print/settings";
import type { RenderPayload } from "@/lib/vocabulary/print/pdf/request";
import { overflowing, PdfRender } from "./pdf-render";

const payload: RenderPayload = {
  locale: "en", title: "T", settings: DEFAULT_WORKSHEET_SETTINGS,
  pages: [{ kind: "items", items: [{ id: "a", number: 1, cells: 1, target: "人", glyphs: ["人"] }] }],
  resources: { strokeGuides: {}, credits: { jmdict: null, kanjivg: null } },
};
afterEach(() => { vi.restoreAllMocks(); Reflect.deleteProperty(document, "fonts"); });

describe("PdfRender (spec W §6.3 step 5)", () => {
  it("renders exactly the payload pages into a body-level print root and marks it ready after fonts and images", async () => {
    let fontsDone!: () => void;
    Object.defineProperty(document, "fonts", { configurable: true, value: { ready: new Promise<void>((resolve) => { fontsDone = resolve; }) } });
    vi.spyOn(HTMLImageElement.prototype, "decode").mockResolvedValue(undefined);
    render(<PdfRender payload={payload} />);
    const root = () => document.body.querySelector(":scope > [data-print-root]");
    await waitFor(() => expect(root()?.querySelectorAll(".vp-sheet")).toHaveLength(1));
    expect(root()?.hasAttribute("data-pdf-ready")).toBe(false);
    fontsDone();
    await waitFor(() => expect(root()?.hasAttribute("data-pdf-ready")).toBe(true));
  });
  it("overflowing() is true when an item ends below its sheet's quote band", () => {
    document.body.innerHTML = '<section class="vp-sheet"><div class="vp-item"></div><div class="vp-quote"></div></section>';
    const rect = (top: number, bottom: number) => ({ top, bottom, height: bottom - top, left: 0, right: 0, width: 0, x: 0, y: top, toJSON: () => ({}) }) as DOMRect;
    vi.spyOn(document.querySelector(".vp-item")!, "getBoundingClientRect").mockReturnValue(rect(0, 120));
    vi.spyOn(document.querySelector(".vp-quote")!, "getBoundingClientRect").mockReturnValue(rect(100, 110));
    expect(overflowing(document)).toBe(true);
    vi.spyOn(document.querySelector(".vp-item")!, "getBoundingClientRect").mockReturnValue(rect(0, 100));
    expect(overflowing(document)).toBe(false);
  });
});
```

```tsx
// app/[locale]/print-render/[token]/page.test.tsx
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ notFound: vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); }) }));
vi.mock("@/lib/vocabulary/print/pdf/jobs", () => ({ takeRenderJob: vi.fn() }));
vi.mock("@/components/vocabulary-print/pdf-render", () => ({ PdfRender: () => null }));

import { takeRenderJob } from "@/lib/vocabulary/print/pdf/jobs";
import Page, { metadata } from "./page";

describe("print-render page (spec W §6.3 step 5)", () => {
  it("404s for an unknown, used or expired token, and for a job of another locale", async () => {
    vi.mocked(takeRenderJob).mockReturnValueOnce(null);
    await expect(async () => Page({ params: { locale: "vi", token: "x" } })).rejects.toThrow("NEXT_NOT_FOUND");
    vi.mocked(takeRenderJob).mockReturnValueOnce({ userId: "u", lessonId: "l", expiresAt: 1, payload: { locale: "en" } } as never);
    await expect(async () => Page({ params: { locale: "vi", token: "x" } })).rejects.toThrow("NEXT_NOT_FOUND");
  });
  it("passes only plain data to the client renderer, and is never indexed", async () => {
    const payload = { locale: "vi", title: "T", settings: {}, pages: [], resources: { strokeGuides: {}, credits: { jmdict: null, kanjivg: null } } };
    vi.mocked(takeRenderJob).mockReturnValueOnce({ userId: "u", lessonId: "l", expiresAt: 1, payload } as never);
    const element = await Page({ params: { locale: "vi", token: "x" } });
    expect(() => structuredClone(element.props.payload)).not.toThrow();
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });
});
```

Route protection (append to `lib/supabase/route-protection.test.ts`):

```ts
it("leaves the PDF render target public: the single-use token is its capability (spec W §6.3 step 5)", () => {
  expect(isProtectedPath("/print-render/abc")).toBe(false);
});
```

Workspace additions (append to `print-workspace.test.tsx`):

```tsx
it("Download PDF posts the committed ids and settings, then saves the returned file", async () => {
  const fetchMock = vi.fn(async () => new Response(new Blob(["%PDF-1.7"]), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  const createObjectURL = vi.fn(() => "blob:x");
  Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
  render(<PrintWorkspace doc={doc(items(3))} views={views} source={source} resources={resources} />);
  await screen.findByText("3/3 words · 1 page");
  fireEvent.click(screen.getByRole("button", { name: "Download PDF" }));
  await waitFor(() => expect(click).toHaveBeenCalled());
  const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe("/api/vocab/print/pdf");
  expect(JSON.parse(init.body as string)).toEqual({
    lessonId: "L", set: "all", locale: "en", settings: expect.objectContaining({ mode: "practice" }),
    pages: [{ kind: "items", ids: ["i-0", "i-1", "i-2"] }],
  });
});

it("keeps Download PDF busy while a request runs, even if the selection changes (Review Focus 3)", async () => {
  let respond!: (response: Response) => void;
  vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => { respond = resolve; })));
  render(<PrintWorkspace doc={doc(items(2))} views={views} source={source} resources={resources} />);
  await screen.findByText("2/2 words · 1 page");
  fireEvent.click(screen.getByRole("button", { name: "Download PDF" }));
  expect(await screen.findByRole("button", { name: "Creating the PDF…" })).toHaveAttribute("aria-disabled", "true");
  fireEvent.click(screen.getAllByRole("checkbox")[0]!);
  fireEvent.click(screen.getByRole("button", { name: "Creating the PDF…" }));
  expect(fetch).toHaveBeenCalledTimes(1);
  respond(new Response(null, { status: 503 }));
  expect(await screen.findByText("The server is busy — try again shortly.")).toBeInTheDocument();
});

it("disables both actions until a page set is committed", async () => {
  vi.mocked(mascotReady).mockImplementation(() => new Promise(() => undefined));
  render(<PrintWorkspace doc={doc(items(2))} views={views} source={source} resources={resources} />);
  expect(screen.getByRole("button", { name: "Download PDF" })).toHaveAttribute("aria-disabled", "true");
  expect(printButton()).toHaveAttribute("aria-disabled", "true");
});
```

(If the toast primitive needs `ToastProvider`, wrap the render in it as `@/test/render` already may — check
`test/render.tsx`; the busy-message assertion reads the toast text.)

- [ ] **Step 3: Run** the four test files → FAIL.

- [ ] **Step 4: Implement**

```tsx
// components/vocabulary-print/pdf-render.tsx
"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { RenderPayload } from "@/lib/vocabulary/print/pdf/request";
import { useSheetLabels } from "./labels";
import { Worksheet } from "./worksheet";

/** True when any item or answer ends below its own sheet's quote band (spec W §6.3 step 5). */
export function overflowing(root: ParentNode): boolean {
  return [...root.querySelectorAll(".vp-sheet")].some((sheet) => {
    const limit = sheet.querySelector(".vp-quote")?.getBoundingClientRect().top;
    if (limit === undefined) return false;
    return [...sheet.querySelectorAll(".vp-item, .vp-answer")].some((unit) => unit.getBoundingClientRect().bottom > limit + 0.5);
  });
}

/** The PDF render target: exactly the payload's pages, the same print root as `In`, no measuring, no paginating. */
export function PdfRender({ payload }: { payload: RenderPayload }) {
  const labels = useSheetLabels(payload.settings.mode, payload.title);
  const [portal, setPortal] = useState<HTMLElement | null>(null);
  const [state, setState] = useState<"rendering" | "ready" | "error">("rendering");

  useEffect(() => setPortal(document.body), []);

  useEffect(() => {
    if (!portal) return;
    let live = true;
    void (async () => {
      const root = document.querySelector<HTMLElement>("[data-print-root]");
      root?.getBoundingClientRect(); // force layout, so every glyph's font slice is requested before fonts.ready
      await (document as Document & { fonts?: FontFaceSet }).fonts?.ready;
      await Promise.all([...(root?.querySelectorAll("img") ?? [])].map((image) => image.decode().catch(() => undefined)));
      if (live) setState(root && overflowing(root) ? "error" : "ready");
    })();
    return () => { live = false; };
  }, [portal]);

  if (!portal) return null;
  return createPortal(
    <div data-print-root="" data-pdf-ready={state === "ready" ? "" : undefined} data-pdf-error={state === "error" ? "" : undefined}>
      <Worksheet pages={payload.pages} settings={payload.settings} labels={labels} resources={payload.resources} />
    </div>,
    portal,
  );
}
```

```tsx
// app/[locale]/print-render/[token]/page.tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PdfRender } from "@/components/vocabulary-print/pdf-render";
import { takeRenderJob } from "@/lib/vocabulary/print/pdf/jobs";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Spec W §6.3 step 5: the server Chromium's target. No session — the single-use token is the capability. No database read. */
export default async function PrintRenderPage({ params }: { params: { locale: string; token: string } }) {
  const job = takeRenderJob(params.token);
  if (!job || job.payload.locale !== params.locale) notFound();
  return <PdfRender payload={job.payload} />;
}
```

Registry row in `lib/product/screen-registry.ts` (next to `vocab-print`):

```ts
  // Internal render target for the server-side PDF (print spec W §6.3); never navigated to by a learner.
  {
    screenId: "print-render",
    name: "Print — PDF render target",
    kind: "repo-only",
    variantOf: null,
    figmaNodeId: null,
    repoOnlyReason: "out-of-design-scope",
    figmaCheckedAt: null,
    route: "/print-render/[token]",
    chrome: null,
    impl: "built",
    navGroup: null,
    navOrder: null,
    specRef: null,
  },
```

Workspace (`print-workspace.tsx`): add `useLocale` (from `@/lib/i18n`), `useToast` (from `@/components/ui/toast`),
`pdfFilename` (from `@/lib/vocabulary/print/filename`), state `const [downloading, setDownloading] = useState(false);`,
remove any `void source;`, and:

```tsx
const locale = useLocale();
const { toast } = useToast();
const download = async () => {
  if (blocked || downloading || !committed) return;
  setDownloading(true);
  const pages = committed.pages.map((page) => (page.kind === "items"
    ? { kind: "items" as const, ids: page.items.map((item) => item.id) }
    : { kind: "answers" as const, ids: page.answers.map((answer) => answer.id) }));
  try {
    const response = await fetch("/api/vocab/print/pdf", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lessonId: source.lessonId, set: source.set, locale, settings: committed.settings, pages }),
    });
    if (!response.ok) {
      const key = response.status === 409 ? "pdfChanged" : response.status === 429 || response.status === 503 ? "pdfBusy" : "pdfFailed";
      toast({ title: t(key), variant: "danger" });
      return;
    }
    const url = URL.createObjectURL(await response.blob());
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = pdfFilename(committedLabels.documentName, doc.title);
    anchor.click();
    URL.revokeObjectURL(url);
  } catch {
    toast({ title: t("pdfFailed"), variant: "danger" });
  } finally {
    setDownloading(false);
  }
};
```

and the action row becomes (primary first, then `In`):

```tsx
<div className="sticky bottom-0 mt-auto flex gap-sm bg-background pt-sm">
  <Button className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50" aria-disabled={blocked || downloading || undefined} onClick={() => void download()}>
    {downloading ? t("downloading") : t("download")}
  </Button>
  <Button variant="outline" className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50" aria-disabled={blocked || undefined} onClick={() => { if (!blocked) window.print(); }}>
    {t("print")}
  </Button>
</div>
```

`committed.pages` is read at click time, so a later selection change cannot alter the request (Review Focus 3).

- [ ] **Step 5: Run** `npx vitest run components/vocabulary-print "app/[locale]/print-render" lib/supabase lib/product messages --minWorkers=1 --maxWorkers=2`, `npx tsc --noEmit`, `npm run lint` → green.

- [ ] **Step 6: Mutations** — (a) `PdfRender` sets ready before `fonts.ready` → the first test goes red; (b) the page
  skips the locale check → the cross-locale 404 goes red; (c) `download()` reads the live `prepared` instead of
  `committed` → the body assertion or the busy test goes red; (d) drop `downloading` from `aria-disabled` → the busy
  test goes red. Restore; paste.

- [ ] **Step 7: Commit** — `feat(print): Download PDF from the committed pages; cookie-less render target`.

---

### Task 10: Browser acceptance (Playwright)

**Files:**
- Modify: `tests/e2e/print-vocabulary.spec.ts`, `tests/e2e/fixtures/print-data.ts`
- Create: `tests/e2e/fixtures/pdf-text.ts`

**Interfaces:**
- Consumes: the DOM contract of Task 6, the workspace copy (en): status `/words ·/`, buttons `Print`, `Download PDF`,
  radio `Self-test`, switch `Include kana-only words`.

- [ ] **Step 1: Fixture** — in `print-data.ts`, make line 0 contain two printed nouns so self-test masking crosses
  items: change the `text_jp` mapping to
  ``index === 0 ? "これは学校の先生の話です。" : `これは${noun}の話です。` ``. Update its doc comment.

- [ ] **Step 2: PDF text helper**

```ts
// tests/e2e/fixtures/pdf-text.ts
import { inflateSync } from "node:zlib";

/** Every Flate stream of a PDF, inflated and concatenated (latin1). Chrome writes ToUnicode CMaps as `<gid> <UTF-16BE hex>`. */
export function pdfStreams(pdf: Buffer): string {
  const raw = pdf.toString("latin1");
  let text = "";
  for (const match of raw.matchAll(/stream\r?\n/g)) {
    const start = (match.index ?? 0) + match[0].length;
    const end = raw.indexOf("endstream", start);
    try { text += inflateSync(Buffer.from(raw.slice(start, end), "latin1")).toString("latin1"); } catch { /* not Flate */ }
  }
  return text;
}

export const pdfPageCount = (pdf: Buffer) => (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
/** A code point as it appears in a ToUnicode CMap. */
export const cmapHex = (char: string) => `<${char.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}>`;
```

Prove the helper before relying on it: in the first new test, call `pdfStreams` on the client `page.pdf()` buffer
(test 1 already makes one) and assert it contains `cmapHex("学")` — that is the positive control; if it fails, inspect
one inflated CMap and adjust the helper (e.g. lowercase hex) before writing the download test.

- [ ] **Step 3: Update the existing tests 1–10** to the new DOM: the print button is `Print`; test 1's crossing
  check compares each `.vp-item` bottom with its sheet's `.vp-quote` top; test 10 compares measure-tree heights for
  roles `item`, `first-header`, `quote`, `footer` with the print root's `.vp-item`, `.vp-head-first`, `.vp-quote`,
  `.vp-foot-block` heights (match items by `data-item-id`). Keep each test's intent.

- [ ] **Step 4: Add tests 11–16**

```ts
test("11 · practice: each item shows its stroke guide, then the black model, the grey trace, then blank groups", async ({ page }) => {
  await learner(page);
  await open(page);
  const items = await page.evaluate(() => [...document.querySelectorAll("[data-print-root] .vp-item")].map((item) => ({
    target: item.querySelector(".vp-word")?.textContent ?? "",
    guides: item.querySelectorAll("svg.vp-guide").length,
    numbers: item.querySelectorAll(".vp-guide-number").length,
    model: [...(item.querySelector(".vp-group")?.querySelectorAll(".vp-model") ?? [])].map((cell) => cell.textContent).join(""),
    trace: item.querySelectorAll(".vp-group:nth-child(2) .vp-trace").length,
    blanks: [...item.querySelectorAll(".vp-group")].slice(2).every((group) => group.textContent === ""),
  })));
  expect(items.length).toBeGreaterThan(0);
  for (const item of items) {
    expect(item.guides).toBe([...item.target].length); // seeded nouns are all kanji, every one in KanjiVG
    expect(item.numbers).toBeGreaterThan(0);
    expect(item.model).toBe(item.target);
    expect(item.trace).toBe([...item.target].length);
    expect(item.blanks).toBe(true);
  }
});

test("12 · self-test: no printed answer appears anywhere on item pages; the answer key is last", async ({ page }) => {
  await learner(page);
  await open(page);
  await page.getByRole("radio", { name: "Self-test" }).click();
  await expect(page.locator("[data-print-root] .vp-answer").first()).toBeAttached({ timeout: 30_000 });
  const result = await page.evaluate(() => {
    const sheets = [...document.querySelectorAll("[data-print-root] .vp-sheet")];
    const answerSheets = sheets.filter((sheet) => sheet.querySelector(".vp-answers-title"));
    const itemSheets = sheets.filter((sheet) => !sheet.querySelector(".vp-answers-title"));
    const answers = answerSheets.flatMap((sheet) => [...sheet.querySelectorAll(".vp-answer-target")].map((el) => el.textContent ?? ""));
    const bodies = itemSheets.map((sheet) => sheet.querySelector(".vp-body")?.textContent ?? "");
    return {
      answers, lastIsAnswers: sheets.at(-1) === answerSheets.at(-1),
      leaks: answers.filter((answer) => bodies.some((body) => body.includes(answer))),
      revealing: itemSheets.some((sheet) => sheet.querySelector(".vp-guide, .vp-trace, .vp-model, .vp-word")),
      crossMasked: bodies.some((body) => body.includes("＿＿の＿＿")),
    };
  });
  expect(result.answers.length).toBeGreaterThan(1);
  expect(result.lastIsAnswers).toBe(true);
  expect(result.leaks).toEqual([]);
  expect(result.revealing).toBe(false);
  expect(result.crossMasked).toBe(true); // line 0: 学校 and 先生 both printed answers (fixture)
});

test("13 · a repetition is atomic: every group sits on one row line", async ({ page }) => {
  await learner(page);
  await open(page);
  await page.emulateMedia({ media: "print" });
  const split = await page.evaluate(() => [...document.querySelectorAll("[data-print-root] .vp-group")].filter((group) => {
    const tops = [...group.querySelectorAll(".vp-cell")].map((cell) => Math.round(cell.getBoundingClientRect().top));
    return new Set(tops).size > 1;
  }).length);
  expect(split).toBe(0);
});

test("14 · identity: watermark centred on every sheet, quote band at one height, data credit on every footer", async ({ page }) => {
  await learner(page);
  await open(page);
  await page.emulateMedia({ media: "print" });
  const sheets = await page.evaluate(() => [...document.querySelectorAll("[data-print-root] .vp-sheet")].map((sheet) => {
    const box = sheet.getBoundingClientRect();
    const mark = sheet.querySelector(".vp-watermark img")!.getBoundingClientRect();
    return {
      dx: Math.abs(mark.left + mark.width / 2 - (box.left + box.width / 2)),
      quoteTop: sheet.querySelector(".vp-quote")!.getBoundingClientRect().top - box.top,
      credit: sheet.querySelector(".vp-credit")?.textContent ?? "",
      opacity: Number(getComputedStyle(sheet.querySelector(".vp-watermark")!).opacity),
    };
  }));
  expect(sheets.length).toBeGreaterThan(1);
  for (const sheet of sheets) {
    expect(sheet.dx).toBeLessThan(1);
    expect(sheet.quoteTop).toBeCloseTo(sheets[0]!.quoteTop, 0);
    expect(sheet.credit).toContain("JMdict");
    expect(sheet.opacity).toBeLessThanOrEqual(0.06);
  }
});

test("15 · Download PDF: a real PDF file, one page per sheet, with the lesson's kanji as text", async ({ page }) => {
  await learner(page);
  await open(page);
  const { sheets } = await geometry(page);
  const [download] = await Promise.all([page.waitForEvent("download", { timeout: 60_000 }), page.getByRole("button", { name: "Download PDF" }).click()]);
  expect(download.suggestedFilename()).toMatch(/^Korume - Vocabulary Writing Practice - .+\.pdf$/);
  const pdf = await readFile((await download.path())!);
  expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  expect(pdfPageCount(pdf)).toBe(sheets);
  expect(pdfStreams(pdf).toUpperCase()).toContain(cmapHex("学"));
});

test("16 · the PDF route rejects a forged id and a missing session", async ({ page, playwright }) => {
  await learner(page);
  const body = { lessonId: lesson.videoId, set: "all", locale: "en",
    settings: { mode: "practice", density: "airy", includeKanaOnly: false, showReading: true, showMeaning: true, showExample: true },
    pages: [{ kind: "items", ids: ["lex-1:forged"] }] };
  expect((await page.request.post("/api/vocab/print/pdf", { data: body })).status()).toBe(400);
  const anonymous = await playwright.request.newContext({ baseURL: page.url().replace(/\/en\/.*$/, "") });
  expect((await anonymous.post("/api/vocab/print/pdf", { data: body })).status()).toBe(401);
  await anonymous.dispose();
});
```

Imports at the top of the spec: `import { readFile } from "node:fs/promises";` and
`import { cmapHex, pdfPageCount, pdfStreams } from "./fixtures/pdf-text";`. Reuse `geometry`'s `sheets` from the print
root, read under screen media before the download (the preview and print root hold the same commit).

- [ ] **Step 5: Run** (Docker Desktop running, `npx supabase start` done, nothing else on :3000):
  `$env:AI_PROVIDER='none'; npx playwright test tests/e2e/print-vocabulary.spec.ts --workers=1` → all pass. Then
  `tests/e2e/lesson-summary*.spec.ts` (the Summary launcher) the same way.

- [ ] **Step 6: Mutations** (each run against the single spec, `--workers=1`):
  (a) self-test `maskText` returns the text unmasked → test 12 red; (b) `WritingRows` uses one flex-wrap row of all
  groups instead of explicit rows, with `flex-wrap: wrap` on `.vp-row` → test 13 red; (c) `.vp-watermark` `inset: 0
  auto auto 0` → test 14 red; (d) the route returns `page.pdf()` of an empty page (render path `/vi/print-render/x`) →
  test 15 red. Restore; paste raw output.

- [ ] **Step 7: Commit** — `test(e2e): writing worksheet, self-test no-leak, atomic groups, identity and real PDF download`.

---

### Task 11: Gates, docs, owner review

**Files:**
- Modify: `docs/superpowers/run-state/print-vocabulary.md`, `docs/lessons.md`, the spec's amendments section if
  execution changed anything (`docs/superpowers/specs/2026-10-06-print-vocabulary-writing-worksheet-design.md`)

- [ ] **Step 1: Full gates**

```powershell
npx tsc --noEmit; if ($?) { npm run lint }
npx vitest run --minWorkers=1 --maxWorkers=2
$env:AI_PROVIDER='none'; npx playwright test --workers=1
npm run verify:protocol
```

All exit 0; keep the output. A failure outside the print/summary specs is re-run in isolation twice; accept only if it
passes both isolated runs and the branch does not touch its code (record each in the run state, as on Task 10 of the
first plan).

- [ ] **Step 2: Whole-branch review** — `code-reviewer` on `git diff 22226d9...print-vocabulary` with both specs; fix
  every Critical and Important test-first; re-run Step 1.

- [ ] **Step 3: Owner Chrome + paper review** — from the worktree: `npx next build`, then `npx next start -p 3000`
  (absolute paths; nothing else on :3000). Hand the owner:
  - `/vi/vocab/print?source=lesson&lesson=ba522023-8eba-4929-924f-35ae69eacf99&set=all` (Ep.729) in **Luyện viết**
    and **Tự kiểm tra**, both densities, the kana toggle;
  - a **Tải PDF** download and an **In** printout on real paper: stroke-guide numbers legible, 12mm cells writable,
    trace light but visible, watermark faint, quote band and credit readable in grayscale;
  - the self-test answer key at the end.

- [ ] **Step 4: Docs + commit** — run state rewritten with the gate output (the validator needs `# Branch Run
  State`, the `- Owner:` line and its fixed sections — copy the structure of the current file); lessons merged into
  `docs/lessons.md` under its entry rules (no counts); commit
  `docs(run-state): writing worksheet gates recorded; awaiting the owner's Chrome and paper review`.

Merge `--no-ff` only after the owner approves.
