"use client";

import { Link, useTranslations } from "@/lib/i18n";
import { CompanionAnchor } from "@/components/companion/companion-anchor";
import type { DashboardCue } from "@/lib/companion/dashboard-cues";
import { DashboardCard } from "./dashboard-card";
import { buttonStyles } from "@/components/ui/button";
import { DashboardIcon } from "./dashboard-icon";
import type enDashboard from "@/messages/en/dashboard.json";

export function KorumeCard({ enabled, cue }: { enabled: boolean; cue: DashboardCue | null }) {
  const t = useTranslations("dashboard");
  const companion = useTranslations("companion");
  if (!enabled) return null;
  const values = cue ? { ...cue.values, skill: cue.values.skill === undefined ? undefined : t(`skills.${cue.values.skill as keyof typeof enDashboard.skills}`) } : {};
  return <DashboardCard id="korume" area="korume" eyebrow="Korume">
    {cue && <p className="dash-quote">“{companion(cue.key, values)}”</p>}
    <div className="mt-auto flex items-end justify-between gap-[calc(12*var(--d))] pt-[calc(20*var(--d))]">
      <div className="flex flex-wrap items-center gap-[calc(12*var(--d))]">{cue?.practiceHref && <Link className={buttonStyles({ className: "dash-btn dash-btn--sm" })} href={cue.practiceHref}>{t("korume.practice")}</Link>}{cue?.viewWeakness && <button className="dash-link" type="button" onClick={() => document.getElementById("weakness-snapshot")?.focus()}>{t("korume.viewWeakness")}<DashboardIcon name="chevron" /></button>}</div>
      {/* shrink-0: the art keeps its size; the actions wrap instead. */}
      <div className="shrink-0"><CompanionAnchor surface="dashboard" pose="sitting" size="lg" /></div>
    </div>
  </DashboardCard>;
}
