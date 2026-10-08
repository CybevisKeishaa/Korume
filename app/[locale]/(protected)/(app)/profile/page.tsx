import type { Metadata } from "next";
import type { Locale } from "@/lib/i18n";
import { redirect } from "@/lib/i18n/navigation";
import { getTranslations } from "@/lib/i18n/server";
import { getProfile } from "@/lib/data/profile";
import { ProfilePage } from "@/components/profile/profile-page";

export async function generateMetadata({ params }: { params: { locale: Locale } }): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: "profile" });
  return { title: t("page.title") };
}

export const dynamic = "force-dynamic";

export default async function ProfileRoute({ params }: { params: { locale: Locale } }) {
  const result = await getProfile();
  // The (app) layout already redirects signed-out users; this is defence in depth.
  if (!result.ok) redirect({ href: "/login", locale: params.locale });
  // `redirect` throws, but its type is not `never` here; narrow explicitly.
  if (!result.ok) return null;
  return <ProfilePage view={result.data} />;
}
