import type { Metadata } from "next";
import type { Locale } from "@/lib/i18n";
import { getTranslations } from "@/lib/i18n/server";
import { getModelTrainingConsent } from "@/lib/data/model-training-consent";
import { readPendingDeletionSafe } from "@/lib/data/account-deletion";
import { SettingsPage } from "@/components/settings/settings-page";
import { version } from "@/package.json";

export async function generateMetadata({
  params,
}: {
  params: { locale: Locale };
}): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: "settings" });
  return { title: t("page.title") };
}

/**
 * Figma Global settings `220:16032`.
 *
 * Only two server reads happen here. The preferences themselves are NOT among
 * them: `PreferencesProvider` in the `(protected)` layout already holds them
 * for the whole session, and reading them again would hand the page a second
 * copy that the save hook's optimistic updates would immediately contradict.
 *
 * `version` is imported from `package.json` rather than read at runtime — it
 * is a build-time constant, so `fs` at request time would be work done on
 * every load to learn something the bundle already knows.
 */
export default async function SettingsRoute() {
  const [{ consent }, pending] = await Promise.all([
    getModelTrainingConsent(),
    readPendingDeletionSafe(),
  ]);

  return (
    <SettingsPage initialAiTrainingConsent={consent} pending={pending} version={version} />
  );
}
