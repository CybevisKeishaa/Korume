import type { Metadata } from "next";
import { Container } from "@/components/ui/container";
import { StatsDashboard } from "@/components/admin/stats-dashboard";
import { useTranslations, type Locale } from "@/lib/i18n";
import { getTranslations } from "@/lib/i18n/server";

export async function generateMetadata({
  params,
}: {
  params: { locale: Locale };
}): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: "admin" });
  return { title: t("meta.dashboard") };
}

export default function AdminDashboardPage() {
  const t = useTranslations("admin");
  return (
    <Container className="max-w-none py-2">
      <h1 className="text-2xl font-bold">{t("dashboard.heading")}</h1>
      <p className="mt-1 text-muted-foreground">{t("dashboard.subtitle")}</p>
      <div className="mt-8">
        <StatsDashboard />
      </div>
    </Container>
  );
}
