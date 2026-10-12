import { Link, useTranslations } from "@/lib/i18n";
import type { WeaknessFact } from "@/lib/data/dashboard/facts";
import { DashboardCard } from "./dashboard-card";
import { DashboardIcon, type DashboardIconKey } from "./dashboard-icon";
import type enDashboard from "@/messages/en/dashboard.json";

const FAMILY_ICON: Record<WeaknessFact["family"], DashboardIconKey> = { listening: "headphones", reading: "book", pronunciation: "volume" };

export function WeaknessCard({ rows, error = false }: { rows: WeaknessFact[]; error?: boolean }) {
  const t = useTranslations("dashboard");
  return <DashboardCard id="weakness-snapshot" area="weakness" eyebrow={t("weakness.eyebrow")} focusable>
    {error ? <p>{t("card.error")}</p> : rows.length === 0 ? <p className="text-muted-foreground">{t("weakness.empty")}</p> : <ul className="space-y-[calc(16*var(--d))]">{rows.map((row) => {
      // Pronunciation names its weakest metric (as the Korume cue does); the other families are one metric each.
      const label = t(`skills.${(row.family === "pronunciation" ? row.metric : row.family) as keyof typeof enDashboard.skills}`);
      return <li key={`${row.family}-${row.metric}`}>
        <div className="dash-meta mb-[calc(8*var(--d))] flex items-center justify-between gap-[calc(12*var(--d))]">
          <span className="flex min-w-0 items-center gap-[calc(8*var(--d))] text-muted-foreground"><DashboardIcon name={FAMILY_ICON[row.family]} className="dash-icon dash-icon--sm text-primary" />{row.practiceHref ? <Link className="hover:text-foreground hover:underline" href={row.practiceHref}>{label}</Link> : <span>{label}</span>}</span>
          <span className="shrink-0 font-bold tabular-nums">{row.score}%</span>
        </div>
        <meter className="dashboard-meter" aria-label={label} value={row.score} min={0} max={100} />
      </li>;
    })}</ul>}
    <div className="dash-foot"><Link className="dash-link" href="/roadmap">{t("weakness.explore")}<DashboardIcon name="chevron" /></Link></div>
  </DashboardCard>;
}
