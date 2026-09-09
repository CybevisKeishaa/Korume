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

import { getShadowingHub } from "./shadowing-hub";
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
