import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, eqValue, type QueryCall } from "@/test/supabase-mock";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAdmin } from "@/lib/admin/guard";
import { toFurigana } from "@/lib/japanese";

vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));
vi.mock("@/lib/admin/guard", () => ({ requireAdmin: vi.fn() }));
// Furigana generation is a separate, already-unit-tested concern
// (lib/japanese/furigana.test.ts) — mock it here, same precedent as
// lib/data/reading.test.ts / lib/data/transcripts.ts's real usage.
vi.mock("@/lib/japanese", () => ({ toFurigana: vi.fn() }));

// Imported after the mocks above are registered.
import {
  computePromotionScore,
  demoteVideo,
  listNeedsReview,
  listPublishedLessons,
  listReadyToPromote,
  listTrendingLessons,
  promoteVideo,
  rejectVideo,
  replaceVideoTranscript,
  starVideo,
} from "./admin-videos";

const ADMIN = { id: "admin-1", email: "admin@example.com" };
const VIDEO_ID = "a0000000-0000-0000-0000-000000000001";
const VIDEO_ID_2 = "a0000000-0000-0000-0000-000000000002";

function makeVideoRow(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    youtube_video_id: `yt-${id}`,
    title: `Video ${id}`,
    duration_seconds: null,
    thumbnail_url: null,
    jlpt_level_estimate: null,
    added_by_user_id: null,
    library_access: "PRIVATE",
    promotion_starred: false,
    created_at: "2026-07-01T00:00:00Z",
    ...overrides,
  };
}

function mockService(tables: Parameters<typeof createMockSupabase>[0]["tables"]) {
  const supabase = createMockSupabase({ tables });
  vi.mocked(createServiceClient).mockReturnValue(supabase as unknown as ReturnType<typeof createServiceClient>);
  return supabase;
}

beforeEach(() => {
  vi.mocked(createServiceClient).mockReset();
  vi.mocked(requireAdmin).mockReset();
  vi.mocked(requireAdmin).mockResolvedValue({ ok: true, user: ADMIN });
  vi.mocked(toFurigana).mockReset();
  vi.mocked(toFurigana).mockResolvedValue([]);
});

describe("listNeedsReview", () => {
  it("passes through a guard failure", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ ok: false, status: 403 });
    const result = await listNeedsReview();
    expect(result).toEqual({ ok: false, status: 403 });
  });

  it("returns pending videos with importer name and transcript presence/line-count", async () => {
    mockService({
      videos: (calls: QueryCall[]) => {
        expect(eqValue(calls, "library_access")).toBe("PRIVATE");
        return {
          data: [
            {
              id: VIDEO_ID,
              youtube_video_id: "abc123",
              title: "Test video",
              duration_seconds: 120,
              thumbnail_url: null,
              jlpt_level_estimate: "N4",
              added_by_user_id: "u1",
              library_access: "PRIVATE",
              created_at: "2026-07-01T00:00:00Z",
            },
          ],
          error: null,
        };
      },
      users: () => ({ data: [{ id: "u1", name: "Taro" }], error: null }),
      transcripts: () => ({
        data: [{ id: "t1", video_id: VIDEO_ID, created_at: "2026-07-02T00:00:00Z" }],
        error: null,
      }),
      transcript_lines: () => ({ data: [{ transcript_id: "t1" }, { transcript_id: "t1" }], error: null }),
    });

    const result = await listNeedsReview();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.items).toEqual([
      expect.objectContaining({
        id: VIDEO_ID,
        importerName: "Taro",
        hasTranscript: true,
        transcriptLineCount: 2,
      }),
    ]);
    expect(result.data.nextCursor).toBeNull();
  });

  it("returns no importer name / no transcript for a video with neither", async () => {
    mockService({
      videos: () => ({
        data: [
          {
            id: VIDEO_ID,
            youtube_video_id: "abc123",
            title: "Test video",
            duration_seconds: null,
            thumbnail_url: null,
            jlpt_level_estimate: null,
            added_by_user_id: null,
            library_access: "PRIVATE",
            created_at: "2026-07-01T00:00:00Z",
          },
        ],
        error: null,
      }),
      transcripts: () => ({ data: [], error: null }),
      transcript_lines: () => ({ data: [], error: null }),
    });

    const result = await listNeedsReview();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.items[0]).toEqual(
      expect.objectContaining({ importerName: null, hasTranscript: false, transcriptLineCount: 0 }),
    );
  });

  it("paginates: sets nextCursor when more rows exist beyond the page size, and filters by cursor via gt", async () => {
    const rows = Array.from({ length: 21 }, (_, i) => ({
      id: `v${i}`,
      youtube_video_id: `yt${i}`,
      title: `Video ${i}`,
      duration_seconds: null,
      thumbnail_url: null,
      jlpt_level_estimate: null,
      added_by_user_id: null,
      library_access: "PRIVATE",
      created_at: `2026-07-01T00:00:${String(i).padStart(2, "0")}Z`,
    }));

    mockService({
      videos: (calls: QueryCall[]) => {
        const gtCall = calls.find((c): c is Extract<QueryCall, { op: "gt" }> => c.op === "gt");
        if (gtCall) {
          expect(gtCall.column).toBe("created_at");
          expect(gtCall.value).toBe("2026-07-01T00:00:05Z");
        }
        return { data: rows, error: null };
      },
      transcripts: () => ({ data: [], error: null }),
      transcript_lines: () => ({ data: [], error: null }),
    });

    const result = await listNeedsReview("2026-07-01T00:00:05Z");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.items).toHaveLength(20);
    expect(result.data.nextCursor).toBe(rows[19]?.created_at);
  });
});

describe("promoteVideo", () => {
  it("passes through a guard failure", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ ok: false, status: 403 });
    const result = await promoteVideo(VIDEO_ID, "FREE");
    expect(result).toEqual({ ok: false, status: 403 });
  });

  it("refuses to promote a lesson with no transcript", async () => {
    mockService({
      transcripts: () => ({ data: [], error: null }),
    });
    const result = await promoteVideo(VIDEO_ID, "FREE");
    expect(result).toEqual({ ok: false, status: 422 });
  });

  it("returns 404 when the video is not PRIVATE (or does not exist)", async () => {
    mockService({
      transcripts: () => ({ data: [{ id: "t1" }], error: null }),
      videos: () => ({ data: null, error: null }),
    });
    const result = await promoteVideo(VIDEO_ID, "FREE");
    expect(result).toEqual({ ok: false, status: 404 });
  });

  it("promotes a lesson with a transcript to the requested tier", async () => {
    mockService({
      transcripts: () => ({ data: [{ id: "t1" }], error: null }),
      videos: (calls: QueryCall[]) => {
        expect(eqValue(calls, "id")).toBe(VIDEO_ID);
        expect(eqValue(calls, "library_access")).toBe("PRIVATE");
        const update = calls.find((c): c is Extract<QueryCall, { op: "update" }> => c.op === "update");
        expect(update?.values).toEqual({ library_access: "FREE" });
        return { data: { id: VIDEO_ID, library_access: "FREE" }, error: null };
      },
    });
    const result = await promoteVideo(VIDEO_ID, "FREE");
    expect(result).toEqual({ ok: true, data: { id: VIDEO_ID, library_access: "FREE" } });
  });
});

describe("demoteVideo", () => {
  it("sets library_access back to PRIVATE", async () => {
    mockService({
      videos: (calls: QueryCall[]) => {
        const update = calls.find((c): c is Extract<QueryCall, { op: "update" }> => c.op === "update");
        expect(update?.values).toEqual({ library_access: "PRIVATE" });
        return { data: { id: VIDEO_ID, library_access: "PRIVATE" }, error: null };
      },
    });
    const result = await demoteVideo(VIDEO_ID);
    expect(result).toEqual({ ok: true, data: { id: VIDEO_ID, library_access: "PRIVATE" } });
  });
});

describe("starVideo", () => {
  it("toggles promotion_starred", async () => {
    mockService({
      videos: (calls: QueryCall[]) => {
        const update = calls.find((c): c is Extract<QueryCall, { op: "update" }> => c.op === "update");
        expect(update?.values).toEqual({ promotion_starred: true });
        return { data: { id: VIDEO_ID, promotion_starred: true }, error: null };
      },
    });
    const result = await starVideo(VIDEO_ID, true);
    expect(result).toEqual({ ok: true, data: { id: VIDEO_ID, promotion_starred: true } });
  });
});

describe("computePromotionScore", () => {
  it("computes libraryCount*3 + studySessionCount*1 + completedCount*2", () => {
    expect(computePromotionScore({ libraryCount: 2, studySessionCount: 3, completedCount: 1 })).toBe(11);
  });

  it("scores 0 for zero activity", () => {
    expect(computePromotionScore({ libraryCount: 0, studySessionCount: 0, completedCount: 0 })).toBe(0);
  });

  it("weighs library saves and completions more heavily than raw study sessions", () => {
    expect(computePromotionScore({ libraryCount: 1, studySessionCount: 0, completedCount: 0 })).toBe(3);
    expect(computePromotionScore({ libraryCount: 0, studySessionCount: 0, completedCount: 1 })).toBe(2);
    expect(computePromotionScore({ libraryCount: 0, studySessionCount: 1, completedCount: 0 })).toBe(1);
  });
});

describe("listTrendingLessons", () => {
  it("passes through a guard failure", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ ok: false, status: 403 });
    const result = await listTrendingLessons();
    expect(result).toEqual({ ok: false, status: 403 });
  });

  it("returns [] when there are no PRIVATE lessons", async () => {
    mockService({ videos: () => ({ data: [], error: null }) });
    const result = await listTrendingLessons();
    expect(result).toEqual({ ok: true, data: [] });
  });

  it("scores a zero-activity lesson as 0 and still includes it, ranking a more-active lesson above it", async () => {
    mockService({
      videos: () => ({ data: [makeVideoRow(VIDEO_ID), makeVideoRow(VIDEO_ID_2)], error: null }),
      user_lesson_library: () => ({ data: [{ lesson_id: VIDEO_ID_2 }], error: null }),
      shadowing_sessions: () => ({ data: [], error: null }),
      dictation_attempts: () => ({ data: [{ video_id: VIDEO_ID_2 }], error: null }),
      user_video_progress: () => ({
        data: [{ video_id: VIDEO_ID_2, completed_at: "2026-07-02T00:00:00Z" }],
        error: null,
      }),
    });

    const result = await listTrendingLessons();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(2);
    // VIDEO_ID_2: libraryCount=1 (*3) + studySessionCount=1 (*1) + completedCount=1 (*2) = 6
    expect(result.data[0]).toEqual(expect.objectContaining({ id: VIDEO_ID_2, score: 6 }));
    // VIDEO_ID: no activity anywhere = 0, but still present in the ranked list.
    expect(result.data[1]).toEqual(expect.objectContaining({ id: VIDEO_ID, score: 0 }));
  });
});

describe("listReadyToPromote", () => {
  it("passes through a guard failure", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ ok: false, status: 403 });
    const result = await listReadyToPromote();
    expect(result).toEqual({ ok: false, status: 403 });
  });

  it("returns only PRIVATE lessons with promotion_starred = true", async () => {
    mockService({
      videos: (calls: QueryCall[]) => {
        expect(eqValue(calls, "library_access")).toBe("PRIVATE");
        expect(eqValue(calls, "promotion_starred")).toBe(true);
        return { data: [makeVideoRow(VIDEO_ID, { promotion_starred: true })], error: null };
      },
    });
    const result = await listReadyToPromote();
    expect(result).toEqual({
      ok: true,
      data: [expect.objectContaining({ id: VIDEO_ID, promotion_starred: true })],
    });
  });
});

describe("listPublishedLessons", () => {
  it("passes through a guard failure", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ ok: false, status: 403 });
    const result = await listPublishedLessons();
    expect(result).toEqual({ ok: false, status: 403 });
  });

  it("returns library_access IN (FREE, PLUS) lessons, newest first", async () => {
    mockService({
      videos: (calls: QueryCall[]) => {
        const inCall = calls.find((c): c is Extract<QueryCall, { op: "in" }> => c.op === "in");
        expect(inCall?.column).toBe("library_access");
        expect(inCall?.values).toEqual(["FREE", "PLUS"]);
        const orderCall = calls.find((c): c is Extract<QueryCall, { op: "order" }> => c.op === "order");
        expect(orderCall).toEqual({ op: "order", column: "created_at", ascending: false });
        return {
          data: [
            makeVideoRow(VIDEO_ID, { library_access: "FREE", created_at: "2026-07-02T00:00:00Z" }),
            makeVideoRow(VIDEO_ID_2, { library_access: "PLUS", created_at: "2026-07-01T00:00:00Z" }),
          ],
          error: null,
        };
      },
    });
    const result = await listPublishedLessons();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toHaveLength(2);
    expect(result.data[0]).toEqual(expect.objectContaining({ id: VIDEO_ID, library_access: "FREE" }));
    expect(result.data[1]).toEqual(expect.objectContaining({ id: VIDEO_ID_2, library_access: "PLUS" }));
  });
});

describe("rejectVideo", () => {
  it("passes through a guard failure", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ ok: false, status: 403 });
    const result = await rejectVideo(VIDEO_ID);
    expect(result).toEqual({ ok: false, status: 403 });
  });

  it("returns 404 when the video is not pending (or does not exist)", async () => {
    mockService({ videos: () => ({ data: null, error: null }) });
    const result = await rejectVideo(VIDEO_ID, "spam");
    expect(result).toEqual({ ok: false, status: 404 });
  });

  it("deletes the pending video row", async () => {
    mockService({
      videos: (calls: QueryCall[]) => {
        expect(calls.some((c) => c.op === "delete")).toBe(true);
        expect(eqValue(calls, "library_access")).toBe("PRIVATE");
        return { data: { id: VIDEO_ID }, error: null };
      },
    });
    const result = await rejectVideo(VIDEO_ID);
    expect(result).toEqual({ ok: true, data: { id: VIDEO_ID } });
  });
});

describe("replaceVideoTranscript", () => {
  it("passes through a guard failure", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ ok: false, status: 403 });
    const result = await replaceVideoTranscript(VIDEO_ID, { format: "plain", content: "[00:01]\tこんにちは" });
    expect(result).toEqual({ ok: false, status: 403 });
  });

  it("returns 404 when the video does not exist", async () => {
    mockService({ videos: () => ({ data: null, error: null }) });
    const result = await replaceVideoTranscript(VIDEO_ID, { format: "plain", content: "[00:01]\tこんにちは" });
    expect(result).toEqual({ ok: false, status: 404 });
  });

  it("returns 422 when the parsed content yields zero lines", async () => {
    mockService({ videos: () => ({ data: { id: VIDEO_ID }, error: null }) });
    const result = await replaceVideoTranscript(VIDEO_ID, { format: "plain", content: "not a valid line" });
    expect(result).toEqual({ ok: false, status: 422 });
  });

  it("deletes any existing transcript and inserts the new one with source=user_submitted", async () => {
    let deletedVideoId: unknown;
    let insertedTranscript: unknown;
    let insertedLines: unknown;

    mockService({
      videos: () => ({ data: { id: VIDEO_ID }, error: null }),
      transcripts: (calls: QueryCall[]) => {
        const deleteCall = calls.find((c) => c.op === "delete");
        const insertCall = calls.find((c): c is Extract<QueryCall, { op: "insert" }> => c.op === "insert");
        if (deleteCall) {
          deletedVideoId = eqValue(calls, "video_id");
          return { data: null, error: null };
        }
        if (insertCall) {
          insertedTranscript = insertCall.values;
          return { data: { id: "new-transcript" }, error: null };
        }
        return { data: null, error: null };
      },
      transcript_lines: (calls: QueryCall[]) => {
        const insertCall = calls.find((c): c is Extract<QueryCall, { op: "insert" }> => c.op === "insert");
        insertedLines = insertCall?.values;
        return { data: null, error: null };
      },
    });

    const result = await replaceVideoTranscript(VIDEO_ID, {
      format: "plain",
      content: "[00:01]\tこんにちは\n[00:05]\tさようなら",
    });

    expect(result).toEqual({ ok: true, data: { transcriptId: "new-transcript", lineCount: 2 } });
    expect(deletedVideoId).toBe(VIDEO_ID);
    expect(insertedTranscript).toEqual({ video_id: VIDEO_ID, source: "user_submitted", language: "ja" });
    expect(Array.isArray(insertedLines)).toBe(true);
    expect((insertedLines as unknown[]).length).toBe(2);
  });
});
