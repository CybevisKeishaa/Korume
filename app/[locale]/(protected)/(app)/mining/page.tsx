import type { Metadata } from "next";
import type { Locale } from "@/lib/i18n";
import { Link } from "@/lib/i18n/navigation";
import { getTranslations } from "@/lib/i18n/server";
import { listMiningCards } from "@/lib/data/mining";
import { Container } from "@/components/ui/container";
import { buttonStyles } from "@/components/ui/button";
import { MiningDeckList } from "@/components/video-player/mining-deck-list";

export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: { locale: Locale };
}): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: "mining" });
  return { title: t("deck.title") };
}

export default async function MiningDeckPage() {
  const t = await getTranslations("mining");
  const result = await listMiningCards();
  const cards = result.ok ? result.data : [];

  return (
    <Container className="py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{t("deck.title")}</h1>
        <Link href="/mining/review" className={buttonStyles()}>
          {t("deck.review")}
        </Link>
      </div>

      <div className="mt-6">
        <MiningDeckList cards={cards} />
      </div>
    </Container>
  );
}
