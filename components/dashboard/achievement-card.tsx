import { Link, useTranslations } from "@/lib/i18n";
import type { AchievementSnapshot } from "@/lib/data/dashboard/achievements";
import { addDays } from "@/lib/time/study-day";
import { DashboardCard } from "./dashboard-card";

export function AchievementCard({ snapshot, today, error = false }: { snapshot: AchievementSnapshot; today: string; error?: boolean }) {
  const t = useTranslations("dashboard");
  const earned = (date: string) => date.slice(0, 10) === today ? t("achievements.earnedToday") : date.slice(0, 10) === addDays(today, -1) ? t("achievements.earnedYesterday") : t("achievements.earnedOn", { date: date.slice(0, 10) });
  if (error) return <DashboardCard id="recent-achievement" area="achievements" eyebrow={t("achievements.eyebrow")}><p>{t("card.error")}</p></DashboardCard>;
  return <DashboardCard id="recent-achievement" area="achievements" eyebrow={t("achievements.eyebrow")}>{snapshot.earned.length + snapshot.inProgress.length === 0 ? <p>{t("achievements.empty")}</p> : <ul>{snapshot.earned.map((badge) => <li key={badge.id}>{badge.name} · {earned(badge.earnedAt)}</li>)}{snapshot.inProgress.map((badge) => <li key={badge.id}>{badge.name} · {badge.progress.kind === "streak" ? t("achievements.streakProgress", badge.progress) : `${badge.progress.current}/${badge.progress.target}`}</li>)}</ul>}<Link href="/profile#achievements">{t("achievements.viewAll")}</Link></DashboardCard>;
}
