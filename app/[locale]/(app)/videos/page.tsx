import type { Metadata } from "next";
import { Suspense } from "react";
import type { Locale } from "@/lib/i18n";
import { redirect } from "@/lib/i18n/navigation";
import { getLocale, getTranslations } from "@/lib/i18n/server";
import { listVideos } from "@/lib/data/videos";
import { Container } from "@/components/ui/container";
import { VideoImportForm } from "@/components/video/video-import-form";
import { VideoCard } from "@/components/video/video-card";
import { RecommendationSection } from "@/components/learning/recommendation-section";
import { SaveToPlaylistButton } from "@/components/community/save-to-playlist-button";
import { CompanionAnchor } from "@/components/companion/companion-anchor";
// lib/data/videos.ts's VideoRow is the same DB row shape as lib/video-types.ts's
// client-safe VideoRow, just declared locally with a wider `string | null` for
// jlpt_level_estimate instead of the `JlptLevel | null` union. The cast below is
// a type-only reconciliation of that duplication, not a runtime-unsafe one.
import type { VideoRow } from "@/lib/video-types";

export async function generateMetadata({
  params,
}: {
  params: { locale: Locale };
}): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: "videos" });
  return { title: t("title") };
}
export const dynamic = "force-dynamic";

export default async function VideosPage() {
  const t = await getTranslations("videos");
  const tCommon = await getTranslations("common");
  const result = await listVideos();
  // (app) layout already redirects unauthenticated users; this is defence in depth.
  if (!result.ok) redirect({ href: "/login", locale: await getLocale() });

  const videos = result.data as unknown as VideoRow[];

  return (
    <Container className="py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("subtitle")}
        </p>
      </div>

      <VideoImportForm />

      <section aria-labelledby="recommendations-heading" className="mt-8">
        <h2 id="recommendations-heading" className="mb-3 text-lg font-semibold">
          {tCommon("recommendations.heading")}
        </h2>
        <Suspense fallback={<p className="text-sm text-muted-foreground">{tCommon("recommendations.loading")}</p>}>
          <RecommendationSection limit={8} />
        </Suspense>
      </section>

      <div className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">{t("yourVideos")}</h2>
        {videos.length === 0 ? (
          // An empty library is a rest point (§5.2/§5.4); the anchor states
          // WHAT HAPPENED and the Ambient Layer decides whether to speak.
          <div className="flex flex-col items-start gap-3">
            <CompanionAnchor surface="videos-empty" pose="standing" context="empty_library" />
            <p className="text-muted-foreground">
              {t("empty")}
            </p>
          </div>
        ) : (
          // `role="list"`/`"listitem"` (rather than <ul>/<li>) because each
          // item wraps VideoCard's own <li> together with an overlaid
          // "Save to playlist" button as a sibling — nesting another <li>
          // around VideoCard's would be invalid HTML, so ARIA restores the
          // list semantics for assistive tech instead.
          <div role="list" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {videos.map((video) => (
              <div key={video.id} role="listitem" className="relative">
                <VideoCard video={video} />
                <div className="absolute right-2 top-2 z-10">
                  <SaveToPlaylistButton videoId={video.id} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Container>
  );
}
