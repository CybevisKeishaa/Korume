"use client";

import { Link, useTranslations } from "@/lib/i18n";
import { CompanionAnchor } from "@/components/companion/companion-anchor";
import type { DashboardCue } from "@/lib/companion/dashboard-cues";
import { DashboardCard } from "./dashboard-card";

export function KorumeCard({ enabled, cue }: { enabled: boolean; cue: DashboardCue | null }) {
  const t = useTranslations("dashboard");
  const companion = useTranslations("companion");
  if (!enabled) return null;
  const skillLabel = (skill: string | undefined) => {
    switch (skill) {
      case "listening": return t("skills.listening");
      case "reading": return t("skills.reading");
      case "accuracy": return t("skills.accuracy");
      case "pitch": return t("skills.pitch");
      case "rhythm": return t("skills.rhythm");
      default: return skill;
    }
  };
  const values = cue ? { ...cue.values, skill: skillLabel(cue.values.skill) } : {};
  return <DashboardCard id="korume" area="korume" eyebrow="Korume"><CompanionAnchor surface="dashboard" pose="sitting" />{cue && <><p>{companion(cue.key, values)}</p>{cue.practiceHref && <Link href={cue.practiceHref}>{t("korume.practice")}</Link>}{cue.viewWeakness && <button type="button" onClick={() => document.getElementById("weakness-snapshot")?.focus()}>{t("korume.viewWeakness")}</button>}</>}</DashboardCard>;
}
