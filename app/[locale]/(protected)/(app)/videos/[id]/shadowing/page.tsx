import { notFound } from "next/navigation";
import { getVideo } from "@/lib/data/videos";
import { getTranscript } from "@/lib/data/transcripts";
import { getVocabMasteryMap } from "@/lib/data/vocab-progress";
import { Container } from "@/components/ui/container";
import { ShadowingView } from "@/components/video-player/shadowing-view";
import { SaveToPlaylistButton } from "@/components/community/save-to-playlist-button";
// lib/data/videos.ts's VideoRow is the same DB row shape as lib/video-types.ts's
// client-safe VideoRow, just declared locally with a wider `string | null` for
// jlpt_level_estimate instead of the `JlptLevel | null` union (see
// app/(app)/videos/page.tsx for the same reconciliation). The cast below is a
// type-only reconciliation of that duplication, not a runtime-unsafe one.
import type { TranscriptWithLines, VideoRow } from "@/lib/video-types";

export const dynamic = "force-dynamic";

export default async function ShadowingPage({ params }: { params: { id: string } }) {
  const videoResult = await getVideo(params.id);
  if (!videoResult.ok) notFound();

  const transcriptResult = await getTranscript(params.id);
  const transcript = transcriptResult.ok
    ? (transcriptResult.data as unknown as TranscriptWithLines | null)
    : null;

  const masteryMap = await getVocabMasteryMap();

  const video = videoResult.data as unknown as VideoRow;

  return (
    <Container className="py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl font-bold">{video.title}</h1>
        <SaveToPlaylistButton videoId={video.id} />
      </div>

      <div className="mt-6">
        <ShadowingView video={video} transcript={transcript} masteryMap={masteryMap} />
      </div>
    </Container>
  );
}
