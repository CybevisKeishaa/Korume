import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getCollectionBySlug, listCollectionLessons } from "@/lib/data/collections";
import { containsPattern } from "@/lib/data/query-pagination";
import { FREE_MONTHLY_LESSON_QUOTA, countMonthlyCreations, hasTranscript } from "@/lib/data/lesson-library";
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
/** How many matches a learner-dependent sort ranks; see getHubDiscovery. */
const CANDIDATE_LIMIT = 100;

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
  last_watched_at?: string | null;
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
  options: { query?: string; filter?: string; sort?: PronunciationSort; duration?: PronunciationDuration; hideCompleted?: boolean } = {},
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

  if (!query && !activeFilter) return { filters, discovery: null };

  const sort = options.sort ?? "newest";
  let search = supabase.from("videos").select(VIDEO_COLUMNS);
  if (query) search = search.ilike("title", containsPattern(query));
  if (activeFilter) search = search.eq(FILTER_COLUMNS[activeFilter.kind], activeFilter.id);
  // A band excludes a lesson with no duration: SQL comparisons drop nulls.
  if (options.duration === "under_10") search = search.lt("duration_seconds", 600);
  if (options.duration === "10_30") search = search.gte("duration_seconds", 600).lte("duration_seconds", 1800);
  if (options.duration === "over_30") search = search.gt("duration_seconds", 1800);
  search = sort === "shortest"
    ? search.order("duration_seconds", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false })
    : search.order("created_at", { ascending: false });
  search = search.order("id", { ascending: true });

  // Newest and Shortest are whole orders in SQL, so the database cuts the list.
  const needsLearnerOrder = sort === "recommended" || sort === "in_progress" || Boolean(options.hideCompleted);
  if (!needsLearnerOrder) {
    const { data, error } = await search.limit(SHELF_LIMIT);
    if (error) throw error;
    return { filters, discovery: { query, activeFilter: activeFilter ? `${activeFilter.kind}:${activeFilter.slug}` : null, lessons: ((data as VideoRow[] | null) ?? []).map(toHubLesson) } };
  }

  // ponytail: the learner-dependent orders rank the newest (or shortest)
  // CANDIDATE_LIMIT matches, not the whole catalogue — the ids travel in the
  // request URL of the progress read and the i+1 engine, and the engine scans
  // at most 100 anyway. Page the candidates if a query ever matches more.
  const { data, error } = await search.limit(CANDIDATE_LIMIT);
  if (error) throw error;
  const candidates = (data as VideoRow[] | null) ?? [];
  const { data: progressRows, error: progressError } = candidates.length
    ? await supabase.from("user_video_progress").select("video_id, last_watched_position, completed_at, last_watched_at").in("video_id", candidates.map((video) => video.id))
    : { data: [], error: null };
  if (progressError) throw progressError;
  const progress = new Map(((progressRows as ProgressRow[] | null) ?? []).map((row) => [row.video_id, row]));
  const visible = candidates.filter((video) => !options.hideCompleted || !progress.get(video.id)?.completed_at);

  // Array.sort is stable, so every tie keeps the SQL order (newest, or shortest).
  let ordered = visible;
  if (sort === "in_progress") {
    // Started and not finished, most recently watched first (unknown time last); then the rest.
    const inProgressAt = (video: VideoRow): number | null => {
      const row = progress.get(video.id);
      if (!row || row.completed_at || row.last_watched_position <= 0) return null;
      return row.last_watched_at ? Date.parse(row.last_watched_at) : Number.NEGATIVE_INFINITY;
    };
    ordered = [...visible].sort((left, right) => {
      const leftAt = inProgressAt(left);
      const rightAt = inProgressAt(right);
      if (leftAt === null || rightAt === null) return leftAt === rightAt ? 0 : leftAt === null ? 1 : -1;
      return rightAt === leftAt ? 0 : rightAt > leftAt ? 1 : -1;
    });
  } else if (sort === "recommended" && visible.length) {
    // The i+1 engine's order first; the lessons it did not score keep the SQL order after it.
    // The engine only reorders: a failure keeps the SQL order instead of failing the search.
    const recommendations = await getRecommendations({ limit: visible.length, candidateIds: visible.map((video) => video.id) })
      .catch(() => ({ ok: false as const, status: 401 as const }));
    const rank = new Map(recommendations.ok ? recommendations.data.map((video, index) => [video.videoId, index]) : []);
    const rankOf = (video: VideoRow) => rank.get(video.id) ?? Number.MAX_SAFE_INTEGER;
    ordered = [...visible].sort((left, right) => rankOf(left) - rankOf(right));
  }

  return {
    filters,
    discovery: {
      query,
      activeFilter: activeFilter ? `${activeFilter.kind}:${activeFilter.slug}` : null,
      lessons: ordered.slice(0, SHELF_LIMIT).map(toHubLesson),
    },
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

  const [libraryResult, videosResult, progressResult, tier, used, popularResult, recommendationsResult, featured, hubDiscovery] =
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
      getCollectionBySlug("featured"),
      getHubDiscovery(options),
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
