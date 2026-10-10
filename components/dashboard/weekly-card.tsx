import { useTranslations } from "@/lib/i18n";
import type { WeeklyFacts } from "@/lib/data/dashboard/facts";
import { WEEKLY_WINDOWS } from "@/lib/dashboard/weekly";
import { DashboardCard } from "./dashboard-card";

export function WeeklyCard({ fact, error = false }: { fact: WeeklyFacts; error?: boolean }) {
  const t = useTranslations("dashboard");
  const points = (value: number) => t("weekly.points", { value: `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value)}` });
  const bars = fact.bars.length === 0 ? Array.from({ length: WEEKLY_WINDOWS }, (_, index) => ({ index, unavailable: true as const })) : fact.bars;
  const allUnavailable = bars.every((bar) => "unavailable" in bar);
  if (error) return <DashboardCard id="weekly-evolution" area="weekly" eyebrow={t("weekly.eyebrow")}><p>{t("card.error")}</p></DashboardCard>;
  return <DashboardCard id="weekly-evolution" area="weekly" eyebrow={t("weekly.eyebrow")}>
    <h3>{t("weekly.title")}</h3><div className="flex h-16 items-end gap-1">{bars.map((bar) => "unavailable" in bar ? <span key={bar.index} className="block h-2 flex-1 rounded-sm bg-muted opacity-50" data-state="unavailable" aria-label={t("weekly.notTracked")} /> : <span key={bar.index} className="block min-h-2 flex-1 rounded-sm bg-primary" data-state="tracked" style={{ height: `${Math.min(100, Math.max(8, bar.seconds / 360))}%` }}>{Math.round(bar.seconds / 3600)}</span>)}</div>
    {allUnavailable ? <p>{fact.trackedSinceDate ? t("weekly.trackedFrom", { date: fact.trackedSinceDate }) : t("weekly.notTracked")}</p> : <><p>{t("weekly.vocabulary", { count: fact.vocabularyMastered })}</p><p>{t("weekly.hours", { hours: fact.hoursW0 })}</p>{fact.listeningDelta !== null && <p>{points(fact.listeningDelta)}</p>}{fact.pronunciationDelta !== null && <p>{points(fact.pronunciationDelta)}</p>}</>}
  </DashboardCard>;
}
