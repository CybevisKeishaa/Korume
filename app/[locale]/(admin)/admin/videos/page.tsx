import { Container } from "@/components/ui/container";
import { VideoQueue } from "@/components/admin/video-queue";
import { useTranslations } from "@/lib/i18n";

export const metadata = { title: "Admin — Video Queue" };

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
