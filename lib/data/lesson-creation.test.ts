import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type QueryCall } from "@/test/supabase-mock";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAdmin } from "@/lib/admin/guard";
import { fetchOembed, OembedFetchError } from "@/lib/youtube";
import { toFurigana } from "@/lib/japanese";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));
vi.mock("@/lib/admin/guard", () => ({ requireAdmin: vi.fn() }));
vi.mock("@/lib/youtube", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/youtube")>();
  return { ...actual, fetchOembed: vi.fn() };
});
vi.mock("@/lib/japanese", () => ({ toFurigana: vi.fn() }));
vi.mock("@/lib/data/transcript-providers", () => ({
  youtubeCaptionProvider: { fetch: vi.fn() },
}));

import { youtubeCaptionProvider } from "@/lib/data/transcript-providers";
import { createLesson, createLessonAsAdmin } from "./lesson-creation";

const USER = { id: "u-create-1" };
const ADMIN = { id: "admin-1", email: "admin@example.com" };
const YOUTUBE_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
const VIDEO_ID = "dQw4w9WgXcQ";
const LESSON_ID = "l-0000-0000-0000-000000000099";

function mockClient(user: { id: string } | null) {
  const supabase = createMockSupabase({ user, tables: {} });
  vi.mocked(createClient).mockReturnValue(supabase as unknown as ReturnType<typeof createClient>);
  return supabase;
}

function mockService(tables: Parameters<typeof createMockSupabase>[0]["tables"]) {
  const supabase = createMockSupabase({ tables });
  vi.mocked(createServiceClient).mockReturnValue(supabase as unknown as ReturnType<typeof createServiceClient>);
  return supabase;
}

beforeEach(() => {
  vi.mocked(createClient).mockReset();
  vi.mocked(createServiceClient).mockReset();
  vi.mocked(requireAdmin).mockReset();
  vi.mocked(fetchOembed).mockReset();
  vi.mocked(toFurigana).mockReset().mockResolvedValue([]);
  vi.mocked(youtubeCaptionProvider.fetch).mockReset();
});

describe("createLesson (user mode)", () => {
  it("returns 401 when signed out", async () => {
    mockClient(null);
    const result = await createLesson({ youtubeUrl: YOUTUBE_URL });
    expect(result).toEqual({ ok: false, status: 401 });
  });

  it("returns 400 for an unparseable URL", async () => {
    mockClient(USER);
    const result = await createLesson({ youtubeUrl: "not a url" });
    expect(result).toEqual({ ok: false, status: 400 });
  });

  it("takes the learner straight to an existing FREE lesson with no quota check and no library row", async () => {
    mockClient(USER);
    mockService({
      videos: () => ({
        data: { id: LESSON_ID, youtube_video_id: VIDEO_ID, library_access: "FREE", promotion_starred: false },
        error: null,
      }),
      transcripts: () => ({ data: [{ id: "t1" }], error: null }), // already has a transcript
    });

    const result = await createLesson({ youtubeUrl: YOUTUBE_URL });

    expect(result).toMatchObject({ ok: true, alreadyInLibrary: false, transcriptStatus: "existing" });
    expect(fetchOembed).not.toHaveBeenCalled();
    expect(youtubeCaptionProvider.fetch).not.toHaveBeenCalled();
  });

  it("does NOT blindly report 'existing' for a published lesson with no transcript yet — attempts the fetch and reports 'fetched' on success", async () => {
    mockClient(USER);
    vi.mocked(youtubeCaptionProvider.fetch).mockResolvedValue({
      source: "youtube_caption",
      lines: [{ startTime: 0, endTime: 2, textJp: "こんにちは", textTranslation: null }],
    });
    mockService({
      videos: () => ({
        data: { id: LESSON_ID, youtube_video_id: VIDEO_ID, library_access: "FREE", promotion_starred: false },
        error: null,
      }),
      transcripts: (calls: QueryCall[]) => {
        if (calls.some((c) => c.op === "insert")) return { data: { id: "t-new" }, error: null };
        return { data: [], error: null }; // hasTranscript: no rows yet
      },
      transcript_lines: () => ({ data: null, error: null }),
    });

    const result = await createLesson({ youtubeUrl: YOUTUBE_URL });

    expect(result).toMatchObject({ ok: true, alreadyInLibrary: false, transcriptStatus: "fetched" });
    expect(fetchOembed).not.toHaveBeenCalled();
  });

  it("does NOT blindly report 'existing' for a published lesson with no transcript yet — reports 'missing' on caption failure", async () => {
    mockClient(USER);
    vi.mocked(youtubeCaptionProvider.fetch).mockResolvedValue(null);
    mockService({
      videos: () => ({
        data: { id: LESSON_ID, youtube_video_id: VIDEO_ID, library_access: "FREE", promotion_starred: false },
        error: null,
      }),
      transcripts: () => ({ data: [], error: null }), // hasTranscript: no rows yet
    });

    const result = await createLesson({ youtubeUrl: YOUTUBE_URL });

    expect(result).toMatchObject({ ok: true, alreadyInLibrary: false, transcriptStatus: "missing" });
    expect(fetchOembed).not.toHaveBeenCalled();
  });

  it("dedup-hits an existing PRIVATE lesson with a transcript: quota-checked, library row added, no fetch", async () => {
    mockClient(USER);
    let libraryUpserted = false;
    mockService({
      videos: () => ({
        data: { id: LESSON_ID, youtube_video_id: VIDEO_ID, library_access: "PRIVATE", promotion_starred: false },
        error: null,
      }),
      transcripts: () => ({ data: [{ id: "t1" }], error: null }),
      subscriptions: () => ({ data: null, error: null }),
      user_lesson_library: (calls: QueryCall[]) => {
        if (calls.some((c) => c.op === "upsert")) libraryUpserted = true;
        if (calls.some((c) => c.op === "gte")) return { data: [], error: null }; // 0 so far this month
        return { data: null, error: null }; // isInLibrary check: not yet a member
      },
    });

    const result = await createLesson({ youtubeUrl: YOUTUBE_URL });

    expect(result).toMatchObject({ ok: true, alreadyInLibrary: false, transcriptStatus: "existing" });
    expect(libraryUpserted).toBe(true);
    expect(fetchOembed).not.toHaveBeenCalled();
    expect(youtubeCaptionProvider.fetch).not.toHaveBeenCalled();
  });

  it("reuses an orphaned PRIVATE lesson (no transcript yet) instead of inserting a new videos row, and adds the library row on caption success", async () => {
    mockClient(USER);
    vi.mocked(youtubeCaptionProvider.fetch).mockResolvedValue({
      source: "youtube_caption",
      lines: [{ startTime: 0, endTime: 2, textJp: "こんにちは", textTranslation: null }],
    });
    let insertedOnVideos = false;
    let libraryUpserted = false;
    mockService({
      videos: (calls: QueryCall[]) => {
        if (calls.some((c) => c.op === "insert")) {
          insertedOnVideos = true;
          return {
            data: { id: LESSON_ID, youtube_video_id: VIDEO_ID, library_access: "PRIVATE", promotion_starred: false },
            error: null,
          };
        }
        return {
          data: { id: LESSON_ID, youtube_video_id: VIDEO_ID, library_access: "PRIVATE", promotion_starred: false },
          error: null,
        };
      },
      transcripts: (calls: QueryCall[]) => {
        if (calls.some((c) => c.op === "insert")) return { data: { id: "t-new" }, error: null };
        return { data: [], error: null }; // hasTranscript: no rows yet — the orphan
      },
      transcript_lines: () => ({ data: null, error: null }),
      subscriptions: () => ({ data: null, error: null }),
      user_lesson_library: (calls: QueryCall[]) => {
        if (calls.some((c) => c.op === "upsert")) libraryUpserted = true;
        if (calls.some((c) => c.op === "gte")) return { data: [], error: null }; // 0 so far this month
        return { data: null, error: null };
      },
    });

    const result = await createLesson({ youtubeUrl: YOUTUBE_URL });

    expect(result).toMatchObject({ ok: true, alreadyInLibrary: false, transcriptStatus: "fetched" });
    expect(fetchOembed).not.toHaveBeenCalled();
    expect(insertedOnVideos).toBe(false);
    expect(libraryUpserted).toBe(true);
  });

  it("reuses an orphaned PRIVATE lesson (no transcript yet), checks quota, but does NOT add the library row on repeat caption failure", async () => {
    mockClient(USER);
    vi.mocked(youtubeCaptionProvider.fetch).mockResolvedValue(null);
    let insertedOnVideos = false;
    let quotaChecked = false;
    let libraryTouched = false;
    mockService({
      videos: (calls: QueryCall[]) => {
        if (calls.some((c) => c.op === "insert")) insertedOnVideos = true;
        return {
          data: { id: LESSON_ID, youtube_video_id: VIDEO_ID, library_access: "PRIVATE", promotion_starred: false },
          error: null,
        };
      },
      transcripts: () => ({ data: [], error: null }), // hasTranscript: no rows yet — the orphan
      subscriptions: () => ({ data: null, error: null }),
      user_lesson_library: (calls: QueryCall[]) => {
        if (calls.some((c) => c.op === "gte")) {
          quotaChecked = true;
          return { data: [], error: null }; // 0 so far this month — under quota
        }
        if (calls.some((c) => c.op === "upsert")) libraryTouched = true;
        return { data: null, error: null };
      },
    });

    const result = await createLesson({ youtubeUrl: YOUTUBE_URL });

    expect(result).toMatchObject({ ok: true, alreadyInLibrary: false, transcriptStatus: "missing" });
    expect(fetchOembed).not.toHaveBeenCalled();
    expect(insertedOnVideos).toBe(false);
    expect(quotaChecked).toBe(true);
    expect(libraryTouched).toBe(false);
  });

  it("blocks a Free user already at quota from creating a brand-new lesson", async () => {
    mockClient(USER);
    mockService({
      videos: () => ({ data: null, error: null }), // no existing lesson at all
      subscriptions: () => ({ data: null, error: null }), // free tier
      user_lesson_library: (calls: QueryCall[]) => {
        if (calls.some((c) => c.op === "gte")) return { data: [{ a: 1 }, { a: 2 }, { a: 3 }], error: null };
        return { data: null, error: null };
      },
    });

    const result = await createLesson({ youtubeUrl: YOUTUBE_URL });

    expect(result).toEqual({ ok: false, status: 403, reason: "quota_exceeded" });
    expect(fetchOembed).not.toHaveBeenCalled();
  });

  it("creates a brand-new PRIVATE lesson and reports transcriptStatus 'fetched' on caption success", async () => {
    mockClient(USER);
    vi.mocked(fetchOembed).mockResolvedValue({ title: "Test", thumbnailUrl: "t.jpg", authorName: "A" });
    vi.mocked(youtubeCaptionProvider.fetch).mockResolvedValue({
      source: "youtube_caption",
      lines: [{ startTime: 0, endTime: 2, textJp: "こんにちは", textTranslation: null }],
    });
    mockService({
      videos: (calls: QueryCall[]) => {
        if (calls.some((c) => c.op === "insert")) {
          return {
            data: { id: LESSON_ID, youtube_video_id: VIDEO_ID, library_access: "PRIVATE", promotion_starred: false },
            error: null,
          };
        }
        return { data: null, error: null }; // dedup lookup: nothing exists yet
      },
      subscriptions: () => ({ data: null, error: null }),
      user_lesson_library: (calls: QueryCall[]) => {
        if (calls.some((c) => c.op === "gte")) return { data: [], error: null };
        return { data: null, error: null };
      },
      transcripts: () => ({ data: { id: "t-new" }, error: null }),
      transcript_lines: () => ({ data: null, error: null }),
    });

    const result = await createLesson({ youtubeUrl: YOUTUBE_URL });

    expect(result).toMatchObject({ ok: true, alreadyInLibrary: false, transcriptStatus: "fetched" });
  });

  it("creates a brand-new PRIVATE lesson but reports transcriptStatus 'missing' with no quota spent on caption failure", async () => {
    mockClient(USER);
    vi.mocked(fetchOembed).mockResolvedValue({ title: "Test", thumbnailUrl: "t.jpg", authorName: "A" });
    vi.mocked(youtubeCaptionProvider.fetch).mockResolvedValue(null);
    let libraryTouched = false;
    mockService({
      videos: (calls: QueryCall[]) => {
        if (calls.some((c) => c.op === "insert")) {
          return {
            data: { id: LESSON_ID, youtube_video_id: VIDEO_ID, library_access: "PRIVATE", promotion_starred: false },
            error: null,
          };
        }
        return { data: null, error: null };
      },
      subscriptions: () => ({ data: null, error: null }),
      transcripts: () => ({ data: [], error: null }), // hasTranscript: freshly inserted, no rows yet
      user_lesson_library: (calls: QueryCall[]) => {
        if (calls.some((c) => c.op === "gte")) return { data: [], error: null };
        if (calls.some((c) => c.op === "upsert")) libraryTouched = true;
        return { data: null, error: null };
      },
    });

    const result = await createLesson({ youtubeUrl: YOUTUBE_URL });

    expect(result).toMatchObject({ ok: true, alreadyInLibrary: false, transcriptStatus: "missing" });
    expect(libraryTouched).toBe(false);
  });

  it("recovers from a 23505 unique-violation race by re-selecting the winning row instead of throwing", async () => {
    // Two concurrent requests paste the same brand-new URL: the loser's
    // insert hits videos.youtube_video_id's unique constraint. The old
    // importVideo() (deleted by Task 8) re-selected the winner's row instead
    // of throwing; insertLessonAndFetchTranscript must do the same (final
    // whole-branch review, 2026-08-01).
    mockClient(USER);
    vi.mocked(fetchOembed).mockResolvedValue({ title: "Test", thumbnailUrl: "t.jpg", authorName: "A" });
    let insertAttempted = false;
    let selectCount = 0;
    mockService({
      videos: (calls: QueryCall[]) => {
        if (calls.some((c) => c.op === "insert")) {
          insertAttempted = true;
          return { data: null, error: { message: "duplicate key value violates unique constraint", code: "23505" } };
        }
        selectCount += 1;
        if (selectCount === 1) {
          // createLesson's initial dedup lookup: nothing exists yet.
          return { data: null, error: null };
        }
        // insertLessonAndFetchTranscript's re-select after the race: another
        // concurrent request already won and inserted the row.
        return {
          data: { id: LESSON_ID, youtube_video_id: VIDEO_ID, library_access: "PRIVATE", promotion_starred: false },
          error: null,
        };
      },
      subscriptions: () => ({ data: null, error: null }),
      user_lesson_library: (calls: QueryCall[]) => {
        if (calls.some((c) => c.op === "gte")) return { data: [], error: null };
        return { data: null, error: null };
      },
      transcripts: () => ({ data: [{ id: "t1" }], error: null }), // the winning row already has a transcript
    });

    const result = await createLesson({ youtubeUrl: YOUTUBE_URL });

    expect(insertAttempted).toBe(true);
    expect(result).toMatchObject({ ok: true, alreadyInLibrary: false, transcriptStatus: "existing" });
    expect(youtubeCaptionProvider.fetch).not.toHaveBeenCalled();
  });

  it("re-throws a non-23505 insert error rather than treating it as a race", async () => {
    mockClient(USER);
    vi.mocked(fetchOembed).mockResolvedValue({ title: "Test", thumbnailUrl: "t.jpg", authorName: "A" });
    mockService({
      videos: (calls: QueryCall[]) => {
        if (calls.some((c) => c.op === "insert")) {
          return { data: null, error: { message: "connection reset", code: "08006" } };
        }
        return { data: null, error: null };
      },
      subscriptions: () => ({ data: null, error: null }),
      user_lesson_library: (calls: QueryCall[]) => {
        if (calls.some((c) => c.op === "gte")) return { data: [], error: null };
        return { data: null, error: null };
      },
    });

    await expect(createLesson({ youtubeUrl: YOUTUBE_URL })).rejects.toEqual(
      expect.objectContaining({ code: "08006" }),
    );
  });

  it("maps an oEmbed failure to a 422", async () => {
    mockClient(USER);
    vi.mocked(fetchOembed).mockRejectedValue(new OembedFetchError("boom"));
    mockService({
      videos: () => ({ data: null, error: null }),
      subscriptions: () => ({ data: null, error: null }),
      user_lesson_library: () => ({ data: [], error: null }),
    });

    const result = await createLesson({ youtubeUrl: YOUTUBE_URL });
    expect(result).toEqual({ ok: false, status: 422 });
  });
});

describe("createLessonAsAdmin", () => {
  it("passes through a guard failure", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ ok: false, status: 403 });
    const result = await createLessonAsAdmin({ youtubeUrl: YOUTUBE_URL, libraryAccess: "FREE" });
    expect(result).toEqual({ ok: false, status: 403 });
  });

  it("creates directly at the requested tier with no quota check", async () => {
    vi.mocked(requireAdmin).mockResolvedValue({ ok: true, user: ADMIN });
    vi.mocked(fetchOembed).mockResolvedValue({ title: "Test", thumbnailUrl: "t.jpg", authorName: "A" });
    vi.mocked(youtubeCaptionProvider.fetch).mockResolvedValue({
      source: "youtube_caption",
      lines: [{ startTime: 0, endTime: 2, textJp: "こんにちは", textTranslation: null }],
    });
    let insertedLibraryAccess: unknown;
    mockService({
      videos: (calls: QueryCall[]) => {
        const insert = calls.find((c): c is Extract<QueryCall, { op: "insert" }> => c.op === "insert");
        if (insert) {
          insertedLibraryAccess = (insert.values as { library_access: unknown }).library_access;
          return {
            data: { id: LESSON_ID, youtube_video_id: VIDEO_ID, library_access: "FREE", promotion_starred: false },
            error: null,
          };
        }
        return { data: null, error: null };
      },
      transcripts: () => ({ data: { id: "t-new" }, error: null }),
      transcript_lines: () => ({ data: null, error: null }),
    });

    const result = await createLessonAsAdmin({ youtubeUrl: YOUTUBE_URL, libraryAccess: "FREE" });

    expect(result).toMatchObject({ ok: true, transcriptStatus: "fetched" });
    expect(insertedLibraryAccess).toBe("FREE");
  });
});
