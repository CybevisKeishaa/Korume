import { getTranslations } from "@/lib/i18n/server";
import { getMiningQueue } from "@/lib/data/mining";
import { Container } from "@/components/ui/container";
import { MiningReviewSession } from "@/components/video-player/mining-review-session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Review mined sentences" };

export default async function MiningReviewPage() {
  const t = await getTranslations("mining");
  const result = await getMiningQueue();
  const items = result.ok ? result.data : [];

  return (
    <Container className="max-w-xl py-12">
      <h1 className="mb-6 text-center text-xl font-bold">{t("review.title")}</h1>
      <MiningReviewSession items={items} />
    </Container>
  );
}
