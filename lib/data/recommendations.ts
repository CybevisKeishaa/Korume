import "server-only";
import * as React from "react";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/data/videos";
import { getKnownVocabLemmas } from "@/lib/data/difficulty";
import { tokenize } from "@/lib/japanese/tokenizer";
import { contentLemmas, DIFFICULTY_BANDS, scoreComprehension } from "@/lib/difficulty";
import { readPreferences } from "@/lib/data/preferences";
import type { RecommendationBand, RecommendationReason, VideoRecommendation } from "@/lib/recommendation-types";
import type { RecommendationsQuery } from "@/lib/validation/recommendations";
import { fetchAllPages, fetchByIdChunks } from "@/lib/data/query-pagination";

/**
 * i+1 comprehensible-input video recommendations (CLAUDE.md §5.2). Scores
 * each candidate video by the fraction of its content words the caller
 * already knows via SRS mastery (`getKnownVocabLemmas` — the same "known
 * vocab" definition `lib/data/difficulty.ts::getVideoDifficulty` uses for a
 * single video) and surfaces the comprehensible-input sweet spot first.
 */

/**
 * Bound on how many approved-with-transcript videos this endpoint scans per
 * request. Every candidate's transcript is fully tokenized to score it, so
 * this caps request cost. There is no cross-request cache yet — a known,
 * deliberate tradeoff carried over from Layer 3's difficulty scorer (see
 * `lib/data/difficulty.ts`); revisit once the approved-video catalog
 * regularly exceeds this bound.
 */
const SCAN_LIMIT = 100;

type RankedBand = RecommendationBand;

const BAND_RANK: Record<RankedBand, number> = {
  ideal: 0,
  "too-easy": 1,
  "too-hard": 2,
};

export type GetRecommendationsResult = { ok: true; data: VideoRecommendation[] } | { ok: false; status: 401 };

interface CandidateVideoRow {
  id: string;
  youtube_video_id: string;
  title: string;
  thumbnail_url: string | null;
  jlpt_level_estimate: string | null;
  created_at: string;
}

interface ProgressRow {
  video_id: string;
  completed_at: string | null;
}

interface LineRow {
  id: string;
  transcript_id: string;
  text_jp: string;
}

function reasonForKnownWordFit(input: {
  band: RankedBand;
  knownRatio: number;
  totalWords: number;
  knownWords: number;
}): RecommendationReason {
  // The current scorer only records vocabulary comprehension. A grammar or
  // pronunciation explanation would be an unsupported inference, so it is
  // intentionally impossible to return one from this function.
  if (input.band !== "ideal" || input.knownWords === 0) return null;

  return {
    kind: "known-word-fit",
    knownRatio: input.knownRatio,
    totalWords: input.totalWords,
    knownWords: input.knownWords,
  };
}

/**
 * Everything the engine reads about the learner, loaded once per request
 * (owner ruling 15, 2026-09-29), plus the per-video scores computed so far.
 * Every consumer on one page — the discovery sort, AI Sensei's goal pass and
 * its catalogue pass — scores through the same context, so a lesson two of
 * them rank is read, tokenized and scored once.
 */
export interface RecommendationContext {
  supabase: ReturnType<typeof createClient>;
  known: Set<string>;
  completedVideoIds: Set<string>;
  bands: (typeof DIFFICULTY_BANDS)[keyof typeof DIFFICULTY_BANDS];
  /** A promise per video, so two consumers scoring at once share one pass. */
  scores: Map<string, Promise<VideoRecommendation | null>>;
}

async function loadRecommendationContext(): Promise<RecommendationContext | null> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return null;
  const [prefs, known, progressRows] = await Promise.all([
    readPreferences(supabase, user.id),
    getKnownVocabLemmas(supabase, user.id),
    fetchAllPages((from, to) => supabase
      .from("user_video_progress")
      .select("video_id, completed_at")
      .eq("user_id", user.id)
      .order("video_id", { ascending: true })
      .range(from, to),
    ) as Promise<ProgressRow[]>,
  ]);
  return {
    supabase,
    known,
    completedVideoIds: new Set(progressRows.filter((row) => row.completed_at).map((row) => row.video_id)),
    bands: DIFFICULTY_BANDS[prefs.difficulty],
    scores: new Map(),
  };
}

// React's `cache` dedupes per request in the RSC build Next serves; the plain
// React build (vitest) has none, and there each call loads its own context.
const perRequest: <T extends (...args: never[]) => unknown>(fn: T) => T =
  (React as { cache?: <T>(fn: T) => T }).cache ?? ((fn) => fn);

/** The caller's recommendation context for this request, or null when signed out. */
export const getRecommendationContext = perRequest(loadRecommendationContext);

/**
 * True when the learner knows at least one word. With none, no lesson can
 * carry a measured known-word reason (`reasonForKnownWordFit`), so a
 * consumer that shows only reasoned picks can skip the engine entirely.
 */
export async function knowsAnyVocabulary(): Promise<boolean> {
  const context = await getRecommendationContext();
  return Boolean(context && context.known.size > 0);
}

/** Reads, tokenizes and scores videos not yet scored in this context. */
async function scoreBatch(context: RecommendationContext, videos: CandidateVideoRow[]): Promise<Map<string, VideoRecommendation | null>> {
  const { supabase } = context;
  const ids = videos.map((video) => video.id);
  const latestTranscriptRows = await fetchByIdChunks(ids, async (videoIds) => {
    const { data, error } = await supabase.rpc("latest_transcript_ids", { p_video_ids: videoIds });
    if (error) throw error;
    return (data as { video_id: string; transcript_id: string }[] | null) ?? [];
  });

  // `latest_transcript_ids` picks each video's newest transcript in SQL — the
  // same "most recent transcript" convention as `lib/data/transcripts.ts::getTranscript`.
  const latestTranscriptIdByVideoId = new Map(latestTranscriptRows.map((row) => [row.video_id, row.transcript_id]));

  const transcriptIds = Array.from(new Set(latestTranscriptIdByVideoId.values()));
  const linesByTranscriptId = new Map<string, string[]>();
  if (transcriptIds.length > 0) {
    const lineRows = await fetchAllPages((from, to) => supabase
      .from("transcript_lines")
      .select("id, transcript_id, text_jp")
      .in("transcript_id", transcriptIds)
      .order("transcript_id", { ascending: true })
      .order("start_time", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to),
    ) as LineRow[];
    for (const row of lineRows) {
      const lines = linesByTranscriptId.get(row.transcript_id) ?? [];
      lines.push(row.text_jp);
      linesByTranscriptId.set(row.transcript_id, lines);
    }
  }

  const scored = new Map<string, VideoRecommendation | null>();
  for (const video of videos) {
    scored.set(video.id, null);
    const transcriptId = latestTranscriptIdByVideoId.get(video.id);
    if (!transcriptId) continue; // no transcript yet — not scorable

    const texts = linesByTranscriptId.get(transcriptId) ?? [];
    if (texts.length === 0) continue;

    const lemmas: string[] = [];
    for (const text of texts) {
      const tokens = await tokenize(text);
      lemmas.push(...contentLemmas(tokens));
    }

    const score = scoreComprehension(lemmas, context.known, context.bands);
    const band = score.band;
    if (band === "insufficient-data") continue;

    scored.set(video.id, {
      videoId: video.id,
      youtubeVideoId: video.youtube_video_id,
      title: video.title,
      thumbnailUrl: video.thumbnail_url,
      jlptLevelEstimate: video.jlpt_level_estimate,
      knownRatio: score.knownRatio,
      band,
      totalWords: score.totalWords,
      knownWords: score.knownWords,
      reason: reasonForKnownWordFit({
        band,
        knownRatio: score.knownRatio,
        totalWords: score.totalWords,
        knownWords: score.knownWords,
      }),
    });
  }
  return scored;
}

/** Each video's score, computing only the ones this context has not seen. */
async function scoreVideos(context: RecommendationContext, videos: CandidateVideoRow[]): Promise<(VideoRecommendation | null)[]> {
  const missing = videos.filter((video) => !context.scores.has(video.id));
  if (missing.length) {
    const batch = scoreBatch(context, missing);
    // A failed batch is forgotten, so a later consumer retries it instead of inheriting the error.
    batch.catch(() => { for (const video of missing) context.scores.delete(video.id); });
    for (const video of missing) context.scores.set(video.id, batch.then((scores) => scores.get(video.id) ?? null));
  }
  return Promise.all(videos.map((video) => context.scores.get(video.id) ?? Promise.resolve(null)));
}

/**
 * Recommend approved, transcribed videos the caller hasn't completed yet,
 * sorted i+1-ideal first (by known-word ratio descending), then too-easy,
 * then too-hard; videos with no scorable content (no transcript, or a
 * transcript with no content words) are dropped rather than surfaced.
 *
 * The learner's context comes from `getRecommendationContext` (once per
 * request), and scoring is memoised in it, so several calls on one page cost
 * one pass per distinct video. Only the tokenization work scales with
 * `SCAN_LIMIT`.
 */
export async function getRecommendations(query: RecommendationsQuery & { candidateIds?: string[] }): Promise<GetRecommendationsResult> {
  const context = await getRecommendationContext();
  if (!context) return { ok: false, status: 401 };

  const columns = "id, youtube_video_id, title, thumbnail_url, jlpt_level_estimate, created_at";
  const scannable = () => context.supabase.from("videos").select(columns).in("library_access", ["FREE", "PLUS"]);
  let videoRows: CandidateVideoRow[];
  if (query.candidateIds) {
    // The newest SCAN_LIMIT of the caller's ids, whatever order they came in;
    // the ids travel in chunks so a long list stays inside the request URL.
    const rows = await fetchByIdChunks(query.candidateIds, async (ids) => {
      const { data, error } = await scannable().in("id", ids);
      if (error) throw error;
      return (data as CandidateVideoRow[] | null) ?? [];
    });
    videoRows = rows
      .sort((left, right) => right.created_at.localeCompare(left.created_at) || left.id.localeCompare(right.id))
      .slice(0, SCAN_LIMIT);
  } else {
    const { data, error } = await scannable().order("created_at", { ascending: false }).order("id", { ascending: true }).limit(SCAN_LIMIT);
    if (error) throw error;
    videoRows = (data as CandidateVideoRow[] | null) ?? [];
  }

  const candidates = videoRows.filter(
    (video) => !context.completedVideoIds.has(video.id),
  );
  if (candidates.length === 0) return { ok: true, data: [] };

  const scored = (await scoreVideos(context, candidates))
    .filter((recommendation): recommendation is VideoRecommendation => recommendation !== null);

  scored.sort((a, b) => {
    const bandDiff = BAND_RANK[a.band] - BAND_RANK[b.band];
    if (bandDiff !== 0) return bandDiff;
    return b.knownRatio - a.knownRatio;
  });

  return { ok: true, data: scored.slice(0, query.limit) };
}
