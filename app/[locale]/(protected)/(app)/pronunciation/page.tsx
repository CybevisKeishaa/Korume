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
  return { title: t("pronunciation.title") };
}

export default async function PronunciationPage() {
  const t = await getTranslations("upcoming");
  return (
    <UpcomingScreen
      title={t("pronunciation.title")}
      body={t("pronunciation.body")}
      unlocks={t("pronunciation.unlocks")}
      unlocksLabel={t("unlocksLabel")}
    />
  );
}
