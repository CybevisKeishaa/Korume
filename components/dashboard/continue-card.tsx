import { Link, useTranslations } from "@/lib/i18n";
import type { ContinueView } from "@/lib/data/dashboard/facts";
import { DashboardCard } from "./dashboard-card";

export function ContinueCard({ view, error = false }: { view: ContinueView; error?: boolean }) {
  const t = useTranslations("dashboard");
  const eyebrow = t(`continue.eyebrow.${view.kind}`);
  if (error) return <DashboardCard id="continue-learning" area="continue" eyebrow={eyebrow}><p>{t("card.error")}</p></DashboardCard>;
  if (view.kind === "onboarding") return <DashboardCard id="continue-learning" area="continue" eyebrow={eyebrow}><p>{t("continue.onboarding")}</p><Link href="/shadowing">{t("continue.cta.explore")}</Link></DashboardCard>;
  const placement = "placement" in view ? view.placement : null;
  const href = `/shadowing/${view.videoId}`;
  const primary = view.kind === "continue" ? t("continue.cta.continue") : view.kind === "startNext" ? t("continue.cta.start") : t("continue.cta.start");
  return <DashboardCard id="continue-learning" area="continue" eyebrow={eyebrow}>
    {placement && <p className="text-sm text-muted-foreground">{placement.title} · {t("continue.lessonOrdinal", { position: placement.position })}</p>}
    <p className="text-heading font-semibold">{view.title}</p>
    {view.kind === "continue" && view.tags.length > 0 && <ul>{view.tags.map((tag) => <li key={tag}>{tag}</li>)}</ul>}
    {view.kind === "continue" && view.percent !== null && <p>{t("continue.percent", { percent: Math.min(100, view.percent) })}</p>}
    {view.kind === "continue" && view.remainingMinutes !== null && <p>{t("continue.remaining", { minutes: view.remainingMinutes })}</p>}
    <div className="mt-md flex gap-sm"><Link href={href}>{primary}</Link>{view.kind === "continue" && <Link href={`${href}/summary`}>{t("continue.cta.review")}</Link>}</div>
  </DashboardCard>;
}
