import { notFound } from "next/navigation";
import { getVideo } from "@/lib/data/videos";
import { getTranscript } from "@/lib/data/transcripts";
import { Container } from "@/components/ui/container";
import { DictationView } from "@/components/video-player/dictation-view";
// See app/(app)/videos/[id]/shadowing/page.tsx for why this cast is a
// type-only reconciliation of lib/data's wider VideoRow shape, not a
// runtime-unsafe one.
import type { TranscriptWithLines, VideoRow } from "@/lib/video-types";

export const dynamic = "force-dynamic";

export default async function DictationPage({ params }: { params: { id: string } }) {
  const videoResult = await getVideo(params.id);
  if (!videoResult.ok) notFound();

  const transcriptResult = await getTranscript(params.id);
  const transcript = transcriptResult.ok
    ? (transcriptResult.data as unknown as TranscriptWithLines | null)
    : null;

  const video = videoResult.data as unknown as VideoRow;

  return (
    <Container className="py-8">
      <h1 className="text-2xl font-bold">{video.title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">Dictation practice</p>

      <div className="mt-6">
        <DictationView video={video} transcript={transcript} />
      </div>
    </Container>
  );
}
