import "server-only";
import { createClient } from "@/lib/supabase/server";
import { listCollections, listCollectionLessons, selectShadowingCollections, type Collection } from "@/lib/data/collections";
import { containsPattern, fetchAllPages, fetchByIdChunks } from "@/lib/data/query-pagination";
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
  /** A missing summary is unknown learning data, not zero grammar. */
  grammarCount: number | null;
  vocabularyCount: number | null;
  summary: string | null;
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

interface TranscriptLineRow { transcript_id: string; text_jp: string; start_time: number }
interface VideoSummaryProjection { video_id: string; summary: string; key_vocab: unknown; key_grammar: unknown }

/** One Figma shelf is a four-by-two grid; fetch one extra row to disclose truncation honestly. */
const EXPLORE_SHELF_LIMIT = 8;

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

  const [situations, collections, recommendationsResult] = await Promise.all([
    listSituations(),
    listCollections(),
    getRecommendations({ limit: 4 }),
  ]);
  const activeSituation = situations.find((tag) => tag.slug === options.situation) ?? null;
  const query = options.query?.trim() ?? "";
  // Every catalogue read on Explore shares the situation and title filters.
  // A structural bound on the builder makes tsc recurse too deep (TS2589), so
  // the builder passes through untyped; only `eq` and `ilike` touch it.
  const inContext = <T,>(search: T): T => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let filtered = search as any;
    if (activeSituation) filtered = filtered.eq("situation_id", activeSituation.id);
    if (query) filtered = filtered.ilike("title", containsPattern(query));
    return filtered;
  };
  const recommendationIds = recommendationsResult.ok ? recommendationsResult.data.map((recommendation) => recommendation.videoId) : [];
  const [libraryVideos, recentResult, recommendationMatches] = await Promise.all([
    fetchAllPages((from, to) => inContext(supabase.from("learner_videos").select(VIDEO_COLUMNS).eq("in_library", true))
      .order("created_at", { ascending: false }).order("id", { ascending: true }).range(from, to)) as Promise<VideoRow[]>,
    inContext(supabase.from("videos").select(VIDEO_COLUMNS).neq("library_access", "PRIVATE"))
      .order("created_at", { ascending: false }).order("id", { ascending: true }).limit(4),
    recommendationIds.length
      ? inContext(supabase.from("videos").select("id").in("id", recommendationIds))
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (recentResult.error) throw recentResult.error;
  if (recommendationMatches.error) throw recommendationMatches.error;
  const recentlyAdded = (recentResult.data as VideoRow[] | null) ?? [];
  const visibleVideoIds = new Set(((recommendationMatches.data as { id: string }[] | null) ?? []).map((video) => video.id));
  const rawShelves = await Promise.all(selectShadowingCollections(collections).map(async (collection) => {
    const allLessons = await listCollectionLessons(collection.id, { situationId: activeSituation?.id, query, limit: EXPLORE_SHELF_LIMIT + 1 });
    return { collection, lessons: allLessons.slice(0, EXPLORE_SHELF_LIMIT), hasMore: allLessons.length > EXPLORE_SHELF_LIMIT };
  }));
  // Library cards only need "is there a transcript"; lines and summaries feed
  // the shelf cards alone, so only shelf lessons pay for them.
  const shelfLessonIds = Array.from(new Set(rawShelves.flatMap((shelf) => shelf.lessons.map((lesson) => lesson.id))));
  const lessonIds = Array.from(new Set([...libraryVideos.map((video) => video.id), ...shelfLessonIds]));
  const latestTranscriptByVideo = new Map<string, string>();
  const linesByTranscript = new Map<string, TranscriptLineRow[]>();
  const summaryByVideo = new Map<string, VideoSummaryProjection>();
  if (lessonIds.length) {
    const [transcripts, summaries] = await Promise.all([
      fetchByIdChunks(lessonIds, async (videoIds) => {
        const { data, error } = await supabase.rpc("latest_transcript_ids", { p_video_ids: videoIds });
        if (error) throw error;
        return (data as { video_id: string; transcript_id: string }[] | null) ?? [];
      }),
      fetchByIdChunks(shelfLessonIds, async (videoIds) => {
        const { data, error } = await supabase.from("video_summaries").select("video_id, summary, key_vocab, key_grammar").in("video_id", videoIds);
        if (error) throw error;
        return (data as VideoSummaryProjection[] | null) ?? [];
      }),
    ]);
    for (const summary of summaries) summaryByVideo.set(summary.video_id, summary);
    for (const transcript of transcripts) latestTranscriptByVideo.set(transcript.video_id, transcript.transcript_id);
    const shelfTranscriptIds = Array.from(new Set(shelfLessonIds.flatMap((id) => latestTranscriptByVideo.get(id) ?? [])));
    if (shelfTranscriptIds.length) {
      const lines = await fetchByIdChunks(shelfTranscriptIds, (ids) => fetchAllPages((from, to) => supabase
        .from("transcript_lines").select("id, transcript_id, text_jp, start_time").in("transcript_id", ids)
        .order("transcript_id", { ascending: true }).order("start_time", { ascending: true }).order("id", { ascending: true }).range(from, to))) as TranscriptLineRow[];
      for (const line of lines) linesByTranscript.set(line.transcript_id, [...(linesByTranscript.get(line.transcript_id) ?? []), line]);
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
    const summary = summaryByVideo.get(lesson.id);
    const grammar = summary?.key_grammar;
    const vocabulary = summary?.key_vocab;
    return {
      ...toLesson(lesson),
      transcriptPreview: lines.slice(0, 3).map((line) => line.text_jp),
      lineCount: lines.length,
      wordCount: await getWordCount(transcriptId, lines),
      grammarCount: Array.isArray(grammar) ? grammar.length : null,
      vocabularyCount: Array.isArray(vocabulary) ? vocabulary.length : null,
      summary: summary?.summary ?? null,
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
      recentlyAdded: recentlyAdded.map(toLesson),
      recommendations,
      quietSuggestion: recommendations.find((recommendation) => recommendation.reason !== null) ?? null,
      shelves,
    },
  };
}
