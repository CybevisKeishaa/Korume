import { Container } from "@/components/ui/container";
import { ContentTypeCards } from "@/components/admin/content-type-cards";
import { useTranslations } from "@/lib/i18n";

export const metadata = { title: "Admin — Content" };

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
