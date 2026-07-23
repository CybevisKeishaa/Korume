import type { Metadata } from "next";
import type { Locale } from "@/lib/i18n";
import { getTranslations } from "@/lib/i18n/server";
import { Container } from "@/components/ui/container";
import { ReadingList } from "@/components/reading/reading-list";

export async function generateMetadata({
  params,
}: {
  params: { locale: Locale };
}): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: "reading" });
  return { title: t("page.title") };
}

export default async function ReadingPage() {
  const t = await getTranslations("reading");
  return (
    <Container className="py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t("page.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("page.subtitle")}</p>
      </div>

      <ReadingList />
    </Container>
  );
}
