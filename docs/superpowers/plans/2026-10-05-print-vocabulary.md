# Print Vocabulary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the shared lexical resolver (人 → ひと, no ん, honest meanings) and ship a generic `/vocab/print` workspace that prints a lesson's vocabulary as Korume-branded A4 pages.

**Architecture:** A pure resolver (`lib/analysis/lexical-resolver.ts`) replaces first-JMdict-entry selection for every caller. A server source adapter turns a lesson into `VocabularyPrintItem[]`; a client workspace measures items in a hidden tree, paginates them greedily into fixed A4 sheets, and renders the committed page set twice — scaled in the preview, unscaled in a `<body>`-level print root.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Tailwind + `app/globals.css`, next-intl, kuromoji, Supabase, Vitest + Testing Library (jsdom), Playwright (Chromium).

**Spec:** `docs/superpowers/specs/2026-10-05-print-vocabulary-design.md` (approved and frozen, `921bca1`). Read it before any task.

## Global Constraints

- Worktree `.worktrees/print-vocabulary`; every command runs there with absolute paths. Never build or serve in the main checkout (it shares `.next` with the owner's dev server).
- `node_modules` is a junction to `.worktrees/verify-db-erasure/node_modules`; do not `npm install`.
- Vitest runs with `--minWorkers=1 --maxWorkers=2` (15.8 GB machine). Never run vitest and Playwright at the same time.
- E2E runs with `AI_PROVIDER=none`. Playwright builds into this worktree's `.next`; stop any `next start` on :3000 first.
- No migration. No new npm dependency.
- Print never triggers AI (P8). Print never reads `word_gloss_vi` (P6). `meaningSource` is `"curated" | "canonical-vocab" | "jmdict"` — no `ai-cache`.
- Every value crossing server → client is a plain DTO: check with `assertPlainSerializableDto` (`test/dto.ts`) **and** a `JSON.parse(JSON.stringify(x))` round-trip.
- Paper: 210 × 297 mm, margin 14 mm, sizes in `mm` / `pt` only, paper palette fixed (`#111` on `#fff`), Japanese spans carry `lang="ja"`.
- Copy lives in `messages/{en,vi}/vocab.json` under `"print"`; both locales get the same keys (`lib/i18n/catalog.test.ts` enforces it).
- Comments follow the repo idiom: one line on *why*, cite the spec section (`spec §3.4`).
- Each task ends green: `npx tsc --noEmit`, `npx next lint --dir <touched dirs>`, and the task's vitest files; commit with the attribution line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Tests are written first and must be seen RED for the stated reason before the implementation.

## Review Focus

1. **A lesson with no eligible word** (all kana chatter, or nothing saved): `/vocab/print` shows the empty state with the adapter's back link, never a blank A4 sheet — pinned in Task 5 (source) and Task 8 (workspace).
2. **The learner deselects every word:** the count reads `0/N`, Print is disabled, the preview shows the empty message, `paginate([])` returns `[]` — pinned in Task 8.
3. **A very long lesson title without spaces** (a pasted URL-like title): it wraps inside the header (`overflow-wrap: anywhere`), the first-page capacity shrinks, nothing overflows the sheet — pinned in Task 9 e2e.
4. **Leaving the page while a measurement is in flight:** no state update after unmount, no console error — pinned in Task 8 (unmount bumps the generation).
5. **A saved card whose transcript line was deleted** (`transcript_line_id` set null, or the line gone): the item prints `saved_raw` without an example, and the workspace counts it in the "could not resolve" notice — pinned in Task 5.

---

## File map

| File | Responsibility |
|---|---|
| `lib/japanese/kana.ts` (new) | `katakanaToHiragana`, moved out of `furigana.ts` so client-safe code can import it without kuromoji |
| `lib/japanese/tokenizer.ts`, `lib/japanese/types.ts` | `Token.posDetail1` |
| `lib/analysis/lexical-resolver.ts` (new) | pure: `resolveLexeme`, `entriesFor`, eligibility predicates, `EntryRow`, `VocabRow` |
| `lib/analysis/meaning.ts` (new) | pure, client-safe: `meaningFor`, `Meaning` types |
| `lib/analysis/line-analysis.ts` | batched DB reads; calls the resolver; memo key carries `LEXICAL_RESOLVER_VERSION` |
| `lib/analysis/types.ts` | `AnalysisToken.posDetail1/curatedVi`, `LessonVocabularyItem.curatedVi` |
| `lib/analysis/lesson-vocabulary.ts` | strict eligibility in `aggregateVocabulary` |
| `lib/summary/analysis/{hydrate,service,view}.ts` | hydration from the resolved token; `WordView.meaningLocale/meaningSource` |
| `lib/summary/word-list.ts`, `components/lesson-summary/{word-list,analysis-blocks}.tsx` | locale-aware rows, `EN` chip, "In từ vựng" launcher |
| `lib/vocabulary/print/source.ts` (new) | `PrintSource`, `VocabularyPrintItem`, `PrintDocument`, query parsing |
| `lib/vocabulary/print/lesson-source.ts` (new) | the Lesson adapter (server) |
| `lib/vocabulary/print/load.ts` (new) | session → adapter dispatch, `cache()`d per request |
| `lib/vocabulary/print/paper.ts`, `paginate.ts`, `settings.ts`, `mascot.ts` (new) | paper geometry, pure pagination, settings type, mascot decode |
| `components/vocabulary-print/print-sheets.tsx` (new) | presentational sheets + item (no ids, no controls) |
| `components/vocabulary-print/print-workspace.tsx` (new) | controls, measurement, commit lifecycle, preview scale, print portal |
| `app/[locale]/(protected)/(app)/vocab/print/page.tsx` (new) | route, metadata, `notFound()` |
| `app/globals.css` | `.vp-*` paper styles and the scoped print rules |
| `tests/e2e/print-vocabulary.spec.ts`, `tests/e2e/fixtures/print-data.ts` (new) | Chrome print/PDF checks |

**Three spec refinements this plan makes** (flag them in the Task 10 report; they tighten, not change, the design):
- §4.1 / §4.2 — the isolation rule and `@page` are **scoped to the print page**: `body:has(> [data-print-root]) > :not([data-print-root])` and a named page `@page vocab-sheet`. Unscoped, a global `body > :not([data-print-root])` would blank the printout of every other app page, and a global `@page { margin: 0 }` would change their margins.
- §2.3 — the Lesson adapter reads the analysis through `analysisStatusForReflection` (`lib/summary/analysis/service.ts:182`), which is documented "Never generates" and reuses the lines and analyses `loadLessonSummary` already loaded, instead of `requestLessonAnalysis(…, "read")`, which would reload the transcript and spend the read rate limit. Same P8 guarantee; the test pins that `requestLessonAnalysis` is never called.
- §8 "the analysis fingerprint changes with the resolver version" is pinned as "changes when the resolver changes the candidate set" — a lesson whose candidates did not change keeps its analysis, which is the R5 lazy behaviour.

---

### Task 1: Pure lexical resolver

**Files:**
- Create: `lib/japanese/kana.ts`, `lib/analysis/lexical-resolver.ts`, `lib/analysis/lexical-resolver.test.ts`
- Modify: `lib/japanese/furigana.ts` (import + re-export `katakanaToHiragana`), `lib/japanese/types.ts`, `lib/japanese/tokenizer.ts:47-56`, `lib/japanese/tokenizer.test.ts`

**Interfaces:**
- Produces:
  - `katakanaToHiragana(input: string): string` from `@/lib/japanese/kana`
  - `Token.posDetail1: string | null`
  - `EntryRow`, `VocabRow`, `ResolverToken`, `EligibilityToken`, `ReadingMatch`, `ResolvedLexeme`
  - `resolveLexeme(token: ResolverToken, entries: EntryRow[], vocabRows?: VocabRow[]): ResolvedLexeme | null`
  - `entriesFor(base: string, surface: string, entries: EntryRow[]): DictionaryMatch[]`
  - `isAutomaticLookupEligible(token: EligibilityToken): boolean`, `isLessonVocabularyEligible(token: EligibilityToken): boolean`
  - `LEXICAL_RESOLVER_VERSION = 1`

- [ ] **Step 1: Move the kana helper**

Create `lib/japanese/kana.ts` with the body of `katakanaToHiragana` cut from `lib/japanese/furigana.ts:12-28` (constants `KATAKANA_START`, `KATAKANA_END`, `HIRAGANA_OFFSET` and the function, unchanged). In `furigana.ts` replace the cut block with:

```ts
import { katakanaToHiragana } from "./kana";
export { katakanaToHiragana };
```

(keep `lib/japanese/index.ts` exporting it from `./furigana` — nothing else changes). Run `npx vitest run lib/japanese --minWorkers=1 --maxWorkers=2` → PASS (pure move).

- [ ] **Step 2: Write the failing tokenizer test**

Append to `lib/japanese/tokenizer.test.ts` (it already runs the real kuromoji):

```ts
it("reports kuromoji's pos_detail_1, which separates a dependent ん from a content noun (spec §1.2)", async () => {
  const tokens = await tokenize("話すんです");
  expect(tokens.find((token) => token.surface === "ん")).toMatchObject({ pos: "名詞", posDetail1: "非自立", base: "ん" });
  expect(tokens.find((token) => token.surface === "話す")).toMatchObject({ pos: "動詞", posDetail1: "自立" });
  expect((await tokenize("です"))[0]?.posDetail1).toBeNull(); // kuromoji's "*"
});
```

Run `npx vitest run lib/japanese/tokenizer.test.ts --minWorkers=1 --maxWorkers=2` → FAIL (`posDetail1` undefined).

- [ ] **Step 3: Add `posDetail1`**

`lib/japanese/types.ts` — `Token` gains:

```ts
  /** kuromoji's pos_detail_1 (非自立, 接尾, 数, …); null for "*". */
  posDetail1: string | null;
```

`lib/japanese/tokenizer.ts` `toToken` returns, after `pos: feature.pos,`:

```ts
    posDetail1: feature.pos_detail_1 && feature.pos_detail_1 !== "*" ? feature.pos_detail_1 : null,
```

Run the test → PASS. Run `npx tsc --noEmit` and fix any object literal typed `Token` in tests by adding `posDetail1: null`.

- [ ] **Step 4: Write the failing resolver tests**

Create `lib/analysis/lexical-resolver.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  entriesFor, isAutomaticLookupEligible, isLessonVocabularyEligible, resolveLexeme, type EntryRow, type VocabRow,
} from "./lexical-resolver";

const entry = (ent_seq: number, kanji: string[], kana: string[], gloss: string, common = true): EntryRow =>
  ({ ent_seq, kanji_forms: kanji, kana_forms: kana, senses: [{ gloss: [gloss] }], common, jlpt: null });

// 人: the suffix entry has the lower ent_seq and is common — exactly what the old first-entry rule picked.
const JIN = entry(2000, ["人"], ["じん"], "-ian");
const HITO = entry(3000, ["人"], ["ひと"], "person");
const NIN = entry(4000, ["人"], ["にん"], "counter for people", false);
const HANASU = entry(5000, ["話す"], ["はなす"], "to speak");
const HANASHI = entry(5100, ["話"], ["はなし"], "talk; story");
const IKU = entry(6000, ["行く", "逝く"], ["いく", "ゆく"], "to go");
const YOMU = entry(7000, ["読む"], ["よむ"], "to read");
const HOMOPHONE = entry(5200, ["放す"], ["はなす"], "to let go");

describe("resolveLexeme — contextual reading (spec §1.3–§1.5)", () => {
  it("picks ひと for 人 read ヒト, though the suffix entry じん ranks first without a reading", () => {
    const resolved = resolveLexeme({ surface: "人", base: "人", reading: "ヒト" }, [JIN, HITO, NIN]);
    expect(resolved?.matches[0]).toMatchObject({ entSeq: 3000, headword: "人", reading: "ひと", glossEn: "person" });
    expect(resolved?.readingMatch).toBe("exact");
    expect(entriesFor("人", "人", [JIN, HITO, NIN])[0]?.entSeq).toBe(2000); // reading-less callers: today's ranking
  });

  it("stem-matches inflected verbs and shows the dictionary-form kana", () => {
    const hanashi = resolveLexeme({ surface: "話し", base: "話す", reading: "ハナシ" }, [HANASU, HANASHI]);
    expect(hanashi?.matches[0]).toMatchObject({ entSeq: 5000, reading: "はなす" });
    expect(hanashi?.readingMatch).toBe("stem");
    expect(resolveLexeme({ surface: "行っ", base: "行く", reading: "イッ" }, [IKU])?.matches[0]?.reading).toBe("いく");
    expect(resolveLexeme({ surface: "読ん", base: "読む", reading: "ヨン" }, [YOMU])?.matches[0]?.reading).toBe("よむ");
  });

  it("ranks an exact reading above a stem reading", () => {
    // 話し read はなし: one candidate matches the reading exactly, the other only by stem (はなす → はな).
    const stem = entry(8000, ["話す"], ["はなす"], "stem match", true);
    const exact = entry(8100, ["話す"], ["はなし"], "exact match", false);
    const resolved = resolveLexeme({ surface: "話し", base: "話す", reading: "ハナシ" }, [stem, exact]);
    expect(resolved?.matches.map((match) => match.entSeq)).toEqual([8100, 8000]);
    expect(resolved?.readingMatch).toBe("exact");
  });

  it("never lets a right-reading homophone with another headword beat the token's own written form", () => {
    const resolved = resolveLexeme({ surface: "話す", base: "話す", reading: "ハナス" }, [HOMOPHONE, HANASU]);
    expect(resolved?.matches.map((match) => match.entSeq)).toEqual([5000]);
  });

  it("does not stem-resolve a kana-only irregular and falls back to the headword ranking", () => {
    const suru = entry(9000, [], ["する"], "to do");
    const resolved = resolveLexeme({ surface: "し", base: "する", reading: "シ" }, [suru]);
    expect(resolved?.readingMatch).toBe("fallback");
    expect(resolved?.matches[0]?.reading).toBe("する");
  });
});

describe("resolveLexeme — vocab join (spec §1.7)", () => {
  const vocab = (id: string, word: string, reading: string | null, meaning_vi: string | null): VocabRow => ({ id, word, reading, meaning_vi });

  it("joins (headword, resolved reading) and carries the curated Vietnamese meaning", () => {
    const resolved = resolveLexeme({ surface: "人", base: "人", reading: "ヒト" }, [JIN, HITO], [
      vocab("v-jin", "人", "じん", "người (nước)"), vocab("v-hito", "人", "ひと", "người"),
    ]);
    expect(resolved).toMatchObject({ vocabId: "v-hito", curatedVi: "người" });
  });

  it("gives the same word with two readings two vocab ids, never cross-attached", () => {
    const rows = [vocab("v-jin", "人", "じん", "người (nước)"), vocab("v-hito", "人", "ひと", "người")];
    expect(resolveLexeme({ surface: "人", base: "人", reading: "ジン" }, [JIN, HITO], rows)?.vocabId).toBe("v-jin");
    expect(resolveLexeme({ surface: "人", base: "人", reading: "ヒト" }, [JIN, HITO], rows)?.vocabId).toBe("v-hito");
  });

  it("attaches nothing on a fallback reading of a multi-reading entry, even when one vocab row has the word", () => {
    const resolved = resolveLexeme({ surface: "行く", base: "行く", reading: null }, [IKU], [vocab("v-iku", "行く", "いく", "đi")]);
    expect(resolved?.readingMatch).toBe("fallback");
    expect(resolved).toMatchObject({ vocabId: null, curatedVi: null });
  });

  it("attaches on a fallback reading when the entry has a single kana form", () => {
    const resolved = resolveLexeme({ surface: "読む", base: "読む", reading: null }, [YOMU], [vocab("v-yomu", "読む", "よむ", "đọc")]);
    expect(resolved).toMatchObject({ vocabId: "v-yomu", curatedVi: "đọc" });
  });

  it("resolves with vocabId and curatedVi null when the caller passes no vocab rows (Ask Korume)", () => {
    expect(resolveLexeme({ surface: "人", base: "人", reading: "ヒト" }, [HITO])).toMatchObject({ vocabId: null, curatedVi: null });
  });
});

describe("eligibility (spec §1.6)", () => {
  const t = (pos: string, posDetail1: string | null, base: string) => ({ pos, posDetail1, base });

  it("keeps ん, the dependent いる and しまう out of automatic lookup and out of lesson vocabulary", () => {
    for (const token of [t("名詞", "非自立", "ん"), t("動詞", "非自立", "いる"), t("動詞", "非自立", "しまう")]) {
      expect(isAutomaticLookupEligible(token)).toBe(false);
      expect(isLessonVocabularyEligible(token)).toBe(false);
    }
  });

  it("keeps a useful dependent noun (こと) in the popup but out of the lists", () => {
    expect(isAutomaticLookupEligible(t("名詞", "非自立", "こと"))).toBe(true);
    expect(isLessonVocabularyEligible(t("名詞", "非自立", "こと"))).toBe(false);
  });

  it("keeps suffixes and numbers in the popup (アメリカ人's 人 is right there) but out of the lists", () => {
    for (const token of [t("名詞", "接尾", "人"), t("名詞", "数", "三")]) {
      expect(isAutomaticLookupEligible(token)).toBe(true);
      expect(isLessonVocabularyEligible(token)).toBe(false);
    }
  });

  it("lists ordinary content words and never particles or auxiliaries", () => {
    expect(isLessonVocabularyEligible(t("名詞", "一般", "人"))).toBe(true);
    expect(isLessonVocabularyEligible(t("名詞", "形容動詞語幹", "苦手"))).toBe(true);
    expect(isLessonVocabularyEligible(t("動詞", "自立", "話す"))).toBe(true);
    expect(isAutomaticLookupEligible(t("助詞", "格助詞", "が"))).toBe(false);
    expect(isAutomaticLookupEligible(t("助動詞", null, "です"))).toBe(false);
  });
});
```

Run `npx vitest run lib/analysis/lexical-resolver.test.ts --minWorkers=1 --maxWorkers=2` → FAIL (module not found).

- [ ] **Step 5: Implement the resolver**

Create `lib/analysis/lexical-resolver.ts`:

```ts
import { katakanaToHiragana } from "@/lib/japanese/kana";
import type { DictionaryMatch } from "./types";

/**
 * Spec §1: one lexical resolution for every caller — the Shadowing popup, lesson vocabulary, Summary candidates and
 * hydration, Ask Korume and Print. Pure: the callers read the database in batches and pass the rows in.
 */
export const LEXICAL_RESOLVER_VERSION = 1;

export interface EntryRow {
  ent_seq: number;
  kanji_forms: string[];
  kana_forms: string[];
  senses: { gloss?: string[] }[];
  common: boolean;
  jlpt: number | null;
}

export interface VocabRow {
  id: string;
  word: string;
  reading: string | null;
  meaning_vi: string | null;
}

export interface ResolverToken {
  surface: string;
  base: string;
  /** Katakana as kuromoji reports it, or null (unknown word, or a caller with no sentence context). */
  reading: string | null;
}

export interface EligibilityToken {
  pos: string;
  posDetail1: string | null;
  base: string;
}

export type ReadingMatch = "exact" | "stem" | "fallback";

export interface ResolvedLexeme {
  /** At most three, best first; `matches[0]` is the resolution. */
  matches: DictionaryMatch[];
  readingMatch: ReadingMatch;
  vocabId: string | null;
  curatedVi: string | null;
}

const ENTRIES_PER_TOKEN = 3;
const CONTENT_POS = new Set(["名詞", "動詞", "形容詞", "副詞", "連体詞", "感動詞", "接続詞"]);
/** Spec §1.6: never in a lesson's word list. */
const NOT_LISTED = new Set(["非自立", "接尾", "数"]);
/** Spec §1.6: dependent uses whose dictionary entry misleads (ん "yes; yeah", しまう "to put away"). */
const NO_LOOKUP = [
  { pos: "名詞", posDetail1: "非自立", base: "ん" },
  { pos: "動詞", posDetail1: "非自立", base: "いる" },
  { pos: "動詞", posDetail1: "非自立", base: "しまう" },
];
const QUALITY: Record<ReadingMatch, number> = { exact: 0, stem: 1, fallback: 2 };
const KANA = /[ぁ-ゖァ-ヺー]/;

export function isAutomaticLookupEligible(token: EligibilityToken): boolean {
  return CONTENT_POS.has(token.pos)
    && !NO_LOOKUP.some((rule) => rule.pos === token.pos && rule.posDetail1 === token.posDetail1 && rule.base === token.base);
}

export function isLessonVocabularyEligible(token: EligibilityToken): boolean {
  return CONTENT_POS.has(token.pos) && !(token.posDetail1 !== null && NOT_LISTED.has(token.posDetail1));
}

function trailingKana(text: string): number {
  let count = 0;
  for (let index = text.length - 1; index >= 0 && KANA.test(text[index] ?? ""); index -= 1) count += 1;
  return count;
}

/** Spec §1.4: exact reading, else the stems once each side's own okurigana is cut, else the legacy first kana form. */
function readingOf(entry: EntryRow, token: ResolverToken): { kind: ReadingMatch; kana: string } {
  const fallback = { kind: "fallback" as const, kana: entry.kana_forms[0] ?? "" };
  if (!token.reading) return fallback;
  const reading = katakanaToHiragana(token.reading);
  const exact = entry.kana_forms.find((kana) => katakanaToHiragana(kana) === reading);
  if (exact) return { kind: "exact", kana: exact };
  if (token.surface === token.base) return fallback;
  const stem = reading.slice(0, reading.length - trailingKana(token.surface));
  if (stem === "") return fallback;
  const cut = trailingKana(token.base);
  const hit = entry.kana_forms.find((kana) => {
    const hiragana = katakanaToHiragana(kana);
    return hiragana.slice(0, hiragana.length - cut) === stem;
  });
  return hit ? { kind: "stem", kana: hit } : fallback;
}

function toMatch(entry: EntryRow, form: string, kana: string): DictionaryMatch {
  return {
    entSeq: entry.ent_seq,
    headword: entry.kanji_forms.includes(form) ? form : entry.kanji_forms[0] ?? entry.kana_forms[0] ?? form,
    reading: kana,
    glossEn: (entry.senses[0]?.gloss ?? []).slice(0, 3).join("; "),
    jlpt: entry.jlpt,
  };
}

/**
 * Base form first, then surface. Every candidate carries the form (the headword match); among them: exact reading,
 * stem reading, none — then a written (kanji) match, common words, ent_seq.
 */
export function resolveLexeme(token: ResolverToken, entries: EntryRow[], vocabRows: VocabRow[] = []): ResolvedLexeme | null {
  for (const form of [token.base, token.surface]) {
    const ranked = entries
      .filter((entry) => entry.kanji_forms.includes(form) || entry.kana_forms.includes(form))
      .map((entry) => ({ entry, reading: readingOf(entry, token) }))
      .sort((a, b) =>
        QUALITY[a.reading.kind] - QUALITY[b.reading.kind] ||
        Number(b.entry.kanji_forms.includes(form)) - Number(a.entry.kanji_forms.includes(form)) ||
        Number(b.entry.common) - Number(a.entry.common) ||
        a.entry.ent_seq - b.entry.ent_seq);
    const best = ranked[0];
    if (!best) continue;
    const matches = ranked.slice(0, ENTRIES_PER_TOKEN).map(({ entry, reading }) => toMatch(entry, form, reading.kana));
    // Spec §1.7: a fallback reading of a multi-reading entry is a guess; vocab data never confirms it.
    const unambiguous = best.reading.kind !== "fallback" || best.entry.kana_forms.length === 1;
    const resolved = matches[0];
    const vocab = unambiguous && resolved
      ? vocabRows.find((row) => row.word === resolved.headword && row.reading !== null
        && katakanaToHiragana(row.reading) === katakanaToHiragana(resolved.reading))
      : undefined;
    return { matches, readingMatch: best.reading.kind, vocabId: vocab?.id ?? null, curatedVi: vocab?.meaning_vi?.trim() || null };
  }
  return null;
}

/** Reading-less lookup (Ask Korume's dictionary and exposure tools): today's ranking, unchanged. */
export function entriesFor(base: string, surface: string, entries: EntryRow[]): DictionaryMatch[] {
  return resolveLexeme({ surface, base, reading: null }, entries)?.matches ?? [];
}
```

Run the resolver tests → PASS.

- [ ] **Step 6: Mutation check**

Temporarily change `QUALITY` to `{ exact: 0, stem: 0, fallback: 0 }` → the 人, exact-vs-stem and stem tests must FAIL. Change `const unambiguous = …` to `true` → the fallback test must FAIL. Restore both (keep the restore in a `<file>.mutbak` beside the file, never in `/tmp`). Re-run → PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/japanese lib/analysis/lexical-resolver.ts lib/analysis/lexical-resolver.test.ts
git commit -m "feat(analysis): pure lexical resolver — contextual reading, POS eligibility, safe vocab join"
```

---

### Task 2: `staticAnalyses` runs on the resolver

**Files:**
- Modify: `lib/analysis/types.ts:20-31`, `lib/analysis/line-analysis.ts:16-120,145-176`, `lib/analysis/line-analysis.test.ts`

**Interfaces:**
- Consumes: Task 1 (`resolveLexeme`, `entriesFor`, `isAutomaticLookupEligible`, `EntryRow`, `VocabRow`, `LEXICAL_RESOLVER_VERSION`).
- Produces: `AnalysisToken.posDetail1: string | null`, `AnalysisToken.curatedVi: string | null`; `entries[0]` is the resolved entry with the resolved reading. `line-analysis.ts` still exports `entriesFor`, `lookupForms`, `EntryRow` (re-exported) so `lib/korume/tools/*` need no change.

- [ ] **Step 1: Write the failing tests**

In `lib/analysis/line-analysis.test.ts`, change the `vocab` table mock to carry a reading and a curated meaning:

```ts
      vocab: () => ({ data: [{ id: "v-taberu", word: "食べる", reading: "たべる", meaning_vi: "ăn" }], error: null }),
```

Update the existing expectation in "tokenizes with UTF-16 spans…" to also assert:

```ts
    expect(tabe).toMatchObject({ posDetail1: "自立", curatedVi: "ăn" });
    // しまっ is 動詞/非自立 (spec §1.6): no popup, though 仕舞う shares its kana.
    expect(tokens.find((token) => token.surface === "しまっ")?.entries).toEqual([]);
```

Append a new `describe`:

```ts
describe("staticAnalyses on the shared resolver (spec §1)", () => {
  const HITO = { ent_seq: 3000, kanji_forms: ["人"], kana_forms: ["ひと"], senses: [{ gloss: ["person"] }], common: true, jlpt: 5 };
  const JIN = { ent_seq: 2000, kanji_forms: ["人"], kana_forms: ["じん"], senses: [{ gloss: ["-ian"] }], common: true, jlpt: null };
  const N_YES = { ent_seq: 1000, kanji_forms: [], kana_forms: ["ん"], senses: [{ gloss: ["yes", "yeah"] }], common: true, jlpt: null };

  function useDictionary(rows: unknown[], vocab: unknown[] = []) {
    vi.mocked(createClient).mockReturnValue(createMockSupabase({
      user: { id: "u-a" },
      tables: {
        dict_entries: (calls) => {
          const overlap = calls.find((call) => call.op === "overlaps");
          const forms = overlap?.op === "overlaps" ? (overlap.values as string[]) : [];
          const column = overlap?.op === "overlaps" ? (overlap.column as "kanji_forms" | "kana_forms") : "kanji_forms";
          return { data: (rows as { kanji_forms: string[]; kana_forms: string[] }[]).filter((row) => row[column].some((form) => forms.includes(form))), error: null };
        },
        vocab: () => ({ data: vocab, error: null }),
      },
    }) as ReturnType<typeof createClient>);
  }

  it("resolves 人 in 苦手な人 to ひと and never looks ん up", async () => {
    useDictionary([JIN, HITO, N_YES], [{ id: "v-hito", word: "人", reading: "ひと", meaning_vi: "người" }]);
    const analyses = await staticAnalyses(createClient(), [{ id: "l-1", textJp: "苦手な人について話すんです" }], undefined, "lexical");
    const tokens = analyses.get("l-1")?.tokens ?? [];
    expect(tokens.find((token) => token.surface === "人")).toMatchObject({
      entries: [expect.objectContaining({ entSeq: 3000, reading: "ひと" }), expect.objectContaining({ entSeq: 2000 })],
      vocabId: "v-hito", curatedVi: "người",
    });
    expect(tokens.find((token) => token.surface === "ん")).toMatchObject({ posDetail1: "非自立", entries: [], vocabId: null });
  });

  it("does not attach a vocab row of the same word with another reading", async () => {
    useDictionary([JIN, HITO], [{ id: "v-jin", word: "人", reading: "じん", meaning_vi: "người (nước)" }]);
    const tokens = (await staticAnalyses(createClient(), [{ id: "l-2", textJp: "苦手な人" }], undefined, "lexical")).get("l-2")?.tokens ?? [];
    expect(tokens.find((token) => token.surface === "人")).toMatchObject({ vocabId: null, curatedVi: null });
  });
});
```

Run `npx vitest run lib/analysis/line-analysis.test.ts --minWorkers=1 --maxWorkers=2` → FAIL (`posDetail1`, `curatedVi` missing; 人 resolves to 2000; ん looked up).

- [ ] **Step 2: Extend the token DTO**

`lib/analysis/types.ts` `AnalysisToken`, after `pos: string;`:

```ts
  /** kuromoji's pos_detail_1; drives lookup and list eligibility (spec §1.6). */
  posDetail1: string | null;
```

and after `vocabId`:

```ts
  /** `vocab.meaning_vi` when (headword, reading) matched unambiguously (spec §1.7); never an AI gloss. */
  curatedVi: string | null;
```

- [ ] **Step 3: Rewire `line-analysis.ts`**

1. Delete `CONTENT_POS`, `ENTRIES_PER_TOKEN`, the local `EntryRow` interface, `toMatch` and `entriesFor`. Add:

```ts
import {
  LEXICAL_RESOLVER_VERSION, isAutomaticLookupEligible, resolveLexeme, type EntryRow, type VocabRow,
} from "./lexical-resolver";

export { entriesFor, type EntryRow } from "./lexical-resolver";
```

2. Memo key (spec §1.10):

```ts
  const keyOf = (line: LineText) =>
    `${scope}|r${LEXICAL_RESOLVER_VERSION}|${line.id}|${snapshotId ?? "none"}|${grammar?.revision ?? ""}|${line.textJp}`;
```

3. Replace the lookup block (from `const content = …` through the `vocabByWord` line) with:

```ts
  const content = tokenized.flatMap(({ tokens }) => tokens).filter(isAutomaticLookupEligible);
  const forms = [...new Set(content.flatMap((token) => [token.base, token.surface]))];
  const entries = snapshotId && forms.length > 0 ? await lookupForms(supabase, snapshotId, forms) : [];
  const headwords = [...new Set([...forms, ...entries.flatMap((entry) => entry.kanji_forms)])];
  // Spec §1.7: the (word, reading) join happens in the resolver, so every candidate headword's rows come back.
  const vocab = await fetchByIdChunks(headwords, async (chunk) => {
    const { data, error } = await supabase.from("vocab").select("id, word, reading, meaning_vi").in("word", chunk);
    if (error) throw error;
    return (data ?? []) as VocabRow[];
  });
```

4. In the token map, replace the `lookedUp` / `matches` lines and the returned object with:

```ts
      const resolved = isAutomaticLookupEligible(token) ? resolveLexeme(token, entries, vocab) : null;
      return {
        index,
        surface: token.surface,
        base: token.base,
        reading: token.reading,
        pos: token.pos,
        posDetail1: token.posDetail1,
        span: token.span,
        entries: resolved?.matches ?? [],
        vocabId: resolved?.vocabId ?? null,
        curatedVi: resolved?.curatedVi ?? null,
      };
```

5. `lookupForms` keeps its signature; its return type is now the imported `EntryRow`.

Run the line-analysis tests → PASS. Run `npx vitest run lib/korume lib/analysis --minWorkers=1 --maxWorkers=2` → PASS (Korume tools import `entriesFor`/`lookupForms` from `line-analysis` unchanged). Run `npx tsc --noEmit`; fix every `AnalysisToken` literal in tests (`grep -rln "vocabId:" --include=*.test.ts* lib components`) by adding `posDetail1: null, curatedVi: null`.

- [ ] **Step 4: Mutation check**

Replace `isAutomaticLookupEligible(token)` in the token map with `true` → the ん and しまっ assertions FAIL. Restore → PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/analysis lib/korume components test
git commit -m "fix(analysis): line analysis resolves by contextual reading; ん no longer looked up"
```

---

### Task 3: Lesson vocabulary, Summary candidates and hydration on the resolver

**Files:**
- Create: `lib/analysis/meaning.ts`, `lib/analysis/meaning.test.ts`
- Modify: `lib/analysis/types.ts` (`LessonVocabularyItem`), `lib/analysis/lesson-vocabulary.ts:28-45`, `lib/analysis/lesson-vocabulary.test.ts`, `lib/summary/analysis/view.ts` (`WordView`), `lib/summary/analysis/hydrate.ts`, `lib/summary/analysis/hydrate.test.ts`, `lib/summary/analysis/service.ts:39-70,136,192`, `lib/summary/analysis/input.test.ts` (or `service.test.ts` if the fingerprint test lives there), every `WordView` fixture (`components/lesson-summary/summary-island.test.tsx`, `lib/summary/word-list.test.ts`, `lib/summary/reflection/prompt.test.ts`, `tests/e2e/fixtures/summary-data.ts`)

**Interfaces:**
- Consumes: Task 2 tokens (`posDetail1`, `curatedVi`, resolved `entries[0]`); `isLessonVocabularyEligible`.
- Produces:
  - `meaningFor(lexeme: { glossEn: string; curatedVi: string | null }, locale: string): Meaning`
  - `type MeaningLocale = "vi" | "en"`, `type MeaningSource = "curated" | "canonical-vocab" | "jmdict"`, `interface Meaning { meaning; meaningLocale; meaningSource }`
  - `LessonVocabularyItem.curatedVi: string | null`
  - `WordView.meaningLocale: MeaningLocale`, `WordView.meaningSource: MeaningSource`
  - `hydrateAnalysis(supabase, stored, lines, analyses: Map<string, { tokens: AnalysisToken[] }>, locale: KnowledgeLocale)`

- [ ] **Step 1: Write the failing meaning tests**

`lib/analysis/meaning.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { meaningFor } from "./meaning";

describe("meaningFor (spec §1.8, P6)", () => {
  it("serves the curated Vietnamese meaning in vi", () => {
    expect(meaningFor({ glossEn: "person", curatedVi: "người" }, "vi")).toEqual({ meaning: "người", meaningLocale: "vi", meaningSource: "curated" });
  });
  it("falls back to JMdict English, labelled en, when vi has no curated meaning", () => {
    expect(meaningFor({ glossEn: "person", curatedVi: null }, "vi")).toEqual({ meaning: "person", meaningLocale: "en", meaningSource: "jmdict" });
  });
  it("never returns the Vietnamese meaning to an en learner", () => {
    expect(meaningFor({ glossEn: "person", curatedVi: "người" }, "en")).toEqual({ meaning: "person", meaningLocale: "en", meaningSource: "jmdict" });
  });
});
```

Run → FAIL (module missing).

- [ ] **Step 2: Implement `meaning.ts`**

```ts
/** Spec §1.8: client-safe — no kuromoji, no database. Line analysis stays locale-free; each consumer calls this. */
export type MeaningLocale = "vi" | "en";
/** No `ai-cache` member (P6): an AI gloss never reaches a list or a printout. `canonical-vocab` is reserved. */
export type MeaningSource = "curated" | "canonical-vocab" | "jmdict";

export interface Meaning {
  meaning: string;
  meaningLocale: MeaningLocale;
  meaningSource: MeaningSource;
}

export function meaningFor(lexeme: { glossEn: string; curatedVi: string | null }, locale: string): Meaning {
  if (locale === "vi" && lexeme.curatedVi) return { meaning: lexeme.curatedVi, meaningLocale: "vi", meaningSource: "curated" };
  return { meaning: lexeme.glossEn, meaningLocale: "en", meaningSource: "jmdict" };
}
```

Run → PASS. Mutation: drop the `locale === "vi" &&` guard → the en test FAILS; restore.

- [ ] **Step 3: Write the failing aggregate test**

In `lib/analysis/lesson-vocabulary.test.ts`, extend the `token()` helper to accept eligibility and a curated meaning:

```ts
function token(entSeq: number | null, vocabId: string | null = null, posDetail1: string | null = "一般", curatedVi: string | null = null): AnalysisToken {
  return {
    index: 0, surface: "x", base: "x", reading: null, pos: entSeq === null ? "助詞" : "名詞", posDetail1, span: { start: 0, end: 1 },
    entries: entSeq === null ? [] : [{ entSeq, headword: `w${entSeq}`, reading: "よみ", glossEn: `g${entSeq}`, jlpt: null }],
    vocabId, curatedVi,
  };
}
```

and add:

```ts
describe("aggregateVocabulary eligibility (spec §1.6)", () => {
  it("lists no dependent noun, suffix or number, and carries the curated meaning", () => {
    const items = aggregateVocabulary([{ id: "l-1", tokens: [
      token(10, "v-10", "一般", "mưa"), token(40, null, "非自立"), token(50, null, "接尾"), token(60, null, "数"),
    ] }]);
    expect(items.map((item) => [item.entSeq, item.curatedVi])).toEqual([[10, "mưa"]]);
  });
});
```

Run → FAIL (40, 50, 60 listed; `curatedVi` missing).

- [ ] **Step 4: Implement**

`lib/analysis/types.ts` `LessonVocabularyItem` gains, after `vocabId`:

```ts
  /** Curated Vietnamese meaning of the resolved (headword, reading), or null (spec §1.7). */
  curatedVi: string | null;
```

`lib/analysis/lesson-vocabulary.ts`:

```ts
import { isLessonVocabularyEligible } from "./lexical-resolver";
import type { AnalysisToken, LessonVocabularyItem, LessonVocabularyPage } from "./types";
```

change the parameter type to `lines: { id: string; tokens: AnalysisToken[] }[]`, and at the top of the token loop:

```ts
      if (!isLessonVocabularyEligible(token)) continue;
      const entry = token.entries[0];
      if (!entry) continue;
```

and add `curatedVi: token.curatedVi,` to the new item literal plus `item.curatedVi ??= token.curatedVi;` next to `item.vocabId ??= token.vocabId;`. Update the doc comment's first line to "Every list-eligible content word of the lesson (spec §1.6), aggregated by its resolved JMdict entry". Run → PASS.

- [ ] **Step 5: Write the failing hydration tests**

Read `lib/summary/analysis/hydrate.test.ts` first and keep its fixture helpers. Change every `hydrateAnalysis(supabase(), STORED, LINES)` call to `hydrateAnalysis(supabase(), STORED, LINES, ANALYSES, "en")`, where `ANALYSES` is built next to `LINES`:

```ts
// The resolved token each stored word points at (spec §1.9): same surface, entries[0] = the stored entSeq.
const ANALYSES = new Map<string, { tokens: AnalysisToken[] }>();
for (const word of STORED.words) {
  const tokens = ANALYSES.get(word.sourceLineId)?.tokens ?? [];
  tokens.push({
    index: tokens.length, surface: word.surface, base: word.surface, reading: null, pos: "名詞", posDetail1: "一般",
    span: { start: 0, end: word.surface.length },
    entries: [{ entSeq: word.entSeq, headword: `resolved-${word.entSeq}`, reading: `よみ${word.entSeq}`, glossEn: `gloss-${word.entSeq}`, jlpt: null }],
    vocabId: null, curatedVi: word.entSeq === STORED.words[0]?.entSeq ? "nghĩa" : null,
  });
  ANALYSES.set(word.sourceLineId, { tokens });
}
```

and add:

```ts
  it("takes written, reading and meaning from the resolved token, never kana_forms[0] (spec §1.9)", async () => {
    const view = await hydrateAnalysis(supabase(), STORED, LINES, ANALYSES, "vi");
    const first = STORED.words[0]!;
    expect(view.words[0]).toMatchObject({
      written: `resolved-${first.entSeq}`, reading: `よみ${first.entSeq}`, meaning: "nghĩa", meaningLocale: "vi", meaningSource: "curated",
    });
    expect(view.words[1]).toMatchObject({ meaningLocale: "en", meaningSource: "jmdict" });
  });

  it("drops a stored word whose line no longer resolves to its entSeq", async () => {
    const stale = new Map([...ANALYSES].map(([lineId, analysis]) => [lineId, { tokens: analysis.tokens.map((token) => ({ ...token, entries: [] })) }]));
    expect((await hydrateAnalysis(supabase(), STORED, LINES, stale, "en")).words).toEqual([]);
  });
```

(If `STORED` has fewer than two words, add a second word to it, on a second line in `LINES`, before these tests.) Run → FAIL.

- [ ] **Step 6: Implement hydration**

`lib/summary/analysis/view.ts`: `import type { MeaningLocale, MeaningSource } from "@/lib/analysis/meaning";` and add to `WordView` after `meaning: string;`:

```ts
  meaningLocale: MeaningLocale;
  meaningSource: MeaningSource;
```

`lib/summary/analysis/hydrate.ts`: new imports `import type { AnalysisToken } from "@/lib/analysis/types";`, `import { meaningFor } from "@/lib/analysis/meaning";`, `import type { KnowledgeLocale } from "@/lib/knowledge/types";`; signature:

```ts
export async function hydrateAnalysis(
  supabase: ReturnType<typeof createClient>,
  stored: StoredAnalysis,
  lines: SummaryLine[],
  analyses: Map<string, { tokens: AnalysisToken[] }>,
  locale: KnowledgeLocale,
): Promise<LessonAnalysisView> {
```

and the `words` mapping becomes:

```ts
    words: stored.words.flatMap((word) => {
      const entry = entries.get(word.entSeq);
      const source = ref(word.sourceLineId);
      // Spec §1.9: the resolved token on the source line, never kanji_forms[0] / kana_forms[0].
      const token = analyses.get(word.sourceLineId)?.tokens
        .find((candidate) => candidate.surface === word.surface && candidate.entries[0]?.entSeq === word.entSeq);
      const lexeme = token?.entries[0];
      if (!entry || !source || !token || !lexeme) return [];
      const sense = entry.senses[0];
      return [{
        entSeq: word.entSeq, surface: word.surface, written: lexeme.headword, reading: lexeme.reading,
        ...meaningFor({ glossEn: lexeme.glossEn, curatedVi: token.curatedVi }, locale),
        posKey: posKey(sense?.pos?.[0]), jlpt: entry.jlpt === null ? null : `N${entry.jlpt}`, common: entry.common,
        whyItMatters: word.whyItMatters, usageNote: word.usageNote, source,
      }];
    }),
```

`lib/summary/analysis/service.ts`:
- `Context`'s ok branch gains `analyses: Map<string, StaticLineAnalysis>`; `loadContext` returns `{ kind: "ok", title: video.title, lines, analyses, ...analysisKey(videoId, locale, lines, analyses) }`.
- line 136: `data: await hydrateAnalysis(auth.supabase, storedAnalysisSchema.parse(content), ctx.lines, ctx.analyses, locale),`
- line 192: `const view = await hydrateAnalysis(lesson.supabase, storedAnalysisSchema.parse(state.content), lesson.lines, lesson.analyses, locale);`

Add `meaningLocale: "en", meaningSource: "jmdict"` to every `WordView` fixture listed under **Files**. Run `npx vitest run lib/summary lib/analysis components/lesson-summary --minWorkers=1 --maxWorkers=2` → PASS; `npx tsc --noEmit` → 0.

- [ ] **Step 7: Pin the fingerprint behaviour**

In the test file that covers `analysisFingerprint` / `buildAnalysisInput` (`grep -rn "analysisFingerprint" lib/summary --include=*.test.ts`), add:

```ts
it("changes the analysis fingerprint when the resolver changes the candidate set (spec §1.10)", () => {
  const line = { id: "l-1", textJp: "話すんです" };
  const tok = (surface: string, posDetail1: string, entSeq: number): AnalysisToken => ({
    index: 0, surface, base: surface, reading: null, pos: "名詞", posDetail1, span: { start: 0, end: surface.length },
    entries: [{ entSeq, headword: surface, reading: surface, glossEn: "", jlpt: null }], vocabId: null, curatedVi: null,
  });
  const before = buildAnalysisInput([line], new Map([["l-1", { lineId: "l-1", snapshotId: "s", grammar: [], tokens: [tok("話す", "自立", 1), tok("ん", "自立", 2)] }]]));
  const after = buildAnalysisInput([line], new Map([["l-1", { lineId: "l-1", snapshotId: "s", grammar: [], tokens: [tok("話す", "自立", 1), tok("ん", "非自立", 2)] }]]));
  expect(after.vocabulary.map((item) => item.entSeq)).toEqual([1]);
  expect(analysisFingerprint(after)).not.toBe(analysisFingerprint(before));
});
```

Run → PASS (eligibility in `aggregateVocabulary` already drops ん; this pins it).

- [ ] **Step 8: Commit**

```bash
git add lib components tests/e2e/fixtures/summary-data.ts
git commit -m "fix(summary): candidates and hydration use the resolved lexeme; meanings state locale and source"
```

---

### Task 4: Summary UI — locale-aware Words, EN chip, print launcher

**Files:**
- Modify: `lib/summary/word-list.ts`, `lib/summary/word-list.test.ts`, `components/lesson-summary/word-list.tsx`, `components/lesson-summary/analysis-blocks.tsx:77-90,134-160`, `components/lesson-summary/summary-island.test.tsx`, `messages/en/shadowing.json`, `messages/vi/shadowing.json` (`lessonSummary.words`)

**Interfaces:**
- Consumes: `meaningFor`, `Meaning` (Task 3); `WordView.meaningLocale/meaningSource`; `LessonVocabularyItem.curatedVi`.
- Produces:
  - `type LessonWord = Pick<LessonVocabularyItem, "entSeq" | "headword" | "reading" | "glossEn" | "curatedVi" | "exampleLineIds" | "exampleSurface">`
  - `wordRows(aiWords: WordView[], lessonWords: LessonWord[] | null, locale: string, max?: number): WordRow[]`
  - `WordRow` gains `meaningLocale`, `meaningSource`
  - `printHref(videoId: string): string` from `lib/summary/word-list.ts` → `/vocab/print?source=lesson&lesson=<id>&set=all`

- [ ] **Step 1: Write the failing tests**

`lib/summary/word-list.test.ts`: add `meaningLocale: "en", meaningSource: "jmdict"` to `ai()`, `curatedVi: null` to `lesson()`, pass `"en"` as the third argument of every existing `wordRows(…)` call (the cap call becomes `wordRows([ai(1)], many, "en")`), and add:

```ts
  it("gives lesson rows a locale-aware meaning: curated vi, else JMdict English labelled en", () => {
    const curated = { ...lesson(3), curatedVi: "mưa" };
    expect(wordRows([], [curated, lesson(4)], "vi").map((row) => [row.meaning, row.meaningLocale, row.meaningSource]))
      .toEqual([["mưa", "vi", "curated"], ["g4", "en", "jmdict"]]);
    expect(wordRows([], [curated], "en")[0]).toMatchObject({ meaning: "g3", meaningLocale: "en" });
  });

  it("builds the print launcher link for a lesson", () => {
    expect(printHref("v-1")).toBe("/vocab/print?source=lesson&lesson=v-1&set=all");
  });
```

(import `printHref`). In `components/lesson-summary/summary-island.test.tsx` give the fixture's first word `meaning: "đặt hàng", meaningLocale: "vi", meaningSource: "curated"` and the second `meaningLocale: "en", meaningSource: "jmdict"`, then add inside `describe("SummaryIsland")`:

```tsx
  it("labels an English fallback meaning EN and links the lesson's print page", async () => {
    stubFetch({ [`GET ${ANALYSIS}`]: [{ status: "ready", data: view }], [`GET ${REFLECTION}`]: [{ state: "ready", reflection }] });
    render(<SummaryIsland {...props} />);
    await flush();
    expect(within(area("words")).getAllByText("EN")).toHaveLength(1); // 温かい only; 注文 is curated vi
    expect(within(area("words")).getByRole("link", { name: "Print vocabulary" }))
      .toHaveAttribute("href", "/vocab/print?source=lesson&lesson=v-1&set=all");
  });

  it("offers the print link even when the analysis is unavailable (Print needs no AI)", async () => {
    stubFetch({ [`GET ${ANALYSIS}`]: [{ status: "unavailable" }], [`GET ${REFLECTION}`]: [{ state: "ready", reflection }] });
    render(<SummaryIsland {...props} />);
    await flush();
    expect(within(area("words")).getByRole("link", { name: "Print vocabulary" })).toBeInTheDocument();
  });
```

Run `npx vitest run lib/summary/word-list.test.ts components/lesson-summary --minWorkers=1 --maxWorkers=2` → FAIL.

- [ ] **Step 2: Implement `word-list.ts`**

```ts
import { meaningFor, type MeaningLocale, type MeaningSource } from "@/lib/analysis/meaning";
import type { LessonVocabularyItem } from "@/lib/analysis/types";
```

```ts
export type LessonWord = Pick<LessonVocabularyItem, "entSeq" | "headword" | "reading" | "glossEn" | "curatedVi" | "exampleLineIds" | "exampleSurface">;

export interface WordRow {
  key: string;
  written: string;
  reading: string;
  meaning: string;
  meaningLocale: MeaningLocale;
  meaningSource: MeaningSource;
  /** The line a save attaches to, and the word saved. */
  lineId: string;
  targetWord: string;
}

/** Spec §2.5: Summary's launcher; Print owns the route, Summary only links to it. */
export function printHref(videoId: string): string {
  return `/vocab/print?source=lesson&lesson=${videoId}&set=all`;
}
```

`wordRows(aiWords: WordView[], lessonWords: LessonWord[] | null, locale: string, max = WORD_LIST_MAX)`: the AI row literal adds `meaningLocale: word.meaningLocale, meaningSource: word.meaningSource`; the lesson row literal becomes

```ts
    const row = {
      key: `lesson-${item.entSeq}`, written: item.headword, reading: item.reading,
      ...meaningFor({ glossEn: item.glossEn, curatedVi: item.curatedVi }, locale), lineId, targetWord: item.exampleSurface,
    };
```

- [ ] **Step 3: Implement the UI**

`messages/en/shadowing.json` `lessonSummary.words` gains `"englishMeaning": "EN", "englishMeaningLabel": "English meaning — no Vietnamese meaning yet", "print": "Print vocabulary"`; `messages/vi/shadowing.json` gains `"englishMeaning": "EN", "englishMeaningLabel": "Nghĩa tiếng Anh — chưa có nghĩa tiếng Việt", "print": "In từ vựng"`.

`components/lesson-summary/word-list.tsx`: `import { useLocale, useTranslations } from "@/lib/i18n";`, `const locale = useLocale();`, call `wordRows(words, lessonWords, locale)`, and render the meaning cell as:

```tsx
                <span className="line-clamp-2 text-body sm:line-clamp-1" title={row.meaning}>
                  {row.meaning}
                  {row.meaningLocale === "en" && <EnglishChip />}
                </span>
```

Add to `analysis-blocks.tsx` (exported so `word-list.tsx` imports it):

```tsx
/** Spec §1.8: an English fallback says so — it never passes for a Vietnamese meaning. */
export function EnglishChip() {
  const t = useTranslations("shadowing.lessonSummary.words");
  return (
    <abbr title={t("englishMeaningLabel")} className="ms-xs inline-block rounded-sm border border-border px-2xs align-middle text-caption font-semibold text-muted-foreground no-underline">
      {t("englishMeaning")}
    </abbr>
  );
}
```

In `Words`, the meaning line becomes `<Clamp lines={2} className="text-body">{word.meaning}{word.meaningLocale === "en" && <EnglishChip />}</Clamp>`.

The Words action shows the launcher whether or not the AI analysis is ready (Print works without AI):

```tsx
  const wordActions = (
    <div className="flex flex-wrap items-center gap-sm">
      {wordViewToggle}
      <Link href={printHref(videoId)} className={buttonStyles({ variant: "outline", size: "sm" })}>{t("words.print")}</Link>
    </div>
  );
```

and `{block("words", words ?? state("words"), true, wordActions)}`. Imports: `Link` from `@/lib/i18n/navigation`, `buttonStyles` from `@/components/ui/button`, `printHref` from `@/lib/summary/word-list`. If `buttonStyles` does not take `{ variant, size }`, read `components/ui/button.tsx` and use its exported class helper's real signature.

Run the Step 1 tests → PASS. Run `npx vitest run lib/i18n components/lesson-summary lib/summary --minWorkers=1 --maxWorkers=2` → PASS.

- [ ] **Step 4: Commit**

```bash
git add lib/summary components/lesson-summary messages
git commit -m "feat(summary): Words show the meaning's language and link to Print vocabulary"
```

---

### Task 5: Print source contract and Lesson adapter

**Files:**
- Create: `lib/vocabulary/print/source.ts`, `lib/vocabulary/print/source.test.ts`, `lib/vocabulary/print/lesson-source.ts`, `lib/vocabulary/print/lesson-source.test.ts`, `lib/vocabulary/print/load.ts`
- Modify: `messages/en/vocab.json`, `messages/vi/vocab.json` (new `"print"` object)

**Interfaces:**
- Consumes: `loadLessonSummary`, `authenticateSummary` (`lib/summary/load-snapshot.ts`), `analysisStatusForReflection` (`lib/summary/analysis/service.ts`), `aggregateVocabulary`, `wordRows`, `LESSON_WORDS_FETCH`, `meaningFor`, `normalizeRef`.
- Produces:
  - `type PrintSet = "all" | "saved"`, `type PrintSource = { kind: "lesson"; lessonId: string; set: PrintSet }`
  - `interface VocabularyPrintItem` and `interface PrintDocument` exactly as spec §2.2
  - `type PrintSourceResult = { kind: "ok"; doc: PrintDocument } | { kind: "not_found" } | { kind: "unauthorized" }`
  - `parsePrintQuery(searchParams: Record<string, string | string[] | undefined>): PrintSource | null`
  - `resolveLessonSource(args: { source: PrintSource; locale: KnowledgeLocale; userId: string; db: SummaryAuth["supabase"] }): Promise<PrintSourceResult>`
  - `loadPrintDocument(source: PrintSource, locale: KnowledgeLocale): Promise<PrintSourceResult>` (React `cache`d)

- [ ] **Step 1: Write the failing query tests**

`lib/vocabulary/print/source.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parsePrintQuery } from "./source";

const LESSON = "ba522023-8eba-4929-924f-35ae69eacf99";

describe("parsePrintQuery (spec §2.1)", () => {
  it("reads a lesson source and defaults the set to all", () => {
    expect(parsePrintQuery({ source: "lesson", lesson: LESSON })).toEqual({ kind: "lesson", lessonId: LESSON, set: "all" });
    expect(parsePrintQuery({ source: "lesson", lesson: LESSON, set: "saved" })).toMatchObject({ set: "saved" });
  });
  it("rejects anything else", () => {
    for (const query of [{}, { source: "deck", lesson: LESSON }, { source: "lesson", lesson: "not-a-uuid" },
      { source: "lesson", lesson: LESSON, set: "mine" }, { source: ["lesson", "lesson"], lesson: LESSON }]) {
      expect(parsePrintQuery(query)).toBeNull();
    }
  });
});
```

Run → FAIL.

- [ ] **Step 2: Implement `source.ts`**

```ts
import { z } from "zod";
import type { MeaningLocale, MeaningSource } from "@/lib/analysis/meaning";

/** Spec §2.2: the workspace knows only these types — never a lesson, a mining card or Summary. */
export type PrintSet = "all" | "saved";
export type PrintSource = { kind: "lesson"; lessonId: string; set: PrintSet };

export interface VocabularyPrintItem {
  /** Stable within the source: the lexical identity, or the saved word's identity when raw. */
  id: string;
  surface: string;
  reading?: string;
  meaning?: string;
  meaningLocale?: MeaningLocale;
  meaningSource?: MeaningSource;
  resolution: "resolved" | "saved_raw";
  example?: { text: string; sourceLabel?: string };
}

export interface PrintDocument {
  title: string;
  backHref: string;
  backLabel: string;
  items: VocabularyPrintItem[];
}

export type PrintSourceResult = { kind: "ok"; doc: PrintDocument } | { kind: "not_found" } | { kind: "unauthorized" };

const querySchema = z.object({
  source: z.literal("lesson"),
  lesson: z.string().uuid(),
  set: z.enum(["all", "saved"]).default("all"),
});

export function parsePrintQuery(searchParams: Record<string, string | string[] | undefined>): PrintSource | null {
  const parsed = querySchema.safeParse(searchParams);
  return parsed.success ? { kind: "lesson", lessonId: parsed.data.lesson, set: parsed.data.set } : null;
}
```

Run → PASS.

- [ ] **Step 3: Add the print copy**

`messages/en/vocab.json` gains:

```json
  "print": {
    "pageTitle": "Vocabulary – {title}",
    "backToSummary": "Back to the lesson summary",
    "heading": "Print vocabulary",
    "setAll": "All",
    "setSaved": "Saved",
    "mode": "Mode",
    "modeReview": "Review",
    "modeSelfTest": "Self-test",
    "show": "Show",
    "showReading": "Reading",
    "showMeaning": "Meaning",
    "showExample": "Example",
    "hide": "Hide",
    "density": "Density",
    "densityAiry": "Airy",
    "densityCompact": "Compact",
    "words": "Words",
    "selectAll": "Select all",
    "selectNone": "Select none",
    "count": "{selected}/{total} words · {pages, plural, one {# page} other {# pages}}",
    "unresolved": "{count, plural, one {# item has} other {# items have}} no reading or meaning on record.",
    "oversized": "“{word}” is too long for one page. Choose Compact, turn off Example, or deselect it.",
    "preparing": "Preparing the pages…",
    "print": "Print / Save PDF",
    "empty": "There are no words to print here yet.",
    "docReview": "Vocabulary review",
    "docSelfTest": "Vocabulary self-test",
    "wordmark": "KORUME",
    "footer": "Korume · {document}",
    "pageNumber": "{page} / {count}",
    "englishMeaning": "EN"
  }
```

`messages/vi/vocab.json` gains the same keys:

```json
  "print": {
    "pageTitle": "Từ vựng – {title}",
    "backToSummary": "Quay lại tổng kết bài",
    "heading": "In từ vựng",
    "setAll": "Tất cả",
    "setSaved": "Đã lưu",
    "mode": "Chế độ",
    "modeReview": "Ôn tập",
    "modeSelfTest": "Tự kiểm tra",
    "show": "Hiển thị",
    "showReading": "Cách đọc",
    "showMeaning": "Nghĩa",
    "showExample": "Ví dụ",
    "hide": "Ẩn",
    "density": "Mật độ",
    "densityAiry": "Thoáng",
    "densityCompact": "Gọn",
    "words": "Từ",
    "selectAll": "Chọn tất cả",
    "selectNone": "Bỏ chọn",
    "count": "{selected}/{total} từ · {pages} trang",
    "unresolved": "{count} mục không tìm được cách đọc/nghĩa.",
    "oversized": "“{word}” quá dài để vừa một trang. Chọn Gọn, tắt Ví dụ, hoặc bỏ chọn mục này.",
    "preparing": "Đang chuẩn bị trang…",
    "print": "In / Lưu PDF",
    "empty": "Chưa có từ nào để in ở đây.",
    "docReview": "Ôn tập từ vựng",
    "docSelfTest": "Tự kiểm tra từ vựng",
    "wordmark": "KORUME",
    "footer": "Korume · {document}",
    "pageNumber": "{page} / {count}",
    "englishMeaning": "EN"
  }
```

Run `npx vitest run lib/i18n --minWorkers=1 --maxWorkers=2` → PASS (catalog parity).

- [ ] **Step 4: Write the failing adapter tests**

`lib/vocabulary/print/lesson-source.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { assertPlainSerializableDto } from "@/test/dto";
import type { AnalysisToken, StaticLineAnalysis } from "@/lib/analysis/types";
import { loadLessonSummary } from "@/lib/summary/load-snapshot";
import { analysisStatusForReflection, requestLessonAnalysis } from "@/lib/summary/analysis/service";
import { getGloss, requestGloss } from "@/lib/dictionary/lookup";
import { resolveLessonSource } from "./lesson-source";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/summary/load-snapshot", () => ({ loadLessonSummary: vi.fn() }));
vi.mock("@/lib/summary/analysis/service", () => ({ analysisStatusForReflection: vi.fn(), requestLessonAnalysis: vi.fn() }));
vi.mock("@/lib/dictionary/lookup", () => ({ getGloss: vi.fn(), requestGloss: vi.fn() }));
vi.mock("@/lib/i18n/server", () => ({ getTranslations: vi.fn(async () => (key: string) => key) }));

const LESSON = "ba522023-8eba-4929-924f-35ae69eacf99";
const db = {} as never;
const tok = (surface: string, entSeq: number, reading: string, curatedVi: string | null = null): AnalysisToken => ({
  index: 0, surface, base: surface, reading: null, pos: "名詞", posDetail1: "一般", span: { start: 0, end: surface.length },
  entries: [{ entSeq, headword: surface, reading, glossEn: `${surface}-en`, jlpt: null }], vocabId: null, curatedVi,
});
const LINES = [
  { id: "l-1", index: 0, textJp: "苦手な人です", translation: null, startTime: 0, endTime: 1 },
  { id: "l-2", index: 1, textJp: "人が好き", translation: null, startTime: 1, endTime: 2 },
];
const ANALYSES = new Map<string, StaticLineAnalysis>([
  ["l-1", { lineId: "l-1", snapshotId: "s", grammar: [], tokens: [tok("苦手", 10, "にがて", "kém"), tok("人", 20, "ひと")] }],
  ["l-2", { lineId: "l-2", snapshotId: "s", grammar: [], tokens: [tok("人", 20, "ひと"), tok("好き", 30, "すき")] }],
]);

function loaded(saved: { cardId: string; kind: "vocabulary" | "expression"; ref: string; lineId: string }[] = []) {
  vi.mocked(loadLessonSummary).mockResolvedValue({ ok: true, data: {
    userId: "u-1", video: { id: LESSON, youtubeVideoId: "y", title: "苦手な人", thumbnailUrl: null, jlptLevel: null, durationSeconds: null },
    lines: LINES, analyses: ANALYSES, hasTranscript: true, completed: false, snapshot: {} as never, saved,
  } });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(analysisStatusForReflection).mockResolvedValue({ kind: "absent" });
  loaded();
});

const run = (set: "all" | "saved", locale: "vi" | "en" = "vi") =>
  resolveLessonSource({ source: { kind: "lesson", lessonId: LESSON, set }, locale, userId: "u-1", db });

describe("resolveLessonSource — all (spec §2.3)", () => {
  it("is the Words list: frequent lesson words with their first line as the example and a locale-aware meaning", async () => {
    const result = await run("all");
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.doc.title).toBe("苦手な人");
    expect(result.doc.backHref).toBe(`/shadowing/${LESSON}/summary`);
    expect(result.doc.items.map((item) => item.surface)).toEqual(["人", "苦手", "好き"]);
    expect(result.doc.items[1]).toEqual({
      id: "lesson-10", surface: "苦手", reading: "にがて", meaning: "kém", meaningLocale: "vi", meaningSource: "curated",
      resolution: "resolved", example: { text: "苦手な人です" },
    });
    expect(result.doc.items[0]).toMatchObject({ meaning: "人-en", meaningLocale: "en", meaningSource: "jmdict" });
  });

  it("reads a ready analysis read-only and never generates (P8), and never reads the AI gloss cache (P6)", async () => {
    await run("all");
    expect(analysisStatusForReflection).toHaveBeenCalledWith(LESSON, "vi", expect.objectContaining({ lines: LINES, analyses: ANALYSES }));
    expect(requestLessonAnalysis).not.toHaveBeenCalled();
    expect(getGloss).not.toHaveBeenCalled();
    expect(requestGloss).not.toHaveBeenCalled();
  });

  it("puts the AI words first when the analysis is ready", async () => {
    vi.mocked(analysisStatusForReflection).mockResolvedValue({ kind: "ready", fingerprint: "f", view: { overview: "", expressions: [], grammar: [], culture: [], words: [{
      entSeq: 30, surface: "好き", written: "好き", reading: "すき", meaning: "liked", meaningLocale: "en", meaningSource: "jmdict",
      posKey: "noun", jlpt: null, common: true, whyItMatters: "", usageNote: "", source: { lineId: "l-2", textJp: "人が好き", startTime: 1, endTime: 2 },
    }] } });
    const result = await run("all");
    expect(result.kind === "ok" && result.doc.items.map((item) => item.surface)).toEqual(["好き", "人", "苦手"]);
  });

  it("returns a plain, JSON-safe document", async () => {
    const result = await run("all");
    assertPlainSerializableDto(result);
    expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });

  it("maps an unreadable lesson to unauthorized and a missing one to not_found", async () => {
    vi.mocked(loadLessonSummary).mockResolvedValueOnce({ ok: false, status: 401 });
    expect((await run("all")).kind).toBe("unauthorized");
    vi.mocked(loadLessonSummary).mockResolvedValueOnce({ ok: false, status: 404 });
    expect((await run("all")).kind).toBe("not_found");
  });
});

describe("resolveLessonSource — saved (spec §2.4)", () => {
  it("prints vocabulary cards only, deduped by entSeq + reading with the earliest line as the example", async () => {
    loaded([
      { cardId: "c-2", kind: "vocabulary", ref: "人", lineId: "l-2" },
      { cardId: "c-1", kind: "vocabulary", ref: "人", lineId: "l-1" },
      { cardId: "c-3", kind: "expression", ref: "苦手な人", lineId: "l-1" },
    ]);
    const result = await run("saved");
    expect(result.kind === "ok" && result.doc.items).toEqual([{
      id: "lex-20:ひと", surface: "人", reading: "ひと", meaning: "人-en", meaningLocale: "en", meaningSource: "jmdict",
      resolution: "resolved", example: { text: "苦手な人です" },
    }]);
  });

  it("keeps a card that no longer resolves as saved_raw, without reading or meaning, and without a deleted line", async () => {
    loaded([
      { cardId: "c-9", kind: "vocabulary", ref: "消えた", lineId: "l-1" },
      { cardId: "c-8", kind: "vocabulary", ref: "幽霊", lineId: "l-gone" },
    ]);
    const result = await run("saved");
    expect(result.kind === "ok" && result.doc.items).toEqual([
      { id: "raw-消えた", surface: "消えた", resolution: "saved_raw", example: { text: "苦手な人です" } },
      { id: "raw-幽霊", surface: "幽霊", resolution: "saved_raw" },
    ]);
  });

  it("returns an empty document when nothing is saved", async () => {
    const result = await run("saved");
    expect(result.kind === "ok" && result.doc.items).toEqual([]);
  });
});
```

Run → FAIL (module missing).

- [ ] **Step 5: Implement the adapter**

`lib/vocabulary/print/lesson-source.ts`:

```ts
import "server-only";
import { aggregateVocabulary } from "@/lib/analysis/lesson-vocabulary";
import { meaningFor } from "@/lib/analysis/meaning";
import type { StaticLineAnalysis } from "@/lib/analysis/types";
import { getTranslations } from "@/lib/i18n/server";
import type { KnowledgeLocale } from "@/lib/knowledge/types";
import { analysisStatusForReflection } from "@/lib/summary/analysis/service";
import { loadLessonSummary, type SummaryAuth } from "@/lib/summary/load-snapshot";
import { normalizeRef } from "@/lib/summary/refs";
import type { SavedCard, SummaryLine } from "@/lib/summary/snapshot";
import { LESSON_WORDS_FETCH, wordRows } from "@/lib/summary/word-list";
import type { PrintSource, PrintSourceResult, VocabularyPrintItem } from "./source";

interface Args { source: PrintSource; locale: KnowledgeLocale; userId: string; db: SummaryAuth["supabase"] }

/** Spec §2: a lesson as printable vocabulary. Reads only; never generates an analysis (P8) nor reads an AI gloss (P6). */
export async function resolveLessonSource({ source, locale, userId, db }: Args): Promise<PrintSourceResult> {
  const loaded = await loadLessonSummary(source.lessonId, { supabase: db, userId });
  if (!loaded.ok) return loaded.status === 401 ? { kind: "unauthorized" } : { kind: "not_found" };
  const { video, lines, analyses, saved } = loaded.data;
  const t = await getTranslations({ locale, namespace: "vocab.print" });
  const items = source.set === "all"
    ? await allItems(source.lessonId, locale, db, lines, analyses)
    : savedItems(saved, lines, analyses, locale);
  return { kind: "ok", doc: { title: video.title, backHref: `/shadowing/${video.id}/summary`, backLabel: t("backToSummary"), items } };
}

function example(text: string | undefined): Pick<VocabularyPrintItem, "example"> {
  return text ? { example: { text } } : {};
}

/** Spec §2.3: exactly Summary's Words list — the same `wordRows`, cap and order. */
async function allItems(
  lessonId: string, locale: KnowledgeLocale, db: SummaryAuth["supabase"], lines: SummaryLine[], analyses: Map<string, StaticLineAnalysis>,
): Promise<VocabularyPrintItem[]> {
  const status = await analysisStatusForReflection(lessonId, locale, { supabase: db, lines, analyses });
  const aiWords = status.kind === "ready" ? status.view.words : [];
  const lessonWords = aggregateVocabulary(lines.flatMap((line) => {
    const analysis = analyses.get(line.id);
    return analysis ? [{ id: line.id, tokens: analysis.tokens }] : [];
  })).slice(0, LESSON_WORDS_FETCH);
  const textOf = new Map(lines.map((line) => [line.id, line.textJp]));
  return wordRows(aiWords, lessonWords, locale).map((row) => ({
    id: row.key, surface: row.written, ...(row.reading ? { reading: row.reading } : {}),
    meaning: row.meaning, meaningLocale: row.meaningLocale, meaningSource: row.meaningSource,
    resolution: "resolved", ...example(textOf.get(row.lineId)),
  }));
}

/** Spec §2.4: vocabulary cards only, one item per lexeme, the earliest line as its example, in transcript order. */
function savedItems(saved: SavedCard[], lines: SummaryLine[], analyses: Map<string, StaticLineAnalysis>, locale: KnowledgeLocale): VocabularyPrintItem[] {
  const lineOf = new Map(lines.map((line) => [line.id, line]));
  const kept = new Map<string, { order: number; item: VocabularyPrintItem }>();
  for (const card of saved) {
    if (card.kind !== "vocabulary") continue;
    const line = lineOf.get(card.lineId);
    const order = line?.index ?? Number.MAX_SAFE_INTEGER;
    const token = analyses.get(card.lineId)?.tokens
      .find((candidate) => normalizeRef(candidate.surface) === normalizeRef(card.ref) && candidate.entries.length > 0);
    const lexeme = token?.entries[0];
    const [key, item]: [string, VocabularyPrintItem] = token && lexeme
      ? [`lex-${lexeme.entSeq}:${lexeme.reading}`, {
        id: `lex-${lexeme.entSeq}:${lexeme.reading}`, surface: lexeme.headword, reading: lexeme.reading,
        ...meaningFor({ glossEn: lexeme.glossEn, curatedVi: token.curatedVi }, locale), resolution: "resolved", ...example(line?.textJp),
      }]
      // Never a first-JMdict-entry guess: the learner saved it, so it prints as saved.
      : [`raw-${normalizeRef(card.ref)}`, { id: `raw-${normalizeRef(card.ref)}`, surface: card.ref, resolution: "saved_raw", ...example(line?.textJp) }];
    const previous = kept.get(key);
    if (!previous || order < previous.order) kept.set(key, { order, item });
  }
  return [...kept.values()].sort((a, b) => a.order - b.order).map(({ item }) => item);
}
```

If `getTranslations({ locale, namespace })` is not the signature `lib/i18n/server` re-exports, use the form `app/[locale]/(protected)/(app)/vocab/page.tsx:16` uses. Run the adapter tests → PASS. Mutation: replace `analysisStatusForReflection(...)` with a call to `requestLessonAnalysis(lessonId, locale, "generate")` → the P8 test FAILS; restore.

- [ ] **Step 6: Implement `load.ts`**

```ts
import "server-only";
import { cache } from "react";
import type { KnowledgeLocale } from "@/lib/knowledge/types";
import { authenticateSummary } from "@/lib/summary/load-snapshot";
import { resolveLessonSource } from "./lesson-source";
import type { PrintSource, PrintSourceResult } from "./source";

/** One load per request: `generateMetadata` and the page share it. The user id always comes from the session. */
export const loadPrintDocument = cache(async (source: PrintSource, locale: KnowledgeLocale): Promise<PrintSourceResult> => {
  const auth = await authenticateSummary();
  if (!auth) return { kind: "unauthorized" };
  switch (source.kind) {
    case "lesson": return resolveLessonSource({ source, locale, userId: auth.userId, db: auth.supabase });
  }
});
```

`cache` keys on argument identity, so the page and `generateMetadata` must pass the **same** `source` object: parse it once per request through a `cache`d `parsePrintQuery` wrapper in Task 9. Run `npx tsc --noEmit` → 0.

- [ ] **Step 7: Commit**

```bash
git add lib/vocabulary messages
git commit -m "feat(print): print source contract and the read-only Lesson adapter"
```

---

### Task 6: Paper geometry and pure pagination

**Files:**
- Create: `lib/vocabulary/print/paper.ts`, `lib/vocabulary/print/paginate.ts`, `lib/vocabulary/print/paginate.test.ts`, `lib/vocabulary/print/settings.ts`

**Interfaces:**
- Produces:
  - `PAPER = { widthMm: 210, heightMm: 297, marginMm: 14 }`, `MM_TO_PX = 96 / 25.4`, `paperVars(): Record<string, string>` (CSS custom properties `--vp-width`, `--vp-height`, `--vp-margin`)
  - `type PageCapacity = { firstPage: number; continuationPage: number }`
  - `paginate(itemHeights: number[], capacity: PageCapacity): { pages: number[][]; oversized: number[] }`
  - `pageCapacity(measured: { content: number; firstHeader: number; continuationHeader: number; footer: number }): PageCapacity`
  - `interface PrintSettings { mode: "review" | "selfTest"; showReading: boolean; showMeaning: boolean; showExample: boolean; hide: "meaning" | "reading"; density: "airy" | "compact" }`, `DEFAULT_PRINT_SETTINGS`

- [ ] **Step 1: Write the failing tests**

`lib/vocabulary/print/paginate.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { pageCapacity, paginate } from "./paginate";

const capacity = { firstPage: 300, continuationPage: 400 };

describe("paginate (spec §3.4)", () => {
  it("returns no pages for no items", () => {
    expect(paginate([], capacity)).toEqual({ pages: [], oversized: [] });
  });

  it("fills the first page to its own capacity, then continuation pages to theirs", () => {
    expect(paginate([100, 100, 100, 100, 100, 100, 100, 100], capacity).pages).toEqual([[0, 1, 2], [3, 4, 5, 6], [7]]);
  });

  it("keeps an exact fit on the page", () => {
    expect(paginate([150, 150, 400], capacity).pages).toEqual([[0, 1], [2]]);
  });

  it("puts an oversized item alone on its page and reports it, placing every item exactly once", () => {
    const result = paginate([100, 500, 100], capacity);
    expect(result.pages).toEqual([[0], [1], [2]]);
    expect(result.oversized).toEqual([1]);
    expect(result.pages.flat()).toEqual([0, 1, 2]);
  });

  it("reports an item that fits a continuation page but not the first page as oversized only if it starts the first page", () => {
    expect(paginate([350], capacity)).toEqual({ pages: [[0]], oversized: [0] });
    expect(paginate([100, 350], capacity)).toEqual({ pages: [[0], [1]], oversized: [] });
  });

  it("is deterministic, and a two-line title (smaller first page) moves only the first break", () => {
    const heights = Array.from({ length: 12 }, () => 100);
    expect(paginate(heights, capacity)).toEqual(paginate(heights, capacity));
    expect(paginate(heights, { ...capacity, firstPage: 200 }).pages[0]).toEqual([0, 1]);
  });

  it("does not change the layout when the page count reaches two digits (the footer height is fixed)", () => {
    const nine = paginate(Array.from({ length: 36 }, () => 100), { firstPage: 400, continuationPage: 400 });
    const ten = paginate(Array.from({ length: 40 }, () => 100), { firstPage: 400, continuationPage: 400 });
    expect(nine.pages).toHaveLength(9);
    expect(ten.pages.slice(0, 9)).toEqual(nine.pages);
  });
});

describe("pageCapacity", () => {
  it("subtracts each page kind's own measured header and the footer", () => {
    expect(pageCapacity({ content: 1000, firstHeader: 120, continuationHeader: 40, footer: 30 })).toEqual({ firstPage: 850, continuationPage: 930 });
  });
});
```

Run → FAIL.

- [ ] **Step 2: Implement**

`lib/vocabulary/print/paper.ts`:

```ts
/** Spec §3.2: the one paper config — preview sheets, the measurement tree and the print sheets all read it. */
export const PAPER = { widthMm: 210, heightMm: 297, marginMm: 14 } as const;
/** CSS defines 1in = 96px = 25.4mm, so this is exact in every browser. */
export const MM_TO_PX = 96 / 25.4;

export function paperVars(): Record<string, string> {
  return { "--vp-width": `${PAPER.widthMm}mm`, "--vp-height": `${PAPER.heightMm}mm`, "--vp-margin": `${PAPER.marginMm}mm` };
}
```

`lib/vocabulary/print/paginate.ts`:

```ts
/** Spec §3.4: heights in CSS px from the measurement tree; capacities per page kind, all measured. */
export type PageCapacity = { firstPage: number; continuationPage: number };

export function pageCapacity(measured: { content: number; firstHeader: number; continuationHeader: number; footer: number }): PageCapacity {
  return {
    firstPage: measured.content - measured.firstHeader - measured.footer,
    continuationPage: measured.content - measured.continuationHeader - measured.footer,
  };
}

/** Greedy, one pass: each item is placed exactly once, so no input can loop. An item taller than its page is alone and reported. */
export function paginate(itemHeights: number[], capacity: PageCapacity): { pages: number[][]; oversized: number[] } {
  const pages: number[][] = [];
  const oversized: number[] = [];
  let page: number[] = [];
  let used = 0;
  const limit = () => (pages.length === 0 ? capacity.firstPage : capacity.continuationPage);
  itemHeights.forEach((height, index) => {
    if (page.length > 0 && used + height > limit()) {
      pages.push(page);
      page = [];
      used = 0;
    }
    if (height > limit()) oversized.push(index);
    page.push(index);
    used += height;
  });
  if (page.length > 0) pages.push(page);
  return { pages, oversized };
}
```

`lib/vocabulary/print/settings.ts`:

```ts
/** Spec §3.1 / §5: transient workspace settings; nothing persists in V1. */
export interface PrintSettings {
  mode: "review" | "selfTest";
  showReading: boolean;
  showMeaning: boolean;
  showExample: boolean;
  /** Self-test only: the field replaced by a writing line. */
  hide: "meaning" | "reading";
  density: "airy" | "compact";
}

export const DEFAULT_PRINT_SETTINGS: PrintSettings = {
  mode: "review", showReading: true, showMeaning: true, showExample: true, hide: "meaning", density: "airy",
};
```

Run → PASS. Mutation: change `pages.length === 0 ? capacity.firstPage : …` to always `capacity.continuationPage` → the first-page tests FAIL; restore.

- [ ] **Step 3: Commit**

```bash
git add lib/vocabulary/print
git commit -m "feat(print): paper geometry, settings and one-pass A4 pagination"
```

---

### Task 7: Presentational sheets, paper styles and Korume identity

**Files:**
- Create: `lib/vocabulary/print/mascot.ts`, `components/vocabulary-print/print-sheets.tsx`, `components/vocabulary-print/print-sheets.test.tsx`
- Modify: `app/globals.css` (append the `.vp-*` block)

**Interfaces:**
- Consumes: `VocabularyPrintItem` (Task 5), `PrintSettings`, `paperVars` (Task 6).
- Produces:
  - `MASCOT_SRC = "/mascot/poses/quill-writing.png"`, `mascotReady(): Promise<void>`
  - `interface SheetLabels { wordmark: string; documentName: string; title: string; footer: string; pageNumber: (page: number, count: number) => string; englishMeaning: string }`
  - `PrintItem({ item, settings, englishMeaning })`, `FirstHeader({ labels })`, `ContinuationHeader({ labels })`, `Footer({ labels, page, count })`
  - `PrintSheets({ pages, settings, labels })` — renders `<div class="vp-paper …">` containing one `.vp-sheet` per page

`SheetLabels.pageNumber` is a function: these components render only inside client components (the workspace), never as RSC props.

- [ ] **Step 1: Write the failing tests**

`components/vocabulary-print/print-sheets.test.tsx`:

```tsx
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DEFAULT_PRINT_SETTINGS } from "@/lib/vocabulary/print/settings";
import type { VocabularyPrintItem } from "@/lib/vocabulary/print/source";
import { PrintSheets, type SheetLabels } from "./print-sheets";

const labels: SheetLabels = {
  wordmark: "KORUME", documentName: "Vocabulary review", title: "苦手な人", footer: "Korume · Vocabulary review",
  pageNumber: (page, count) => `${page} / ${count}`, englishMeaning: "EN",
};
const vi: VocabularyPrintItem = { id: "a", surface: "苦手", reading: "にがて", meaning: "kém", meaningLocale: "vi", meaningSource: "curated", resolution: "resolved", example: { text: "今回はね「私の苦手な人」について話します" } };
const en: VocabularyPrintItem = { id: "b", surface: "人", reading: "ひと", meaning: "person", meaningLocale: "en", meaningSource: "jmdict", resolution: "resolved" };
const raw: VocabularyPrintItem = { id: "c", surface: "消えた", resolution: "saved_raw" };

const sheets = (pages: VocabularyPrintItem[][], settings = DEFAULT_PRINT_SETTINGS) =>
  render(<PrintSheets pages={pages} settings={settings} labels={labels} />).container;

describe("PrintSheets (spec §5, §6)", () => {
  it("gives page 1 the mascot and full header, later pages a compact header, every page a footer with x / y", () => {
    const root = sheets([[vi], [en]]);
    const [first, second] = [...root.querySelectorAll(".vp-sheet")];
    expect(first?.querySelector(".vp-head-first img.vp-mascot")).toHaveAttribute("src", "/mascot/poses/quill-writing.png");
    expect(first?.textContent).toContain("Vocabulary review");
    expect(second?.querySelector(".vp-head-first")).toBeNull();
    expect(second?.querySelector(".vp-head-cont")?.textContent).toContain("苦手な人");
    expect(first?.querySelector(".vp-foot")?.textContent).toContain("1 / 2");
    expect(second?.querySelector(".vp-foot")?.textContent).toContain("2 / 2");
    expect(root.querySelectorAll(".vp-foot img.vp-foot-mark")).toHaveLength(2);
  });

  it("marks Japanese lang=ja and shows the EN chip only for an English meaning", () => {
    const root = sheets([[vi, en]]);
    expect(root.querySelector(".vp-word")).toHaveAttribute("lang", "ja");
    expect(root.querySelector(".vp-example")).toHaveAttribute("lang", "ja");
    expect(root.querySelectorAll(".vp-chip")).toHaveLength(1);
  });

  it("replaces the hidden field with a writing line in self-test, keeping the template", () => {
    const root = sheets([[vi]], { ...DEFAULT_PRINT_SETTINGS, mode: "selfTest", hide: "meaning" });
    expect(root.querySelector(".vp-meaning")).toBeNull();
    expect(root.querySelector(".vp-blank")).not.toBeNull();
    expect(root.textContent).toContain("にがて");
    const reading = sheets([[vi]], { ...DEFAULT_PRINT_SETTINGS, mode: "selfTest", hide: "reading" });
    expect(reading.querySelector(".vp-reading")).toBeNull();
    expect(reading.querySelector(".vp-blank-inline")).not.toBeNull();
  });

  it("drops toggled-off fields and prints a raw saved item without reading or meaning", () => {
    const root = sheets([[vi, raw]], { ...DEFAULT_PRINT_SETTINGS, showExample: false });
    expect(root.querySelector(".vp-example")).toBeNull();
    expect(root.querySelectorAll(".vp-item")[1]?.textContent).toBe("消えた");
  });

  it("is presentational: no ids, no buttons, no inputs, no aria references (it renders twice)", () => {
    const root = sheets([[vi, en], [raw]]);
    expect(root.querySelectorAll("[id], button, input, [aria-describedby], [aria-labelledby]")).toHaveLength(0);
  });

  it("applies the compact density as a class, not a different template", () => {
    expect(sheets([[vi]], { ...DEFAULT_PRINT_SETTINGS, density: "compact" }).querySelector(".vp-paper.vp-compact")).not.toBeNull();
  });
});
```

Run → FAIL.

- [ ] **Step 2: Implement `mascot.ts`**

```ts
/** Spec §6: the first-page mascot and the footer mark are this one existing asset; no new artwork. */
export const MASCOT_SRC = "/mascot/poses/quill-writing.png";

let ready: Promise<void> | null = null;

/** Spec §3.5: part of the complete-page-set lifecycle — a page set is never committed before the mascot decodes. */
export function mascotReady(): Promise<void> {
  if (!ready) {
    const image = new Image();
    image.src = MASCOT_SRC;
    // A failed decode must not block printing forever: the page then prints without the mascot pixels.
    ready = image.decode().catch(() => undefined);
  }
  return ready;
}
```

- [ ] **Step 3: Implement `print-sheets.tsx`**

```tsx
/* eslint-disable @next/next/no-img-element -- print needs a plain, eagerly decoded <img> at a fixed mm box; next/image adds lazy loading and wrappers. */
import type { CSSProperties } from "react";
import { MASCOT_SRC } from "@/lib/vocabulary/print/mascot";
import { paperVars } from "@/lib/vocabulary/print/paper";
import type { PrintSettings } from "@/lib/vocabulary/print/settings";
import type { VocabularyPrintItem } from "@/lib/vocabulary/print/source";

/** Spec §4.1: presentational only — rendered twice (preview and print root), so no ids, controls or ARIA references. */
export interface SheetLabels {
  wordmark: string;
  documentName: string;
  title: string;
  footer: string;
  pageNumber: (page: number, count: number) => string;
  englishMeaning: string;
}

export function PrintItem({ item, settings, englishMeaning }: { item: VocabularyPrintItem; settings: PrintSettings; englishMeaning: string }) {
  const hide = settings.mode === "selfTest" ? settings.hide : null;
  return (
    <div className="vp-item">
      <div>
        <span lang="ja" className="vp-word">{item.surface}</span>
        {hide === "reading"
          ? <span className="vp-blank-inline" />
          : settings.showReading && item.reading && <span lang="ja" className="vp-reading">{item.reading}</span>}
      </div>
      {hide === "meaning"
        ? <div className="vp-blank" />
        : settings.showMeaning && item.meaning && (
          <div className="vp-meaning">
            {item.meaning}
            {item.meaningLocale === "en" && <span className="vp-chip">{englishMeaning}</span>}
          </div>
        )}
      {settings.showExample && item.example && <div lang="ja" className="vp-example">{item.example.text}</div>}
    </div>
  );
}

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

export function Footer({ labels, page, count }: { labels: SheetLabels; page: number; count: number }) {
  return (
    <div className="vp-foot">
      <span>{labels.footer}</span>
      <img src={MASCOT_SRC} alt="" className="vp-foot-mark" />
      <span>{labels.pageNumber(page, count)}</span>
    </div>
  );
}

export function PrintSheets({ pages, settings, labels }: { pages: VocabularyPrintItem[][]; settings: PrintSettings; labels: SheetLabels }) {
  return (
    <div className={`vp-paper${settings.density === "compact" ? " vp-compact" : ""}`} style={paperVars() as CSSProperties}>
      {pages.map((items, index) => (
        <section key={index} className="vp-sheet">
          {index === 0 ? <FirstHeader labels={labels} /> : <ContinuationHeader labels={labels} />}
          <div className="vp-body">
            {items.map((item) => <PrintItem key={item.id} item={item} settings={settings} englishMeaning={labels.englishMeaning} />)}
          </div>
          <Footer labels={labels} page={index + 1} count={pages.length} />
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Append the paper styles to `app/globals.css`**

```css
/* Print vocabulary (spec 2026-10-05-print-vocabulary-design §3–§6): geometry in mm, type in pt, the paper's own
   palette in every theme. `.vp-paper` carries the --vp-* geometry variables (paper.ts). */
.vp-paper { --vp-ink: #111; --vp-muted: #5c5c5c; --vp-rule: #c9c9c9; color: var(--vp-ink); }
.vp-sheet {
  box-sizing: border-box; width: var(--vp-width); height: var(--vp-height); padding: var(--vp-margin);
  display: flex; flex-direction: column; overflow: hidden; background: #fff; color: var(--vp-ink);
  font-family: var(--font-sans); font-size: 10pt; line-height: 1.45;
  break-inside: avoid; page-break-inside: avoid; page: vocab-sheet;
}
.vp-body { flex: 1 1 auto; }
.vp-head-first { display: flex; align-items: center; gap: 4mm; padding-bottom: 4mm; border-bottom: 0.3mm solid var(--vp-rule); }
.vp-head-cont { display: flex; justify-content: space-between; gap: 4mm; padding-bottom: 2mm; border-bottom: 0.3mm solid var(--vp-rule); font-size: 8pt; color: var(--vp-muted); }
.vp-mascot { width: 18mm; height: 18mm; flex: none; object-fit: contain; }
.vp-wordmark { font-family: var(--font-display); font-weight: 700; font-size: 9pt; letter-spacing: 0.12em; }
.vp-docname { font-size: 14pt; font-weight: 600; }
.vp-title { color: var(--vp-muted); overflow-wrap: anywhere; }
.vp-item { padding: 4mm 0; border-bottom: 0.2mm solid var(--vp-rule); }
.vp-compact .vp-item { padding: 2.2mm 0; }
.vp-word { font-family: var(--font-jp); font-size: 16pt; font-weight: 700; }
.vp-compact .vp-word { font-size: 13pt; }
.vp-reading { margin-inline-start: 3mm; font-family: var(--font-jp); font-size: 10pt; color: var(--vp-muted); }
.vp-meaning { margin-top: 1mm; font-size: 11pt; font-weight: 500; }
.vp-compact .vp-meaning { font-size: 10pt; }
.vp-chip { display: inline-block; margin-inline-start: 2mm; padding: 0 1mm; border: 0.2mm solid var(--vp-muted); border-radius: var(--radius-sm, 2px); font-size: 6.5pt; font-weight: 600; color: var(--vp-muted); vertical-align: middle; }
.vp-example { margin-top: 1mm; font-family: var(--font-jp); font-size: 9.5pt; color: var(--vp-muted); }
.vp-compact .vp-example { font-size: 8.5pt; }
.vp-blank { height: 10mm; border-bottom: 0.3mm solid var(--vp-ink); }
.vp-blank-inline { display: inline-block; width: 30mm; height: 6mm; margin-inline-start: 3mm; border-bottom: 0.3mm solid var(--vp-ink); vertical-align: bottom; }
.vp-foot { display: flex; align-items: flex-end; justify-content: space-between; gap: 4mm; padding-top: 2mm; font-size: 7.5pt; color: var(--vp-muted); }
.vp-foot-mark { width: 8mm; height: 8mm; margin-inline-start: auto; flex: none; object-fit: contain; filter: grayscale(1); opacity: 0.08; }
.vp-measure { position: absolute; top: 0; inset-inline-start: -10000px; width: calc(var(--vp-width) - 2 * var(--vp-margin)); visibility: hidden; pointer-events: none; }
.vp-measure-content { height: calc(var(--vp-height) - 2 * var(--vp-margin)); }
/* The preview stacks its sheets with a gap; print never sees it (the print root is hidden on screen). */
@media screen { .vp-paper:not(.vp-measure) { display: flex; flex-direction: column; gap: 16px; } }

/* Scoped to the print page (plan refinement of spec §4.1/§4.2): unscoped, these rules would blank or re-margin the
   printout of every other page of the app. */
@page vocab-sheet { size: A4; margin: 0; }
@media screen { [data-print-root] { display: none; } }
@media print {
  html:has(body > [data-print-root]), body:has(> [data-print-root]) { margin: 0; padding: 0; background: #fff; }
  body:has(> [data-print-root]) > :not([data-print-root]) { display: none !important; }
  [data-print-root] .vp-sheet { break-after: page; }
  [data-print-root] .vp-sheet:last-child { break-after: auto; }
}
```

If the token-scale tests (`components/ui/token-scale*.test.ts`) flag raw `pt`/`mm` values in `globals.css`, read the test, then add the `.vp-` selectors to its documented exception list with the reason "physical paper units, spec §4.4".

Run `npx vitest run components/vocabulary-print components/ui --minWorkers=1 --maxWorkers=2` → PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/vocabulary/print/mascot.ts components/vocabulary-print app/globals.css
git commit -m "feat(print): presentational A4 sheets with the Korume print identity"
```

---

### Task 8: Workspace — measurement, commit lifecycle, preview scale, print portal

**Files:**
- Create: `components/vocabulary-print/print-workspace.tsx`, `components/vocabulary-print/print-workspace.test.tsx`

**Interfaces:**
- Consumes: Tasks 5–7.
- Produces: `PrintWorkspace({ doc, views }: { doc: PrintDocument; views: { label: string; href: string; current: boolean }[] })` (client component; props are plain DTOs).

- [ ] **Step 1: Write the failing tests**

`components/vocabulary-print/print-workspace.test.tsx`:

```tsx
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@/test/render";
import type { PrintDocument, VocabularyPrintItem } from "@/lib/vocabulary/print/source";
import * as paginateModule from "@/lib/vocabulary/print/paginate";
import { mascotReady } from "@/lib/vocabulary/print/mascot";
import { PrintWorkspace } from "./print-workspace";

vi.mock("@/lib/i18n/navigation", () => ({ Link: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a> }));
vi.mock("@/lib/vocabulary/print/mascot", () => ({ MASCOT_SRC: "/m.png", mascotReady: vi.fn(() => Promise.resolve()) }));

const items = (count: number): VocabularyPrintItem[] => Array.from({ length: count }, (_, i) => ({
  id: `i-${i}`, surface: `語${i}`, reading: "ご", meaning: `m${i}`, meaningLocale: "en", meaningSource: "jmdict", resolution: "resolved",
}));
const doc = (list: VocabularyPrintItem[]): PrintDocument => ({ title: "Lesson", backHref: "/back", backLabel: "Back to the lesson summary", items: list });
const views = [{ label: "All", href: "/vocab/print?set=all", current: true }, { label: "Saved", href: "/vocab/print?set=saved", current: false }];

// jsdom lays nothing out: heights come from the element's role in the measurement tree.
const HEIGHTS: Record<string, number> = { content: 1000, "first-header": 100, "continuation-header": 40, footer: 60 };
let itemHeight = 100;
let resizeCallback: ResizeObserverCallback | null = null;

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    const role = this.dataset.measure;
    const height = role === "item" ? itemHeight : HEIGHTS[role ?? ""] ?? 0;
    return { height, width: 600, top: 0, left: 0, bottom: height, right: 600, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
  });
  vi.stubGlobal("ResizeObserver", class { constructor(cb: ResizeObserverCallback) { resizeCallback = cb; } observe() {} disconnect() {} });
  vi.spyOn(paginateModule, "paginate");
  vi.mocked(mascotReady).mockImplementation(() => Promise.resolve());
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); itemHeight = 100; });

const printButton = () => screen.getByRole("button", { name: "Print / Save PDF" });
const printRoot = () => document.body.querySelector(":scope > [data-print-root]");

describe("PrintWorkspace (spec §3)", () => {
  it("commits a complete page set into the preview and a body-level print root", async () => {
    render(<PrintWorkspace doc={doc(items(20))} views={views} />);
    // capacity: first 1000-100-60 = 840 → 8 items; continuation 1000-40-60 = 900 → 9 items; 20 items → 3 pages
    expect(await screen.findByText("20/20 words · 3 pages")).toBeInTheDocument();
    expect(printRoot()?.querySelectorAll(".vp-sheet")).toHaveLength(3);
    expect(printButton()).not.toHaveAttribute("aria-disabled");
  });

  it("commits nothing and keeps Print disabled until the mascot decodes", async () => {
    let decode!: () => void;
    vi.mocked(mascotReady).mockImplementation(() => new Promise<void>((resolve) => { decode = resolve; }));
    render(<PrintWorkspace doc={doc(items(3))} views={views} />);
    await waitFor(() => expect(paginateModule.paginate).toHaveBeenCalled());
    expect(printRoot()?.querySelectorAll(".vp-sheet") ?? []).toHaveLength(0);
    expect(printButton()).toHaveAttribute("aria-disabled", "true");
    await act(async () => decode());
    expect(await screen.findByText("3/3 words · 1 page")).toBeInTheDocument();
  });

  it("re-paginates on a setting change but not on a resize, which only rescales the preview", async () => {
    render(<PrintWorkspace doc={doc(items(5))} views={views} />);
    await screen.findByText("5/5 words · 1 page");
    const calls = vi.mocked(paginateModule.paginate).mock.calls.length;
    act(() => resizeCallback?.([{ contentRect: { width: 300 } } as ResizeObserverEntry], {} as ResizeObserver));
    expect(vi.mocked(paginateModule.paginate).mock.calls.length).toBe(calls);
    fireEvent.click(screen.getByRole("radio", { name: "Compact" }));
    await waitFor(() => expect(vi.mocked(paginateModule.paginate).mock.calls.length).toBe(calls + 1));
  });

  it("never lets a stale generation win over a newer one", async () => {
    const pending: (() => void)[] = [];
    vi.mocked(mascotReady).mockImplementation(() => new Promise<void>((resolve) => { pending.push(resolve); }));
    render(<PrintWorkspace doc={doc(items(4))} views={views} />);
    await waitFor(() => expect(pending).toHaveLength(1));
    fireEvent.click(screen.getByRole("radio", { name: "Compact" }));
    await waitFor(() => expect(pending).toHaveLength(2));
    await act(async () => pending[1]!());
    await act(async () => pending[0]!());
    expect(printRoot()?.querySelector(".vp-paper")).toHaveClass("vp-compact");
  });

  it("re-measures once after a burst of font loads", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const fonts = Object.assign(new EventTarget(), { ready: Promise.resolve() });
    Object.defineProperty(document, "fonts", { value: fonts, configurable: true });
    render(<PrintWorkspace doc={doc(items(4))} views={views} />);
    await screen.findByText("4/4 words · 1 page");
    const calls = vi.mocked(paginateModule.paginate).mock.calls.length;
    act(() => { fonts.dispatchEvent(new Event("loadingdone")); fonts.dispatchEvent(new Event("loadingdone")); });
    await act(async () => { vi.advanceTimersByTime(300); });
    await waitFor(() => expect(vi.mocked(paginateModule.paginate).mock.calls.length).toBe(calls + 1));
    vi.useRealTimers();
    Reflect.deleteProperty(document, "fonts");
  });

  it("blocks printing, without clipping, when an item is taller than a page", async () => {
    itemHeight = 950;
    render(<PrintWorkspace doc={doc(items(1))} views={views} />);
    expect(await screen.findByText(/is too long for one page/)).toBeInTheDocument();
    expect(printButton()).toHaveAttribute("aria-disabled", "true");
  });

  it("disables Print and shows the empty message when every word is deselected", async () => {
    render(<PrintWorkspace doc={doc(items(2))} views={views} />);
    await screen.findByText("2/2 words · 1 page");
    fireEvent.click(screen.getByRole("button", { name: "Select none" }));
    expect(await screen.findByText("0/2 words · 0 pages")).toBeInTheDocument();
    expect(printButton()).toHaveAttribute("aria-disabled", "true");
  });

  it("shows the adapter's back link instead of a blank sheet for an empty document", () => {
    render(<PrintWorkspace doc={doc([])} views={views} />);
    expect(screen.getByText("There are no words to print here yet.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to the lesson summary" })).toHaveAttribute("href", "/back");
  });

  it("notes raw saved items before printing", async () => {
    render(<PrintWorkspace doc={doc([...items(1), { id: "raw-x", surface: "x", resolution: "saved_raw" }])} views={views} />);
    expect(await screen.findByText("1 item has no reading or meaning on record.")).toBeInTheDocument();
  });

  it("updates nothing after unmount while a measurement is in flight", async () => {
    let decode!: () => void;
    vi.mocked(mascotReady).mockImplementation(() => new Promise<void>((resolve) => { decode = resolve; }));
    const errors = vi.spyOn(console, "error");
    const { unmount } = render(<PrintWorkspace doc={doc(items(2))} views={views} />);
    await waitFor(() => expect(paginateModule.paginate).toHaveBeenCalled());
    unmount();
    await act(async () => decode());
    expect(errors).not.toHaveBeenCalled();
    expect(printRoot()).toBeNull();
  });
});
```

Run → FAIL (module missing).

- [ ] **Step 2: Implement the workspace**

`components/vocabulary-print/print-workspace.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Switch } from "@/components/ui/switch";
import { useTranslations } from "@/lib/i18n";
import { Link } from "@/lib/i18n/navigation";
import { mascotReady } from "@/lib/vocabulary/print/mascot";
import { MM_TO_PX, PAPER, paperVars } from "@/lib/vocabulary/print/paper";
import { pageCapacity, paginate } from "@/lib/vocabulary/print/paginate";
import { DEFAULT_PRINT_SETTINGS, type PrintSettings } from "@/lib/vocabulary/print/settings";
import type { PrintDocument, VocabularyPrintItem } from "@/lib/vocabulary/print/source";
import { ContinuationHeader, FirstHeader, Footer, PrintItem, PrintSheets, type SheetLabels } from "./print-sheets";

const FONT_DEBOUNCE_MS = 150;
const SHEET_GAP_PX = 16;
const SHEET_PX = { width: PAPER.widthMm * MM_TO_PX, height: PAPER.heightMm * MM_TO_PX };

interface Committed { pages: VocabularyPrintItem[][]; settings: PrintSettings; oversized: VocabularyPrintItem[] }

/** Spec §3: one print workspace — selection and settings on the left, the committed A4 page set on the right. */
export function PrintWorkspace({ doc, views }: { doc: PrintDocument; views: { label: string; href: string; current: boolean }[] }) {
  const t = useTranslations("vocab.print");
  const [settings, setSettings] = useState<PrintSettings>(DEFAULT_PRINT_SETTINGS);
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set(doc.items.map((item) => item.id)));
  const chosen = useMemo(() => doc.items.filter((item) => selected.has(item.id)), [doc.items, selected]);
  const [committed, setCommitted] = useState<Committed | null>(null);
  const [busy, setBusy] = useState(true);
  const [fontTick, setFontTick] = useState(0);
  const [scale, setScale] = useState(1);
  const [portal, setPortal] = useState<HTMLElement | null>(null);
  const generation = useRef(0);
  const measureRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const labels: SheetLabels = {
    wordmark: t("wordmark"),
    documentName: settings.mode === "review" ? t("docReview") : t("docSelfTest"),
    title: doc.title,
    footer: t("footer", { document: settings.mode === "review" ? t("docReview") : t("docSelfTest") }),
    pageNumber: (page, count) => t("pageNumber", { page, count }),
    englishMeaning: t("englishMeaning"),
  };

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

  // Spec §3.5: render tree → fonts.ready → measure + paginate → mascot decode → commit; only the newest generation commits.
  useEffect(() => {
    const mine = ++generation.current;
    setBusy(true);
    void (async () => {
      await (document as Document & { fonts?: FontFaceSet }).fonts?.ready;
      const root = measureRef.current;
      if (mine !== generation.current || !root) return;
      const height = (role: string) => root.querySelector<HTMLElement>(`[data-measure="${role}"]`)?.getBoundingClientRect().height ?? 0;
      const itemHeights = [...root.querySelectorAll<HTMLElement>('[data-measure="item"]')].map((el) => el.getBoundingClientRect().height);
      const capacity = pageCapacity({
        content: height("content"), firstHeader: height("first-header"), continuationHeader: height("continuation-header"), footer: height("footer"),
      });
      const { pages, oversized } = paginate(itemHeights, capacity);
      await mascotReady();
      if (mine !== generation.current) return;
      setCommitted({ pages: pages.map((page) => page.map((index) => chosen[index]!)), settings, oversized: oversized.map((index) => chosen[index]!) });
      setBusy(false);
    })();
  }, [chosen, settings, fontTick]);

  // Unmount: any in-flight generation becomes stale and commits nothing.
  useEffect(() => () => { generation.current += 1; }, []);

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

  const update = useCallback(<K extends keyof PrintSettings>(key: K, value: PrintSettings[K]) => {
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
  const unresolved = doc.items.filter((item) => item.resolution === "saved_raw" && selected.has(item.id)).length;
  const blocked = busy || !committed || chosen.length === 0 || committed.oversized.length > 0;
  const previewHeight = pageCount * SHEET_PX.height + Math.max(0, pageCount - 1) * SHEET_GAP_PX;

  return (
    <div className="grid gap-lg py-lg lg:grid-cols-[20rem_minmax(0,1fr)]">
      <aside className="flex max-h-[calc(100dvh-var(--header-height,4rem))] flex-col gap-md overflow-y-auto lg:sticky lg:top-0">
        <h1 className="text-heading font-bold">{t("heading")}</h1>
        <nav className="flex gap-xs">
          {views.map((view) => (
            <Link key={view.href} href={view.href} aria-current={view.current ? "page" : undefined}
              className="rounded-md border border-border px-sm py-2xs text-caption aria-[current=page]:bg-muted aria-[current=page]:font-semibold">
              {view.label}
            </Link>
          ))}
        </nav>
        <SegmentedControl aria-label={t("mode")} value={settings.mode} onValueChange={(value) => update("mode", value)}
          options={[{ value: "review", label: t("modeReview") }, { value: "selfTest", label: t("modeSelfTest") }]} />
        <fieldset className="space-y-xs">
          <legend className="text-caption font-semibold text-muted-foreground">{t("show")}</legend>
          {(["showReading", "showMeaning", "showExample"] as const).map((key) => (
            <label key={key} className="flex items-center justify-between gap-sm text-body">
              {t(key)}
              <Switch checked={settings[key]} onCheckedChange={(checked) => update(key, checked)} />
            </label>
          ))}
        </fieldset>
        {settings.mode === "selfTest" && (
          <SegmentedControl aria-label={t("hide")} value={settings.hide} onValueChange={(value) => update("hide", value)}
            options={[{ value: "meaning", label: t("showMeaning") }, { value: "reading", label: t("showReading") }]} />
        )}
        <SegmentedControl aria-label={t("density")} value={settings.density} onValueChange={(value) => update("density", value)}
          options={[{ value: "airy", label: t("densityAiry") }, { value: "compact", label: t("densityCompact") }]} />
        <div className="space-y-xs">
          <div className="flex items-center justify-between gap-sm">
            <span className="text-caption font-semibold text-muted-foreground">{t("words")}</span>
            <span className="flex gap-xs">
              <Button variant="ghost" size="sm" onClick={() => setSelected(new Set(doc.items.map((item) => item.id)))}>{t("selectAll")}</Button>
              <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>{t("selectNone")}</Button>
            </span>
          </div>
          <ul className="space-y-2xs">
            {doc.items.map((item) => (
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
          {busy && !committed ? t("preparing") : t("count", { selected: chosen.length, total: doc.items.length, pages: chosen.length === 0 ? 0 : pageCount })}
        </p>
        {unresolved > 0 && <p className="text-caption text-muted-foreground">{t("unresolved", { count: unresolved })}</p>}
        {committed?.oversized.map((item) => (
          <p key={item.id} role="alert" className="text-caption text-destructive">{t("oversized", { word: item.surface })}</p>
        ))}
        <Button className="sticky bottom-0 mt-auto" aria-disabled={blocked || undefined} onClick={() => { if (!blocked) window.print(); }}>
          {t("print")}
        </Button>
      </aside>

      <div ref={previewRef} data-preview="" className="min-w-0">
        {chosen.length === 0
          ? <p className="text-body text-muted-foreground">{t("empty")}</p>
          : committed && (
            <div style={{ height: previewHeight * scale }}>
              <div className="origin-top-left" style={{ width: SHEET_PX.width, transform: `scale(${scale})` }}>
                <PrintSheets pages={committed.pages} settings={committed.settings} labels={labels} />
              </div>
            </div>
          )}
      </div>

      {/* Spec §3.3: the hidden measurement tree, same components and paper width, never scaled, never printed. */}
      <div ref={measureRef} aria-hidden className={`vp-paper vp-measure${settings.density === "compact" ? " vp-compact" : ""}`} style={paperVars() as CSSProperties}>
        <div data-measure="content" className="vp-measure-content" />
        <div data-measure="first-header"><FirstHeader labels={labels} /></div>
        <div data-measure="continuation-header"><ContinuationHeader labels={labels} /></div>
        <div data-measure="footer"><Footer labels={labels} page={88} count={88} /></div>
        {chosen.map((item) => (
          <div key={item.id} data-measure="item"><PrintItem item={item} settings={settings} englishMeaning={labels.englishMeaning} /></div>
        ))}
      </div>

      {portal && createPortal(
        <div data-print-root="">
          {committed && chosen.length > 0 && <PrintSheets pages={committed.pages} settings={committed.settings} labels={labels} />}
        </div>,
        portal,
      )}
    </div>
  );
}
```

Notes for the implementer:
- The 16px gap between preview sheets comes from the `@media screen { .vp-paper:not(.vp-measure) … gap: 16px }` rule added in Task 7; `SHEET_GAP_PX` must equal it.
- The footer is measured with `page={88} count={88}`, the widest two-digit label, so 9 → 10 pages never changes the footer height.
- `SegmentedControl` renders a WAI-ARIA radiogroup (`role="radio"` per option, `components/ui/segmented-control.tsx:64-78`), so the tests click `radio "Compact"`.
- The `labels.pageNumber` function never crosses the server boundary — `PrintWorkspace` builds it on the client.

Run `npx vitest run components/vocabulary-print --minWorkers=1 --maxWorkers=2` → PASS.

- [ ] **Step 3: Mutation checks**

1. Delete `if (mine !== generation.current) return;` after `await mascotReady()` → the stale-generation test FAILS. Restore.
2. Move `await mascotReady()` after `setCommitted(...)` → the mascot test FAILS. Restore.
3. Add `scale` to the measurement effect's dependency array → the resize test FAILS. Restore.

- [ ] **Step 4: Commit**

```bash
git add components/vocabulary-print app/globals.css
git commit -m "feat(print): workspace with measured pagination, atomic commit and a body-level print root"
```

---

### Task 9: Route, metadata and Chrome print checks

**Files:**
- Create: `app/[locale]/(protected)/(app)/vocab/print/page.tsx`, `app/[locale]/(protected)/(app)/vocab/print/page.test.tsx`, `tests/e2e/fixtures/print-data.ts`, `tests/e2e/print-vocabulary.spec.ts`

**Interfaces:**
- Consumes: `parsePrintQuery`, `loadPrintDocument` (Task 5), `PrintWorkspace` (Task 8).

- [ ] **Step 1: Write the failing route test**

`app/[locale]/(protected)/(app)/vocab/print/page.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadPrintDocument } from "@/lib/vocabulary/print/load";
import PrintPage, { generateMetadata } from "./page";

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ notFound: vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); }) }));
vi.mock("@/lib/vocabulary/print/load", () => ({ loadPrintDocument: vi.fn() }));
vi.mock("@/lib/i18n/server", () => ({ getTranslations: vi.fn(async () => (key: string, values?: Record<string, string>) => `${key}${values ? JSON.stringify(values) : ""}`) }));

const LESSON = "ba522023-8eba-4929-924f-35ae69eacf99";
const params = { locale: "vi" as const };

describe("/vocab/print (spec §2.1)", () => {
  it("is a static segment beside /vocab/[id], so Next routes /vocab/print here", () => {
    const dir = join(process.cwd(), "app/[locale]/(protected)/(app)/vocab");
    expect(existsSync(join(dir, "print/page.tsx"))).toBe(true);
    expect(existsSync(join(dir, "[id]/page.tsx"))).toBe(true);
  });

  it("404s a bad or ambiguous query without loading anything", async () => {
    for (const searchParams of [{ source: "lesson", lesson: "x" }, { source: ["lesson", "lesson"], lesson: LESSON }]) {
      await expect(PrintPage({ params, searchParams })).rejects.toThrow("NEXT_NOT_FOUND");
    }
    expect(loadPrintDocument).not.toHaveBeenCalled();
  });

  it("404s an unreadable lesson exactly like a missing one", async () => {
    for (const kind of ["unauthorized", "not_found"] as const) {
      vi.mocked(loadPrintDocument).mockResolvedValueOnce({ kind });
      await expect(PrintPage({ params, searchParams: { source: "lesson", lesson: LESSON } })).rejects.toThrow("NEXT_NOT_FOUND");
    }
  });

  it("titles the page after the lesson for the PDF file name", async () => {
    vi.mocked(loadPrintDocument).mockResolvedValueOnce({ kind: "ok", doc: { title: "苦手な人", backHref: "/b", backLabel: "b", items: [] } });
    expect(await generateMetadata({ params, searchParams: { source: "lesson", lesson: LESSON } })).toEqual({ title: 'pageTitle{"title":"苦手な人"}' });
  });
});
```

Run → FAIL (page missing).

- [ ] **Step 2: Implement the route**

`app/[locale]/(protected)/(app)/vocab/print/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { Container } from "@/components/ui/container";
import { PrintWorkspace } from "@/components/vocabulary-print/print-workspace";
import type { Locale } from "@/lib/i18n";
import { getTranslations } from "@/lib/i18n/server";
import { loadPrintDocument } from "@/lib/vocabulary/print/load";
import { parsePrintQuery, type PrintSource } from "@/lib/vocabulary/print/source";

export const dynamic = "force-dynamic";

type Props = { params: { locale: Locale }; searchParams: Record<string, string | string[] | undefined> };

/** One parse per request, so `loadPrintDocument`'s cache sees the same source object from metadata and page. */
const sourceOf = cache((query: string): PrintSource | null => {
  const params = new URLSearchParams(query);
  // A repeated key is ambiguous; Object.fromEntries would silently keep the last one.
  if (["source", "lesson", "set"].some((key) => params.getAll(key).length > 1)) return null;
  return parsePrintQuery(Object.fromEntries(params));
});
const queryOf = (searchParams: Props["searchParams"]) =>
  new URLSearchParams(Object.entries(searchParams).flatMap(([key, value]) => (Array.isArray(value) ? value.map((v) => [key, v]) : value === undefined ? [] : [[key, value]]))).toString();

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const source = sourceOf(queryOf(searchParams));
  if (!source) return {};
  const result = await loadPrintDocument(source, params.locale);
  if (result.kind !== "ok") return {};
  const t = await getTranslations({ locale: params.locale, namespace: "vocab.print" });
  return { title: t("pageTitle", { title: result.doc.title }) };
}

/** Spec §2.1: never reveals whether a lesson exists — unreadable and missing are the same 404. */
export default async function VocabularyPrintPage({ params, searchParams }: Props) {
  const source = sourceOf(queryOf(searchParams));
  if (!source) notFound();
  const result = await loadPrintDocument(source, params.locale);
  if (result.kind !== "ok") notFound();
  const t = await getTranslations({ locale: params.locale, namespace: "vocab.print" });
  const href = (set: "all" | "saved") => `/vocab/print?source=lesson&lesson=${source.lessonId}&set=${set}`;
  return (
    <Container>
      <PrintWorkspace doc={result.doc} views={[
        { label: t("setAll"), href: href("all"), current: source.set === "all" },
        { label: t("setSaved"), href: href("saved"), current: source.set === "saved" },
      ]} />
    </Container>
  );
}
```

Add the case `{ source: ["lesson", "lesson"], lesson: LESSON }` to the "404s a bad query" test (a loop over both bad queries). Run the route test → PASS.

- [ ] **Step 3: E2E fixture**

`tests/e2e/fixtures/print-data.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";

/** 30 lines, one distinct common noun each, so set=all reaches its 24-word cap and spans pages. */
export const PRINT_NOUNS = [
  "学校", "先生", "電車", "天気", "時間", "写真", "映画", "料理", "音楽", "仕事", "会社", "家族", "友達", "部屋", "新聞",
  "手紙", "季節", "公園", "病院", "図書館", "銀行", "会議", "旅行", "野菜", "果物", "動物", "自転車", "飛行機", "番組", "世界",
];
export const LONG_TITLE = `${"とても長いレッスンのタイトルが続きます".repeat(4)}-https://example.com/a/very/long/unbroken/path/segment`;

export async function seedPrintLesson(admin: SupabaseClient, prefix: string): Promise<{ videoId: string; lineIds: string[] }> {
  const video = await admin.from("videos").insert({
    youtube_video_id: `${prefix}-print`, title: LONG_TITLE, library_access: "FREE", duration_seconds: 120, jlpt_level_estimate: "N4",
  }).select("id").single();
  if (video.error) throw video.error;
  const transcript = await admin.from("transcripts").insert({ video_id: video.data.id, source: "youtube_caption", language: "ja" }).select("id").single();
  if (transcript.error) throw transcript.error;
  const lines = await admin.from("transcript_lines").insert(PRINT_NOUNS.map((noun, index) => ({
    transcript_id: transcript.data.id, start_time: index * 3, end_time: index * 3 + 2.5, text_jp: `これは${noun}の話です。`, text_translation: null,
  }))).select("id");
  if (lines.error) throw lines.error;
  return { videoId: video.data.id, lineIds: lines.data.map((line) => line.id as string) };
}
```

(Reuse `seedWorkspaceData`'s admin client and `prefix`/`cleanup`: its cleanup deletes every video whose `youtube_video_id` starts with the prefix, which covers `${prefix}-print`. If `WorkspaceData` does not expose `prefix`, add it to the returned object in `tests/e2e/fixtures/workspace-data.ts`.)

- [ ] **Step 4: Write the E2E spec**

`tests/e2e/print-vocabulary.spec.ts`:

```ts
import { expect, test, type Page } from "@playwright/test";
import { registerViaUi, uniqueEmail } from "./fixtures/auth";
import { seedPrintLesson } from "./fixtures/print-data";
import { seedWorkspaceData, type WorkspaceData } from "./fixtures/workspace-data";

test.use({ viewport: { width: 1280, height: 529 } });
let data: WorkspaceData;
let lesson: { videoId: string; lineIds: string[] };
test.beforeAll(async () => {
  data = await seedWorkspaceData();
  lesson = await seedPrintLesson(data.admin, data.prefix);
});
test.afterAll(async () => { await data?.cleanup(); });

async function learner(page: Page): Promise<void> {
  await page.goto("/en/register");
  await registerViaUi(page, { name: "E2E Print", email: uniqueEmail("e2e_print"), password: "password123" });
  await expect(page).toHaveURL(/\/en\/dashboard$/, { timeout: 15_000 });
}
const open = async (page: Page, set = "all") => {
  await page.goto(`/en/vocab/print?source=lesson&lesson=${lesson.videoId}&set=${set}`);
  await expect(page.getByRole("status").filter({ hasText: /words ·/ })).toBeVisible({ timeout: 30_000 });
};
const geometry = (page: Page) => page.evaluate(() => {
  const logical = [...document.querySelectorAll<HTMLElement>('[data-measure="item"]')].map((el) => el.offsetHeight);
  const sheets = document.querySelectorAll("[data-print-root] .vp-sheet").length;
  return { logical, sheets };
});

test("1 · the PDF has one page per DOM sheet, and no item crosses its sheet", async ({ page }) => {
  await learner(page);
  await open(page);
  const { sheets } = await geometry(page);
  expect(sheets).toBeGreaterThan(1); // positive control: 24 words span several pages
  await page.emulateMedia({ media: "print" });
  const crossing = await page.evaluate(() => [...document.querySelectorAll("[data-print-root] .vp-sheet")].flatMap((sheet) => {
    const bottom = sheet.getBoundingClientRect().bottom;
    return [...sheet.querySelectorAll(".vp-item")].filter((item) => item.getBoundingClientRect().bottom > bottom + 0.5).map((item) => item.textContent);
  }));
  expect(crossing).toEqual([]);
  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
  const pdfPages = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
  expect(pdfPages).toBe(sheets);
});

test("2 · print media shows only the print root; the measurement tree and app shell are gone", async ({ page }) => {
  await learner(page);
  await open(page);
  await page.emulateMedia({ media: "print" });
  expect(await page.evaluate(() => {
    const shown = [...document.body.children].filter((el) => getComputedStyle(el).display !== "none");
    return shown.map((el) => el.hasAttribute("data-print-root"));
  })).toEqual([true]);
  await expect(page.locator(".vp-measure")).toBeHidden();
});

test("3 · dark theme: print-root Japanese uses Noto Sans JP, paper stays #111 on white, page count holds", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await learner(page);
  await open(page);
  const before = (await geometry(page)).sheets;
  await page.emulateMedia({ media: "print", colorScheme: "dark" });
  const style = await page.evaluate(() => {
    const word = document.querySelector<HTMLElement>("[data-print-root] .vp-word")!;
    const sheet = document.querySelector<HTMLElement>("[data-print-root] .vp-sheet")!;
    return { font: getComputedStyle(word).fontFamily, color: getComputedStyle(word).color, paper: getComputedStyle(sheet).backgroundColor };
  });
  expect(style.font).toMatch(/Noto[_ ]Sans[_ ]JP/i); // next/font names the face __Noto_Sans_JP_<hash>
  expect(style.color).toBe("rgb(17, 17, 17)");
  expect(style.paper).toBe("rgb(255, 255, 255)");
  expect((await geometry(page)).sheets).toBe(before);
});

test("4 · at 375px the logical heights and page count are unchanged; only the preview scale differs", async ({ page }) => {
  await learner(page);
  await open(page);
  const wide = await geometry(page);
  await page.setViewportSize({ width: 375, height: 800 });
  await page.waitForTimeout(300);
  const narrow = await geometry(page);
  expect(narrow).toEqual(wide);
  const ratio = await page.evaluate(() => {
    const sheet = document.querySelector<HTMLElement>("[data-preview] .vp-sheet")!;
    return sheet.getBoundingClientRect().width / sheet.offsetWidth;
  });
  expect(ratio).toBeLessThan(1);
  expect(ratio).toBeGreaterThan(0.3);
});

test("5 · a long unbroken title wraps in the header and nothing overflows the first sheet", async ({ page }) => {
  await learner(page);
  await open(page);
  const overflow = await page.evaluate(() => {
    const sheet = document.querySelector<HTMLElement>("[data-print-root] .vp-sheet")!;
    const head = sheet.querySelector<HTMLElement>(".vp-head-first")!;
    return { headTaller: head.offsetHeight > 80, scroll: sheet.scrollWidth - sheet.clientWidth };
  });
  expect(overflow.headTaller).toBe(true); // positive control: the title really wraps
  expect(overflow.scroll).toBe(0);
});

test("6 · saved set: a word saved from Summary prints; nothing saved shows the back link", async ({ page }) => {
  await learner(page);
  // Nothing saved yet: the empty state, not a status line, so no open() here.
  await page.goto(`/en/vocab/print?source=lesson&lesson=${lesson.videoId}&set=saved`);
  await expect(page.getByRole("link", { name: "Back to the lesson summary" })).toBeVisible();
  await expect(page.locator("[data-print-root] .vp-sheet")).toHaveCount(0);
  const saved = await page.request.post("/api/mining", { data: { lineId: lesson.lineIds[0], targetWord: "学校", sourceKind: "vocabulary" } });
  expect(saved.ok()).toBe(true);
  await open(page, "saved");
  await expect(page.locator("[data-print-root] .vp-word")).toHaveText(["学校"]);
});
```

If the PDF page regex does not match Chromium's output (it writes `/Type /Page` per page object, `/Type /Pages` for the tree), log `pdf.toString("latin1").match(/\/Type\s*\/Pages?\b/g)` once, adjust, and keep the comparison against `sheets`.

- [ ] **Step 5: Run the E2E**

Stop any server on :3000 (`Get-NetTCPConnection -LocalPort 3000 -State Listen` → `Stop-Process`), then from PowerShell in the worktree:

```powershell
$env:AI_PROVIDER='none'; npx playwright test tests/e2e/print-vocabulary.spec.ts tests/e2e/summary.spec.ts
```

Expected: all print tests and the 12 summary tests PASS.

- [ ] **Step 6: E2E mutations**

1. In `print-workspace.tsx` delete `await (document as …).fonts?.ready;` → test 1 or 3 must FAIL (heights measured before the JP font). If neither fails, the measurement is not font-sensitive in this fixture: switch the fixture nouns' lines to longer sentences until removing `fonts.ready` changes `sheets`, and record the result.
2. In `paper.ts` set `heightMm: 250` → test 1 must FAIL (PDF pages ≠ sheets, A4 page vs 250 mm sheet). Restore both.

- [ ] **Step 7: Commit**

```bash
git add "app/[locale]/(protected)/(app)/vocab/print" tests/e2e components/vocabulary-print lib/vocabulary
git commit -m "feat(print): /vocab/print route and Chrome print/PDF checks"
```

---

### Task 10: Whole-branch gates and owner review

**Files:**
- Modify: `docs/superpowers/run-state/print-vocabulary.md`, `docs/lessons.md`, `docs/superpowers/specs/2026-10-05-print-vocabulary-design.md` (fold in the three plan refinements listed at the top)

- [ ] **Step 1: Full gates**

```powershell
npx tsc --noEmit; if ($?) { npm run lint }
npx vitest run --minWorkers=1 --maxWorkers=2
$env:AI_PROVIDER='none'; npm run test:e2e
npm run verify:protocol
```

All exit 0; keep the output for the report.

- [ ] **Step 2: Whole-branch review**

Dispatch `code-reviewer` on `git diff master...print-vocabulary` with the spec path. Fix every Critical and Important finding test-first, re-run Step 1.

- [ ] **Step 3: Owner Chrome + paper review**

Serve this worktree's build on :3000 (`npx next build` then `npx next start -p 3000`, both from the worktree, absolute paths), then hand the owner:
- `/vi/vocab/print?source=lesson&lesson=ba522023-8eba-4929-924f-35ae69eacf99&set=all` (Ep.729) — a 2–3 page PDF: page 1 mascot + full header, pages 2+ compact header, footer aligned on every page, footer mark legible in grayscale, dark theme leaves the paper white;
- Ep.729 Shadowing popup on 人 → ひと, ん with no popup;
- Summary Words: the `EN` chip and the "In từ vựng" link.

Screenshots from a Playwright script under `.superpowers/sdd/print-vocabulary/` for the parts the owner's reviewer cannot open.

- [ ] **Step 4: Lessons and run state**

Add the branch's lessons to `docs/lessons.md` under the four entry rules (merge into an existing entry where one applies). Update the run state with the gate output, then commit:

```bash
git add docs
git commit -m "docs(run-state): print-vocabulary gates green; awaiting the owner's Chrome and paper review"
```

Merge (`--no-ff`) only after the owner approves.
