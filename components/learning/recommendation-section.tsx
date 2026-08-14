import { getRecommendations } from "@/lib/data/recommendations";
import { RecommendationRail } from "./recommendation-rail";

export interface RecommendationSectionProps {
  limit?: number;
}

/**
 * Async server-component wrapper around `RecommendationRail` (Layer 6, i+1
 * rail — CLAUDE.md §5.2). Calls `getRecommendations()` directly rather than
 * `fetch`ing `GET /api/videos/recommendations`, matching this repo's
 * established pattern of server components calling `lib/data/*` straight
 * (see `app/[locale]/(protected)/(app)/shadowing/page.tsx`'s `listVideos()`,
 * `app/[locale]/(protected)/(app)/certification/page.tsx`).
 *
 * Callers (`/dashboard`, `/shadowing`) wrap this in `<Suspense>` so scoring every
 * candidate video (a real, non-trivial amount of tokenization work — see
 * `lib/data/recommendations.ts`) streams in without blocking the rest of the
 * page shell.
 */
export async function RecommendationSection({ limit = 8 }: RecommendationSectionProps) {
  const result = await getRecommendations({ limit });
  const recommendations = result.ok ? result.data : [];
  return <RecommendationRail recommendations={recommendations} />;
}
