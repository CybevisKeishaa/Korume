import Image from "next/image";
import { Link } from "@/lib/i18n/navigation";
import { useTranslations } from "@/lib/i18n";
import { BAND_LABEL_KEY, type VideoRecommendation } from "@/lib/recommendation-types";

export interface RecommendationRailProps {
  recommendations: VideoRecommendation[];
}

/**
 * i+1 comprehensible-input recommendation rail (CLAUDE.md §5.2). Pure
 * presentational — data comes from `getRecommendations()` /
 * `GET /api/videos/recommendations`, fetched by the caller (a Suspense-wrapped
 * async server component; see `components/learning/recommendation-section.tsx`)
 * so this renders instantly once its props arrive and never blocks the rest
 * of the page.
 *
 * Thumbnails only ever come from `thumbnailUrl` as already stored on the
 * video row — the YouTube thumbnail URL captured at import time (CLAUDE.md
 * §2.1: never re-host/proxy video or its assets).
 *
 * Strings live in `common.recommendations.*`, not a per-module namespace:
 * this rail is rendered by both `/dashboard` and `/shadowing` (via
 * `recommendation-section.tsx`), and CLAUDE.md P4 requires a string needed by
 * two or more modules to be promoted to `common` rather than duplicated.
 *
 * A non-async Server Component — `useTranslations` from `@/lib/i18n` works
 * here without `"use client"` (confirmed by a real build in Task 5), which
 * keeps this RTL-renderable.
 */
export function RecommendationRail({ recommendations }: RecommendationRailProps) {
  const t = useTranslations("common");

  if (recommendations.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t.rich("recommendations.empty", {
          link: (chunks) => (
            <Link href="/shadowing" className="underline underline-offset-2 hover:text-foreground">
              {chunks}
            </Link>
          ),
        })}
      </p>
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {recommendations.map((rec) => (
        <li key={rec.videoId}>
          <Link
            href={`/shadowing/${rec.videoId}`}
            className="group flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <div className="relative aspect-video w-full shrink-0 overflow-hidden bg-muted">
              {rec.thumbnailUrl ? (
                <Image
                  src={rec.thumbnailUrl}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 100vw"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  {t("noThumbnail")}
                </div>
              )}
            </div>
            <div className="flex flex-1 flex-col gap-2 p-4">
              <p className="line-clamp-2 text-sm font-medium text-foreground">{rec.title}</p>
              <div className="mt-auto flex flex-wrap items-center gap-1.5">
                {rec.jlptLevelEstimate && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {rec.jlptLevelEstimate}
                  </span>
                )}
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary-strong">
                  {t(BAND_LABEL_KEY[rec.band])}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("recommendations.knownWords", { percent: Math.round(rec.knownRatio * 100) })}
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
