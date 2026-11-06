import type { Metadata } from "next";
import type { Locale } from "@/lib/i18n";
import { getTranslations } from "@/lib/i18n/server";
import { getKanjiReviewQueue } from "@/lib/data/kanji-review";
import { jlptLevelSchema } from "@/lib/validation/content";
import { ReviewSession } from "@/components/learning/review-session";
import { Container } from "@/components/ui/container";

export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: { locale: Locale };
}): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: "kanji" });
  return { title: t("reviewTitle") };
}

export default async function KanjiReviewPage({
  searchParams,
}: {
  searchParams: { level?: string; focus?: string };
}) {
  const t = await getTranslations("kanji");
  const level = jlptLevelSchema.safeParse(searchParams.level).data;
  const items = (await getKanjiReviewQueue({ level, focus: searchParams.focus })).map((card) => ({
    id: card.literal,
    front: card.literal,
    back: card.meaningsEn.join(", "),
  }));

  return (
    <Container className="max-w-xl py-12">
      <h1 className="mb-6 text-center text-title font-bold">{t("reviewTitle")}</h1>
      <ReviewSession
        itemType="kanji"
        items={items}
        backHref={`/kanji${level ? `?level=${level}` : ""}`}
      />
    </Container>
  );
}
