import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getCollectionBySlug, listCollectionLessons } from "@/lib/data/collections";
import { containsPattern, fetchAllPages, fetchByIdChunks } from "@/lib/data/query-pagination";
import { FREE_MONTHLY_LESSON_QUOTA, countMonthlyCreations } from "@/lib/data/lesson-library";
import { PopularStrategyV1 } from "@/lib/data/lesson-ranking";
import { getRecommendations } from "@/lib/data/recommendations";
import type { VideoRecommendation } from "@/lib/recommendation-types";
import type { RecommendationReason } from "@/lib/recommendation-types";
import { getActivePlanTier, type PlanTier } from "@/lib/data/subscriptions";
import { requireUser, VIDEO_COLUMNS, type VideoRow } from "@/lib/data/videos";
import { listSituations, listSources } from "@/lib/data/lesson-taxonomy";
import type { PronunciationDuration, PronunciationSort } from "@/lib/preferences/options";
import { JLPT_LEVELS } from "@/lib/conversation-types";

const SHELF_LIMIT = 4;
const FILTER_COLUMNS = { situation: "situation_id", source: "source_id", level: "jlpt_level_estimate" } as const;
const RECOMMENDATION_SCAN_LIMIT = 100;

export interface HubLesson {
  id: string;
  youtubeVideoId: string;
  title: string;
  durationSeconds: number | null;
  thumbnailUrl: string | null;
  jlptLevelEstimate: string | null;
}

export interface HubContinueLesson {
  lesson: HubLesson;
  lastWatchedPosition: number;
}

export interface HubLibraryLesson {
  lesson: HubLesson;
  /** A transcript is either available now or unavailable; C4 owns job states. */
  state: "ready" | "unavailable";
}

export interface HubQuota {
  used: number;
  /** `null` represents Plus's genuinely unlimited allowance. */
  limit: number | null;
  tier: PlanTier;
}

export interface HubRailProjection {
  /** Only a recommendation carrying a measured learner-data reason may enter the rail. */
  suggestion: { lesson: HubLesson; reason: Exclude<RecommendationReason, null> } | null;
}

export interface HubDiscoveryFilter {
  /** `level` is a JLPT level (`n5`…`n1`); the studio shows it, the Hub does not. */
  kind: "situation" | "source" | "level";
  slug: string;
}

export interface HubDiscoveryProjection {
  query: string;
  activeFilter: string | null;
  lessons: HubLesson[];
  hasMore: boolean;
  /** Exact filtered match count, requested only by the pronunciation search facade. */
  total?: number;
}

export interface ShadowingHubData {
  featured: HubLesson | null;
  library: HubLibraryLesson[];
  continueLearning: HubContinueLesson[];
  recentlyAdded: HubLesson[];
  popular: HubLesson[];
  recommendations: VideoRecommendation[];
  quota: HubQuota;
  rail: HubRailProjection | null;
  filters: HubDiscoveryFilter[];
  /** Null until the learner submits a search or selects a filter. */
  discovery: HubDiscoveryProjection | null;
}

export type GetShadowingHubResult = { ok: true; data: ShadowingHubData } | { ok: false; status: 401 };

interface LearnerVideoRow extends VideoRow {
  last_watched_position: number;
  completed_at: string | null;
  last_watched_at: string | null;
  in_progress: boolean;
  in_library: boolean;
}

interface HubDiscoveryFilterTag extends HubDiscoveryFilter {
  id: string;
}

export function toHubLesson(video: VideoRow): HubLesson {
  return {
    id: video.id,
    youtubeVideoId: video.youtube_video_id,
    title: video.title,
    durationSeconds: video.duration_seconds,
    thumbnailUrl: video.thumbnail_url,
    jlptLevelEstimate: video.jlpt_level_estimate,
  };
}

/** Shared taxonomy-backed discovery read for the Shadowing and Pronunciation hubs. */
export async function getHubDiscovery(
  options: { query?: string; filter?: string; browse?: boolean; limit?: number; sort?: PronunciationSort; duration?: PronunciationDuration; hideCompleted?: boolean; withTotal?: boolean; countOnly?: boolean } = {},
): Promise<{ filters: HubDiscoveryFilter[]; discovery: HubDiscoveryProjection | null }> {
  const supabase = createClient();
  const [situations, sources] = await Promise.all([listSituations(), listSources()]);
  const filterTags: HubDiscoveryFilterTag[] = [
    ...situations.map((tag) => ({ kind: "situation" as const, slug: tag.slug, id: tag.id })),
    ...sources.map((tag) => ({ kind: "source" as const, slug: tag.slug, id: tag.id })),
  ];
  const filters = filterTags.map(({ kind, slug }) => ({ kind, slug }));
  // Levels are not taxonomy rows: `id` is the `jlpt_level` value itself.
  const levelTags: HubDiscoveryFilterTag[] = JLPT_LEVELS.map((level) => ({ kind: "level", slug: level.toLowerCase(), id: level }));
  const query = options.query?.trim() ?? "";
  const activeFilter = [...filterTags, ...levelTags].find((filter) => `${filter.kind}:${filter.slug}` === options.filter) ?? null;

  if (!query && !activeFilter && !options.browse) return { filters, discovery: null };

  const sort = options.sort ?? "newest";
  const limit = options.limit ?? SHELF_LIMIT;
  type FilterableDiscoveryQuery = {
    ilike(column: string, pattern: string): FilterableDiscoveryQuery;
    eq(column: string, value: string): FilterableDiscoveryQuery;
    lt(column: string, value: number): FilterableDiscoveryQuery;
    gte(column: string, value: number): FilterableDiscoveryQuery;
    lte(column: string, value: number): FilterableDiscoveryQuery;
    gt(column: string, value: number): FilterableDiscoveryQuery;
    is(column: string, value: null): FilterableDiscoveryQuery;
  };
  const applyDiscoveryFilters = <T,>(queryBuilder: T): T => {
    let search = queryBuilder as unknown as FilterableDiscoveryQuery;
    if (query) search = search.ilike("title", containsPattern(query));
    if (activeFilter) search = search.eq(FILTER_COLUMNS[activeFilter.kind], activeFilter.id);
    // A band excludes a lesson with no duration: SQL comparisons drop nulls.
    if (options.duration === "under_10") search = search.lt("duration_seconds", 600);
    if (options.duration === "10_30") search = search.gte("duration_seconds", 600).lte("duration_seconds", 1800);
    if (options.duration === "over_30") search = search.gt("duration_seconds", 1800);
    if (options.hideCompleted) search = search.is("completed_at", null);
    return search as unknown as T;
  };
  let search = applyDiscoveryFilters(supabase.from("learner_videos").select(VIDEO_COLUMNS));
  const totalRead = options.withTotal
    ? applyDiscoveryFilters(supabase.from("learner_videos").select("id", { count: "exact", head: true }))
    : null;
  if (options.countOnly) {
    const totalResult = await totalRead;
    if (totalResult?.error) throw totalResult.error;
    return {
      filters,
      discovery: { query, activeFilter: activeFilter ? `${activeFilter.kind}:${activeFilter.slug}` : null, lessons: [], hasMore: false, total: totalResult?.count ?? 0 },
    };
  }
  if (sort === "shortest") {
    search = search.order("duration_seconds", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false });
  } else if (sort !== "in_progress") {
    search = search.order("created_at", { ascending: false });
  }

  // Newest and Shortest are whole orders in SQL, so the database cuts the list.
  const needsLearnerOrder = sort === "recommended" || sort === "in_progress" || Boolean(options.hideCompleted);
  if (!needsLearnerOrder) {
    // `id` makes the order total: a longer page ("Show more") keeps the cards already shown in place.
    const [{ data, error }, totalResult] = await Promise.all([search.order("id", { ascending: true }).limit(limit + 1), totalRead]);
    if (error) throw error;
    if (totalResult?.error) throw totalResult.error;
    const rows = (data as VideoRow[] | null) ?? [];
    return {
      filters,
      discovery: {
        query,
        activeFilter: activeFilter ? `${activeFilter.kind}:${activeFilter.slug}` : null,
        lessons: rows.slice(0, limit).map(toHubLesson),
        hasMore: rows.length > limit,
        ...(options.withTotal ? { total: totalResult?.count ?? 0 } : {}),
      },
    };
  }

  if (sort === "in_progress") {
    search = search.order("in_progress", { ascending: false })
      .order("in_progress_last_watched_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
  }
  search = search.order("id", { ascending: true });
  const recommendationReadLimit = Math.max(RECOMMENDATION_SCAN_LIMIT, limit) + 1;
  const [{ data, error }, totalResult] = await Promise.all([search.limit(sort === "recommended" ? recommendationReadLimit : limit + 1), totalRead]);
  if (error) throw error;
  if (totalResult?.error) throw totalResult.error;
  const fetched = (data as LearnerVideoRow[] | null) ?? [];
  const candidates = fetched.slice(0, sort === "recommended" ? Math.max(RECOMMENDATION_SCAN_LIMIT, limit) : limit + 1);

  // Array.sort is stable, so every tie keeps the SQL order (newest, or shortest).
  let ordered = candidates;
  if (sort === "recommended" && candidates.length) {
    // The i+1 engine's order first; the lessons it did not score keep the SQL order after it.
    // The engine only reorders: a failure keeps the SQL order instead of failing the search.
    const recommendations = await getRecommendations({ limit: candidates.length, candidateIds: candidates.map((video) => video.id) })
      .catch(() => ({ ok: false as const, status: 401 as const }));
    const rank = new Map(recommendations.ok ? recommendations.data.map((video, index) => [video.videoId, index]) : []);
    const rankOf = (video: VideoRow) => rank.get(video.id) ?? Number.MAX_SAFE_INTEGER;
    ordered = [...candidates].sort((left, right) => rankOf(left) - rankOf(right));
  }

  return {
    filters,
    discovery: {
      query,
      activeFilter: activeFilter ? `${activeFilter.kind}:${activeFilter.slug}` : null,
      lessons: ordered.slice(0, limit).map(toHubLesson),
      hasMore: fetched.length > limit,
      ...(options.withTotal ? { total: totalResult?.count ?? 0 } : {}),
    },
  };
}

/** Exact discovery count without loading a candidate lesson row. */
export async function getHubDiscoveryCount(options: {
  query: string;
  filter?: string;
  duration?: PronunciationDuration;
  hideCompleted?: boolean;
}): Promise<number> {
  const { discovery } = await getHubDiscovery({ ...options, browse: true, withTotal: true, countOnly: true });
  return discovery?.total ?? 0;
}

/**
 * Server read model for the Shadowing Hub. It composes existing data-layer
 * boundaries, returning absence explicitly instead of filling Figma regions
 * with example lessons or invented learner state.
 */
export async function getShadowingHub(options: { query?: string; filter?: string } = {}): Promise<GetShadowingHubResult> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { ok: false, status: 401 };

  const [libraryVideos, continueResult, recentResult, tier, used, popularResult, recommendationsResult, featured, hubDiscovery] =
    await Promise.all([
      fetchAllPages((from, to) => supabase.from("learner_videos").select(VIDEO_COLUMNS).eq("in_library", true)
        .order("created_at", { ascending: false }).order("id", { ascending: true }).range(from, to)) as Promise<VideoRow[]>,
      supabase.from("learner_videos").select(`${VIDEO_COLUMNS}, last_watched_position`).eq("in_progress", true)
        .order("created_at", { ascending: false }).order("id", { ascending: true }).limit(SHELF_LIMIT),
      supabase.from("videos").select(VIDEO_COLUMNS).order("created_at", { ascending: false }).order("id", { ascending: true }).limit(SHELF_LIMIT),
      getActivePlanTier(user.id),
      countMonthlyCreations(user.id),
      PopularStrategyV1.rank({ userId: user.id, limit: SHELF_LIMIT }),
      getRecommendations({ limit: SHELF_LIMIT }),
      getCollectionBySlug("featured"),
      getHubDiscovery(options),
    ]);

  if (continueResult.error) throw continueResult.error;
  if (recentResult.error) throw recentResult.error;
  // "Ready" means a transcript exists, whether or not this learner may read it
  // today (a lapsed PLUS lesson stays ready), so the check reads past RLS.
  const service = createServiceClient();
  const transcriptRows = await fetchByIdChunks(libraryVideos.map((video) => video.id), async (ids) => {
    const { data, error } = await service.rpc("latest_transcript_ids", { p_video_ids: ids });
    if (error) throw error;
    return (data as { video_id: string; transcript_id: string }[] | null) ?? [];
  });
  const transcriptVideoIds = new Set(transcriptRows.map((row) => row.video_id));
  const featuredLessons = featured ? await listCollectionLessons(featured.id) : [];
  const recommendations = recommendationsResult.ok ? recommendationsResult.data : [];
  const suggestedRecommendation = recommendations.find((recommendation) => recommendation.reason !== null) ?? null;
  return {
    ok: true,
    data: {
      featured: featuredLessons[0] ? toHubLesson(featuredLessons[0]) : null,
      library: libraryVideos.map((video) => ({
        lesson: toHubLesson(video),
        state: transcriptVideoIds.has(video.id) ? "ready" : "unavailable",
      })),
      continueLearning: ((continueResult.data as LearnerVideoRow[] | null) ?? []).map((video) => ({ lesson: toHubLesson(video), lastWatchedPosition: video.last_watched_position })),
      recentlyAdded: ((recentResult.data as VideoRow[] | null) ?? []).map(toHubLesson),
      popular: popularResult.map(toHubLesson),
      recommendations,
      quota: {
        used,
        limit: tier === "plus" ? null : FREE_MONTHLY_LESSON_QUOTA,
        tier,
      },
      rail: {
        suggestion: suggestedRecommendation?.reason
          ? {
              lesson: {
                id: suggestedRecommendation.videoId,
                youtubeVideoId: suggestedRecommendation.youtubeVideoId,
                title: suggestedRecommendation.title,
                durationSeconds: null,
                thumbnailUrl: suggestedRecommendation.thumbnailUrl,
                jlptLevelEstimate: suggestedRecommendation.jlptLevelEstimate,
              },
              reason: suggestedRecommendation.reason,
            }
          : null,
      },
      filters: hubDiscovery.filters,
      discovery: hubDiscovery.discovery,
    },
  };
}
