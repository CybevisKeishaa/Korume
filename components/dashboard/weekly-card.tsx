import { Link, useFormatter, useTranslations } from "@/lib/i18n";
import type { WeeklyFacts } from "@/lib/data/dashboard/facts";
import { WEEKLY_WINDOWS } from "@/lib/dashboard/weekly";
import { DashboardCard } from "./dashboard-card";
import { DashboardIcon } from "./dashboard-icon";

export function WeeklyCard({ fact, error = false }: { fact: WeeklyFacts; error?: boolean }) {
  const t = useTranslations("dashboard");
  const format = useFormatter();
  const points = (value: number) => t("weekly.stat.points", { value: `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value)}` });
  // Oldest window on the left, the current one (index 0) on the right, like the activity grid.
  const bars = [...(fact.bars.length === 0 ? Array.from({ length: WEEKLY_WINDOWS }, (_, index) => ({ index, unavailable: true as const })) : fact.bars)]
    .sort((left, right) => right.index - left.index);
  const allUnavailable = bars.every((bar) => "unavailable" in bar);
  // Heights are relative to the busiest window shown; a tracked zero is as tall as an untracked window, told apart by colour.
  const max = Math.max(1, ...bars.map((bar) => "seconds" in bar ? bar.seconds : 0));
  if (error) return <DashboardCard id="weekly-evolution" area="weekly" eyebrow={t("weekly.eyebrow")}><p>{t("card.error")}</p></DashboardCard>;
  const stats: { value: string; label: string }[] = [
    { value: `+${format.number(fact.vocabularyMastered)}`, label: t("weekly.stat.vocabulary", { count: fact.vocabularyMastered }) },
    ...fact.listeningDelta !== null ? [{ value: points(fact.listeningDelta), label: t("skills.listening") }] : [],
    ...fact.pronunciationDelta !== null ? [{ value: points(fact.pronunciationDelta), label: t("skills.pronunciation") }] : [],
    { value: t("weekly.stat.hours", { hours: fact.hoursW0 }), label: t("weekly.stat.studied") },
  ];
  return <DashboardCard id="weekly-evolution" area="weekly" eyebrow={t("weekly.eyebrow")} aside={<DashboardIcon name="trend" className="dash-icon dash-icon--lg" />}>
    <h3 className="dash-display dash-title">{t("weekly.title")}</h3>
    <div className="dashboard-bars mt-[calc(20*var(--d))]">{bars.map((bar) => "unavailable" in bar
      ? <span key={bar.index} role="img" className="block h-[calc(8*var(--d))] bg-muted opacity-50" data-state="unavailable" aria-label={t("weekly.notTracked")} />
      : <span key={bar.index} role="img" className={`block ${bar.seconds > 0 ? "bg-primary/70" : "h-[calc(8*var(--d))] bg-secondary"}`} data-state="tracked"
          aria-label={t("weekly.hours", { hours: Math.round(bar.seconds / 360) / 10 })} style={bar.seconds > 0 ? { height: `${Math.max(8, 100 * bar.seconds / max)}%` } : undefined} />)}
    </div>
    {allUnavailable
      ? <p className="dash-meta mt-[calc(20*var(--d))] text-muted-foreground">{fact.trackedSinceDate ? t("weekly.trackedFrom", { date: format.dateTime(new Date(`${fact.trackedSinceDate}T00:00:00Z`), { dateStyle: "medium", timeZone: "UTC" }) }) : t("weekly.notTracked")}</p>
      : <dl className="dashboard-stats dash-meta mt-[calc(20*var(--d))]">{stats.map((stat) => <div key={stat.label} className="flex flex-col">{/* Value above its label, as the frame reads; the term stays first for assistive tech. */}<dt className="order-2 text-muted-foreground">{stat.label}</dt><dd className="dash-soft font-bold tabular-nums">{stat.value}</dd></div>)}</dl>}
    <div className="dash-foot"><Link className="dash-link" href="/weekly-report">{t("weekly.report")}<DashboardIcon name="chevron" /></Link></div>
  </DashboardCard>;
}
