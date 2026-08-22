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
  return { title: t("privacyMemory.title") };
}

/**
 * The destination of the Danger Zone's `Delete Korume Memory` row.
 *
 * Spec §13 was a user ruling: the row ships as `337:3323` draws it, and its
 * `Manage` action points at an HONEST "not built yet" surface. The whole-branch
 * review found the row linking here with no page behind it — Next's default,
 * unstyled, English 404, outside the app chrome (there is no `not-found.tsx`
 * anywhere under `app/`). "Pointing at an honest not-built surface" and
 * "appearing functional" are different things, and only the first is
 * acceptable; a 404 is neither.
 *
 * `UpcomingScreen` is the pattern the spec names and `/settings` itself already
 * uses. When the memory-erase behaviour is built, this page is replaced —
 * the Danger Zone row is not redesigned.
 */
export default async function PrivacyMemoryPage() {
  const t = await getTranslations("upcoming");
  return (
    <UpcomingScreen
      title={t("privacyMemory.title")}
      body={t("privacyMemory.body")}
      unlocks={t("privacyMemory.unlocks")}
      unlocksLabel={t("unlocksLabel")}
    />
  );
}
