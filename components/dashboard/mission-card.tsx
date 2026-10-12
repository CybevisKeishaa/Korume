import { Link, useTranslations } from "@/lib/i18n";
import { DAILY_MISSION_XP } from "@/lib/gamification/xp";
import type { CardState } from "./card-boundary";
import { DashboardCard } from "./dashboard-card";
import type { MissionView } from "@/lib/data/dashboard/mission";

export function MissionCard({ state }: { state: CardState<MissionView> }) {
  const t = useTranslations("dashboard");
  if (state.kind === "unavailable") return <DashboardCard id="today-mission" area="mission" eyebrow={t("mission.eyebrow")}><p>{t("mission.onboarding")}</p></DashboardCard>;
  if (state.kind === "error") return <DashboardCard id="today-mission" area="mission" eyebrow={t("mission.eyebrow")}><p>{t("mission.error")}</p></DashboardCard>;
  const { items, rewarded } = state.data;
  return <DashboardCard id="today-mission" area="mission" eyebrow={t("mission.eyebrow")}>
    <h3 className="text-heading font-semibold">{items.length === 3 ? t("mission.titleThree") : t("mission.titleSome")}</h3>
    <ul className="mt-sm divide-y divide-border">{items.map((item) => {
      const key = item.type === "finish_lesson" ? "finish" : item.type === "shadow_lines" ? "shadow" : item.type === "dictation_lines" ? "dictation" : "review";
      const label = t(`mission.item.${key}`, { target: item.target, title: item.title ?? "" });
      return <li className="py-sm" key={item.type}>
        <div className="flex items-start justify-between gap-sm text-sm"><Link className="min-w-0 hover:underline" href={item.href}>{label}</Link> <span className="shrink-0 tabular-nums text-primary-strong">{item.current}/{item.target}</span></div>
        {item.type === "finish_lesson" && item.playbackPercent !== null && <progress className="dashboard-progress mt-xs" aria-label={label} value={item.playbackPercent} max={100} />}
      </li>;
    })}</ul>
    <p className="mt-sm flex flex-wrap justify-between gap-xs border-t border-border pt-sm text-sm text-muted-foreground"><span>{t("mission.reward")}: </span><span className="text-primary-strong">{rewarded ? t("mission.rewardEarned", { xp: DAILY_MISSION_XP }) : t("mission.rewardXp", { xp: DAILY_MISSION_XP })}</span></p>
  </DashboardCard>;
}
