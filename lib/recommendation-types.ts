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

/**
 * Maps each i+1 band to its `common.recommendations.band.*` catalog key
 * (short, non-alarming label — CLAUDE.md §5.2). This used to be the
 * rendered English label itself, but a module-level constant can't call
 * `t()` — only a component body can — so it holds the catalog key instead,
 * resolved by the sole consumer, `recommendation-rail.tsx`.
 *
 * `satisfies Record<RecommendationBand, string>` (rather than annotating the
 * object literal with that type) keeps both properties this needs:
 * exhaustiveness (a new `RecommendationBand` member that's missing here is a
 * type error — a new band must not be able to silently lose its label) AND
 * literal string types on the values (so `t(BAND_LABEL_KEY[band])` type-checks
 * against next-intl's typed keys without a cast).
 */
export const BAND_LABEL_KEY = {
  ideal: "recommendations.band.ideal",
  "too-easy": "recommendations.band.tooEasy",
  "too-hard": "recommendations.band.tooHard",
} as const satisfies Record<RecommendationBand, string>;
