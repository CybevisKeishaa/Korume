import type { Metadata } from "next";
import type { Locale } from "@/lib/i18n";
import { AuthCard } from "@/components/auth/auth-card";
import { AuthSplitShell } from "@/components/auth/auth-split-shell";
import { AuthStory } from "@/components/auth/auth-story";
import { VerifyEmailForm } from "@/components/auth/verify-email-form";
import { getTranslations } from "@/lib/i18n/server";
import { redirect } from "@/lib/i18n/navigation";
import { emailOnlySchema } from "@/lib/validation/auth";

export async function generateMetadata({
  params,
}: {
  params: { locale: Locale };
}): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: "auth" });
  return { title: t("verify.card.heading") };
}

export default async function VerifyEmailPage({
  params,
  searchParams,
}: {
  params: { locale: Locale };
  searchParams: { email?: string; resend?: string };
}) {
  const parsed = emailOnlySchema.safeParse({ email: searchParams.email ?? "" });
  if (!parsed.success) redirect({ href: "/register", locale: params.locale });

  const t = await getTranslations("auth");
  return (
    <AuthSplitShell
      story={
        <AuthStory
          eyebrow={t("verify.story.eyebrow")}
          heading={t("verify.story.heading")}
          body={t("verify.story.body")}
          quote={t("verify.story.quote")}
          quoteAttribution={t("verify.story.quoteAttribution")}
          pose="verify-email"
        />
      }
    >
      <AuthCard
        eyebrow={t("verify.card.eyebrow")}
        heading={t("verify.card.heading")}
        subtitle={t("verify.card.subtitle")}
      >
        <VerifyEmailForm email={parsed.data.email} initialCooldown={searchParams.resend !== "1"} />
      </AuthCard>
    </AuthSplitShell>
  );
}
