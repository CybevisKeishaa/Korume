import { Container } from "@/components/ui/container";
import { StatsDashboard } from "@/components/admin/stats-dashboard";
import { useTranslations } from "@/lib/i18n";

export const metadata = { title: "Admin — Dashboard" };

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
