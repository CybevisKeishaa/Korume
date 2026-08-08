import type { Metadata } from "next";
import type { Locale } from "@/lib/i18n";
import { getTranslations } from "@/lib/i18n/server";
import { UpcomingScreen } from "@/components/layout/upcoming-screen";

export async function generateMetadata({
  params,
}: {
  params: { locale: Locale };
}): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: "upcoming" });
  return { title: t("review.title") };
}

export default async function ReviewPage() {
  const t = await getTranslations("upcoming");
  return (
    <UpcomingScreen
      title={t("review.title")}
      body={t("review.body")}
      unlocks={t("review.unlocks")}
      unlocksLabel={t("unlocksLabel")}
    />
  );
}
