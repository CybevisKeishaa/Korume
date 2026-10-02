import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase } from "@/test/supabase-mock";
import { assertPlainSerializableDto } from "@/test/dto";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { getTranscript } from "@/lib/data/transcripts";
import { staticAnalyses } from "./line-analysis";
import { getLessonVocabulary } from "./lesson-vocabulary";
import type { AnalysisToken, LexicalLineAnalysis } from "./types";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn() }));
vi.mock("@/lib/data/transcripts", () => ({ getTranscript: vi.fn() }));
vi.mock("./line-analysis", () => ({ staticAnalyses: vi.fn() }));

const VIDEO_ID = "c0000000-0000-0000-0000-000000000001";
const LINES = Array.from({ length: 1_500 }, (_, i) => ({
  id: `line-${String(i).padStart(4, "0")}`, start_time: i, end_time: i + 1, text_jp: `文${i}`, text_translation: null, furigana_json: null,
}));

function token(entSeq: number | null, vocabId: string | null = null): AnalysisToken {
  return {
    index: 0, surface: "x", base: "x", reading: null, pos: entSeq === null ? "助詞" : "名詞", span: { start: 0, end: 1 },
    entries: entSeq === null ? [] : [{ entSeq, headword: `w${entSeq}`, reading: "よみ", glossEn: `g${entSeq}`, jlpt: null }],
    vocabId,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(rateLimit).mockReturnValue({ ok: true, retryAfter: 0 });
  vi.mocked(createClient).mockReturnValue(createMockSupabase({
    user: { id: "u-1" },
    tables: { user_vocab_progress: () => ({ data: [{ vocab_id: "v-ame", srs_stage: 4 }], error: null }) },
  }) as ReturnType<typeof createClient>);
  vi.mocked(getTranscript).mockResolvedValue({ ok: true, data: { id: "t-1", video_id: VIDEO_ID, source: "x", language: "ja", created_at: "", lines: LINES } } as never);
  // Every line: entry 10 once and a particle; every third line also entry 20 (curated as v-ame); line 0 has entry 30.
  vi.mocked(staticAnalyses).mockImplementation(async (_supabase, lines) => new Map(lines.map((line, i): [string, LexicalLineAnalysis] => [
    line.id,
    { lineId: line.id, snapshotId: "s", tokens: [token(10), token(null), ...(i % 3 === 0 ? [token(20, "v-ame")] : []), ...(i === 0 ? [token(30)] : [])] },
  ])));
});

describe("getLessonVocabulary", () => {
  it("aggregates every line of the lesson, not a capped first page", async () => {
    const result = await getLessonVocabulary(VIDEO_ID, {});
    expect(vi.mocked(staticAnalyses).mock.calls[0]?.[1]).toHaveLength(1_500);
    expect(vi.mocked(staticAnalyses).mock.calls[0]?.[3]).toBe("lexical");
    expect(result.kind === "ok" && result.page.items.map((item) => [item.entSeq, item.occurrences])).toEqual([[10, 1_500], [20, 500], [30, 1]]);
  });

  it("counts content words only, with example lines and this learner's mastery, as a plain DTO", async () => {
    const result = await getLessonVocabulary(VIDEO_ID, {});
    if (result.kind !== "ok") throw new Error(result.kind);
    assertPlainSerializableDto(result.page);
    expect(result.page.items[1]).toEqual({
      entSeq: 20, headword: "w20", reading: "よみ", glossEn: "g20", occurrences: 500, jlpt: null, vocabId: "v-ame", mastery: 4,
      exampleLineIds: ["line-0000", "line-0003", "line-0006"],
    });
    expect(result.page.items[0]?.mastery).toBeNull();
  });

  it("pages with a stable cursor over the whole list", async () => {
    const first = await getLessonVocabulary(VIDEO_ID, { limit: 2 });
    expect(first.kind === "ok" && first.page).toMatchObject({ nextCursor: "2", total: 3 });
    const second = await getLessonVocabulary(VIDEO_ID, { limit: 2, cursor: "2" });
    expect(second.kind === "ok" && second.page.items.map((item) => item.entSeq)).toEqual([30]);
    expect(second.kind === "ok" && second.page.nextCursor).toBeNull();
    const again = await getLessonVocabulary(VIDEO_ID, { limit: 2 });
    expect(again.kind === "ok" && again.page.items.map((item) => item.entSeq)).toEqual([10, 20]);
  });

  it("refuses a bad cursor, an unreadable lesson and an anonymous caller", async () => {
    await expect(getLessonVocabulary(VIDEO_ID, { cursor: "-1" })).resolves.toEqual({ kind: "invalid_cursor" });
    await expect(getLessonVocabulary(VIDEO_ID, { cursor: "abc" })).resolves.toEqual({ kind: "invalid_cursor" });
    vi.mocked(getTranscript).mockResolvedValueOnce({ ok: false, status: 404 });
    await expect(getLessonVocabulary(VIDEO_ID, {})).resolves.toEqual({ kind: "not_found" });
    vi.mocked(createClient).mockReturnValue(createMockSupabase({ user: null, tables: {} }) as ReturnType<typeof createClient>);
    await expect(getLessonVocabulary(VIDEO_ID, {})).resolves.toEqual({ kind: "unauthorized" });
  });
});
