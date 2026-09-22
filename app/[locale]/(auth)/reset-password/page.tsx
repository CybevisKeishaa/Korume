import type { Metadata } from "next";
import type { Locale } from "@/lib/i18n";
import { AuthCard } from "@/components/auth/auth-card";
import { AuthSplitShell } from "@/components/auth/auth-split-shell";
import { AuthStory } from "@/components/auth/auth-story";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { Link } from "@/lib/i18n/navigation";
import { getTranslations } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({
  params,
}: {
  params: { locale: Locale };
}): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: "auth" });
  return { title: t("resetPassword.card.heading") };
}

export default async function ResetPasswordPage({
  params,
}: {
  params: { locale: Locale };
}) {
  const {
    data: { user },
  } = await createClient().auth.getUser();
  const t = await getTranslations("auth");
  return (
    <AuthSplitShell
      story={
        <AuthStory
          eyebrow={t("resetPassword.story.eyebrow")}
          heading={t("resetPassword.story.heading")}
          body={t("resetPassword.story.body")}
          quote={t("resetPassword.story.quote")}
          quoteAttribution={t("resetPassword.story.quoteAttribution")}
          pose="reset-password"
        />
      }
    >
      <AuthCard
        eyebrow={t("resetPassword.card.eyebrow")}
        heading={t("resetPassword.card.heading")}
        subtitle={t("resetPassword.card.subtitle")}
      >
        {user ? (
          <ResetPasswordForm />
        ) : (
          <div className="space-y-lg">
            <p role="alert" className="text-body text-danger-strong">
              {t("errors.resetExpired")}
            </p>
            <Link href="/forgot-password" className="block text-center text-body text-primary-strong hover:underline">
              {t("resetPassword.requestNewLink")}
            </Link>
          </div>
        )}
      </AuthCard>
    </AuthSplitShell>
  );
}
