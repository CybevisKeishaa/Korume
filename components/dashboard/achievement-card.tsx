import { Link, useFormatter, useTranslations } from "@/lib/i18n";
import type { AchievementSnapshot } from "@/lib/data/dashboard/achievements";
import { addDays } from "@/lib/time/study-day";
import { DashboardCard } from "./dashboard-card";
import { useBadgeCopy } from "@/components/learning/use-badge-copy";

export function AchievementCard({ snapshot, today, error = false }: { snapshot: AchievementSnapshot; today: string; error?: boolean }) {
  const t = useTranslations("dashboard");
  const format = useFormatter();
  const badgeCopy = useBadgeCopy();
  // `date` and `today` are both study dates, so they compare as plain strings; UTC keeps the printed day unshifted.
  const earned = (date: string) => date === today ? t("achievements.earnedToday") : date === addDays(today, -1) ? t("achievements.earnedYesterday")
    : t("achievements.earnedOn", { date: format.dateTime(new Date(`${date}T00:00:00Z`), { dateStyle: "medium", timeZone: "UTC" }) });
  if (error) return <DashboardCard id="recent-achievement" area="achievements" eyebrow={t("achievements.eyebrow")}><p>{t("card.error")}</p></DashboardCard>;
  const item = (id: string, name: string, status: string) => <li key={id}><p className="font-medium">{badgeCopy.name(name)}</p><p className="mt-2xs text-xs text-muted-foreground">{status}</p></li>;
  return <DashboardCard id="recent-achievement" area="achievements" eyebrow={t("achievements.eyebrow")}>
    {snapshot.earned.length + snapshot.inProgress.length === 0 ? <p>{t("achievements.empty")}</p> : <ul className="dashboard-achievements text-sm">
      {snapshot.earned.map((badge) => item(badge.id, badge.name, earned(badge.earnedOn)))}
      {snapshot.inProgress.map((badge) => item(badge.id, badge.name, badge.progress.kind === "streak" ? t("achievements.streakProgress", badge.progress) : `${badge.progress.current}/${badge.progress.target}`))}
    </ul>}
    <Link className="mt-md inline-block text-sm text-primary-strong hover:underline" href="/profile#achievements">{t("achievements.viewAll")}</Link>
  </DashboardCard>;
}
