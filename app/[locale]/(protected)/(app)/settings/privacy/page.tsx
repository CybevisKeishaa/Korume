import type { Metadata } from "next";
import type { Locale } from "@/lib/i18n";
import { getTranslations } from "@/lib/i18n/server";
import { PrivacyScreen } from "@/components/settings/privacy-screen";

export async function generateMetadata({
  params,
}: {
  params: { locale: Locale };
}): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: "settings" });
  return { title: t("privacy.title") };
}

// No chrome strings live here — every string on the page is inside
// PrivacyScreen (a client component with its own translator), so this stays
// a thin, synchronous pass-through rather than an async function wired to a
// translator it would never call.
export default function PrivacyPage() {
  return <PrivacyScreen />;
}
