import { listQueue, listMine } from "@/lib/data/peer-review";
import { Container } from "@/components/ui/container";
import { CommunityTabs } from "@/components/community/community-tabs";
import { PeerReviewTabs } from "@/components/community/peer-review-tabs";

export const metadata = { title: "Peer review" };
export const dynamic = "force-dynamic";

export default async function PeerReviewPage() {
  const [queueResult, mineResult] = await Promise.all([listQueue({ limit: 20 }), listMine()]);

  const initialQueue = queueResult.ok ? queueResult.data : { shares: [], nextCursor: null };
  const initialMine = mineResult.ok ? mineResult.data : [];

  return (
    <Container className="py-8">
      <h1 className="text-2xl font-bold">Community</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Listen to a shadowing take shared by another learner and leave a rating and comment, or manage the
        recordings you&apos;ve shared.
      </p>

      <div className="mt-6">
        <CommunityTabs />
      </div>

      <div className="mt-6">
        <PeerReviewTabs initialQueue={initialQueue} initialMine={initialMine} />
      </div>
    </Container>
  );
}
