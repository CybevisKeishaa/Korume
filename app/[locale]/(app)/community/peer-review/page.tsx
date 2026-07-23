import { getTranslations } from "@/lib/i18n/server";
import { listQueue, listMine } from "@/lib/data/peer-review";
import { Container } from "@/components/ui/container";
import { CommunityTabs } from "@/components/community/community-tabs";
import { PeerReviewTabs } from "@/components/community/peer-review-tabs";

export const metadata = { title: "Peer review" };
export const dynamic = "force-dynamic";

export default async function PeerReviewPage() {
  const t = await getTranslations("community");
  const [queueResult, mineResult] = await Promise.all([listQueue({ limit: 20 }), listMine()]);

  const initialQueue = queueResult.ok ? queueResult.data : { shares: [], nextCursor: null };
  const initialMine = mineResult.ok ? mineResult.data : [];

  return (
    <Container className="py-8">
      <h1 className="text-2xl font-bold">{t("page.heading")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("peerReviewPage.subtitle")}</p>

      <div className="mt-6">
        <CommunityTabs />
      </div>

      <div className="mt-6">
        <PeerReviewTabs initialQueue={initialQueue} initialMine={initialMine} />
      </div>
    </Container>
  );
}
