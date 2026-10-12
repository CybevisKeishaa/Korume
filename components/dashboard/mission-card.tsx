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
    <h3 className="dash-display dash-title">{items.length === 3 ? t("mission.titleThree") : t("mission.titleSome")}</h3>
    <ul className="mt-[calc(20*var(--d))] space-y-[calc(14*var(--d))]">{items.map((item) => {
      const key = item.type === "finish_lesson" ? "finish" : item.type === "shadow_lines" ? "shadow" : item.type === "dictation_lines" ? "dictation" : "review";
      const label = t(`mission.item.${key}`, { target: item.target, title: item.title ?? "" });
      return <li key={item.type}>
        <div className="flex items-start justify-between gap-[calc(12*var(--d))] text-muted-foreground">
          <span className="flex min-w-0 items-start gap-[calc(8*var(--d))]"><span aria-hidden="true" className="dashboard-check mt-[0.3em]" data-done={item.current >= item.target || undefined} /><Link className="min-w-0 hover:text-foreground hover:underline" href={item.href}>{label}</Link></span>{" "}
          <span className="dash-soft shrink-0 tabular-nums">{item.current}/{item.target}</span>
        </div>
        {item.type === "finish_lesson" && item.playbackPercent !== null && <progress className="dashboard-progress mt-[calc(8*var(--d))]" aria-label={label} value={item.playbackPercent} max={100} />}
      </li>;
    })}</ul>
    <div className="dash-foot"><p className="dash-small flex flex-wrap justify-between gap-[calc(8*var(--d))] border-t border-border pt-[calc(16*var(--d))] text-muted-foreground"><span>{t("mission.reward")}</span><span className="dash-soft font-semibold">{rewarded ? t("mission.rewardEarned", { xp: DAILY_MISSION_XP }) : t("mission.rewardXp", { xp: DAILY_MISSION_XP })}</span></p></div>
  </DashboardCard>;
}
