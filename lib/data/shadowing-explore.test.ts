import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase } from "@/test/supabase-mock";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/data/collections", () => ({ listCollections: vi.fn(), listCollectionLessons: vi.fn() }));
vi.mock("@/lib/data/lesson-taxonomy", () => ({ listSituations: vi.fn() }));
vi.mock("@/lib/data/recommendations", () => ({ getRecommendations: vi.fn() }));
vi.mock("@/lib/japanese/tokenizer", () => ({ tokenize: vi.fn() }));
vi.mock("@/lib/difficulty", () => ({ contentLemmas: vi.fn() }));

import { getShadowingExplore } from "./shadowing-explore";
import { listCollections, listCollectionLessons } from "@/lib/data/collections";
import { listSituations } from "@/lib/data/lesson-taxonomy";
import { getRecommendations } from "@/lib/data/recommendations";
import { tokenize } from "@/lib/japanese/tokenizer";
import { contentLemmas } from "@/lib/difficulty";
import type { VideoRow } from "@/lib/data/videos";

const USER = { id: "explore-learner" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listCollections).mockResolvedValue([]);
  vi.mocked(listCollectionLessons).mockResolvedValue([]);
  vi.mocked(listSituations).mockResolvedValue([]);
  vi.mocked(getRecommendations).mockResolvedValue({ ok: true, data: [] });
  vi.mocked(tokenize).mockResolvedValue([]);
  vi.mocked(contentLemmas).mockReturnValue([]);
});

describe("getShadowingExplore", () => {
  it("does not compose catalogue or learner data without an authenticated learner", async () => {
    const client = createMockSupabase({ user: null, tables: {} });
    vi.mocked(createClient).mockReturnValue(client as unknown as ReturnType<typeof createClient>);

    await expect(getShadowingExplore()).resolves.toEqual({ ok: false, status: 401 });
    expect(listCollections).not.toHaveBeenCalled();
    expect(getRecommendations).not.toHaveBeenCalled();
  });

  it("projects every curated shelf with the same selected situation context", async () => {
    const client = createMockSupabase({
      user: USER,
      tables: {
        user_lesson_library: () => ({ data: [], error: null }),
        videos: () => ({ data: [], error: null }),
      },
    });
    vi.mocked(createClient).mockReturnValue(client as unknown as ReturnType<typeof createClient>);
    vi.mocked(listSituations).mockResolvedValue([{ id: "s-restaurant", slug: "restaurant", displayOrder: 1 }]);
    vi.mocked(listCollections).mockResolvedValue([
      { id: "c1", slug: "beginner-foundation", title: "Beginner Foundation", description: null, coverImageUrl: null, displayOrder: 1 },
      { id: "c2", slug: "daily-conversation", title: "Daily Conversation", description: null, coverImageUrl: null, displayOrder: 2 },
      { id: "featured", slug: "featured", title: "Featured", description: null, coverImageUrl: null, displayOrder: 0 },
    ]);

    const result = await getShadowingExplore({ situation: "restaurant" });

    expect(result).toMatchObject({
      ok: true,
      data: {
        activeSituation: "restaurant",
        situations: [{ slug: "restaurant" }],
        shelves: [{ collection: { id: "c1" } }, { collection: { id: "c2" } }],
      },
    });
    expect(listCollectionLessons).toHaveBeenNthCalledWith(1, "c1", { situationId: "s-restaurant", query: "", limit: 9 });
    expect(listCollectionLessons).toHaveBeenNthCalledWith(2, "c2", { situationId: "s-restaurant", query: "", limit: 9 });
    expect(listCollectionLessons).toHaveBeenCalledTimes(2);
  });

  it("omits recommendations and the quiet suggestion when they fall outside the selected catalogue context", async () => {
    const restaurantLesson: VideoRow = { id: "restaurant-lesson", youtube_video_id: "yt-restaurant", title: "Restaurant Japanese", duration_seconds: 120, thumbnail_url: null, jlpt_level_estimate: "N5", added_by_user_id: null, library_access: "FREE", promotion_starred: false, created_at: "2026-09-09T00:00:00Z" };
    const client = createMockSupabase({
      user: USER,
      tables: {
        user_lesson_library: () => ({ data: [], error: null }),
        videos: () => ({ data: [restaurantLesson], error: null }),
        transcripts: () => ({ data: [], error: null }),
      },
    });
    vi.mocked(createClient).mockReturnValue(client as unknown as ReturnType<typeof createClient>);
    vi.mocked(listSituations).mockResolvedValue([{ id: "s-restaurant", slug: "restaurant", displayOrder: 1 }]);
    vi.mocked(getRecommendations).mockResolvedValue({ ok: true, data: [{ videoId: "outside-context", youtubeVideoId: "yt-outside", title: "Business Japanese", thumbnailUrl: null, jlptLevelEstimate: "N3", knownRatio: 0.8, band: "ideal", totalWords: 10, knownWords: 8, reason: { kind: "known-word-fit", knownRatio: 0.8, totalWords: 10, knownWords: 8 } }] });

    const result = await getShadowingExplore({ situation: "restaurant" });

    expect(result).toMatchObject({ ok: true, data: { recommendations: [], quietSuggestion: null } });
  });

  it("attaches the first three stored transcript lines to a shelf lesson in playback order", async () => {
    const client = createMockSupabase({
      user: USER,
      tables: {
        user_lesson_library: () => ({ data: [], error: null }),
        videos: () => ({ data: [], error: null }),
        transcripts: () => ({ data: [{ id: "t1", video_id: "v1", created_at: "2026-09-09T00:00:00Z" }], error: null }),
        transcript_lines: () => ({ data: [
          { transcript_id: "t1", text_jp: "一番目", start_time: 0 },
          { transcript_id: "t1", text_jp: "二番目", start_time: 2 },
          { transcript_id: "t1", text_jp: "三番目", start_time: 4 },
          { transcript_id: "t1", text_jp: "四番目", start_time: 6 },
        ], error: null }),
      },
    });
    vi.mocked(createClient).mockReturnValue(client as unknown as ReturnType<typeof createClient>);
    vi.mocked(listCollections).mockResolvedValue([{ id: "c1", slug: "beginner-foundation", title: "Beginner", description: null, coverImageUrl: null, displayOrder: 1 }]);
    vi.mocked(listCollectionLessons).mockResolvedValue([{ id: "v1", youtube_video_id: "yt1", title: "Catalogued", duration_seconds: 120, thumbnail_url: null, jlpt_level_estimate: "N5", added_by_user_id: null, library_access: "FREE", promotion_starred: false, created_at: "2026-09-09T00:00:00Z" }]);
    vi.mocked(tokenize).mockResolvedValue([{ base: "食べる", pos: "動詞" }] as never);
    vi.mocked(contentLemmas).mockReturnValue(["食べる"]);

    const result = await getShadowingExplore();

    expect(result).toMatchObject({ ok: true, data: { shelves: [{ lessons: [{ id: "v1", transcriptPreview: ["一番目", "二番目", "三番目"], lineCount: 4, wordCount: 4 }] }] } });
    expect(tokenize).toHaveBeenCalledTimes(4);
  });

  it("projects all five authored shelves while leaving missing transcript data and unmeasured suggestions absent", async () => {
    const video = (id: string): VideoRow => ({ id, youtube_video_id: `yt-${id}`, title: `Lesson ${id}`, duration_seconds: 120, thumbnail_url: null, jlpt_level_estimate: "N5", added_by_user_id: null, library_access: "FREE", promotion_starred: false, created_at: "2026-09-09T00:00:00Z" });
    const client = createMockSupabase({
      user: USER,
      tables: {
        user_lesson_library: () => ({ data: [{ lesson_id: "library" }], error: null }),
        videos: () => ({ data: [video("library"), video("recent")], error: null }),
        transcripts: () => ({ data: [], error: null }),
      },
    });
    vi.mocked(createClient).mockReturnValue(client as unknown as ReturnType<typeof createClient>);
    vi.mocked(listCollections).mockResolvedValue([
      "beginner-foundation", "daily-conversation", "natural-japanese", "advanced-expression", "native-fluency",
    ].map((slug, index) => ({ id: `c${index}`, slug, title: slug, description: null, coverImageUrl: null, displayOrder: index })));
    vi.mocked(listCollectionLessons).mockImplementation(async (collectionId) => [video(`lesson-${collectionId}`)]);
    vi.mocked(getRecommendations).mockResolvedValue({ ok: true, data: [{ videoId: "recommendation", youtubeVideoId: "yt-recommendation", title: "Unmeasured", thumbnailUrl: null, jlptLevelEstimate: "N4", knownRatio: 0, band: "too-hard", totalWords: 0, knownWords: 0, reason: null }] });

    const result = await getShadowingExplore();

    expect(result).toMatchObject({ ok: true, data: { library: [{ lesson: { id: "library" }, state: "unavailable" }], recentlyAdded: [{ id: "library" }, { id: "recent" }], quietSuggestion: null } });
    if (!result.ok) throw new Error("Expected an authenticated projection");
    expect(result.data.shelves).toHaveLength(5);
    expect(result.data.shelves.every((shelf) => shelf.lessons.length === 1)).toBe(true);
    expect(result.data.shelves.flatMap((shelf) => shelf.lessons).every((lesson) => lesson.transcriptPreview.length === 0 && lesson.lineCount === 0 && lesson.wordCount === 0)).toBe(true);
    expect(listCollectionLessons).toHaveBeenCalledTimes(5);
  });

  it("tokenizes a repeated lesson transcript once per request even when editorial shelves overlap", async () => {
    const client = createMockSupabase({
      user: USER,
      tables: {
        user_lesson_library: () => ({ data: [], error: null }), videos: () => ({ data: [], error: null }),
        transcripts: () => ({ data: [{ id: "t1", video_id: "v1", created_at: "2026-09-09T00:00:00Z" }], error: null }),
        transcript_lines: () => ({ data: [{ transcript_id: "t1", text_jp: "åŒã˜", start_time: 0 }], error: null }),
      },
    });
    vi.mocked(createClient).mockReturnValue(client as unknown as ReturnType<typeof createClient>);
    vi.mocked(listCollections).mockResolvedValue([
      { id: "c1", slug: "beginner-foundation", title: "Beginner", description: null, coverImageUrl: null, displayOrder: 1 },
      { id: "c2", slug: "daily-conversation", title: "Daily", description: null, coverImageUrl: null, displayOrder: 2 },
    ]);
    const repeated: VideoRow = { id: "v1", youtube_video_id: "yt1", title: "Repeated", duration_seconds: 120, thumbnail_url: null, jlpt_level_estimate: "N5", added_by_user_id: null, library_access: "FREE", promotion_starred: false, created_at: "2026-09-09T00:00:00Z" };
    vi.mocked(listCollectionLessons).mockResolvedValue([repeated]);
    vi.mocked(tokenize).mockResolvedValue([{ base: "åŒã˜", pos: "åè©ž" }] as never);
    vi.mocked(contentLemmas).mockReturnValue(["åŒã˜"]);

    await getShadowingExplore();

    expect(tokenize).toHaveBeenCalledTimes(1);
  });

  it("bounds a shelf to the Figma grid and records that later lessons are not silently omitted", async () => {
    const client = createMockSupabase({
      user: USER,
      tables: {
        user_lesson_library: () => ({ data: [], error: null }), videos: () => ({ data: [], error: null }),
        transcripts: () => ({ data: [], error: null }),
      },
    });
    vi.mocked(createClient).mockReturnValue(client as unknown as ReturnType<typeof createClient>);
    vi.mocked(listCollections).mockResolvedValue([{ id: "c1", slug: "beginner-foundation", title: "Beginner", description: null, coverImageUrl: null, displayOrder: 1 }]);
    vi.mocked(listCollectionLessons).mockResolvedValue(Array.from({ length: 9 }, (_, index): VideoRow => ({ id: `v${index}`, youtube_video_id: `yt${index}`, title: `Lesson ${index}`, duration_seconds: 120, thumbnail_url: null, jlpt_level_estimate: "N5", added_by_user_id: null, library_access: "FREE", promotion_starred: false, created_at: "2026-09-09T00:00:00Z" })));

    const result = await getShadowingExplore();

    if (!result.ok) throw new Error("Expected an authenticated projection");
    const firstShelf = result.data.shelves[0];
    if (!firstShelf) throw new Error("Expected the authored shelf");
    expect(firstShelf).toMatchObject({ hasMore: true });
    expect(firstShelf.lessons).toHaveLength(8);
    expect(listCollectionLessons).toHaveBeenCalledWith("c1", { situationId: undefined, query: "", limit: 9 });
  });
});
