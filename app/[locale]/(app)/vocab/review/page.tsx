import { getTranslations } from "@/lib/i18n/server";
import { getReviewQueue } from "@/lib/data/srs";
import { jlptLevelSchema } from "@/lib/validation/content";
import { ReviewSession } from "@/components/learning/review-session";
import { Container } from "@/components/ui/container";

export const dynamic = "force-dynamic";
export const metadata = { title: "Review vocab" };

export default async function VocabReviewPage({
  searchParams,
}: {
  searchParams: { level?: string };
}) {
  const t = await getTranslations("vocab");
  const level = jlptLevelSchema.safeParse(searchParams.level).data;
  const items = await getReviewQueue("vocab", level);

  return (
    <Container className="max-w-xl py-12">
      <h1 className="mb-6 text-center text-xl font-bold">{t("reviewTitle")}</h1>
      <ReviewSession
        itemType="vocab"
        items={items}
        backHref={`/vocab${level ? `?level=${level}` : ""}`}
      />
    </Container>
  );
}
