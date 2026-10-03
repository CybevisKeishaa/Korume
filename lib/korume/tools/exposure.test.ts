import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type QueryCall } from "@/test/supabase-mock";
import { staticAnalyses } from "@/lib/analysis/line-analysis";
import { getActiveSnapshotId } from "@/lib/dictionary/snapshot";
import type { AnalysisToken } from "@/lib/analysis/types";
import type { RetrievalContext } from "../retrieval";
import { countExposure, EXPOSURE_MAX_LINES, exposureTool, seenLines, tokenIdentity, type ExposureLine, type ProgressRow } from "./exposure";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/dictionary/snapshot", () => ({ getActiveSnapshotId: vi.fn() }));
vi.mock("@/lib/analysis/line-analysis", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/analysis/line-analysis")>()),
  staticAnalyses: vi.fn(),
}));

/** "base/pos" or "base/pos:ent:<n>" */
function tok(spec: string, index = 0): AnalysisToken {
  const [word, ent] = spec.split(":ent:");
  const [base, pos] = (word as string).split("/");
  return {
    index, surface: base as string, base: base as string, reading: null, pos: pos as string, span: { start: 0, end: 1 }, vocabId: null,
    entries: ent ? [{ entSeq: Number(ent), headword: base as string, reading: "", glossEn: "", jlpt: null }] : [],
  };
}
let n = 0;
const line = (specs: string[], videoId = "v") => ({ videoId, lineId: `l${n++}`, tokens: specs.map(tok) });

beforeEach(() => vi.clearAllMocks());

describe("countExposure", () => {
  it("counts a particle by base and part of speech", () => {
    const lines = [line(["は/助詞", "日本/名詞"]), line(["は/助詞"]), line(["歯/名詞:ent:1"]), line(["はず/名詞"]), line(["はい/感動詞"])];
    expect(countExposure("は", new Set(), lines)).toMatchObject({ identity: "tok:は:助詞", seenCount: 2 });
  });

  it("counts a word by JMdict entry, not by substring", () => {
    const lines = [line(["日本/名詞:ent:7"]), line(["日本語/名詞:ent:8"])];
    expect(countExposure("日本", new Set([7]), lines)).toMatchObject({ identity: "ent:7", seenCount: 1 });
  });

  it("picks the identity on the most lines when a term names several", () => {
    const lines = [line(["は/助詞"]), line(["は/助詞"]), line(["歯/名詞:ent:1"])];
    expect(countExposure("は", new Set([1]), lines)).toMatchObject({ identity: "tok:は:助詞", seenCount: 2 });
  });

  it("counts a line once however often the word repeats in it", () => {
    expect(countExposure("は", new Set(), [line(["は/助詞", "は/助詞"])]).seenCount).toBe(1);
  });

  it("never counts a longer word that merely starts with the term", () => {
    expect(countExposure("は", new Set(), [line(["はず/名詞"]), line(["はい/感動詞"])]).seenCount).toBe(0);
  });

  it("reports zero for a term never met", () => {
    expect(countExposure("猫", new Set([9]), [line(["犬/名詞:ent:3"])])).toMatchObject({ seenCount: 0 });
  });

  it("names identities by entry, else by base and part of speech", () => {
    expect(tokenIdentity(tok("今日/名詞:ent:5"))).toBe("ent:5");
    expect(tokenIdentity(tok("を/助詞"))).toBe("tok:を:助詞");
  });
});

describe("seenLines", () => {
  const L = (id: string, videoId: string, startTime: number): ExposureLine => ({ id, videoId, startTime, textJp: "x" });
  const lines = [L("a1", "A", 1), L("a2", "A", 50), L("a3", "A", 90), L("b1", "B", 2), L("b2", "B", 10), L("b3", "B", 11), L("b9", "B", 80)];

  it("counts only lines the learner reached", () => {
    const progress: ProgressRow[] = [{ videoId: "A", lastWatchedPosition: 0, completed: true }, { videoId: "B", lastWatchedPosition: 10, completed: false }];
    expect(seenLines(progress, lines, new Set(["b9"])).map((l) => l.id)).toEqual(["a1", "a2", "a3", "b1", "b2", "b9"]);
  });

  it("undercounts after a rewind instead of overclaiming", () => {
    const before = seenLines([{ videoId: "B", lastWatchedPosition: 80, completed: false }], lines, new Set());
    const after = seenLines([{ videoId: "B", lastWatchedPosition: 2, completed: false }], lines, new Set());
    expect(before.map((l) => l.id)).toEqual(["b1", "b2", "b3", "b9"]);
    expect(after.map((l) => l.id)).toEqual(["b1"]);
  });

  it("ignores lines of videos with no progress row", () => {
    expect(seenLines([], lines, new Set(["a1"]))).toEqual([]);
  });
});

describe("exposureTool", () => {
  it("reads only reached lines, labels a capped scan as a floor, and analyses at most the cap", async () => {
    vi.mocked(getActiveSnapshotId).mockResolvedValue(null);
    vi.mocked(staticAnalyses).mockImplementation(async (_s, ls) => new Map(ls.map((l) => [l.id, { lineId: l.id, snapshotId: null, tokens: [tok("は/助詞")] }])) as never);
    const lineCalls: QueryCall[][] = [];
    const many = Array.from({ length: EXPOSURE_MAX_LINES + 1 }, (_, i) => ({ id: `c${i}`, start_time: i, text_jp: "は" }));
    const supabase = createMockSupabase({
      tables: {
        user_video_progress: () => ({ data: [
          { video_id: "A", last_watched_position: 0, completed_at: "2026-10-01T00:00:00Z" },
          { video_id: "B", last_watched_position: 10, completed_at: null },
        ], error: null }),
        shadowing_sessions: () => ({ data: [], error: null }),
        transcript_lines: (c) => {
          lineCalls.push(c);
          const transcript = c.find((q) => q.op === "eq" && q.column === "transcript_id") as { value: string } | undefined;
          return { data: transcript?.value === "tA" ? many : [{ id: "b1", start_time: 2, text_jp: "は" }], error: null };
        },
      },
      rpcs: { latest_transcript_ids: () => ({ data: [{ video_id: "A", transcript_id: "tA" }, { video_id: "B", transcript_id: "tB" }], error: null }) },
    });
    const ctx = { supabase, userId: "u1", tier: "free", locale: "en", anchor: null } as unknown as RetrievalContext;
    const result = await exposureTool({ tool: "learner_exposure", term: "は" }, ctx);

    const forB = lineCalls.find((c) => c.some((q) => q.op === "eq" && q.column === "transcript_id" && q.value === "tB"));
    const forA = lineCalls.find((c) => c.some((q) => q.op === "eq" && q.column === "transcript_id" && q.value === "tA"));
    expect(forB).toContainEqual({ op: "lte", column: "start_time", value: 10 });
    expect(forA?.some((q) => q.op === "lte")).toBe(false);
    expect(vi.mocked(staticAnalyses).mock.calls[0]?.[1]).toHaveLength(EXPOSURE_MAX_LINES);
    expect(result).toMatchObject({ status: "ok", data: { identity: "tok:は:助詞", seenCount: EXPOSURE_MAX_LINES, capped: true } });
  });

  it("reads shadowed lines outside the watched window in chunks, never one oversized id filter", async () => {
    vi.mocked(getActiveSnapshotId).mockResolvedValue(null);
    vi.mocked(staticAnalyses).mockResolvedValue(new Map() as never);
    const shadowed = Array.from({ length: 250 }, (_, i) => ({ transcript_line_id: `s${i}` }));
    const idFilters: number[] = [];
    const supabase = createMockSupabase({
      tables: {
        user_video_progress: () => ({ data: [{ video_id: "A", last_watched_position: 0, completed_at: null }], error: null }),
        shadowing_sessions: () => ({ data: shadowed, error: null }),
        transcript_lines: (c) => {
          const ids = c.find((q) => q.op === "in" && q.column === "id") as { values: string[] } | undefined;
          if (ids) idFilters.push(ids.values.length);
          return { data: [], error: null };
        },
      },
      rpcs: { latest_transcript_ids: () => ({ data: [{ video_id: "A", transcript_id: "tA" }], error: null }) },
    });
    const ctx = { supabase, userId: "u1", tier: "free", locale: "en", anchor: null } as unknown as RetrievalContext;
    await exposureTool({ tool: "learner_exposure", term: "は" }, ctx);
    expect(idFilters).toEqual([100, 100, 50]);
  });

  it("answers zero without reading lines for a learner with no progress", async () => {
    const supabase = createMockSupabase({ tables: { user_video_progress: () => ({ data: [], error: null }) } });
    const ctx = { supabase, userId: "u1", tier: "free", locale: "en", anchor: null } as unknown as RetrievalContext;
    await expect(exposureTool({ tool: "learner_exposure", term: "は" }, ctx)).resolves.toMatchObject({ status: "ok", data: { seenCount: 0, capped: false } });
    expect(staticAnalyses).not.toHaveBeenCalled();
  });
});
