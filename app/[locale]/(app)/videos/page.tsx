import { Suspense } from "react";
import { redirect } from "next/navigation";
import { listVideos } from "@/lib/data/videos";
import { Container } from "@/components/ui/container";
import { VideoImportForm } from "@/components/video/video-import-form";
import { VideoCard } from "@/components/video/video-card";
import { RecommendationSection } from "@/components/learning/recommendation-section";
import { SaveToPlaylistButton } from "@/components/community/save-to-playlist-button";
// lib/data/videos.ts's VideoRow is the same DB row shape as lib/video-types.ts's
// client-safe VideoRow, just declared locally with a wider `string | null` for
// jlpt_level_estimate instead of the `JlptLevel | null` union. The cast below is
// a type-only reconciliation of that duplication, not a runtime-unsafe one.
import type { VideoRow } from "@/lib/video-types";

export const metadata = { title: "Videos" };
export const dynamic = "force-dynamic";

export default async function VideosPage() {
  const result = await listVideos();
  // (app) layout already redirects unauthenticated users; this is defence in depth.
  if (!result.ok) redirect("/login");

  const videos = result.data as unknown as VideoRow[];

  return (
    <Container className="py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Videos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Shadow and study Japanese YouTube videos. Paste a link to add one.
        </p>
      </div>

      <VideoImportForm />

      <section aria-labelledby="recommendations-heading" className="mt-8">
        <h2 id="recommendations-heading" className="mb-3 text-lg font-semibold">
          Recommended for you
        </h2>
        <Suspense fallback={<p className="text-sm text-muted-foreground">Finding videos at your level…</p>}>
          <RecommendationSection limit={8} />
        </Suspense>
      </section>

      <div className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Your videos</h2>
        {videos.length === 0 ? (
          <p className="text-muted-foreground">
            No videos yet — paste a YouTube URL above to start.
          </p>
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
