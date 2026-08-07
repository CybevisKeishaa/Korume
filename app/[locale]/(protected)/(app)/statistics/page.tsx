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
  return { title: t("statistics.title") };
}

export default async function StatisticsPage() {
  const t = await getTranslations("upcoming");
  return (
    <UpcomingScreen
      title={t("statistics.title")}
      body={t("statistics.body")}
      unlocks={t("statistics.unlocks")}
      unlocksLabel={t("unlocksLabel")}
    />
  );
}
