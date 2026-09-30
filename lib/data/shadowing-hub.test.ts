import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockSupabase, type QueryCall } from "@/test/supabase-mock";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { VideoRow } from "@/lib/data/videos";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));
vi.mock("@/lib/data/collections", () => ({
  getCollectionBySlug: vi.fn(),
  listCollectionLessons: vi.fn(),
}));
vi.mock("@/lib/data/lesson-library", () => ({
  FREE_MONTHLY_LESSON_QUOTA: 3,
  countMonthlyCreations: vi.fn(),
}));
vi.mock("@/lib/data/subscriptions", () => ({ getActivePlanTier: vi.fn() }));
vi.mock("@/lib/data/lesson-ranking", () => ({
  PopularStrategyV1: { id: "popular-v1", rank: vi.fn() },
}));
vi.mock("@/lib/data/recommendations", () => ({ getRecommendations: vi.fn() }));
vi.mock("@/lib/data/lesson-taxonomy", () => ({ listSituations: vi.fn(), listSources: vi.fn() }));

import { getHubDiscovery, getHubDiscoveryCount, getShadowingHub } from "./shadowing-hub";
import { getCollectionBySlug, listCollectionLessons } from "@/lib/data/collections";
import { countMonthlyCreations } from "@/lib/data/lesson-library";
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
  options: { libraryIds?: string[]; transcriptVideoIds?: string[]; videos?: VideoRow[]; progress?: unknown[]; onVideosQuery?: (calls: QueryCall[]) => void; enforcePostgrestCap?: boolean } = {},
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
      learner_videos: (calls) => {
        options.onVideosQuery?.(calls);
        let rows = (options.videos ?? []).map((video) => {
          const progress = (options.progress ?? []).find((row) => (row as { video_id?: string }).video_id === video.id) as { last_watched_position?: number; completed_at?: string | null; last_watched_at?: string | null } | undefined;
          return { ...video, last_watched_position: progress?.last_watched_position ?? 0, completed_at: progress?.completed_at ?? null, last_watched_at: progress?.last_watched_at ?? null, in_progress: Boolean(progress && !progress.completed_at && (progress.last_watched_position ?? 0) > 0), in_library: (options.libraryIds ?? []).includes(video.id) || (video.library_access === "PRIVATE" && video.added_by_user_id === user?.id) };
        });
        for (const call of calls) {
          if (call.op === "is" && call.column === "completed_at" && call.value === null) rows = rows.filter((row) => row.completed_at === null);
          if (call.op === "eq" && call.column === "in_library") rows = rows.filter((row) => row.in_library === call.value);
          if (call.op === "eq" && call.column === "in_progress") rows = rows.filter((row) => row.in_progress === call.value);
        }
        if (calls.some((call) => call.op === "order" && call.column === "in_progress")) rows = rows.sort((left, right) => Number(right.in_progress) - Number(left.in_progress) || (left.in_progress && right.in_progress ? (right.last_watched_at ?? "").localeCompare(left.last_watched_at ?? "") : 0) || right.created_at.localeCompare(left.created_at));
        return { data: rows, error: null };
      },
      user_video_progress: () => ({ data: options.progress ?? [], error: null }),
    },
    rpcs: {
      // Every lesson has a transcript unless the test names which do.
      latest_transcript_ids: ({ p_video_ids }) => ({
        data: (p_video_ids as string[])
          .filter((video_id) => !options.transcriptVideoIds || options.transcriptVideoIds.includes(video_id))
          .map((video_id) => ({ video_id, transcript_id: `t-${video_id}` })),
        error: null,
      }),
    },
    enforcePostgrestCap: options.enforcePostgrestCap,
  });
  vi.mocked(createClient).mockReturnValue(supabase as unknown as ReturnType<typeof createClient>);
  vi.mocked(createServiceClient).mockReturnValue(supabase as unknown as ReturnType<typeof createServiceClient>);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCollectionBySlug).mockResolvedValue(null);
  vi.mocked(listCollectionLessons).mockResolvedValue([]);
  vi.mocked(countMonthlyCreations).mockResolvedValue(0);
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
    mockClient(USER, { libraryIds: [PRIVATE_LESSON.id], videos: [PRIVATE_LESSON], transcriptVideoIds: [] });

    const result = await getShadowingHub();

    expect(result).toMatchObject({
      ok: true,
      data: { library: [{ lesson: { id: PRIVATE_LESSON.id }, state: "unavailable" }] },
    });
    expect(JSON.stringify(result)).not.toMatch(/building|percentage|eta/i);
  });

  it("keeps the learner's private failed import visible even before it enters the quota ledger", async () => {
    mockClient(USER, { videos: [PRIVATE_LESSON], transcriptVideoIds: [] });

    const result = await getShadowingHub();

    expect(result).toMatchObject({
      ok: true,
      data: { library: [{ lesson: { id: PRIVATE_LESSON.id }, state: "unavailable" }] },
    });
  });

  it("pages all 1,001 library lessons before checking transcript availability", async () => {
    const ranges: QueryCall[][] = [];
    const videos = Array.from({ length: 1_001 }, (_, index) => ({ ...PRIVATE_LESSON, id: `library-${index}` }));
    mockClient(USER, {
      libraryIds: videos.map((video) => video.id),
      transcriptVideoIds: videos.map((video) => video.id),
      videos,
      enforcePostgrestCap: true,
      onVideosQuery: (calls) => {
        if (calls.some((call) => call.op === "eq" && call.column === "in_library")) ranges.push([...calls]);
      },
    });

    const result = await getShadowingHub();

    if (!result.ok) throw new Error("Expected an authenticated projection");
    expect(result.data.library).toHaveLength(1_001);
    expect(ranges).toEqual(expect.arrayContaining([
      expect.arrayContaining([{ op: "range", from: 0, to: 999 }]),
      expect.arrayContaining([{ op: "range", from: 1_000, to: 1_999 }]),
    ]));
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

  it("continues only started, unfinished lessons, with the position it reads from the view", async () => {
    const lesson = (id: string, created_at: string): VideoRow => ({ ...PRIVATE_LESSON, id, library_access: "FREE", added_by_user_id: null, created_at });
    const videoQueries: QueryCall[][] = [];
    mockClient(USER, {
      videos: [lesson("started", "2026-09-03T00:00:00Z"), lesson("finished", "2026-09-02T00:00:00Z"), lesson("untouched", "2026-09-01T00:00:00Z")],
      progress: [
        { video_id: "started", last_watched_position: 120, completed_at: null, last_watched_at: "2026-09-10T00:00:00Z" },
        { video_id: "finished", last_watched_position: 300, completed_at: "2026-09-11T00:00:00Z", last_watched_at: "2026-09-11T00:00:00Z" },
      ],
      onVideosQuery: (calls) => videoQueries.push([...calls]),
    });

    const result = await getShadowingHub();

    expect(result).toMatchObject({ ok: true, data: { continueLearning: [{ lesson: { id: "started" }, lastWatchedPosition: 120 }] } });
    expect(result.ok && result.data.continueLearning).toHaveLength(1);
    // The mock returns every column, so prove the real read asks for the position.
    const continueRead = videoQueries.find((calls) => calls.some((call) => call.op === "eq" && call.column === "in_progress"));
    expect(continueRead?.find((call) => call.op === "select")).toMatchObject({ columns: expect.stringContaining("last_watched_position") });
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

  it("browses lessons only when explicitly requested without a query or filter", async () => {
    const videoQueries: QueryCall[][] = [];
    mockClient(USER, {
      videos: ["one", "two"].map((id) => ({ ...PRIVATE_LESSON, id })),
      onVideosQuery: (calls) => videoQueries.push([...calls]),
    });

    await expect(getHubDiscovery()).resolves.toMatchObject({ discovery: null });
    await expect(getHubDiscovery({ browse: true })).resolves.toMatchObject({
      discovery: { query: "", activeFilter: null, lessons: [{ id: "one" }, { id: "two" }], hasMore: false },
    });
    expect(videoQueries).toHaveLength(1);
  });

  it("uses the requested SQL result limit plus one to report truncation exactly", async () => {
    const videoQueries: QueryCall[][] = [];
    mockClient(USER, {
      videos: ["one", "two", "three"].map((id) => ({ ...PRIVATE_LESSON, id })),
      onVideosQuery: (calls) => videoQueries.push([...calls]),
    });

    await expect(getHubDiscovery({ browse: true, limit: 2 })).resolves.toMatchObject({
      discovery: { lessons: [{ id: "one" }, { id: "two" }], hasMore: true },
    });
    expect(videoQueries).toContainEqual(expect.arrayContaining([{ op: "limit", count: 3 }]));
  });

  it("does not report truncation for an SQL result that exactly fills its limit", async () => {
    mockClient(USER, { videos: ["one", "two"].map((id) => ({ ...PRIVATE_LESSON, id })) });

    await expect(getHubDiscovery({ browse: true, limit: 2 })).resolves.toMatchObject({
      discovery: { lessons: [{ id: "one" }, { id: "two" }], hasMore: false },
    });
  });

  it("counts the complete filtered set without carrying row ordering into the head read", async () => {
    const videoQueries: QueryCall[][] = [];
    const videos = ["one", "two", "three"].map((id) => ({ ...PRIVATE_LESSON, id }));
    mockClient(USER, { videos, onVideosQuery: (calls) => videoQueries.push([...calls]) });
    vi.mocked(listSituations).mockResolvedValue([{ id: "s1", slug: "restaurant", displayOrder: 1 }]);

    await expect(getHubDiscovery({ query: "lesson", filter: "situation:restaurant", duration: "under_10", hideCompleted: true, sort: "shortest", limit: 1, withTotal: true })).resolves.toMatchObject({ discovery: { total: 3 } });

    const countRead = videoQueries.find((calls) => calls.some((call) => call.op === "select" && call.options?.head));
    expect(countRead).toEqual(expect.arrayContaining([
      { op: "select", columns: "id", options: { count: "exact", head: true } },
      { op: "ilike", column: "title", pattern: "%lesson%" },
      { op: "eq", column: "situation_id", value: "s1" },
      { op: "lt", column: "duration_seconds", value: 600 },
      { op: "is", column: "completed_at", value: null },
    ]));
    expect(countRead?.some((call) => call.op === "order")).toBe(false);
  });

  it("counts every recommended candidate match, not only the ranking window", async () => {
    // More rows than the ranking read (RECOMMENDATION_SCAN_LIMIT + 1), so a
    // total taken from the candidate window would come out short.
    const videos = Array.from({ length: 150 }, (_, index) => ({ ...PRIVATE_LESSON, id: `lesson-${index}` }));
    mockClient(USER, { videos });

    await expect(getHubDiscovery({ query: "lesson", sort: "recommended", limit: 1, withTotal: true })).resolves.toMatchObject({ discovery: { total: 150 } });
  });

  it("counts discovery matches with only the filtered head query", async () => {
    const videoQueries: QueryCall[][] = [];
    mockClient(USER, { videos: [PRIVATE_LESSON], onVideosQuery: (calls) => videoQueries.push([...calls]) });

    await expect(getHubDiscoveryCount({ query: "lesson", duration: "under_10" })).resolves.toBe(1);

    expect(videoQueries).toEqual([[
      { op: "select", columns: "id", options: { count: "exact", head: true } },
      { op: "ilike", column: "title", pattern: "%lesson%" },
      { op: "lt", column: "duration_seconds", value: 600 },
    ]]);
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

  it("escapes ilike wildcard characters in a submitted search", async () => {
    const videoQueries: QueryCall[][] = [];
    mockClient(USER, { videos: [PRIVATE_LESSON], onVideosQuery: (calls) => videoQueries.push([...calls]) });

    await getHubDiscovery({ query: "100%_ready\\now" });

    expect(videoQueries).toContainEqual(expect.arrayContaining([
      { op: "ilike", column: "title", pattern: "%100\\%\\_ready\\\\now%" },
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
    // /shadowing keeps its four-card projection while the SQL read fetches one extra row for hasMore.
    await getHubDiscovery({ query: "lesson" });

    const [shortest, newest, over, plain] = videoQueries;
    // Band edges: 600 and 1800 are inside 10–30; under 10 stops before 600; over 30 starts after 1800.
    expect(shortest).toEqual(expect.arrayContaining([
      { op: "gte", column: "duration_seconds", value: 600 },
      { op: "lte", column: "duration_seconds", value: 1800 },
      { op: "order", column: "duration_seconds", ascending: true, nullsFirst: false },
      { op: "limit", count: 5 },
    ]));
    expect(newest).toEqual(expect.arrayContaining([
      { op: "lt", column: "duration_seconds", value: 600 },
      { op: "order", column: "created_at", ascending: false },
      { op: "limit", count: 5 },
    ]));
    expect(over).toContainEqual({ op: "gt", column: "duration_seconds", value: 1800 });
    expect(plain).toContainEqual({ op: "limit", count: 5 });
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
    expect(videoQueries[0]).toContainEqual({ op: "limit", count: 5 });
  });

  it("reports the exact post-filter result instead of an arbitrary candidate prefix", async () => {
    const videos = Array.from({ length: 101 }, (_, index) => ({ ...PRIVATE_LESSON, id: `v${index}` }));
    mockClient(USER, {
      videos,
      progress: videos.slice(0, 99).map((video) => ({ video_id: video.id, completed_at: "2026-09-29", last_watched_position: 60 })),
    });

    await expect(getHubDiscovery({ browse: true, sort: "newest", hideCompleted: true, limit: 24 })).resolves.toMatchObject({
      discovery: { lessons: [{ id: "v99" }, { id: "v100" }], hasMore: false },
    });
  });

  it("limits learner-ordered results and reports whether more visible lessons remain", async () => {
    const videos = ["one", "two", "three"].map((id) => ({ ...PRIVATE_LESSON, id }));
    mockClient(USER, { videos });

    await expect(getHubDiscovery({ browse: true, sort: "in_progress", limit: 2 })).resolves.toMatchObject({
      discovery: { lessons: [{ id: "one" }, { id: "two" }], hasMore: true },
    });
  });

  it("does not report truncation for a learner-ordered result that exactly fills its limit", async () => {
    const videos = ["one", "two"].map((id) => ({ ...PRIVATE_LESSON, id }));
    mockClient(USER, { videos });

    await expect(getHubDiscovery({ browse: true, sort: "in_progress", limit: 2 })).resolves.toMatchObject({
      discovery: { lessons: [{ id: "one" }, { id: "two" }], hasMore: false },
    });
  });

  // Master ranked only the first 100 SQL matches; the whole match set is ranked now.
  it("finds the one in-progress lesson behind 1,000 untouched matches", async () => {
    const videos = Array.from({ length: 1_001 }, (_, index) => ({ ...PRIVATE_LESSON, id: `match-${index}` }));
    mockClient(USER, {
      videos,
      progress: [{ video_id: "match-1000", last_watched_position: 30, completed_at: null, last_watched_at: "2026-09-28T00:00:00Z" }],
      enforcePostgrestCap: true,
    });

    await expect(getHubDiscovery({ browse: true, sort: "in_progress", limit: 1 })).resolves.toMatchObject({
      discovery: { lessons: [{ id: "match-1000" }], hasMore: true },
    });
  });

  it("finds the one unfinished lesson behind 1,000 completed matches, and knows none remain", async () => {
    const videos = Array.from({ length: 1_001 }, (_, index) => ({ ...PRIVATE_LESSON, id: `match-${index}` }));
    mockClient(USER, {
      videos,
      progress: videos.slice(0, 1_000).map((video) => ({ video_id: video.id, last_watched_position: 90, completed_at: "2026-09-20T00:00:00Z", last_watched_at: "2026-09-20T00:00:00Z" })),
      enforcePostgrestCap: true,
    });

    await expect(getHubDiscovery({ browse: true, hideCompleted: true, limit: 24 })).resolves.toMatchObject({
      discovery: { lessons: [{ id: "match-1000" }], hasMore: false },
    });
  });

  it("puts lessons started and not finished first, most recently watched first, and leaves finished ones in place", async () => {
    const videos = ["new", "finished", "unwatched", "stale", "recent", "unknown-time"].map((id) => ({ ...PRIVATE_LESSON, id }));
    const videoQueries: QueryCall[][] = [];
    mockClient(USER, {
      videos,
      onVideosQuery: (calls) => videoQueries.push([...calls]),
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
    // The mock sorts on its own, so the order the database gets is pinned here.
    expect(videoQueries.at(-1)?.filter((call) => call.op === "order")).toEqual([
      { op: "order", column: "in_progress", ascending: false },
      { op: "order", column: "in_progress_last_watched_at", ascending: false, nullsFirst: false },
      { op: "order", column: "created_at", ascending: false },
      { op: "order", column: "id", ascending: true },
    ]);
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
