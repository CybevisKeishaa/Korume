import type { Metadata } from "next";
import type { Locale } from "@/lib/i18n";
import { AuthCard } from "@/components/auth/auth-card";
import { RegisterForm } from "@/components/auth/register-form";
import { AuthSplitShell } from "@/components/auth/auth-split-shell";
import { AuthStory } from "@/components/auth/auth-story";
import { getTranslations } from "@/lib/i18n/server";

export async function generateMetadata({
  params,
}: {
  params: { locale: Locale };
}): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: "common" });
  return { title: t("auth.signUp") };
}

export default async function RegisterPage() {
  const t = await getTranslations("auth");
  return (
    <AuthSplitShell story={<AuthStory eyebrow={t("register.story.eyebrow")} heading={t("register.story.heading")} body={t("register.story.body")} quote={t("register.story.quote")} quoteAttribution={t("register.story.quoteAttribution")} pose="register" />}>
      <AuthCard eyebrow={t("register.card.eyebrow")} heading={t("register.heading")} subtitle={t("register.subtitle")}>
        <RegisterForm />
      </AuthCard>
    </AuthSplitShell>
  );
}
