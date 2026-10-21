"use client";

import type { ReactNode } from "react";
import { useTranslations } from "@/lib/i18n";
import type { PracticeStatsMode } from "@/lib/shadowing-workspace/learning-modes";
import { useCurrentSentence, useLesson } from "../workspace-context";
import { usePracticeStats } from "./practice-stats-context";

const DASH = "—";

/**
 * The practice column's lesson strip: three labelled stats, no lesson title (the header already names the lesson;
 * owner 2026-10-19). Short enough to stay on one row at the narrowest column, so there is no compact variant.
 * Listening shows its active format only, labelled, as a percentage (spec §3.5: formats are never averaged).
 */
export function LessonStatStrip({ mode }: { mode: PracticeStatsMode }) {
  const t = useTranslations("shadowing.workspace.practice.strip");
  const tListening = useTranslations("shadowing.workspace.practice.listening");
  const listening = mode !== "pronunciation";
  const { lines } = useLesson();
  const { index } = useCurrentSentence();
  const { stats } = usePracticeStats();
  const total = lines.length;
  const average: ReactNode = stats?.mean == null
    ? <><span aria-hidden="true">{DASH}</span>{stats && <span className="sr-only">{t("noScore")}</span>}</>
    : `${Math.round(stats.mean)}${listening ? "%" : ""}`;
  const cells: { name: "sentence" | "scored" | "average"; label: string; value: ReactNode }[] = [
    { name: "sentence", label: t("sentence"), value: `${index === null ? DASH : index + 1}/${total}` },
    { name: "scored", label: listening ? tListening("strip.submitted", { format: tListening(`format.${mode}`) }) : t("scored"), value: stats ? `${stats.scoredLines}/${total}` : DASH },
    { name: "average", label: t("average"), value: average },
  ];
  return (
    <dl aria-label={t("label")} data-testid="lesson-stat-strip" data-mode={mode}
      className="grid grid-cols-3 divide-x divide-border rounded-lg border border-border bg-card py-sm text-center">
      {cells.map(({ name, label, value }) => (
        <div key={name} data-stat={name} className="flex min-w-0 flex-col items-center gap-2xs px-sm">
          <dt className="text-caption text-muted-foreground">{label}</dt>
          <dd className="text-body-lg font-semibold tabular-nums text-foreground">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
