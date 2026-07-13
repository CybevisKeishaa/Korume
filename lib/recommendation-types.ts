/**
 * Client-safe mirror of `lib/data/recommendations.ts`'s `VideoRecommendation`
 * (that module is `server-only`) — same shape `GET /api/videos/recommendations`
 * returns, declared locally so client-safe components can import the type
 * without pulling in the data layer. Same duplication convention as
 * `lib/video-types.ts` vs `lib/data/videos.ts`.
 */

export type RecommendationBand = "ideal" | "too-easy" | "too-hard";

export interface VideoRecommendation {
  videoId: string;
  youtubeVideoId: string;
  title: string;
  thumbnailUrl: string | null;
  jlptLevelEstimate: string | null;
  knownRatio: number;
  band: RecommendationBand;
  totalWords: number;
  knownWords: number;
}

/** Short, non-alarming label for each i+1 band (CLAUDE.md §5.2). */
export const BAND_LABEL: Record<RecommendationBand, string> = {
  ideal: "Just right",
  "too-easy": "Easy review",
  "too-hard": "Challenge",
};
