import { useFormatter, useTranslations } from "@/lib/i18n";
import type { WeeklyFacts } from "@/lib/data/dashboard/facts";
import { WEEKLY_WINDOWS } from "@/lib/dashboard/weekly";
import { DashboardCard } from "./dashboard-card";

export function WeeklyCard({ fact, error = false }: { fact: WeeklyFacts; error?: boolean }) {
  const t = useTranslations("dashboard");
  const format = useFormatter();
  const points = (value: number) => t("weekly.points", { value: `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value)}` });
  // Oldest window on the left, the current one (index 0) on the right, like the activity grid.
  const bars = [...(fact.bars.length === 0 ? Array.from({ length: WEEKLY_WINDOWS }, (_, index) => ({ index, unavailable: true as const })) : fact.bars)]
    .sort((left, right) => right.index - left.index);
  const allUnavailable = bars.every((bar) => "unavailable" in bar);
  // Heights are relative to the busiest window shown; a tracked zero is as tall as an untracked window, told apart by colour.
  const max = Math.max(1, ...bars.map((bar) => "seconds" in bar ? bar.seconds : 0));
  if (error) return <DashboardCard id="weekly-evolution" area="weekly" eyebrow={t("weekly.eyebrow")}><p>{t("card.error")}</p></DashboardCard>;
  return <DashboardCard id="weekly-evolution" area="weekly" eyebrow={t("weekly.eyebrow")}>
    <h3 className="text-heading font-semibold">{t("weekly.title")}</h3>
    <div className="mt-md flex h-16 items-end gap-1">{bars.map((bar) => "unavailable" in bar
      ? <span key={bar.index} role="img" className="block h-2 flex-1 rounded-sm bg-muted opacity-50" data-state="unavailable" aria-label={t("weekly.notTracked")} />
      : <span key={bar.index} role="img" className={`block flex-1 rounded-sm ${bar.seconds > 0 ? "bg-primary" : "h-2 bg-secondary"}`} data-state="tracked"
          aria-label={t("weekly.hours", { hours: Math.round(bar.seconds / 360) / 10 })} style={bar.seconds > 0 ? { height: `${Math.max(8, 100 * bar.seconds / max)}%` } : undefined} />)}
    </div>
    {allUnavailable
      ? <p className="mt-md text-sm text-muted-foreground">{fact.trackedSinceDate ? t("weekly.trackedFrom", { date: format.dateTime(new Date(`${fact.trackedSinceDate}T00:00:00Z`), { dateStyle: "medium", timeZone: "UTC" }) }) : t("weekly.notTracked")}</p>
      : <div className="mt-md grid grid-cols-2 gap-sm text-sm"><p>{t("weekly.vocabulary", { count: fact.vocabularyMastered })}</p><p>{t("weekly.hours", { hours: fact.hoursW0 })}</p>{fact.listeningDelta !== null && <p><span>{t("skills.listening")}</span>{" "}<span>{points(fact.listeningDelta)}</span></p>}{fact.pronunciationDelta !== null && <p><span>{t("skills.pronunciation")}</span>{" "}<span>{points(fact.pronunciationDelta)}</span></p>}</div>}
  </DashboardCard>;
}
