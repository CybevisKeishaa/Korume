import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, eqValue, type QueryCall } from "@/test/supabase-mock";
import { assertPlainSerializableDto } from "@/test/dto";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { getActiveSnapshotId } from "@/lib/dictionary/snapshot";
import { tokenize } from "@/lib/japanese/tokenizer";
import { getLineAnalysisForLearner, resetLineAnalysisCache, staticAnalyses } from "./line-analysis";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn() }));
vi.mock("@/lib/dictionary/snapshot", () => ({ getActiveSnapshotId: vi.fn() }));
vi.mock("@/lib/japanese/tokenizer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/japanese/tokenizer")>();
  return { ...actual, tokenize: vi.fn(actual.tokenize) };
});
// A getter, so a test can bump the version the memo key reads (spec §1.10).
const resolver = vi.hoisted(() => ({ version: 1 }));
vi.mock("./lexical-resolver", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./lexical-resolver")>()),
  get LEXICAL_RESOLVER_VERSION() { return resolver.version; },
}));

const LINE_ID = "a0000000-0000-0000-0000-000000000001";
const TEXT = "全部食べてしまった";
const TABERU = { ent_seq: 1358280, kanji_forms: ["食べる", "喰べる"], kana_forms: ["たべる"], senses: [{ gloss: ["to eat"] }], common: true, jlpt: 5 };
const ZENBU = { ent_seq: 1384080, kanji_forms: ["全部"], kana_forms: ["ぜんぶ"], senses: [{ gloss: ["all", "entire"] }], common: true, jlpt: null };
const SHIMAU_HOMOGRAPH = { ent_seq: 1305800, kanji_forms: ["仕舞う"], kana_forms: ["しまう"], senses: [{ gloss: ["to finish"] }], common: true, jlpt: null };
const GRAMMAR = [{
  id: "g-shimau", title: "〜てしまう", structure_pattern: "〜てしまう", explanation: "Completion or regret.",
  example_sentences: [{ jp: "食べてしまった。", en: "I ate it all." }], created_at: "2026-07-12T00:00:00Z",
}];

let dictQueries: QueryCall[][];
let mastery: Record<string, number>;
let grammarReads: number;

function useUser(user: { id: string } | null, lineVisible = true) {
  vi.mocked(createClient).mockReturnValue(createMockSupabase({
    user,
    tables: {
      transcript_lines: () => ({ data: lineVisible ? { id: LINE_ID, text_jp: TEXT } : null, error: null }),
      grammar_points: () => {
        grammarReads += 1;
        return { data: GRAMMAR, error: null };
      },
      dict_entries: (calls) => {
        dictQueries.push(calls);
        const overlap = calls.find((call) => call.op === "overlaps");
        const forms = overlap?.op === "overlaps" ? (overlap.values as string[]) : [];
        const column = overlap?.op === "overlaps" ? (overlap.column as "kanji_forms" | "kana_forms") : "kanji_forms";
        return { data: [TABERU, ZENBU, SHIMAU_HOMOGRAPH].filter((row) => row[column].some((form) => forms.includes(form))), error: null };
      },
      vocab: () => ({ data: [{ id: "v-taberu", word: "食べる", reading: "たべる", meaning_vi: "ăn" }], error: null }),
      user_vocab_progress: (calls) => {
        const ids = (calls.find((call) => call.op === "in") as { values: string[] } | undefined)?.values ?? [];
        return { data: ids.filter((id) => id in mastery).map((id) => ({ vocab_id: id, srs_stage: mastery[id] })), error: null };
      },
    },
  }) as ReturnType<typeof createClient>);
}

beforeEach(() => {
  vi.clearAllMocks();
  resetLineAnalysisCache();
  dictQueries = [];
  mastery = {};
  grammarReads = 0;
  resolver.version = 1;
  vi.mocked(rateLimit).mockReturnValue({ ok: true, retryAfter: 0 });
  vi.mocked(getActiveSnapshotId).mockResolvedValue("snap-1");
  useUser({ id: "u-a" });
});

describe("getLineAnalysisForLearner", () => {
  it("returns lexical analysis without grammar and never reads grammar points", async () => {
    const analysis = (await staticAnalyses(createClient(), [{ id: LINE_ID, textJp: TEXT }], 0, "lexical")).get(LINE_ID);
    expect(analysis).toBeDefined();
    expect(analysis).not.toHaveProperty("grammar");
    expect(grammarReads).toBe(0);
  });

  it("keeps lexical and full memo entries separate when full follows lexical", async () => {
    await staticAnalyses(createClient(), [{ id: LINE_ID, textJp: TEXT }], 0, "lexical");
    const full = (await staticAnalyses(createClient(), [{ id: LINE_ID, textJp: TEXT }], 0, "full")).get(LINE_ID);
    expect(full?.grammar).toHaveLength(1);
    expect(grammarReads).toBe(1);
  });

  it("does not return a full memo entry for a later lexical analysis", async () => {
    await staticAnalyses(createClient(), [{ id: LINE_ID, textJp: TEXT }], 0, "full");
    const lexical = (await staticAnalyses(createClient(), [{ id: LINE_ID, textJp: TEXT }], 0, "lexical")).get(LINE_ID);
    expect(lexical).not.toHaveProperty("grammar");
  });

  it("returns lexical learner DTOs without grammar", async () => {
    const result = await getLineAnalysisForLearner(LINE_ID, "lexical");
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.analysis.mastery).toEqual({});
    expect(result.analysis).not.toHaveProperty("grammar");
  });

  it("tokenizes with UTF-16 spans, matches JMdict on the base form and grammar on the real segmentation", async () => {
    const result = await getLineAnalysisForLearner(LINE_ID);
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    assertPlainSerializableDto(result.analysis);
    const { tokens, grammar } = result.analysis;
    expect(tokens.map((token) => token.surface).join("")).toBe(TEXT);
    for (const token of tokens) expect(TEXT.slice(token.span.start, token.span.end)).toBe(token.surface);

    const tabe = tokens.find((token) => token.base === "食べる");
    expect(tabe?.entries).toEqual([{ entSeq: 1358280, headword: "食べる", reading: "たべる", glossEn: "to eat", jlpt: 5 }]);
    expect(tabe?.vocabId).toBe("v-taberu");
    expect(tabe).toMatchObject({ posDetail1: "自立", curatedVi: "ăn" });
    expect(tokens.find((token) => token.surface === "て")?.entries).toEqual([]); // particles are not looked up
    // しまっ is 動詞/非自立 (spec §1.6): no popup, though 仕舞う shares its kana.
    expect(tokens.find((token) => token.surface === "しまっ")?.entries).toEqual([]);
    expect(grammar).toEqual([{
      grammarPointId: "g-shimau", title: "〜てしまう", structure: "〜てしまう", explanation: "Completion or regret.",
      examples: [{ jp: "食べてしまった。", en: "I ate it all." }], span: { start: 4, end: 8 },
    }]);
    expect(result.analysis.snapshotId).toBe("snap-1");
    for (const query of dictQueries) expect(eqValue(query, "snapshot_id")).toBe("snap-1");
  });

  it("memoises the static analysis: a second request tokenizes nothing and queries no dictionary", async () => {
    await getLineAnalysisForLearner(LINE_ID);
    const dictionaryReads = dictQueries.length;
    await getLineAnalysisForLearner(LINE_ID);
    expect(tokenize).toHaveBeenCalledTimes(1);
    expect(dictQueries).toHaveLength(dictionaryReads);
  });

  it("re-analyses a line when its text changes despite retaining its id", async () => {
    await staticAnalyses(createClient(), [{ id: LINE_ID, textJp: TEXT }]);
    const changed = (await staticAnalyses(createClient(), [{ id: LINE_ID, textJp: "食べる" }])).get(LINE_ID);
    expect(changed?.tokens.map((token) => token.surface).join("")).toBe("食べる");
    expect(tokenize).toHaveBeenCalledTimes(2);
  });

  it("joins mastery per request and never stores it in the shared analysis", async () => {
    mastery = { "v-taberu": 3 };
    const a = await getLineAnalysisForLearner(LINE_ID);
    useUser({ id: "u-b" });
    mastery = { "v-taberu": 7 };
    const b = await getLineAnalysisForLearner(LINE_ID);
    expect(a.kind === "ok" && a.analysis.mastery).toEqual({ "v-taberu": 3 });
    expect(b.kind === "ok" && b.analysis.mastery).toEqual({ "v-taberu": 7 });
    const shared = (await staticAnalyses(createClient(), [{ id: LINE_ID, textJp: TEXT }])).get(LINE_ID);
    expect(shared).toBeDefined();
    expect(Object.hasOwn(shared ?? {}, "mastery")).toBe(false);
    expect(tokenize).toHaveBeenCalledTimes(1);
  });

  it("re-analyses when the dictionary snapshot changes", async () => {
    await getLineAnalysisForLearner(LINE_ID);
    vi.mocked(getActiveSnapshotId).mockResolvedValue("snap-2");
    const next = await getLineAnalysisForLearner(LINE_ID);
    expect(tokenize).toHaveBeenCalledTimes(2);
    expect(next.kind === "ok" && next.analysis.snapshotId).toBe("snap-2");
  });

  it("re-analyses when the lexical resolver version changes", async () => {
    await getLineAnalysisForLearner(LINE_ID);
    resolver.version += 1;
    await getLineAnalysisForLearner(LINE_ID);
    expect(tokenize).toHaveBeenCalledTimes(2);
  });

  it("still tokenizes and matches grammar before the first dictionary import", async () => {
    vi.mocked(getActiveSnapshotId).mockResolvedValue(null);
    const result = await getLineAnalysisForLearner(LINE_ID);
    expect(result.kind === "ok" && result.analysis.tokens.every((token) => token.entries.length === 0)).toBe(true);
    expect(result.kind === "ok" && result.analysis.grammar).toHaveLength(1);
    expect(dictQueries).toHaveLength(0);
  });

  it("refuses anonymous, rate-limited and unreadable requests", async () => {
    useUser(null);
    await expect(getLineAnalysisForLearner(LINE_ID)).resolves.toEqual({ kind: "unauthorized" });
    useUser({ id: "u-a" }, false);
    await expect(getLineAnalysisForLearner(LINE_ID)).resolves.toEqual({ kind: "not_found" });
    vi.mocked(rateLimit).mockReturnValue({ ok: false, retryAfter: 3_000 });
    await expect(getLineAnalysisForLearner(LINE_ID)).resolves.toEqual({ kind: "rate_limited", retryAfter: 3_000 });
    expect(tokenize).not.toHaveBeenCalled();
  });
});

describe("staticAnalyses on the shared resolver (spec §1)", () => {
  const HITO = { ent_seq: 3000, kanji_forms: ["人"], kana_forms: ["ひと"], senses: [{ gloss: ["person"] }], common: true, jlpt: 5 };
  const JIN = { ent_seq: 2000, kanji_forms: ["人"], kana_forms: ["じん"], senses: [{ gloss: ["-ian"] }], common: true, jlpt: null };
  const N_YES = { ent_seq: 1000, kanji_forms: [], kana_forms: ["ん"], senses: [{ gloss: ["yes", "yeah"] }], common: true, jlpt: null };
  /** Every form the dictionary was queried for, to prove what is never asked. */
  let asked: string[];

  beforeEach(() => { asked = []; });

  function useDictionary(rows: unknown[], vocab: unknown[] = []) {
    vi.mocked(createClient).mockReturnValue(createMockSupabase({
      user: { id: "u-a" },
      tables: {
        dict_entries: (calls) => {
          const overlap = calls.find((call) => call.op === "overlaps");
          const forms = overlap?.op === "overlaps" ? (overlap.values as string[]) : [];
          const column = overlap?.op === "overlaps" ? (overlap.column as "kanji_forms" | "kana_forms") : "kanji_forms";
          asked.push(...forms);
          return { data: (rows as { kanji_forms: string[]; kana_forms: string[] }[]).filter((row) => row[column].some((form) => forms.includes(form))), error: null };
        },
        // Like the real query, only the asked headwords come back: that is what `headwords` widening must satisfy.
        vocab: (calls) => {
          const words = (calls.find((call) => call.op === "in")?.values ?? []) as string[];
          return { data: (vocab as { word: string }[]).filter((row) => words.includes(row.word)), error: null };
        },
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
    // Spec §1.6: the dictionary is not even asked about a dependent ん; 人 shows the capture works.
    expect(asked).toContain("人");
    expect(asked).not.toContain("ん");
  });

  it("keeps しまっ out of the popup even when another line of the batch looks しまう up", async () => {
    useDictionary([SHIMAU_HOMOGRAPH]);
    const lines = [{ id: "l-3", textJp: "荷物をしまう" }, { id: "l-4", textJp: TEXT }];
    const analyses = await staticAnalyses(createClient(), lines, undefined, "lexical");
    // しまう is 動詞/自立 on l-3, so the batch holds 仕舞う; しまっ (動詞/非自立) on l-4 must still not resolve to it.
    expect(analyses.get("l-3")?.tokens.find((token) => token.surface === "しまう")?.entries).toEqual([expect.objectContaining({ entSeq: 1305800 })]);
    expect(analyses.get("l-4")?.tokens.find((token) => token.surface === "しまっ")?.entries).toEqual([]);
  });

  it("joins the curated row of a kanji headword to a token written in kana", async () => {
    useDictionary([HITO], [{ id: "v-hito", word: "人", reading: "ひと", meaning_vi: "người" }]);
    const tokens = (await staticAnalyses(createClient(), [{ id: "l-5", textJp: "ひとを見た" }], undefined, "lexical")).get("l-5")?.tokens ?? [];
    expect(tokens.find((token) => token.surface === "ひと")).toMatchObject({
      entries: [expect.objectContaining({ headword: "人", reading: "ひと" })], vocabId: "v-hito", curatedVi: "người",
    });
  });

  it("does not attach a vocab row of the same word with another reading", async () => {
    useDictionary([JIN, HITO], [{ id: "v-jin", word: "人", reading: "じん", meaning_vi: "người (nước)" }]);
    const tokens = (await staticAnalyses(createClient(), [{ id: "l-2", textJp: "苦手な人" }], undefined, "lexical")).get("l-2")?.tokens ?? [];
    expect(tokens.find((token) => token.surface === "人")).toMatchObject({ vocabId: null, curatedVi: null });
  });
});
