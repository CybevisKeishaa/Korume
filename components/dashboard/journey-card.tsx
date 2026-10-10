import { useTranslations } from "@/lib/i18n";
import type { JourneyView } from "@/lib/dashboard/journey";
import { DashboardCard } from "./dashboard-card";

export function JourneyCard({ view, error = false }: { view: JourneyView; error?: boolean }) {
  const t = useTranslations("dashboard");
  if (error) return <DashboardCard id="learning-journey" area="journey" eyebrow={t("journey.eyebrow")}><p>{t("card.error")}</p></DashboardCard>;
  if (view.kind === "authoring") return <DashboardCard id="learning-journey" area="journey" eyebrow={t("journey.eyebrow")}><p>{t("journey.authoring")}</p></DashboardCard>;
  if (view.kind === "complete") return <DashboardCard id="learning-journey" area="journey" eyebrow={t("journey.eyebrow")}><p>{t("journey.complete")}</p></DashboardCard>;
  return <DashboardCard id="learning-journey" area="journey" eyebrow={t("journey.eyebrow")}><ul>{view.nodes.map((node) => <li key={node.level}>{node.level}{node.state !== "current" && ` · ${t(`journey.state.${node.state}`)}`}{node.percent !== null && ` ${node.percent}%`}</li>)}</ul>{view.next && <p>{t("journey.next")}: {view.next.title}</p>}<p>{t("journey.remaining", { count: view.remaining })}</p>{view.plus.total > 0 && <p>{t("journey.plus", { count: view.plus.total })}</p>}</DashboardCard>;
}
