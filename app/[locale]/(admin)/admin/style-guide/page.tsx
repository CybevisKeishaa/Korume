import type { Metadata } from "next";
import type { Locale } from "@/lib/i18n";
import { getTranslations } from "@/lib/i18n/server";
import { StyleGuide } from "@/components/style-guide/style-guide";

// The style-guide tab title is identical to its page heading, so it reuses
// `styleGuide.heading` rather than adding a parallel `meta.*` key (unlike the
// other admin pages, whose "Admin — " prefixed tab genuinely differs).
export async function generateMetadata({
  params,
}: {
  params: { locale: Locale };
}): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: "admin" });
  return { title: t("styleGuide.heading") };
}

/**
 * D9 gate: this route lives under the (admin) group, whose layout enforces
 * requireAdmin() server-side (dev reaches it via the ADMIN_EMAILS bootstrap
 * admin). Dev/admin-only by construction — no extra gate logic.
 */
export default function StyleGuidePage() {
  return <StyleGuide />;
}
