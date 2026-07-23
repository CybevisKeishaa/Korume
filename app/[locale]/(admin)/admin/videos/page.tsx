import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { VideoQueue } from "@/components/admin/video-queue";
import { useTranslations, type Locale } from "@/lib/i18n";
import { getTranslations } from "@/lib/i18n/server";

export async function generateMetadata({
  params,
}: {
  params: { locale: Locale };
}): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: "admin" });
  return { title: t("meta.videos") };
}

export default function AdminVideosPage() {
  const t = useTranslations("admin");
  return (
    <Container className="max-w-none py-2">
      <h1 className="text-2xl font-bold">{t("videos.page.heading")}</h1>
      <p className="mt-1 text-muted-foreground">{t("videos.page.subtitle")}</p>
      <div className="mt-8">
        <VideoQueue />
      </div>
    </Container>
  );
}
