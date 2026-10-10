import { Link, useTranslations } from "@/lib/i18n";
import type { WeaknessFact } from "@/lib/data/dashboard/facts";
import { DashboardCard } from "./dashboard-card";

export function WeaknessCard({ rows, error = false }: { rows: WeaknessFact[]; error?: boolean }) {
  const t = useTranslations("dashboard");
  return <DashboardCard id="weakness-snapshot" area="weakness" eyebrow={t("weakness.eyebrow")} focusable>
    {error ? <p>{t("card.error")}</p> : rows.length === 0 ? <p>{t("weakness.empty")}</p> : <ul>{rows.map((row) => <li key={`${row.family}-${row.metric}`}>{row.practiceHref ? <Link href={row.practiceHref}>{t(`skills.${row.family}`)} · {t(`skills.${row.metric}`)}</Link> : <span>{t(`skills.${row.family}`)} · {t(`skills.${row.metric}`)}</span>} <span>{row.score}%</span></li>)}</ul>}
  </DashboardCard>;
}
