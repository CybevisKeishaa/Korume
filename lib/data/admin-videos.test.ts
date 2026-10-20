import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, eqValue, type QueryCall } from "@/test/supabase-mock";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAdmin } from "@/lib/admin/guard";
import { toFurigana } from "@/lib/japanese";
import { fetchOembed } from "@/lib/youtube";

vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));
vi.mock("@/lib/admin/guard", () => ({ requireAdmin: vi.fn() }));
// Furigana generation is a separate, already-unit-tested concern
// (lib/japanese/furigana.test.ts) — mock it here, same precedent as
// lib/data/reading.test.ts / lib/data/transcripts.ts's real usage.
vi.mock("@/lib/japanese", () => ({ toFurigana: vi.fn() }));
vi.mock("@/lib/youtube", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/youtube")>()), fetchOembed: vi.fn() }));

// Imported after the mocks above are registered.
import {
  computePromotionScore,
  demoteVideo,
  importVideoFromSrt,
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
    mockService({
      videos: () => ({ data: null, error: null }),
      user_lesson_library: () => ({ data: [], error: null }),
    });
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
      user_lesson_library: () => ({ data: [], error: null }),
    });
    const result = await rejectVideo(VIDEO_ID);
    expect(result).toEqual({ ok: true, data: { id: VIDEO_ID } });
  });

  it("refuses to delete (409) a lesson that a learner already holds in their library, without attempting the delete", async () => {
    let deleteAttempted = false;
    mockService({
      videos: (calls: QueryCall[]) => {
        if (calls.some((c) => c.op === "delete")) deleteAttempted = true;
        return { data: { id: VIDEO_ID }, error: null };
      },
      user_lesson_library: (calls: QueryCall[]) => {
        expect(eqValue(calls, "lesson_id")).toBe(VIDEO_ID);
        return { data: [{ user_id: "some-learner" }], error: null };
      },
    });
    const result = await rejectVideo(VIDEO_ID, "spam");
    expect(result).toEqual({ ok: false, status: 409 });
    expect(deleteAttempted).toBe(false);
  });

  it("proceeds to delete as before when zero users hold the lesson in their library", async () => {
    mockService({
      videos: (calls: QueryCall[]) => {
        expect(calls.some((c) => c.op === "delete")).toBe(true);
        return { data: { id: VIDEO_ID }, error: null };
      },
      user_lesson_library: () => ({ data: [], error: null }),
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

describe("importVideoFromSrt", () => {
  const JA = `1
00:00:01,000 --> 00:00:04,000
こんにちは

2
00:00:04,000 --> 00:00:09,500
元気ですか
`;
  const VI = `1
00:00:01,000 --> 00:00:03,500
Xin chào
`;
  const INPUT = { youtubeVideoId: "kIDaXEnkjmk", libraryAccess: "FREE" as const, format: "srt" as const, content: JA, translation: VI };

  /** Records every write in order; `existing` is what the lookup by youtube id finds. */
  function catalogue(existing: { id: string } | null, failures: { insert?: { code: string; message: string }; lines?: Error } = {}) {
    const writes: { op: string; values?: unknown; id?: unknown }[] = [];
    const order: string[] = [];
    let lines: unknown;
    mockService({
      videos: (calls: QueryCall[]) => {
        const write = calls.find((c) => c.op === "insert" || c.op === "update" || c.op === "delete");
        if (!write) return { data: existing, error: null };
        writes.push({ op: write.op, values: "values" in write ? write.values : undefined, id: eqValue(calls, "id") });
        order.push(`videos.${write.op}`);
        if (write.op === "insert" && failures.insert) return { data: null, error: failures.insert };
        return { data: { id: VIDEO_ID }, error: null };
      },
      transcripts: (calls: QueryCall[]) => {
        order.push(`transcripts.${calls.some((c) => c.op === "insert") ? "insert" : "delete"}`);
        return { data: calls.some((c) => c.op === "insert") ? { id: "new-transcript" } : null, error: null };
      },
      transcript_lines: (calls: QueryCall[]) => {
        lines = calls.find((c): c is Extract<QueryCall, { op: "insert" }> => c.op === "insert")?.values;
        order.push("transcript_lines.insert");
        return { data: null, error: failures.lines ?? null };
      },
    });
    return { writes, order, lines: () => lines as { text_jp: string; text_translation: string | null }[] };
  }

  beforeEach(() => {
    vi.mocked(fetchOembed).mockReset();
    vi.mocked(fetchOembed).mockResolvedValue({
      title: "  <b>聞き取り</b> Ep.1 ",
      thumbnailUrl: "https://i.ytimg.com/vi/kIDaXEnkjmk/hqdefault.jpg",
      authorName: " Channel ",
    });
  });

  it("creates the video PRIVATE, attaches the aligned bilingual transcript, then publishes it", async () => {
    const db = catalogue(null);

    await expect(importVideoFromSrt(INPUT)).resolves.toEqual({
      ok: true,
      data: { videoId: VIDEO_ID, created: true, lineCount: 2, translatedCount: 1 },
    });
    expect(db.writes).toEqual([
      {
        op: "insert",
        values: {
          youtube_video_id: "kIDaXEnkjmk",
          title: "聞き取り Ep.1",
          thumbnail_url: "https://i.ytimg.com/vi/kIDaXEnkjmk/hqdefault.jpg",
          channel_title: "Channel",
          duration_seconds: 10,
          library_access: "PRIVATE",
        },
        id: undefined,
      },
      { op: "update", values: { library_access: "FREE" }, id: VIDEO_ID },
    ]);
    expect(db.lines().map((line) => [line.text_jp, line.text_translation])).toEqual([["こんにちは", "Xin chào"], ["元気ですか", null]]);
    // Published only once it has lines: a failure in between never leaves an empty published lesson.
    expect(db.order).toEqual(["videos.insert", "transcripts.delete", "transcripts.insert", "transcript_lines.insert", "videos.update"]);
  });

  it("refuses an existing video without `replace`, before touching its transcript or YouTube", async () => {
    const db = catalogue({ id: VIDEO_ID });

    await expect(importVideoFromSrt(INPUT)).resolves.toEqual({ ok: false, status: 409, exists: true });
    expect(db.order).toEqual([]);
    expect(fetchOembed).not.toHaveBeenCalled();
  });

  it("with `replace`, replaces an existing video's transcript and keeps its access level", async () => {
    const db = catalogue({ id: VIDEO_ID });

    await expect(importVideoFromSrt({ ...INPUT, translation: undefined, replace: true })).resolves.toEqual({
      ok: true,
      data: { videoId: VIDEO_ID, created: false, lineCount: 2, translatedCount: 0 },
    });
    expect(db.order).toEqual(["transcripts.delete", "transcripts.insert", "transcript_lines.insert"]);
    expect(fetchOembed).not.toHaveBeenCalled();
  });

  it("removes the new video again when its transcript cannot be written, so a retry starts clean", async () => {
    const db = catalogue(null, { lines: new Error("lines insert failed") });
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(importVideoFromSrt(INPUT)).rejects.toThrow("lines insert failed");
    expect(db.writes.map((write) => write.op)).toEqual(["insert", "delete"]);
    expect(db.writes[1]?.id).toBe(VIDEO_ID);
  });

  it("answers 409 when another import created the video first", async () => {
    const db = catalogue(null, { insert: { code: "23505", message: "duplicate key value violates unique constraint" } });

    await expect(importVideoFromSrt(INPUT)).resolves.toEqual({ ok: false, status: 409, exists: true });
    expect(db.order).toEqual(["videos.insert"]);
  });

  it.each([
    ["YouTube metadata fails", () => vi.mocked(fetchOembed).mockRejectedValue(new Error("429"))],
    ["the thumbnail is not https", () => vi.mocked(fetchOembed).mockResolvedValue({ title: "t", thumbnailUrl: "http://i.ytimg.com/x.jpg", authorName: null })],
  ])("writes nothing when %s", async (_, arrange) => {
    arrange();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const db = catalogue(null);
    await expect(importVideoFromSrt(INPUT)).resolves.toEqual({ ok: false, status: 503 });
    expect(db.writes).toEqual([]);
  });

  it.each([
    ["no cues", "not a subtitle"],
    ["more than 2000 lines", Array.from({ length: 2001 }, (_, i) => `${i + 1}\n00:00:${String(i % 60).padStart(2, "0")},000 --> 00:00:${String(i % 60).padStart(2, "0")},500\n行\n`).join("\n")],
  ])("refuses content with %s before any database call", async (_, content) => {
    await expect(importVideoFromSrt({ ...INPUT, content })).resolves.toEqual({ ok: false, status: 422 });
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  it("rate-limits per admin", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ ok: true, user: { id: "admin-rate-limited", email: "r@example.com" } });
    catalogue(null);
    for (let i = 0; i < 10; i += 1) await importVideoFromSrt({ ...INPUT, content: "nothing" });
    await expect(importVideoFromSrt(INPUT)).resolves.toMatchObject({ ok: false, status: 429 });
  });

  it("passes through a guard failure before any other work", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ ok: false, status: 403 });
    await expect(importVideoFromSrt(INPUT)).resolves.toEqual({ ok: false, status: 403 });
    expect(createServiceClient).not.toHaveBeenCalled();
    expect(fetchOembed).not.toHaveBeenCalled();
  });
});
