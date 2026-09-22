import type { Metadata } from "next";
import type { Locale } from "@/lib/i18n";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";
import { AuthSplitShell } from "@/components/auth/auth-split-shell";
import { AuthStory } from "@/components/auth/auth-story";
import { getTranslations } from "@/lib/i18n/server";

export async function generateMetadata({
  params,
}: {
  params: { locale: Locale };
}): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: "common" });
  return { title: t("auth.signIn") };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { redirectTo?: string };
}) {
  const t = await getTranslations("auth");
  return (
    <AuthSplitShell
      story={
        <AuthStory
          eyebrow={t("login.story.eyebrow")}
          heading={t("login.story.heading")}
          body={t("login.story.body")}
          quote={t("login.story.quote")}
          quoteAttribution={t("login.story.quoteAttribution")}
          pose="login"
        />
      }
    >
      <AuthCard
        eyebrow={t("login.card.eyebrow")}
        heading={t("login.heading")}
        subtitle={t("login.subtitle")}
      >
        <LoginForm redirectTo={searchParams.redirectTo} />
      </AuthCard>
    </AuthSplitShell>
  );
}
