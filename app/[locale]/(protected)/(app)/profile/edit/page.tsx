import type { Metadata } from "next";
import type { Locale } from "@/lib/i18n";
import { redirect } from "@/lib/i18n/navigation";
import { getTranslations } from "@/lib/i18n/server";
import { getProfile } from "@/lib/data/profile";
import { EditProfile } from "@/components/profile/edit/edit-profile";

export async function generateMetadata({ params }: { params: { locale: Locale } }): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: "profile" });
  return { title: t("edit.formEyebrow") };
}

export const dynamic = "force-dynamic";

export default async function EditProfileRoute({ params }: { params: { locale: Locale } }) {
  // `view.identity` already carries the four preferences this form edits (dailyMinutes, subtitle, companionEnabled).
  const result = await getProfile();
  // The (app) layout already redirects signed-out users; this is defence in depth.
  if (!result.ok) redirect({ href: "/login", locale: params.locale });
  if (!result.ok) return null;
  return <EditProfile view={result.data} />;
}
