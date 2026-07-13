import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/data/videos";
import { getKnownVocabLemmas } from "@/lib/data/difficulty";
import { tokenize } from "@/lib/japanese/tokenizer";
import { contentLemmas, scoreComprehension } from "@/lib/difficulty";
import type { RecommendationsQuery } from "@/lib/validation/recommendations";

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

type RankedBand = "ideal" | "too-easy" | "too-hard";

const BAND_RANK: Record<RankedBand, number> = {
  ideal: 0,
  "too-easy": 1,
  "too-hard": 2,
};

export interface VideoRecommendation {
  videoId: string;
  youtubeVideoId: string;
  title: string;
  thumbnailUrl: string | null;
  jlptLevelEstimate: string | null;
  knownRatio: number;
  band: RankedBand;
  totalWords: number;
  knownWords: number;
}

export type GetRecommendationsResult = { ok: true; data: VideoRecommendation[] } | { ok: false; status: 401 };

interface CandidateVideoRow {
  id: string;
  youtube_video_id: string;
  title: string;
  thumbnail_url: string | null;
  jlpt_level_estimate: string | null;
}

interface ProgressRow {
  video_id: string;
  completed_at: string | null;
}

interface TranscriptRow {
  id: string;
  video_id: string;
  created_at: string;
}

interface LineRow {
  transcript_id: string;
  text_jp: string;
}

/**
 * Recommend approved, transcribed videos the caller hasn't completed yet,
 * sorted i+1-ideal first (by known-word ratio descending), then too-easy,
 * then too-hard; videos with no scorable content (no transcript, or a
 * transcript with no content words) are dropped rather than surfaced.
 *
 * Query shape is batched rather than per-video: the known-vocab set is
 * fetched once, and both the transcripts and transcript_lines lookups cover
 * every candidate in a single `in(...)` query each — so the request's query
 * count stays flat regardless of how many videos are scanned. Only the
 * tokenization work scales with `SCAN_LIMIT`.
 */
export async function getRecommendations(query: RecommendationsQuery): Promise<GetRecommendationsResult> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { ok: false, status: 401 };

  const known = await getKnownVocabLemmas(supabase, user.id);

  const { data: progressRows, error: progressError } = await supabase
    .from("user_video_progress")
    .select("video_id, completed_at")
    .eq("user_id", user.id);
  if (progressError) throw progressError;
  const completedVideoIds = new Set(
    ((progressRows as ProgressRow[] | null) ?? []).filter((row) => row.completed_at).map((row) => row.video_id),
  );

  const { data: videoRows, error: videoError } = await supabase
    .from("videos")
    .select("id, youtube_video_id, title, thumbnail_url, jlpt_level_estimate")
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(SCAN_LIMIT);
  if (videoError) throw videoError;

  const candidates = ((videoRows as CandidateVideoRow[] | null) ?? []).filter(
    (video) => !completedVideoIds.has(video.id),
  );
  if (candidates.length === 0) return { ok: true, data: [] };

  const candidateIds = candidates.map((video) => video.id);
  const { data: transcriptRows, error: transcriptError } = await supabase
    .from("transcripts")
    .select("id, video_id, created_at")
    .in("video_id", candidateIds)
    .order("created_at", { ascending: false });
  if (transcriptError) throw transcriptError;

  // First occurrence per video_id in this globally-desc-sorted list is that
  // video's newest transcript — same "most recent transcript" convention as
  // `lib/data/transcripts.ts::getTranscript`, generalized to many videos in
  // one query instead of one `order().limit(1)` per video.
  const latestTranscriptIdByVideoId = new Map<string, string>();
  for (const row of (transcriptRows as TranscriptRow[] | null) ?? []) {
    if (!latestTranscriptIdByVideoId.has(row.video_id)) {
      latestTranscriptIdByVideoId.set(row.video_id, row.id);
    }
  }

  const transcriptIds = Array.from(new Set(latestTranscriptIdByVideoId.values()));
  const linesByTranscriptId = new Map<string, string[]>();
  if (transcriptIds.length > 0) {
    const { data: lineRows, error: lineError } = await supabase
      .from("transcript_lines")
      .select("transcript_id, text_jp")
      .in("transcript_id", transcriptIds);
    if (lineError) throw lineError;
    for (const row of (lineRows as LineRow[] | null) ?? []) {
      const lines = linesByTranscriptId.get(row.transcript_id) ?? [];
      lines.push(row.text_jp);
      linesByTranscriptId.set(row.transcript_id, lines);
    }
  }

  const scored: VideoRecommendation[] = [];
  for (const video of candidates) {
    const transcriptId = latestTranscriptIdByVideoId.get(video.id);
    if (!transcriptId) continue; // no transcript yet — not scorable

    const texts = linesByTranscriptId.get(transcriptId) ?? [];
    if (texts.length === 0) continue;

    const lemmas: string[] = [];
    for (const text of texts) {
      const tokens = await tokenize(text);
      lemmas.push(...contentLemmas(tokens));
    }

    const score = scoreComprehension(lemmas, known);
    const band = score.band;
    if (band === "insufficient-data") continue;

    scored.push({
      videoId: video.id,
      youtubeVideoId: video.youtube_video_id,
      title: video.title,
      thumbnailUrl: video.thumbnail_url,
      jlptLevelEstimate: video.jlpt_level_estimate,
      knownRatio: score.knownRatio,
      band,
      totalWords: score.totalWords,
      knownWords: score.knownWords,
    });
  }

  scored.sort((a, b) => {
    const bandDiff = BAND_RANK[a.band] - BAND_RANK[b.band];
    if (bandDiff !== 0) return bandDiff;
    return b.knownRatio - a.knownRatio;
  });

  return { ok: true, data: scored.slice(0, query.limit) };
}
