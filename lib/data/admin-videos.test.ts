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
import { approveVideo, listPendingVideos, rejectVideo, replaceVideoTranscript } from "./admin-videos";

const ADMIN = { id: "admin-1", email: "admin@example.com" };
const VIDEO_ID = "a0000000-0000-0000-0000-000000000001";

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

describe("listPendingVideos", () => {
  it("passes through a guard failure", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ ok: false, status: 403 });
    const result = await listPendingVideos();
    expect(result).toEqual({ ok: false, status: 403 });
  });

  it("returns pending videos with importer name and transcript presence/line-count", async () => {
    mockService({
      videos: (calls: QueryCall[]) => {
        expect(eqValue(calls, "status")).toBe("pending");
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

    const result = await listPendingVideos();
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
            created_at: "2026-07-01T00:00:00Z",
          },
        ],
        error: null,
      }),
      transcripts: () => ({ data: [], error: null }),
      transcript_lines: () => ({ data: [], error: null }),
    });

    const result = await listPendingVideos();
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

    const result = await listPendingVideos("2026-07-01T00:00:05Z");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.items).toHaveLength(20);
    expect(result.data.nextCursor).toBe(rows[19]?.created_at);
  });
});

describe("approveVideo", () => {
  it("passes through a guard failure", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ ok: false, status: 401 });
    const result = await approveVideo(VIDEO_ID);
    expect(result).toEqual({ ok: false, status: 401 });
  });

  it("returns 404 when the video is not pending (or does not exist)", async () => {
    mockService({ videos: () => ({ data: null, error: null }) });
    const result = await approveVideo(VIDEO_ID);
    expect(result).toEqual({ ok: false, status: 404 });
  });

  it("sets status to approved via the service role", async () => {
    mockService({
      videos: (calls: QueryCall[]) => {
        expect(eqValue(calls, "id")).toBe(VIDEO_ID);
        expect(eqValue(calls, "status")).toBe("pending");
        const updateCall = calls.find((c): c is Extract<QueryCall, { op: "update" }> => c.op === "update");
        expect(updateCall?.values).toEqual({ status: "approved" });
        return { data: { id: VIDEO_ID, status: "approved" }, error: null };
      },
    });
    const result = await approveVideo(VIDEO_ID);
    expect(result).toEqual({ ok: true, data: { id: VIDEO_ID, status: "approved" } });
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
        expect(eqValue(calls, "status")).toBe("pending");
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
