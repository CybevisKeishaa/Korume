import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase } from "@/test/supabase-mock";
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
vi.mock("@/lib/data/user-stats", () => ({ getUserStats: vi.fn() }));

import { getShadowingHub } from "./shadowing-hub";
import { getCollectionBySlug, listCollectionLessons } from "@/lib/data/collections";
import { countMonthlyCreations, hasTranscript } from "@/lib/data/lesson-library";
import { getActivePlanTier } from "@/lib/data/subscriptions";
import { PopularStrategyV1 } from "@/lib/data/lesson-ranking";
import { getRecommendations } from "@/lib/data/recommendations";
import { getUserStats } from "@/lib/data/user-stats";

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
  options: { libraryIds?: string[]; videos?: VideoRow[]; progress?: unknown[] } = {},
) {
  const supabase = createMockSupabase({
    user,
    tables: {
      user_lesson_library: () => ({
        data: (options.libraryIds ?? []).map((lesson_id) => ({ lesson_id })),
        error: null,
      }),
      videos: () => ({ data: options.videos ?? [], error: null }),
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
  vi.mocked(getUserStats).mockResolvedValue({
    ok: true,
    data: {
      xp: 0,
      level: { level: 1, levelFloorXp: 0, nextLevelXp: 100, progressRatio: 0 },
      streakCurrent: 0,
      streakLongest: 0,
      lastActiveDate: null,
      badges: [],
      srsDueCount: 0,
    },
  });
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
        quota: { used: 0, limit: 3, tier: "free" },
        rail: {
          stats: {
            xp: 0,
            level: { level: 1, levelFloorXp: 0, nextLevelXp: 100, progressRatio: 0 },
            streakCurrent: 0,
            streakLongest: 0,
            lastActiveDate: null,
            badges: [],
            srsDueCount: 0,
          },
          suggestion: null,
        },
      },
    });
  });
});
