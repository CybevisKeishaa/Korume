import { Link, useTranslations } from "@/lib/i18n";
import type { WeaknessFact } from "@/lib/data/dashboard/facts";
import { DashboardCard } from "./dashboard-card";
import type enDashboard from "@/messages/en/dashboard.json";

export function WeaknessCard({ rows, error = false }: { rows: WeaknessFact[]; error?: boolean }) {
  const t = useTranslations("dashboard");
  return <DashboardCard id="weakness-snapshot" area="weakness" eyebrow={t("weakness.eyebrow")} focusable>
    {error ? <p>{t("card.error")}</p> : rows.length === 0 ? <p>{t("weakness.empty")}</p> : <ul className="space-y-md">{rows.map((row) => {
      // Pronunciation names its weakest metric (as the Korume cue does); the other families are one metric each.
      const label = t(`skills.${(row.family === "pronunciation" ? row.metric : row.family) as keyof typeof enDashboard.skills}`);
      return <li key={`${row.family}-${row.metric}`}>
        <div className="mb-xs flex items-start justify-between gap-sm text-sm">{row.practiceHref ? <Link className="hover:underline" href={row.practiceHref}>{label}</Link> : <span>{label}</span>} <span className="shrink-0 font-medium tabular-nums">{row.score}%</span></div>
        <meter className="dashboard-meter" aria-label={label} value={row.score} min={0} max={100} />
      </li>;
    })}</ul>}
  </DashboardCard>;
}
