"use client";

import { Link, useTranslations } from "@/lib/i18n";
import { CompanionAnchor } from "@/components/companion/companion-anchor";
import type { DashboardCue } from "@/lib/companion/dashboard-cues";
import { DashboardCard } from "./dashboard-card";
import { buttonStyles } from "@/components/ui/button";
import type enDashboard from "@/messages/en/dashboard.json";

export function KorumeCard({ enabled, cue }: { enabled: boolean; cue: DashboardCue | null }) {
  const t = useTranslations("dashboard");
  const companion = useTranslations("companion");
  if (!enabled) return null;
  const values = cue ? { ...cue.values, skill: cue.values.skill === undefined ? undefined : t(`skills.${cue.values.skill as keyof typeof enDashboard.skills}`) } : {};
  return <DashboardCard id="korume" area="korume" eyebrow="Korume"><CompanionAnchor surface="dashboard" pose="sitting" />{cue && <><p className="mt-sm text-body">{companion(cue.key, values)}</p><div className="mt-md flex flex-wrap gap-sm">{cue.practiceHref && <Link className={buttonStyles({ className: "rounded-full" })} href={cue.practiceHref}>{t("korume.practice")}</Link>}{cue.viewWeakness && <button className={buttonStyles({ variant: "ghost", className: "rounded-full" })} type="button" onClick={() => document.getElementById("weakness-snapshot")?.focus()}>{t("korume.viewWeakness")}</button>}</div></>}</DashboardCard>;
}
