import "server-only";
import { createClient } from "@/lib/supabase/server";
import { listCollections, listCollectionLessons, type Collection } from "@/lib/data/collections";
import { listSituations, type LessonTag } from "@/lib/data/lesson-taxonomy";
import { getRecommendations } from "@/lib/data/recommendations";
import { requireUser, VIDEO_COLUMNS, type VideoRow } from "@/lib/data/videos";
import { tokenize } from "@/lib/japanese/tokenizer";
import { contentLemmas } from "@/lib/difficulty";
import type { HubLibraryLesson, HubLesson } from "@/lib/data/shadowing-hub";
import type { VideoRecommendation } from "@/lib/recommendation-types";

export interface ExploreShelf {
  collection: Collection;
  lessons: ExploreLesson[];
  /** C3 intentionally renders one four-by-two editorial grid, never silently more. */
  hasMore: boolean;
}

export interface ExploreLesson extends HubLesson {
  transcriptPreview: string[];
  lineCount: number;
  wordCount: number;
}

export interface ShadowingExploreData {
  activeSituation: string | null;
  situations: LessonTag[];
  library: HubLibraryLesson[];
  recentlyAdded: HubLesson[];
  recommendations: VideoRecommendation[];
  quietSuggestion: VideoRecommendation | null;
  shelves: ExploreShelf[];
}

export type GetShadowingExploreResult = { ok: true; data: ShadowingExploreData } | { ok: false; status: 401 };

function toLesson(video: VideoRow): HubLesson {
  return {
    id: video.id,
    youtubeVideoId: video.youtube_video_id,
    title: video.title,
    durationSeconds: video.duration_seconds,
    thumbnailUrl: video.thumbnail_url,
    jlptLevelEstimate: video.jlpt_level_estimate,
  };
}

interface TranscriptRow { id: string; video_id: string; created_at: string }
interface TranscriptLineRow { transcript_id: string; text_jp: string; start_time: number }

/** C3's authored learning-path sequence; editorial collections stay on the Hub. */
const EXPLORE_COLLECTION_SLUGS = [
  "beginner-foundation",
  "daily-conversation",
  "natural-japanese",
  "advanced-expression",
  "native-fluency",
] as const;

/** One Figma shelf is a four-by-two grid; fetch one extra row to disclose truncation honestly. */
const EXPLORE_SHELF_LIMIT = 8;

function selectExploreCollections(collections: Collection[]): Collection[] {
  const rank = new Map(EXPLORE_COLLECTION_SLUGS.map((slug, index) => [slug, index]));
  return collections
    .filter((collection) => rank.has(collection.slug as (typeof EXPLORE_COLLECTION_SLUGS)[number]))
    .sort((a, b) => (rank.get(a.slug as (typeof EXPLORE_COLLECTION_SLUGS)[number]) ?? 0) - (rank.get(b.slug as (typeof EXPLORE_COLLECTION_SLUGS)[number]) ?? 0));
}

async function countContentWords(lines: TranscriptLineRow[]): Promise<number> {
  const lemmaGroups = await Promise.all(lines.map(async (line) => contentLemmas(await tokenize(line.text_jp))));
  return lemmaGroups.reduce((count, lemmas) => count + lemmas.length, 0);
}

/** Server projection for the public catalogue and the learner's imported lessons. */
export async function getShadowingExplore(
  options: { query?: string; situation?: string } = {},
): Promise<GetShadowingExploreResult> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { ok: false, status: 401 };

  const [libraryResult, situations, collections, recommendationsResult] = await Promise.all([
    supabase.from("user_lesson_library").select("lesson_id").eq("user_id", user.id),
    listSituations(),
    listCollections(),
    getRecommendations({ limit: 4 }),
  ]);
  if (libraryResult.error) throw libraryResult.error;

  const activeSituation = situations.find((tag) => tag.slug === options.situation) ?? null;
  const query = options.query?.trim() ?? "";
  let videosQuery = supabase.from("videos").select(VIDEO_COLUMNS);
  if (activeSituation) videosQuery = videosQuery.eq("situation_id", activeSituation.id);
  if (query) videosQuery = videosQuery.ilike("title", `%${query}%`);
  const { data: videosData, error: videosError } = await videosQuery.order("created_at", { ascending: false });
  if (videosError) throw videosError;
  const libraryIds = new Set(((libraryResult.data as { lesson_id: string }[] | null) ?? []).map((row) => row.lesson_id));
  const visibleVideos = (videosData as VideoRow[] | null) ?? [];
  const visibleVideoIds = new Set(visibleVideos.map((video) => video.id));
  const libraryVideos = visibleVideos.filter((video) => libraryIds.has(video.id) || (video.library_access === "PRIVATE" && video.added_by_user_id === user.id));
  const rawShelves = await Promise.all(selectExploreCollections(collections).map(async (collection) => {
    const allLessons = await listCollectionLessons(collection.id, { situationId: activeSituation?.id, query, limit: EXPLORE_SHELF_LIMIT + 1 });
    return { collection, lessons: allLessons.slice(0, EXPLORE_SHELF_LIMIT), hasMore: allLessons.length > EXPLORE_SHELF_LIMIT };
  }));
  const lessonIds = Array.from(new Set([
    ...libraryVideos.map((video) => video.id),
    ...rawShelves.flatMap((shelf) => shelf.lessons.map((lesson) => lesson.id)),
  ]));
  const latestTranscriptByVideo = new Map<string, string>();
  const linesByTranscript = new Map<string, TranscriptLineRow[]>();
  if (lessonIds.length) {
    const { data: transcriptData, error: transcriptError } = await supabase.from("transcripts").select("id, video_id, created_at").in("video_id", lessonIds).order("created_at", { ascending: false });
    if (transcriptError) throw transcriptError;
    for (const transcript of (transcriptData as TranscriptRow[] | null) ?? []) if (!latestTranscriptByVideo.has(transcript.video_id)) latestTranscriptByVideo.set(transcript.video_id, transcript.id);
    const transcriptIds = Array.from(new Set(latestTranscriptByVideo.values()));
    if (transcriptIds.length) {
      const { data: lineData, error: lineError } = await supabase.from("transcript_lines").select("transcript_id, text_jp, start_time").in("transcript_id", transcriptIds).order("start_time", { ascending: true });
      if (lineError) throw lineError;
      for (const line of (lineData as TranscriptLineRow[] | null) ?? []) linesByTranscript.set(line.transcript_id, [...(linesByTranscript.get(line.transcript_id) ?? []), line]);
    }
  }
  const wordCountByTranscript = new Map<string, Promise<number>>();
  function getWordCount(transcriptId: string | undefined, lines: TranscriptLineRow[]): Promise<number> {
    if (!transcriptId) return Promise.resolve(0);
    const cached = wordCountByTranscript.get(transcriptId);
    if (cached) return cached;
    const count = countContentWords(lines);
    wordCountByTranscript.set(transcriptId, count);
    return count;
  }
  const shelves = await Promise.all(rawShelves.map(async ({ collection, lessons, hasMore }) => ({ collection, hasMore, lessons: await Promise.all(lessons.map(async (lesson) => {
    const transcriptId = latestTranscriptByVideo.get(lesson.id);
    const lines = linesByTranscript.get(transcriptId ?? "") ?? [];
    return {
      ...toLesson(lesson),
      transcriptPreview: lines.slice(0, 3).map((line) => line.text_jp),
      lineCount: lines.length,
      wordCount: await getWordCount(transcriptId, lines),
    };
  })) })));
  const library = libraryVideos.map((video) => ({
    lesson: toLesson(video),
    state: latestTranscriptByVideo.has(video.id) ? "ready" as const : "unavailable" as const,
  }));
  // Recommendations are a catalogue shelf on Explore, so they must stay inside
  // the same RLS-visible query and situation context as every other shelf.
  const recommendations = recommendationsResult.ok
    ? recommendationsResult.data.filter((recommendation) => visibleVideoIds.has(recommendation.videoId))
    : [];

  return {
    ok: true,
    data: {
      activeSituation: activeSituation?.slug ?? null,
      situations,
      library,
      recentlyAdded: visibleVideos
        .filter((video) => video.library_access !== "PRIVATE")
        .slice(0, 4)
        .map(toLesson),
      recommendations,
      quietSuggestion: recommendations.find((recommendation) => recommendation.reason !== null) ?? null,
      shelves,
    },
  };
}
