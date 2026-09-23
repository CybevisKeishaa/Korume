import type { Metadata } from "next";
import type { Locale } from "@/lib/i18n";
import { getTranslations } from "@/lib/i18n/server";
import { getModelTrainingConsent } from "@/lib/data/model-training-consent";
import { readPendingDeletionSafe } from "@/lib/data/account-deletion";
import { PrivacyScreen } from "@/components/settings/privacy-screen";

export async function generateMetadata({
  params,
}: {
  params: { locale: Locale };
}): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: "settings" });
  return { title: t("privacy.title") };
}

// No translator lives here — the only server-side work is the consent and
// pending-deletion reads, not a chrome string; every string on the page is
// inside PrivacyScreen (a client component with its own translator).
// `getModelTrainingConsent` reads the DB directly (fix round 1, 2026-08-21):
// Task 7 shipped no `GET` route, and this page doesn't need a round trip to
// reach its own database. It already fails closed internally, so no
// try/catch is needed here for it specifically.
export default async function PrivacyPage() {
  const [{ consent }, pending] = await Promise.all([getModelTrainingConsent(), readPendingDeletionSafe()]);
  return <PrivacyScreen initialAiTrainingConsent={consent} pending={pending} />;
}
