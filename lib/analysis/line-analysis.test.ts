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

function useUser(user: { id: string } | null, lineVisible = true) {
  vi.mocked(createClient).mockReturnValue(createMockSupabase({
    user,
    tables: {
      transcript_lines: () => ({ data: lineVisible ? { id: LINE_ID, text_jp: TEXT } : null, error: null }),
      grammar_points: () => ({ data: GRAMMAR, error: null }),
      dict_entries: (calls) => {
        dictQueries.push(calls);
        const overlap = calls.find((call) => call.op === "overlaps");
        const forms = overlap?.op === "overlaps" ? (overlap.values as string[]) : [];
        const column = overlap?.op === "overlaps" ? (overlap.column as "kanji_forms" | "kana_forms") : "kanji_forms";
        return { data: [TABERU, ZENBU, SHIMAU_HOMOGRAPH].filter((row) => row[column].some((form) => forms.includes(form))), error: null };
      },
      vocab: () => ({ data: [{ id: "v-taberu", word: "食べる" }], error: null }),
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
  vi.mocked(rateLimit).mockReturnValue({ ok: true, retryAfter: 0 });
  vi.mocked(getActiveSnapshotId).mockResolvedValue("snap-1");
  useUser({ id: "u-a" });
});

describe("getLineAnalysisForLearner", () => {
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
    expect(tokens.find((token) => token.surface === "て")?.entries).toEqual([]); // particles are not looked up
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
