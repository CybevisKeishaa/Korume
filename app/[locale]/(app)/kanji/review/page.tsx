import { getTranslations } from "@/lib/i18n/server";
import { getReviewQueue } from "@/lib/data/srs";
import { jlptLevelSchema } from "@/lib/validation/content";
import { ReviewSession } from "@/components/learning/review-session";
import { Container } from "@/components/ui/container";

export const dynamic = "force-dynamic";
export const metadata = { title: "Review kanji" };

export default async function KanjiReviewPage({
  searchParams,
}: {
  searchParams: { level?: string };
}) {
  const t = await getTranslations("kanji");
  const level = jlptLevelSchema.safeParse(searchParams.level).data;
  const items = await getReviewQueue("kanji", level);

  return (
    <Container className="max-w-xl py-12">
      <h1 className="mb-6 text-center text-xl font-bold">{t("reviewTitle")}</h1>
      <ReviewSession
        itemType="kanji"
        items={items}
        backHref={`/kanji${level ? `?level=${level}` : ""}`}
      />
    </Container>
  );
}
