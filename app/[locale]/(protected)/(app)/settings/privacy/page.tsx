import type { Metadata } from "next";
import type { Locale } from "@/lib/i18n";
import { getTranslations } from "@/lib/i18n/server";
import { getModelTrainingConsent } from "@/lib/data/model-training-consent";
import { getPendingDeletion, type PendingDeletionRead } from "@/lib/data/account-deletion";
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
 * `getModelTrainingConsent`'s own comment gives for its toggle default.
 *
 * Fix round 1, Important #3(b): a failed read returns the explicit
 * `"unknown"` sentinel, NOT `null` — `null` is indistinguishable from
 * "genuinely no pending request" to every consumer (`PrivacyScreen`,
 * `DangerZone`), and during the 7-day cancellation window collapsing a
 * failure to "no request" is the dangerous direction to be wrong in.
 * `PrivacyScreen` shows a neutral "couldn't check" notice on `"unknown"` and
 * leaves the Danger Zone enabled — a transient read failure must not lock a
 * user out of the GDPR right this page exists to serve; a POST from that
 * state re-syncs correctly if a request actually exists (the 409 branch
 * calls `refreshPending()`). The 401 branch below is folded into the same
 * `"unknown"` outcome — it is defence in depth only, since the `(protected)`
 * layout already redirects an unauthenticated request before this page
 * renders, so there is no separate "confidently no request" case to carve
 * out for it.
 */
async function readPendingDeletion(): Promise<PendingDeletionRead> {
  try {
    const result = await getPendingDeletion();
    return result.ok ? result.data : "unknown";
  } catch (error) {
    // eslint-disable-next-line no-console -- server-side only; a failed read
    // must not crash the page and must never be mistaken for "no request".
    console.error("[settings/privacy] getPendingDeletion failed:", error);
    return "unknown";
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
