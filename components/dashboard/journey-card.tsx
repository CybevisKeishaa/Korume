import { Link, useTranslations } from "@/lib/i18n";
import type { JourneyView } from "@/lib/dashboard/journey";
import { DashboardCard } from "./dashboard-card";
import { DashboardIcon } from "./dashboard-icon";

export function JourneyCard({ view, error = false }: { view: JourneyView; error?: boolean }) {
  const t = useTranslations("dashboard");
  if (error) return <DashboardCard id="learning-journey" area="journey" eyebrow={t("journey.eyebrow")}><p>{t("card.error")}</p></DashboardCard>;
  if (view.kind === "authoring") return <DashboardCard id="learning-journey" area="journey" eyebrow={t("journey.eyebrow")}><p>{t("journey.authoring")}</p></DashboardCard>;
  return <DashboardCard id="learning-journey" area="journey" eyebrow={t("journey.eyebrow")}>
    <ol className="dashboard-journey-nodes">{view.nodes.map((node) => <li key={node.level} data-state={node.state} aria-current={node.state === "current" ? "step" : undefined}>
      <span className="dashboard-journey-node">{node.level}</span>
      <span className={`dash-small mt-[calc(6*var(--d))] block ${node.state === "unavailable" ? "text-muted-foreground" : "dash-soft"}`}>{node.state !== "current" && t(`journey.state.${node.state}`)}{node.percent !== null && <span className="block tabular-nums">{node.percent}%</span>}</span>
    </li>)}</ol>
    {view.kind === "complete" ? <p className="mt-[calc(20*var(--d))]">{t("journey.complete")}</p> : <><div className="dashboard-milestone mt-[calc(20*var(--d))]">
      {view.next && <><p className="dash-small text-muted-foreground">{t("journey.next")}</p><p className="mt-[calc(4*var(--d))] font-semibold">{view.next.title}</p></>}
      <p className="dash-small mt-[calc(4*var(--d))] text-muted-foreground">{t("journey.remaining", { count: view.remaining })}</p>
      {view.plus.total > 0 && <p className="dash-small dash-soft">{t("journey.plus", { count: view.plus.total })}</p>}
    </div></>}
    <div className="dash-foot"><Link className="dash-link" href="/roadmap">{t("journey.viewRoadmap")}<DashboardIcon name="chevron" /></Link></div>
  </DashboardCard>;
}
