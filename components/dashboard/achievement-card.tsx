import { Link, useFormatter, useTranslations } from "@/lib/i18n";
import type { CSSProperties } from "react";
import type { AchievementBadge, AchievementSnapshot } from "@/lib/data/dashboard/achievements";
import { addDays } from "@/lib/time/study-day";
import { DashboardCard } from "./dashboard-card";
import { DashboardIcon } from "./dashboard-icon";
import { useBadgeCopy } from "@/components/learning/use-badge-copy";

export function AchievementCard({ snapshot, today, error = false }: { snapshot: AchievementSnapshot; today: string; error?: boolean }) {
  const t = useTranslations("dashboard");
  const format = useFormatter();
  const badgeCopy = useBadgeCopy();
  // `date` and `today` are both study dates, so they compare as plain strings; UTC keeps the printed day unshifted.
  const earned = (date: string) => date === today ? t("achievements.earnedToday") : date === addDays(today, -1) ? t("achievements.earnedYesterday")
    : t("achievements.earnedOn", { date: format.dateTime(new Date(`${date}T00:00:00Z`), { dateStyle: "medium", timeZone: "UTC" }) });
  if (error) return <DashboardCard id="recent-achievement" area="achievements" eyebrow={t("achievements.eyebrow")}><p>{t("card.error")}</p></DashboardCard>;
  // The badge's own line art, tinted by a mask; a badge without authored art falls back to the trophy.
  const icon = (iconUrl: string | null) => iconUrl
    ? <span aria-hidden="true" className="dashboard-badge-icon" style={{ "--badge": `url("${iconUrl}")` } as CSSProperties} />
    : <DashboardIcon name="trophy" className="dash-icon dash-icon--lg text-primary" />;
  const item = (badge: AchievementBadge, status: string) => <li key={badge.id}>{icon(badge.iconUrl)}<p className="mt-[calc(14*var(--d))] font-semibold">{badgeCopy.name(badge.name)}</p><p className="dash-small mt-[calc(4*var(--d))] text-muted-foreground">{status}</p></li>;
  return <DashboardCard id="recent-achievement" area="achievements" eyebrow={t("achievements.eyebrow")} aside={<Link className="dash-link" href="/profile#achievements">{t("achievements.viewAll")}<DashboardIcon name="chevron" /></Link>}>
    {snapshot.earned.length + snapshot.inProgress.length === 0 ? <p className="text-muted-foreground">{t("achievements.empty")}</p> : <ul className="dashboard-achievements">
      {snapshot.earned.map((badge) => item(badge, earned(badge.earnedOn)))}
      {snapshot.inProgress.map((badge) => item(badge, badge.progress.kind === "streak" ? t("achievements.streakProgress", badge.progress) : `${badge.progress.current}/${badge.progress.target}`))}
    </ul>}
  </DashboardCard>;
}
