import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getCollectionBySlug, listCollectionLessons } from "@/lib/data/collections";
import { FREE_MONTHLY_LESSON_QUOTA, countMonthlyCreations, hasTranscript } from "@/lib/data/lesson-library";
import { PopularStrategyV1 } from "@/lib/data/lesson-ranking";
import { getRecommendations } from "@/lib/data/recommendations";
import type { VideoRecommendation } from "@/lib/recommendation-types";
import type { RecommendationReason } from "@/lib/recommendation-types";
import { getActivePlanTier, type PlanTier } from "@/lib/data/subscriptions";
import { getUserStats, type UserStatsData } from "@/lib/data/user-stats";
import { requireUser, VIDEO_COLUMNS, type VideoRow } from "@/lib/data/videos";
import { listSituations, listSources } from "@/lib/data/lesson-taxonomy";

const SHELF_LIMIT = 4;

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
  stats: UserStatsData;
  /** Only a recommendation carrying a measured learner-data reason may enter the rail. */
  suggestion: { lesson: HubLesson; reason: Exclude<RecommendationReason, null> } | null;
}

export interface HubDiscoveryFilter {
  kind: "situation" | "source";
  slug: string;
}

export interface HubDiscoveryProjection {
  query: string;
  activeFilter: string | null;
  lessons: HubLesson[];
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

interface LibraryRow {
  lesson_id: string;
}

interface ProgressRow {
  video_id: string;
  last_watched_position: number;
  completed_at: string | null;
}

function toHubLesson(video: VideoRow): HubLesson {
  return {
    id: video.id,
    youtubeVideoId: video.youtube_video_id,
    title: video.title,
    durationSeconds: video.duration_seconds,
    thumbnailUrl: video.thumbnail_url,
    jlptLevelEstimate: video.jlpt_level_estimate,
  };
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

  const [libraryResult, videosResult, progressResult, tier, used, popularResult, recommendationsResult, statsResult, featured, situations, sources] =
    await Promise.all([
      supabase.from("user_lesson_library").select("lesson_id").eq("user_id", user.id),
      supabase.from("videos").select(VIDEO_COLUMNS).order("created_at", { ascending: false }),
      supabase
        .from("user_video_progress")
        .select("video_id, last_watched_position, completed_at")
        .eq("user_id", user.id),
      getActivePlanTier(user.id),
      countMonthlyCreations(user.id),
      PopularStrategyV1.rank({ userId: user.id, limit: SHELF_LIMIT }),
      getRecommendations({ limit: SHELF_LIMIT }),
      getUserStats(),
      getCollectionBySlug("featured"),
      listSituations(),
      listSources(),
    ]);

  if (libraryResult.error) throw libraryResult.error;
  if (videosResult.error) throw videosResult.error;
  if (progressResult.error) throw progressResult.error;

  const videos = (videosResult.data as VideoRow[] | null) ?? [];
  const libraryIds = new Set(((libraryResult.data as LibraryRow[] | null) ?? []).map((row) => row.lesson_id));
  const libraryVideos = videos.filter(
    (video) =>
      libraryIds.has(video.id) ||
      // A private import whose captions were unavailable has not consumed a
      // quota slot and is deliberately absent from user_lesson_library. It is
      // nevertheless the learner's failed import and must remain retryable.
      (video.library_access === "PRIVATE" && video.added_by_user_id === user.id),
  );

  const transcriptAvailability = await Promise.all(
    libraryVideos.map(async (video) => ({ video, available: await hasTranscript(video.id) })),
  );

  const progressByVideoId = new Map(
    ((progressResult.data as ProgressRow[] | null) ?? []).map((progress) => [progress.video_id, progress]),
  );
  const featuredLessons = featured ? await listCollectionLessons(featured.id) : [];
  const recommendations = recommendationsResult.ok ? recommendationsResult.data : [];
  const suggestedRecommendation = recommendations.find((recommendation) => recommendation.reason !== null) ?? null;
  const filterTags = [
    ...situations.map((tag) => ({ kind: "situation" as const, slug: tag.slug, id: tag.id })),
    ...sources.map((tag) => ({ kind: "source" as const, slug: tag.slug, id: tag.id })),
  ];
  const filters: HubDiscoveryFilter[] = filterTags.map(({ kind, slug }) => ({ kind, slug }));
  const query = options.query?.trim() ?? "";
  const activeFilter = filterTags.find((filter) => `${filter.kind}:${filter.slug}` === options.filter) ?? null;
  let discovery: HubDiscoveryProjection | null = null;
  if (query || activeFilter) {
    let search = supabase.from("videos").select(VIDEO_COLUMNS);
    if (query) search = search.ilike("title", `%${query}%`);
    if (activeFilter) search = search.eq(activeFilter.kind === "situation" ? "situation_id" : "source_id", activeFilter.id);
    const { data, error } = await search.order("created_at", { ascending: false }).limit(SHELF_LIMIT);
    if (error) throw error;
    discovery = {
      query,
      activeFilter: activeFilter ? `${activeFilter.kind}:${activeFilter.slug}` : null,
      lessons: ((data as VideoRow[] | null) ?? []).map(toHubLesson),
    };
  }

  return {
    ok: true,
    data: {
      featured: featuredLessons[0] ? toHubLesson(featuredLessons[0]) : null,
      library: transcriptAvailability.map(({ video, available }) => ({
        lesson: toHubLesson(video),
        state: available ? "ready" : "unavailable",
      })),
      continueLearning: videos
        .flatMap((video) => {
          const progress = progressByVideoId.get(video.id);
          if (!progress || progress.completed_at || progress.last_watched_position <= 0) return [];
          return [{ lesson: toHubLesson(video), lastWatchedPosition: progress.last_watched_position }];
        })
        .slice(0, SHELF_LIMIT),
      recentlyAdded: videos.slice(0, SHELF_LIMIT).map(toHubLesson),
      popular: popularResult.map(toHubLesson),
      recommendations,
      quota: {
        used,
        limit: tier === "plus" ? null : FREE_MONTHLY_LESSON_QUOTA,
        tier,
      },
      rail: statsResult.ok
        ? {
            stats: statsResult.data,
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
          }
        : null,
      filters,
      discovery,
    },
  };
}
