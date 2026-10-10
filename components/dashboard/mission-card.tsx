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
    <h3>{items.length === 3 ? t("mission.titleThree") : t("mission.titleSome")}</h3>
    <ul>{items.map((item) => {
      const key = item.type === "finish_lesson" ? "finish" : item.type === "shadow_lines" ? "shadow" : item.type === "dictation_lines" ? "dictation" : "review";
      const label = t(`mission.item.${key}`, { target: item.target, title: item.title ?? "" });
      return <li key={item.type}><Link href={item.href}>{label}</Link> <span>{item.current}/{item.target}</span>{item.type === "finish_lesson" && item.playbackPercent !== null && <progress aria-label={label} value={item.playbackPercent} max={100} />}</li>;
    })}</ul>
    <p>{t("mission.reward")}: {rewarded ? t("mission.rewardEarned", { xp: DAILY_MISSION_XP }) : t("mission.rewardXp", { xp: DAILY_MISSION_XP })}</p>
  </DashboardCard>;
}
