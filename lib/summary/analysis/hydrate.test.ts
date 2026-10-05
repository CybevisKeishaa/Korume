import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type QueryCall } from "@/test/supabase-mock";
import { getActiveSnapshotId } from "@/lib/dictionary/snapshot";
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

let dictCalls: QueryCall[][];
function supabase() {
  dictCalls = [];
  return createMockSupabase({
    user: null,
    tables: {
      dict_entries: (calls) => { dictCalls.push(calls); return { data: [ENTRY], error: null }; },
      grammar_points: () => ({ data: [{ id: "g-temo", title: "〜てもいい", jlpt_level: "N4" }], error: null }),
    },
  }) as unknown as Parameters<typeof hydrateAnalysis>[0];
}

beforeEach(() => vi.mocked(getActiveSnapshotId).mockResolvedValue("snap-1"));

describe("hydrateAnalysis", () => {
  it("hydrates every word fact from the active dictionary snapshot", async () => {
    const view = await hydrateAnalysis(supabase(), STORED, LINES);
    expect(dictCalls[0]).toContainEqual({ op: "eq", column: "snapshot_id", value: "snap-1" });
    expect(dictCalls[0]).toContainEqual({ op: "in", column: "ent_seq", values: [100, 999] });
    expect(view.words).toEqual([{
      entSeq: 100, surface: "注文", written: "注文", reading: "ちゅうもん", meaning: "order; request; commission",
      posKey: "noun", jlpt: "N3", common: true, whyItMatters: "why", usageNote: "how",
      source: { lineId: "line-1", textJp: "注文をお願いします。", startTime: 1.5, endTime: 3 },
    }]);
  });

  it("renders no word when there is no active snapshot, and leaves the other blocks alone", async () => {
    vi.mocked(getActiveSnapshotId).mockResolvedValueOnce(null);
    const view = await hydrateAnalysis(supabase(), STORED, LINES);
    expect(view.words).toEqual([]);
    expect(dictCalls).toHaveLength(0);
    expect(view.grammar).toHaveLength(1);
    expect(view.expressions).toHaveLength(1);
  });

  it("takes grammar title and JLPT from grammar_points, never from the artifact", async () => {
    const view = await hydrateAnalysis(supabase(), STORED, LINES);
    expect(view.grammar).toEqual([{
      grammarId: "g-temo", title: "〜てもいい", jlpt: "N4", meaningShort: "may", explanation: "e", tryIt: "食べてもいい？",
      span: "てもいい", source: { lineId: "line-2", textJp: "座ってもいいですか。", startTime: 3, endTime: null },
    }]);
  });

  it("drops items whose line no longer exists, and keeps the culture anchor", async () => {
    const view = await hydrateAnalysis(supabase(), STORED, LINES);
    expect(view.expressions.map((item) => item.expression)).toEqual(["お願いします"]);
    expect(view.culture).toEqual([{ title: "Asking first", body: "b", source: { lineId: "line-2", textJp: "座ってもいいですか。", startTime: 3, endTime: null } }]);
    expect(view.overview).toBe("Ordering.");
  });
});
