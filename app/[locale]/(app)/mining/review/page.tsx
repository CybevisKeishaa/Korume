import { getMiningQueue } from "@/lib/data/mining";
import { Container } from "@/components/ui/container";
import { MiningReviewSession } from "@/components/video-player/mining-review-session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Review mined sentences" };

export default async function MiningReviewPage() {
  const result = await getMiningQueue();
  const items = result.ok ? result.data : [];

  return (
    <Container className="max-w-xl py-12">
      <h1 className="mb-6 text-center text-xl font-bold">Mining review</h1>
      <MiningReviewSession items={items} />
    </Container>
  );
}
