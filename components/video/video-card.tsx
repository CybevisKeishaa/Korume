import Image from "next/image";
import { Link } from "@/lib/i18n/navigation";
import { useTranslations } from "@/lib/i18n";
// Type-only import: safe to reuse from a component that may later be pulled
// into a client bundle (lib/data/videos.ts is "server-only" at runtime, but
// its types are not — this is the client-safe mirror per lib/video-types.ts).
import type { VideoRow } from "@/lib/video-types";

/**
 * A single video's card in the /videos grid. Links to its shadowing page.
 *
 * A non-async Server Component — `useTranslations` from `@/lib/i18n` works
 * here without `"use client"`, same as `recommendation-rail.tsx` (Task 5).
 * `noThumbnail` reads from `common` (shared verbatim with the recommendation
 * rail's fallback, CLAUDE.md P4); `pendingReview` is this module's own.
 */
export function VideoCard({ video }: { video: VideoRow }) {
  const t = useTranslations("videos");
  const tCommon = useTranslations("common");
  return (
    <li>
      <Link
        href={`/videos/${video.id}/shadowing`}
        className="group flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <div className="relative aspect-video w-full shrink-0 overflow-hidden bg-muted">
          {video.thumbnail_url ? (
            <Image
              src={video.thumbnail_url}
              alt=""
              fill
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 100vw"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              {tCommon("noThumbnail")}
            </div>
          )}
          {video.library_access === "PRIVATE" && (
            <span className="absolute right-2 top-2 rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
              {t("pendingReview")}
            </span>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-2 p-4">
          <p className="line-clamp-2 text-sm font-medium text-foreground">
            {video.title}
          </p>
          {video.jlpt_level_estimate && (
            <span className="mt-auto w-fit rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {video.jlpt_level_estimate}
            </span>
          )}
        </div>
      </Link>
    </li>
  );
}
