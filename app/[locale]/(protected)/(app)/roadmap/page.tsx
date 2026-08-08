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
  return { title: t("roadmap.title") };
}

export default async function RoadmapPage() {
  const t = await getTranslations("upcoming");
  return (
    <UpcomingScreen
      title={t("roadmap.title")}
      body={t("roadmap.body")}
      unlocks={t("roadmap.unlocks")}
      unlocksLabel={t("unlocksLabel")}
    />
  );
}
