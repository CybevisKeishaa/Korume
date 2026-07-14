import { Container } from "@/components/ui/container";
import { VideoQueue } from "@/components/admin/video-queue";

export const metadata = { title: "Admin — Video Queue" };

export default function AdminVideosPage() {
  return (
    <Container className="max-w-none py-2">
      <h1 className="text-2xl font-bold">Video queue</h1>
      <p className="mt-1 text-muted-foreground">Review, approve, reject, and attach transcripts to submitted videos.</p>
      <div className="mt-8">
        <VideoQueue />
      </div>
    </Container>
  );
}
