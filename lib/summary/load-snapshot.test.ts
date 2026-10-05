import { beforeEach, describe, expect, it, vi } from "vitest";
import { MASTERY_THRESHOLD } from "@/lib/data/difficulty";
import { createMockSupabase, type QueryCall } from "@/test/supabase-mock";
import type { LessonEvidence } from "./snapshot";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  requireUser: vi.fn(),
  selectVideoById: vi.fn(),
  getTranscript: vi.fn(),
  staticAnalyses: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/data/videos", () => ({
  requireUser: mocks.requireUser,
  selectVideoById: mocks.selectVideoById,
}));
vi.mock("@/lib/data/transcripts", () => ({ getTranscript: mocks.getTranscript }));
vi.mock("@/lib/analysis/line-analysis", () => ({ staticAnalyses: mocks.staticAnalyses }));

import { loadLessonSummary } from "./load-snapshot";

const VIDEO = "11111111-1111-4111-8111-111111111111";
const USER = { id: "22222222-2222-4222-8222-222222222222" };
const video = {
  id: VIDEO,
  youtube_video_id: "youtube-id",
  title: "Lesson",
  thumbnail_url: null,
  jlpt_level_estimate: "N4",
  duration_seconds: 120,
};

const emptyEvidence: LessonEvidence = {
  hasTranscript: true,
  lineCount: 1,
  shadowedLines: 0,
  pronunciationMean: null,
  dictationMean: null,
  completed: false,
  cards: {
    total: 0, mastered: 0, reviewedAny: false, vocabularyRefs: 0, expressionRefs: 0,
    knowledgeRemembered: 0, knowledgeReviewedAny: false,
  },
  lines: [],
  saved: [],
};

function mockClient(evidence = emptyEvidence) {
  const grammarCalls: QueryCall[][] = [];
  const supabase = createMockSupabase({
    tables: {
      user_grammar_progress: (calls) => {
        grammarCalls.push([...calls]);
        return { data: [{ grammar_id: "grammar-1" }], error: null };
      },
    },
    rpcs: {
      lesson_summary_evidence: () => ({ data: evidence, error: null }),
    },
  });
  mocks.createClient.mockReturnValue(supabase);
  return { supabase, grammarCalls };
}

describe("loadLessonSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUser.mockResolvedValue(USER);
    mocks.selectVideoById.mockResolvedValue(video);
    mocks.staticAnalyses.mockResolvedValue(new Map());
  });

  it("returns 401 before reading a lesson when there is no user", async () => {
    mockClient();
    mocks.requireUser.mockResolvedValue(null);

    await expect(loadLessonSummary(VIDEO)).resolves.toEqual({ ok: false, status: 401 });
    expect(mocks.selectVideoById).not.toHaveBeenCalled();
  });

  it("returns the transcript access status", async () => {
    mockClient();
    mocks.getTranscript.mockResolvedValue({ ok: false, status: 404 });

    await expect(loadLessonSummary(VIDEO)).resolves.toEqual({ ok: false, status: 404 });
  });

  it("loads evidence with the mastery threshold and matches saved grammar ids", async () => {
    const { supabase, grammarCalls } = mockClient({
      ...emptyEvidence,
      lines: [{ lineId: "line-1", pronunciation: 52, pitch: null, dictation: null, dictationInput: null, difficult: false }],
    });
    mocks.getTranscript.mockResolvedValue({ ok: true, data: {
      id: "transcript", video_id: VIDEO, source: "youtube_caption", language: "ja", created_at: "2026-01-01T00:00:00.000Z",
      lines: [
        { id: "line-1", start_time: 0, end_time: 2, text_jp: "勉強します", text_translation: "study", furigana_json: null },
        { id: "blank", start_time: 3, end_time: null, text_jp: "  ", text_translation: null, furigana_json: null },
      ],
    } });
    mocks.staticAnalyses.mockResolvedValue(new Map([["line-1", {
      lineId: "line-1", snapshotId: null, tokens: [], grammar: [{ grammarPointId: "grammar-1", span: { start: 0, end: 2 } }],
    }]]));

    const result = await loadLessonSummary(VIDEO);

    expect(result).toMatchObject({ ok: true, data: { lines: [{ id: "line-1", index: 0, textJp: "勉強します" }] } });
    expect(supabase.rpcCalls).toEqual([{ name: "lesson_summary_evidence", args: { p_video: VIDEO, p_mastery: MASTERY_THRESHOLD } }]);
    expect(mocks.staticAnalyses).toHaveBeenCalledWith(expect.anything(), [{ id: "line-1", textJp: "勉強します" }], undefined, "full");
    expect(grammarCalls).toEqual([[ 
      { op: "select", columns: "grammar_id" },
      { op: "eq", column: "user_id", value: USER.id },
      { op: "in", column: "grammar_id", values: ["grammar-1"] },
    ]]);
  });

  it("returns an empty, non-analyzed snapshot when no transcript exists", async () => {
    const { supabase } = mockClient({ ...emptyEvidence, hasTranscript: false, lineCount: 0 });
    mocks.getTranscript.mockResolvedValue({ ok: true, data: null });

    const result = await loadLessonSummary(VIDEO);

    expect(result).toEqual({
      ok: true,
      data: expect.objectContaining({
        lines: [],
        hasTranscript: false,
        snapshot: expect.objectContaining({
          status: {
            shadowing: { kind: "not_started" }, pronunciation: { kind: "not_started" },
            listening: { kind: "not_started" }, retention: { kind: "not_enough_data" },
          },
        }),
      }),
    });
    expect(supabase.rpcCalls).toEqual([{ name: "lesson_summary_evidence", args: { p_video: VIDEO, p_mastery: MASTERY_THRESHOLD } }]);
    expect(mocks.staticAnalyses).not.toHaveBeenCalled();
  });
});
