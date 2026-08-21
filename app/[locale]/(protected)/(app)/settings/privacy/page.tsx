import type { Metadata } from "next";
import type { Locale } from "@/lib/i18n";
import { getTranslations } from "@/lib/i18n/server";
import { getModelTrainingConsent } from "@/lib/data/model-training-consent";
import { getPendingDeletion, type PendingDeletion } from "@/lib/data/account-deletion";
import { PrivacyScreen } from "@/components/settings/privacy-screen";

export async function generateMetadata({
  params,
}: {
  params: { locale: Locale };
}): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: "settings" });
  return { title: t("privacy.title") };
}

/**
 * Unlike `getModelTrainingConsent`, `getPendingDeletion` (lib/data/account-
 * deletion.ts) rethrows unexpected DB errors rather than failing closed
 * internally — the API route it also backs needs that so it can return a
 * proper 500. This page is not that route: the pending-deletion banner is
 * ancillary to the rest of `/settings/privacy` (the AI-training toggle and
 * Danger Zone are the primary content), so a transient failure reading it
 * must not take down the whole page, the same reasoning
 * `getModelTrainingConsent`'s own comment gives for its toggle default. The
 * 401 branch is defence in depth only — the `(protected)` layout already
 * redirects an unauthenticated request before this page renders.
 */
async function readPendingDeletion(): Promise<PendingDeletion | null> {
  try {
    const result = await getPendingDeletion();
    return result.ok ? result.data : null;
  } catch (error) {
    // eslint-disable-next-line no-console -- server-side only; a failed read
    // must not crash the page and must never be mistaken for "no request".
    console.error("[settings/privacy] getPendingDeletion failed:", error);
    return null;
  }
}

// No translator lives here — the only server-side work is the consent and
// pending-deletion reads, not a chrome string; every string on the page is
// inside PrivacyScreen (a client component with its own translator).
// `getModelTrainingConsent` reads the DB directly (fix round 1, 2026-08-21):
// Task 7 shipped no `GET` route, and this page doesn't need a round trip to
// reach its own database. It already fails closed internally, so no
// try/catch is needed here for it specifically.
export default async function PrivacyPage() {
  const [{ consent }, pending] = await Promise.all([getModelTrainingConsent(), readPendingDeletion()]);
  return <PrivacyScreen initialAiTrainingConsent={consent} pending={pending} />;
}
