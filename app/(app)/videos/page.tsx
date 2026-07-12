import { redirect } from "next/navigation";
import { listVideos } from "@/lib/data/videos";
import { Container } from "@/components/ui/container";
import { VideoImportForm } from "@/components/video/video-import-form";
import { VideoCard } from "@/components/video/video-card";
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

      <div className="mt-8">
        {videos.length === 0 ? (
          <p className="text-muted-foreground">
            No videos yet — paste a YouTube URL above to start.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {videos.map((video) => (
              <VideoCard key={video.id} video={video} />
            ))}
          </ul>
        )}
      </div>
    </Container>
  );
}
