import { useTranslations } from "@/lib/i18n";
import type { JourneyView } from "@/lib/dashboard/journey";
import { DashboardCard } from "./dashboard-card";

export function JourneyCard({ view, error = false }: { view: JourneyView; error?: boolean }) {
  const t = useTranslations("dashboard");
  if (error) return <DashboardCard id="learning-journey" area="journey" eyebrow={t("journey.eyebrow")}><p>{t("card.error")}</p></DashboardCard>;
  if (view.kind === "authoring") return <DashboardCard id="learning-journey" area="journey" eyebrow={t("journey.eyebrow")}><p>{t("journey.authoring")}</p></DashboardCard>;
  return <DashboardCard id="learning-journey" area="journey" eyebrow={t("journey.eyebrow")}>
    <ol className="dashboard-journey-nodes">{view.nodes.map((node) => <li key={node.level} data-state={node.state} aria-current={node.state === "current" ? "step" : undefined}>
      <span className="dashboard-journey-node">{node.level}</span>
      <span className="mt-xs block text-xs text-muted-foreground">{node.state !== "current" && t(`journey.state.${node.state}`)}{node.percent !== null && <span className="block tabular-nums">{node.percent}%</span>}</span>
    </li>)}</ol>
    {view.kind === "complete" ? <p className="mt-md">{t("journey.complete")}</p> : <><div className="mt-md rounded-lg bg-muted p-md">
      {view.next && <><p className="text-xs text-muted-foreground">{t("journey.next")}</p><p className="mt-xs text-body font-medium">{view.next.title}</p></>}
      <p className="mt-xs text-sm text-muted-foreground">{t("journey.remaining", { count: view.remaining })}</p>
    </div>
    {view.plus.total > 0 && <p className="mt-sm text-sm text-primary-strong">{t("journey.plus", { count: view.plus.total })}</p>}</>}
  </DashboardCard>;
}
