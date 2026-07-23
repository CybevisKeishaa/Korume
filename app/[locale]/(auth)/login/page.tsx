import type { Metadata } from "next";
import type { Locale } from "@/lib/i18n";
import { AuthForm } from "@/components/auth/auth-form";
import { Container } from "@/components/ui/container";
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
  searchParams: { redirectTo?: string; checkEmail?: string };
}) {
  const t = await getTranslations("auth");
  return (
    <Container className="flex min-h-[80vh] max-w-md flex-col justify-center py-12">
      <h1 className="text-2xl font-bold">{t("login.heading")}</h1>
      <p className="mt-2 text-muted-foreground">{t("login.subtitle")}</p>
      {searchParams.checkEmail ? (
        <p className="mt-4 rounded-md bg-accent/10 px-3 py-2 text-sm text-foreground">
          {t("login.checkEmail")}
        </p>
      ) : null}
      <div className="mt-8">
        <AuthForm mode="login" redirectTo={searchParams.redirectTo} />
      </div>
    </Container>
  );
}
