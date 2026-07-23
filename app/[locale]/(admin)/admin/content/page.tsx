import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { ContentTypeCards } from "@/components/admin/content-type-cards";
import { useTranslations, type Locale } from "@/lib/i18n";
import { getTranslations } from "@/lib/i18n/server";

export async function generateMetadata({
  params,
}: {
  params: { locale: Locale };
}): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: "admin" });
  return { title: t("meta.content") };
}

export default function AdminContentLandingPage() {
  const t = useTranslations("admin");
  return (
    <Container className="max-w-none py-2">
      <h1 className="text-2xl font-bold">{t("content.landing.heading")}</h1>
      <p className="mt-1 text-muted-foreground">{t("content.landing.subtitle")}</p>
      <div className="mt-8">
        <ContentTypeCards />
      </div>
    </Container>
  );
}
