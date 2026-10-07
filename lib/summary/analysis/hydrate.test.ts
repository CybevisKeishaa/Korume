import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type QueryCall } from "@/test/supabase-mock";
import { getActiveSnapshotId } from "@/lib/dictionary/snapshot";
import type { AnalysisToken } from "@/lib/analysis/types";
import type { SummaryLine } from "../snapshot";
import { hydrateAnalysis } from "./hydrate";
import type { StoredAnalysis } from "./schema";

vi.mock("@/lib/dictionary/snapshot", () => ({ getActiveSnapshotId: vi.fn() }));

const LINES: SummaryLine[] = [
  { id: "line-1", index: 0, textJp: "注文をお願いします。", translation: null, startTime: 1.5, endTime: 3 },
  { id: "line-2", index: 1, textJp: "座ってもいいですか。", translation: null, startTime: 3, endTime: null },
];
const STORED: StoredAnalysis = {
  overview: "Ordering.",
  words: [
    { entSeq: 100, surface: "注文", sourceLineId: "line-1", whyItMatters: "why", usageNote: "how" },
    { entSeq: 999, surface: "幻", sourceLineId: "line-1", whyItMatters: "why", usageNote: "how" },
    { entSeq: 200, surface: "座る", sourceLineId: "line-2", whyItMatters: "why", usageNote: "how" },
  ],
  expressions: [
    { sourceLineId: "line-1", span: "お願いします", meaningUse: "m", nuance: "n", commonness: "very_common" },
    { sourceLineId: "deleted-line", span: "x", meaningUse: "m", nuance: "n", commonness: "common" },
  ],
  grammar: [{ grammarId: "g-temo", sourceLineId: "line-2", span: "てもいい", meaningShort: "may", explanation: "e", tryIt: "食べてもいい？" }],
  culture: [{ sourceLineId: "line-2", title: "Asking first", body: "b" }],
};
const ENTRY = {
  ent_seq: 100, kanji_forms: ["注文"], kana_forms: ["ちゅうもん"], common: true, jlpt: 3,
  senses: [{ pos: ["n", "vs"], gloss: ["order", "request", "commission", "fourth"] }],
};

const ENTRY_SIT = { ent_seq: 200, kanji_forms: ["座る"], kana_forms: ["すわる"], common: true, jlpt: 4, senses: [{ pos: ["v5r"], gloss: ["to sit"] }] };

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

let dictCalls: QueryCall[][];
function supabase() {
  dictCalls = [];
  return createMockSupabase({
    user: null,
    tables: {
      dict_entries: (calls) => { dictCalls.push(calls); return { data: [ENTRY, ENTRY_SIT], error: null }; },
      grammar_points: () => ({ data: [{ id: "g-temo", title: "〜てもいい", jlpt_level: "N4" }], error: null }),
    },
  }) as unknown as Parameters<typeof hydrateAnalysis>[0];
}

beforeEach(() => vi.mocked(getActiveSnapshotId).mockResolvedValue("snap-1"));

describe("hydrateAnalysis", () => {
  it("hydrates every word fact from the active dictionary snapshot", async () => {
    const view = await hydrateAnalysis(supabase(), STORED, LINES, ANALYSES, "en");
    expect(dictCalls[0]).toContainEqual({ op: "eq", column: "snapshot_id", value: "snap-1" });
    expect(dictCalls[0]).toContainEqual({ op: "in", column: "ent_seq", values: [100, 999, 200] });
    expect(view.words).toEqual([{
      entSeq: 100, surface: "注文", written: "resolved-100", reading: "よみ100", meaning: "gloss-100", meaningLocale: "en", meaningSource: "jmdict",
      posKey: "noun", jlpt: "N3", common: true, whyItMatters: "why", usageNote: "how",
      source: { lineId: "line-1", textJp: "注文をお願いします。", startTime: 1.5, endTime: 3 },
    }, {
      entSeq: 200, surface: "座る", written: "resolved-200", reading: "よみ200", meaning: "gloss-200", meaningLocale: "en", meaningSource: "jmdict",
      posKey: "verb", jlpt: "N4", common: true, whyItMatters: "why", usageNote: "how",
      source: { lineId: "line-2", textJp: "座ってもいいですか。", startTime: 3, endTime: null },
    }]);
  });

  it("takes written, reading and meaning from the resolved token, never kana_forms[0] (spec §1.9)", async () => {
    const view = await hydrateAnalysis(supabase(), STORED, LINES, ANALYSES, "vi");
    const firstSeq = STORED.words[0]?.entSeq;
    expect(view.words[0]).toMatchObject({
      written: `resolved-${firstSeq}`, reading: `よみ${firstSeq}`, meaning: "nghĩa", meaningLocale: "vi", meaningSource: "curated",
    });
    expect(view.words[1]).toMatchObject({ entSeq: 200, meaningLocale: "en", meaningSource: "jmdict" });
  });

  it("drops a stored word whose line no longer resolves to its entSeq", async () => {
    const stale = new Map([...ANALYSES].map(([lineId, analysis]) => [lineId, { tokens: analysis.tokens.map((token) => ({ ...token, entries: [] })) }]));
    expect((await hydrateAnalysis(supabase(), STORED, LINES, stale, "en")).words).toEqual([]);
  });

  it("drops a stored word whose surface now resolves to a different entry", async () => {
    const moved = new Map([...ANALYSES].map(([lineId, analysis]) => [lineId, { tokens: analysis.tokens.map((token) => ({ ...token, entries: token.entries.map((entry) => ({ ...entry, entSeq: entry.entSeq + 1 })) })) }]));
    expect((await hydrateAnalysis(supabase(), STORED, LINES, moved, "en")).words).toEqual([]);
  });

  it("renders no word when there is no active snapshot, and leaves the other blocks alone", async () => {
    vi.mocked(getActiveSnapshotId).mockResolvedValueOnce(null);
    const view = await hydrateAnalysis(supabase(), STORED, LINES, ANALYSES, "en");
    expect(view.words).toEqual([]);
    expect(dictCalls).toHaveLength(0);
    expect(view.grammar).toHaveLength(1);
    expect(view.expressions).toHaveLength(1);
  });

  it("takes grammar title and JLPT from grammar_points, never from the artifact", async () => {
    const view = await hydrateAnalysis(supabase(), STORED, LINES, ANALYSES, "en");
    expect(view.grammar).toEqual([{
      grammarId: "g-temo", title: "〜てもいい", jlpt: "N4", meaningShort: "may", explanation: "e", tryIt: "食べてもいい？",
      span: "てもいい", source: { lineId: "line-2", textJp: "座ってもいいですか。", startTime: 3, endTime: null },
    }]);
  });

  it("drops items whose line no longer exists, and keeps the culture anchor", async () => {
    const view = await hydrateAnalysis(supabase(), STORED, LINES, ANALYSES, "en");
    expect(view.expressions.map((item) => item.expression)).toEqual(["お願いします"]);
    expect(view.culture).toEqual([{ title: "Asking first", body: "b", source: { lineId: "line-2", textJp: "座ってもいいですか。", startTime: 3, endTime: null } }]);
    expect(view.overview).toBe("Ordering.");
  });
});
