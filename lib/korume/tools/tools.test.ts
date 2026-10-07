import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type QueryCall } from "@/test/supabase-mock";
import { getOrGenerateSection, readCachedSection } from "@/lib/knowledge/orchestrator";
import { getLineAnalysisForLearner, staticAnalyses } from "@/lib/analysis/line-analysis";
import { getActiveSnapshotId } from "@/lib/dictionary/snapshot";
import type { RetrievalContext } from "../retrieval";
import { knowledgeTool } from "./knowledge";
import { lineAnalysisTool } from "./line-analysis";
import { dictionaryTool } from "./dictionary";
import { memoryTool } from "./memory";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/knowledge/orchestrator", () => ({ readCachedSection: vi.fn(), getOrGenerateSection: vi.fn() }));
vi.mock("@/lib/dictionary/snapshot", () => ({ getActiveSnapshotId: vi.fn() }));
vi.mock("@/lib/analysis/line-analysis", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/analysis/line-analysis")>()),
  staticAnalyses: vi.fn(),
  getLineAnalysisForLearner: vi.fn(),
}));

const anchor = { lineId: "l1", videoId: "v1", lineText: "今日は晴れ", videoTitle: "Ep" };
const ctxWith = (supabase: unknown, over: Partial<RetrievalContext> = {}) =>
  ({ supabase, userId: "u1", tier: "free", locale: "en", anchor, ...over }) as RetrievalContext;

beforeEach(() => vi.clearAllMocks());

describe("knowledgeTool", () => {
  it("reads the ready cache at the learner's tier and never generates (spec §0)", async () => {
    vi.mocked(readCachedSection).mockResolvedValueOnce({ status: "ready", content: { summary: "x" }, access: "preview", model: "m" });
    await expect(knowledgeTool({ tool: "knowledge_lookup", section: "native_nuance" }, ctxWith({})))
      .resolves.toEqual({ status: "ok", data: { section: "native_nuance", access: "preview", content: { summary: "x" } } });
    expect(vi.mocked(readCachedSection).mock.calls[0]?.[0]).toMatchObject({ targetText: anchor.lineText, tier: "free", locale: "en" });
    vi.mocked(readCachedSection).mockResolvedValueOnce(null);
    await expect(knowledgeTool({ tool: "knowledge_lookup", section: "lite" }, ctxWith({}))).resolves.toEqual({ status: "not_found" });
    expect(getOrGenerateSection).not.toHaveBeenCalled();
  });

  it("has nothing to read without an anchor", async () => {
    await expect(knowledgeTool({ tool: "knowledge_lookup", section: "lite" }, ctxWith({}, { anchor: null }))).resolves.toEqual({ status: "not_found" });
    expect(readCachedSection).not.toHaveBeenCalled();
  });
});

describe("lineAnalysisTool", () => {
  it("analyses the anchored line directly, never through the rate-limited learner path (Correction 7)", async () => {
    vi.mocked(staticAnalyses).mockResolvedValue(new Map([["l1", {
      lineId: "l1", snapshotId: "s",
      tokens: [{ index: 0, surface: "今日", base: "今日", reading: "キョウ", pos: "名詞", posDetail1: null, span: { start: 0, end: 2 }, vocabId: null, curatedVi: null,
        entries: [{ entSeq: 1, headword: "今日", reading: "きょう", glossEn: "today", jlpt: 5 }, { entSeq: 2, headword: "今日", reading: "こんにち", glossEn: "these days", jlpt: null }] }],
      grammar: [],
    }]]) as never);
    const supabase = {};
    const result = await lineAnalysisTool({ tool: "line_analysis" }, ctxWith(supabase));
    expect(staticAnalyses).toHaveBeenCalledWith(supabase, [{ id: "l1", textJp: anchor.lineText }]);
    expect(getLineAnalysisForLearner).not.toHaveBeenCalled();
    expect(result).toEqual({ status: "ok", data: {
      tokens: [{ surface: "今日", base: "今日", reading: "キョウ", pos: "名詞", entSeq: 1, headword: "今日", gloss: "today", jlpt: 5 }],
      grammar: [],
    } });
  });
});

describe("dictionaryTool", () => {
  const row = (ent_seq: number, kanji: string[], kana: string[], common: boolean) =>
    ({ ent_seq, kanji_forms: kanji, kana_forms: kana, senses: [{ gloss: [`g${ent_seq}`] }], common, jlpt: null });

  it("ranks JMdict entries on the active snapshot and keeps three", async () => {
    vi.mocked(getActiveSnapshotId).mockResolvedValue("snap");
    const rows = [row(4, [], ["は"], false), row(1, [], ["は"], true), row(2, ["葉"], ["は"], true), row(3, [], ["は"], true)];
    const supabase = createMockSupabase({ tables: { dict_entries: () => ({ data: rows, error: null }) } });
    const result = await dictionaryTool({ tool: "dictionary_lookup", term: "は" }, ctxWith(supabase));
    expect(result.status).toBe("ok");
    expect((result.data as { matches: { entSeq: number }[] }).matches.map((m) => m.entSeq)).toEqual([1, 2, 3]);
  });

  it("finds nothing before the first dictionary import", async () => {
    vi.mocked(getActiveSnapshotId).mockResolvedValue(null);
    await expect(dictionaryTool({ tool: "dictionary_lookup", term: "は" }, ctxWith({}))).resolves.toEqual({ status: "not_found" });
  });
});

describe("memoryTool", () => {
  it("only SELECTs the learner's own memories, with the topic escaped (spec §7.2)", async () => {
    const calls: QueryCall[][] = [];
    const supabase = createMockSupabase({ tables: { companion_memories: (c) => {
      calls.push(c);
      return { data: [{ id: "m1", memory_type: "line_mastered", title: "50%_off", line_text_jp: null, note: null, occurred_at: "2026-10-01T00:00:00Z" }], error: null };
    } } });
    const result = await memoryTool({ tool: "memory_lookup", topic: "50%_off" }, ctxWith(supabase));
    expect(result).toMatchObject({ status: "ok", data: { memories: [{ title: "50%_off" }] } });
    expect(calls).toHaveLength(2);
    for (const c of calls) {
      expect(c.filter((q) => ["insert", "upsert", "update", "delete"].includes(q.op))).toEqual([]);
      expect(c).toContainEqual({ op: "eq", column: "user_id", value: "u1" });
      expect(c.find((q) => q.op === "ilike")).toMatchObject({ pattern: "%50\\%\\_off%" });
    }
  });
});
