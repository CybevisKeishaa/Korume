import type { Metadata } from "next";
import type { Locale } from "@/lib/i18n";
import { AuthCard } from "@/components/auth/auth-card";
import { AuthSplitShell } from "@/components/auth/auth-split-shell";
import { AuthStory } from "@/components/auth/auth-story";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { getTranslations } from "@/lib/i18n/server";

export async function generateMetadata({
  params,
}: {
  params: { locale: Locale };
}): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: "auth" });
  return { title: t("forgotPassword.card.heading") };
}

export default async function ForgotPasswordPage() {
  const t = await getTranslations("auth");
  return (
    <AuthSplitShell
      story={
        <AuthStory
          eyebrow={t("forgotPassword.story.eyebrow")}
          heading={t("forgotPassword.story.heading")}
          body={t("forgotPassword.story.body")}
          quote={t("forgotPassword.story.quote")}
          quoteAttribution={t("forgotPassword.story.quoteAttribution")}
          pose="forgot-password"
        />
      }
    >
      <AuthCard
        eyebrow={t("forgotPassword.card.eyebrow")}
        heading={t("forgotPassword.card.heading")}
        subtitle={t("forgotPassword.card.subtitle")}
      >
        <ForgotPasswordForm />
      </AuthCard>
    </AuthSplitShell>
  );
}
