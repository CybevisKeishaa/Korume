import type { Metadata } from "next";
import type { Locale } from "@/lib/i18n";
import { getTranslations } from "@/lib/i18n/server";
import { Container } from "@/components/ui/container";
import { ReadingDetail } from "@/components/reading/reading-detail";

export async function generateMetadata({
  params,
}: {
  params: { locale: Locale };
}): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: "reading" });
  return { title: t("page.title") };
}

export default function ReadingDetailPage({ params }: { params: { id: string } }) {
  return (
    <Container className="py-10">
      <ReadingDetail passageId={params.id} />
    </Container>
  );
}
