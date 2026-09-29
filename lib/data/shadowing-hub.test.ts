import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type QueryCall } from "@/test/supabase-mock";
import { createClient } from "@/lib/supabase/server";
import type { VideoRow } from "@/lib/data/videos";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/data/collections", () => ({
  getCollectionBySlug: vi.fn(),
  listCollectionLessons: vi.fn(),
}));
vi.mock("@/lib/data/lesson-library", () => ({
  FREE_MONTHLY_LESSON_QUOTA: 3,
  countMonthlyCreations: vi.fn(),
  hasTranscript: vi.fn(),
}));
vi.mock("@/lib/data/subscriptions", () => ({ getActivePlanTier: vi.fn() }));
vi.mock("@/lib/data/lesson-ranking", () => ({
  PopularStrategyV1: { id: "popular-v1", rank: vi.fn() },
}));
vi.mock("@/lib/data/recommendations", () => ({ getRecommendations: vi.fn() }));
vi.mock("@/lib/data/lesson-taxonomy", () => ({ listSituations: vi.fn(), listSources: vi.fn() }));

import { getHubDiscovery, getShadowingHub } from "./shadowing-hub";
import { getCollectionBySlug, listCollectionLessons } from "@/lib/data/collections";
import { countMonthlyCreations, hasTranscript } from "@/lib/data/lesson-library";
import { getActivePlanTier } from "@/lib/data/subscriptions";
import { PopularStrategyV1 } from "@/lib/data/lesson-ranking";
import { getRecommendations } from "@/lib/data/recommendations";
import { listSituations, listSources } from "@/lib/data/lesson-taxonomy";

const USER = { id: "learner-1" };

const PRIVATE_LESSON: VideoRow = {
  id: "private-lesson",
  youtube_video_id: "yt-private",
  title: "My private lesson",
  duration_seconds: 420,
  thumbnail_url: "https://img.example/private.jpg",
  jlpt_level_estimate: "N4",
  added_by_user_id: USER.id,
  library_access: "PRIVATE",
  promotion_starred: false,
  created_at: "2026-09-01T00:00:00Z",
};

function mockClient(
  user: { id: string } | null = USER,
  options: { libraryIds?: string[]; videos?: VideoRow[]; progress?: unknown[]; onVideosQuery?: (calls: QueryCall[]) => void } = {},
) {
  const supabase = createMockSupabase({
    user,
    tables: {
      user_lesson_library: () => ({
        data: (options.libraryIds ?? []).map((lesson_id) => ({ lesson_id })),
        error: null,
      }),
      videos: (calls) => {
        options.onVideosQuery?.(calls);
        return { data: options.videos ?? [], error: null };
      },
      user_video_progress: () => ({ data: options.progress ?? [], error: null }),
    },
  });
  vi.mocked(createClient).mockReturnValue(supabase as unknown as ReturnType<typeof createClient>);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCollectionBySlug).mockResolvedValue(null);
  vi.mocked(listCollectionLessons).mockResolvedValue([]);
  vi.mocked(countMonthlyCreations).mockResolvedValue(0);
  vi.mocked(hasTranscript).mockResolvedValue(true);
  vi.mocked(getActivePlanTier).mockResolvedValue("free");
  vi.mocked(PopularStrategyV1.rank).mockResolvedValue([]);
  vi.mocked(getRecommendations).mockResolvedValue({ ok: true, data: [] });
  vi.mocked(listSituations).mockResolvedValue([]);
  vi.mocked(listSources).mockResolvedValue([]);
});

describe("getShadowingHub", () => {
  it("returns 401 without composing private learner data when signed out", async () => {
    mockClient(null);

    await expect(getShadowingHub()).resolves.toEqual({ ok: false, status: 401 });
  });

  it("projects a private lesson in the learner's library as ready when its transcript exists", async () => {
    mockClient(USER, { libraryIds: [PRIVATE_LESSON.id], videos: [PRIVATE_LESSON] });

    const result = await getShadowingHub();

    expect(result).toMatchObject({
      ok: true,
      data: {
        quota: { used: 0, limit: 3, tier: "free" },
        library: [
          {
            lesson: {
              id: PRIVATE_LESSON.id,
              youtubeVideoId: PRIVATE_LESSON.youtube_video_id,
              title: PRIVATE_LESSON.title,
              thumbnailUrl: PRIVATE_LESSON.thumbnail_url,
            },
            state: "ready",
          },
        ],
      },
    });
  });

  it("projects a library lesson with no transcript as unavailable, never as building progress", async () => {
    mockClient(USER, { libraryIds: [PRIVATE_LESSON.id], videos: [PRIVATE_LESSON] });
    vi.mocked(hasTranscript).mockResolvedValue(false);

    const result = await getShadowingHub();

    expect(result).toMatchObject({
      ok: true,
      data: { library: [{ lesson: { id: PRIVATE_LESSON.id }, state: "unavailable" }] },
    });
    expect(JSON.stringify(result)).not.toMatch(/building|percentage|eta/i);
  });

  it("keeps the learner's private failed import visible even before it enters the quota ledger", async () => {
    mockClient(USER, { videos: [PRIVATE_LESSON] });
    vi.mocked(hasTranscript).mockResolvedValue(false);

    const result = await getShadowingHub();

    expect(result).toMatchObject({
      ok: true,
      data: { library: [{ lesson: { id: PRIVATE_LESSON.id }, state: "unavailable" }] },
    });
  });

  it("promotes only a measured recommendation reason into the optional rail suggestion", async () => {
    mockClient(USER);
    vi.mocked(getRecommendations).mockResolvedValue({
      ok: true,
      data: [{
        videoId: "recommended-1",
        youtubeVideoId: "yt-recommended-1",
        title: "Ordering at a restaurant",
        thumbnailUrl: null,
        jlptLevelEstimate: "N4",
        knownRatio: 0.78,
        totalWords: 100,
        knownWords: 78,
        band: "ideal",
        reason: { kind: "known-word-fit", knownRatio: 0.78, totalWords: 100, knownWords: 78 },
      }],
    });

    await expect(getShadowingHub()).resolves.toMatchObject({
      ok: true,
      data: {
        rail: {
          suggestion: {
            lesson: { id: "recommended-1", title: "Ordering at a restaurant" },
            reason: { kind: "known-word-fit", knownRatio: 0.78 },
          },
        },
      },
    });
  });

  it("exposes both taxonomy axes and uses only the selected real tag for a discovery query", async () => {
    const videoQueries: QueryCall[][] = [];
    mockClient(USER, { videos: [PRIVATE_LESSON], onVideosQuery: (calls) => videoQueries.push([...calls]) });
    vi.mocked(listSituations).mockResolvedValue([{ id: "s1", slug: "restaurant", displayOrder: 1 }]);
    vi.mocked(listSources).mockResolvedValue([{ id: "o1", slug: "anime", displayOrder: 1 }]);

    const result = await getShadowingHub({ query: "private", filter: "situation:restaurant" });

    expect(result).toMatchObject({
      ok: true,
      data: {
        filters: [
          { kind: "situation", slug: "restaurant" },
          { kind: "source", slug: "anime" },
        ],
        discovery: {
          query: "private",
          activeFilter: "situation:restaurant",
          lessons: [{ id: PRIVATE_LESSON.id }],
        },
      },
    });
    expect(videoQueries).toContainEqual(expect.arrayContaining([
      { op: "ilike", column: "title", pattern: "%private%" },
      { op: "eq", column: "situation_id", value: "s1" },
    ]));
  });

  it("returns null or empty section projections when the learner has no available data", async () => {
    mockClient(USER);

    await expect(getShadowingHub()).resolves.toEqual({
      ok: true,
      data: {
        featured: null,
        library: [],
        continueLearning: [],
        recentlyAdded: [],
        popular: [],
        recommendations: [],
        filters: [],
        discovery: null,
        quota: { used: 0, limit: 3, tier: "free" },
        rail: { suggestion: null },
      },
    });
  });
});

describe("getHubDiscovery", () => {
  it("returns filters without querying videos until discovery is requested", async () => {
    const videoQueries: QueryCall[][] = [];
    mockClient(USER, { onVideosQuery: (calls) => videoQueries.push([...calls]) });
    vi.mocked(listSituations).mockResolvedValue([{ id: "s1", slug: "restaurant", displayOrder: 1 }]);

    await expect(getHubDiscovery()).resolves.toEqual({
      filters: [{ kind: "situation", slug: "restaurant" }],
      discovery: null,
    });
    expect(videoQueries).toEqual([]);
  });

  it("searches titles with the selected known filter", async () => {
    const videoQueries: QueryCall[][] = [];
    mockClient(USER, { videos: [PRIVATE_LESSON], onVideosQuery: (calls) => videoQueries.push([...calls]) });
    vi.mocked(listSituations).mockResolvedValue([{ id: "s1", slug: "restaurant", displayOrder: 1 }]);

    await expect(getHubDiscovery({ query: "private", filter: "situation:restaurant" })).resolves.toMatchObject({
      discovery: { query: "private", activeFilter: "situation:restaurant", lessons: [{ id: PRIVATE_LESSON.id }] },
    });
    expect(videoQueries).toContainEqual(expect.arrayContaining([
      { op: "ilike", column: "title", pattern: "%private%" },
      { op: "eq", column: "situation_id", value: "s1" },
    ]));
  });

  it("filters by a JLPT level on the lesson's estimate, without listing levels among the Hub's chips", async () => {
    const videoQueries: QueryCall[][] = [];
    mockClient(USER, { videos: [PRIVATE_LESSON], onVideosQuery: (calls) => videoQueries.push([...calls]) });
    vi.mocked(listSituations).mockResolvedValue([{ id: "s1", slug: "restaurant", displayOrder: 1 }]);

    await expect(getHubDiscovery({ filter: "level:n3" })).resolves.toEqual({
      filters: [{ kind: "situation", slug: "restaurant" }],
      discovery: expect.objectContaining({ query: "", activeFilter: "level:n3" }),
    });
    expect(videoQueries).toContainEqual(expect.arrayContaining([
      { op: "eq", column: "jlpt_level_estimate", value: "N3" },
    ]));
  });

  it("ignores an unknown filter while retaining a submitted query", async () => {
    const videoQueries: QueryCall[][] = [];
    mockClient(USER, { videos: [PRIVATE_LESSON], onVideosQuery: (calls) => videoQueries.push([...calls]) });
    vi.mocked(listSituations).mockResolvedValue([{ id: "s1", slug: "restaurant", displayOrder: 1 }]);

    await expect(getHubDiscovery({ query: "private", filter: "source:unknown" })).resolves.toMatchObject({
      discovery: { query: "private", activeFilter: null, lessons: [{ id: PRIVATE_LESSON.id }] },
    });
    expect(videoQueries).toContainEqual(expect.arrayContaining([
      { op: "ilike", column: "title", pattern: "%private%" },
    ]));
    expect(videoQueries.flat()).not.toContainEqual(expect.objectContaining({ op: "eq" }));
  });

  it("puts Newest and Shortest, and every duration band, into SQL and lets the database cut the list", async () => {
    const videoQueries: QueryCall[][] = [];
    mockClient(USER, { videos: [PRIVATE_LESSON], onVideosQuery: (calls) => videoQueries.push([...calls]) });

    await getHubDiscovery({ query: "lesson", sort: "shortest", duration: "10_30" });
    await getHubDiscovery({ query: "lesson", sort: "newest", duration: "under_10" });
    await getHubDiscovery({ query: "lesson", duration: "over_30" });
    // /shadowing passes no display options at all: the old four-row read.
    await getHubDiscovery({ query: "lesson" });

    const [shortest, newest, over, plain] = videoQueries;
    // Band edges: 600 and 1800 are inside 10–30; under 10 stops before 600; over 30 starts after 1800.
    expect(shortest).toEqual(expect.arrayContaining([
      { op: "gte", column: "duration_seconds", value: 600 },
      { op: "lte", column: "duration_seconds", value: 1800 },
      { op: "order", column: "duration_seconds", ascending: true, nullsFirst: false },
      { op: "limit", count: 4 },
    ]));
    expect(newest).toEqual(expect.arrayContaining([
      { op: "lt", column: "duration_seconds", value: 600 },
      { op: "order", column: "created_at", ascending: false },
      { op: "limit", count: 4 },
    ]));
    expect(over).toContainEqual({ op: "gt", column: "duration_seconds", value: 1800 });
    expect(plain).toContainEqual({ op: "limit", count: 4 });
    expect(plain?.flat()).not.toContainEqual(expect.objectContaining({ column: "duration_seconds" }));
    expect(getRecommendations).not.toHaveBeenCalled();
  });

  it("hides completed lessons before the four-lesson cut, reading a bounded candidate set", async () => {
    const videoQueries: QueryCall[][] = [];
    const videos = ["a", "b", "c", "d", "e", "f"].map((id) => ({ ...PRIVATE_LESSON, id }));
    mockClient(USER, {
      videos,
      progress: [{ video_id: "a", completed_at: "2026-09-29", last_watched_position: 60 }, { video_id: "c", completed_at: "2026-09-29", last_watched_position: 60 }],
      onVideosQuery: (calls) => videoQueries.push([...calls]),
    });

    await expect(getHubDiscovery({ query: "lesson", sort: "newest", hideCompleted: true })).resolves.toMatchObject({
      discovery: { lessons: [{ id: "b" }, { id: "d" }, { id: "e" }, { id: "f" }] },
    });
    expect(videoQueries[0]).toContainEqual({ op: "limit", count: 100 });
  });

  it("puts lessons started and not finished first, most recently watched first, and leaves finished ones in place", async () => {
    const videos = ["new", "finished", "unwatched", "stale", "recent", "unknown-time"].map((id) => ({ ...PRIVATE_LESSON, id }));
    mockClient(USER, {
      videos,
      progress: [
        { video_id: "finished", completed_at: "2026-09-29", last_watched_position: 90, last_watched_at: "2026-09-29T10:00:00Z" },
        { video_id: "unwatched", completed_at: null, last_watched_position: 0, last_watched_at: "2026-09-29T11:00:00Z" },
        { video_id: "stale", completed_at: null, last_watched_position: 30, last_watched_at: "2026-09-01T00:00:00Z" },
        { video_id: "recent", completed_at: null, last_watched_position: 30, last_watched_at: "2026-09-28T00:00:00Z" },
        { video_id: "unknown-time", completed_at: null, last_watched_position: 30, last_watched_at: null },
      ],
    });

    await expect(getHubDiscovery({ query: "lesson", sort: "in_progress" })).resolves.toMatchObject({
      discovery: { lessons: [{ id: "recent" }, { id: "stale" }, { id: "unknown-time" }, { id: "new" }] },
    });
  });

  it("uses the recommendation engine order before unscored lessons and only then limits", async () => {
    const videos = ["newest", "recommended", "older", "oldest", "fifth"].map((id, index) => ({
      ...PRIVATE_LESSON, id, created_at: `2026-09-${String(29 - index).padStart(2, "0")}T00:00:00Z`,
    }));
    mockClient(USER, { videos });
    vi.mocked(getRecommendations).mockResolvedValue({ ok: true, data: [{ videoId: "recommended" }] as never });

    await expect(getHubDiscovery({ sort: "recommended", query: "lesson" })).resolves.toMatchObject({
      discovery: { lessons: [{ id: "recommended" }, { id: "newest" }, { id: "older" }, { id: "oldest" }] },
    });
    expect(getRecommendations).toHaveBeenCalledWith(expect.objectContaining({ candidateIds: ["newest", "recommended", "older", "oldest", "fifth"] }));
  });

  it("keeps the SQL order when the engine throws, instead of failing the search", async () => {
    mockClient(USER, { videos: ["x", "y"].map((id) => ({ ...PRIVATE_LESSON, id })) });
    vi.mocked(getRecommendations).mockRejectedValue(new Error("transcripts read failed"));
    await expect(getHubDiscovery({ sort: "recommended", query: "lesson" })).resolves.toMatchObject({
      discovery: { lessons: [{ id: "x" }, { id: "y" }] },
    });
  });

  it("keeps the SQL order when the engine is unavailable", async () => {
    mockClient(USER, { videos: ["x", "y"].map((id) => ({ ...PRIVATE_LESSON, id })) });
    vi.mocked(getRecommendations).mockResolvedValue({ ok: false, status: 401 });
    await expect(getHubDiscovery({ sort: "recommended", query: "lesson" })).resolves.toMatchObject({
      discovery: { lessons: [{ id: "x" }, { id: "y" }] },
    });
  });
});
