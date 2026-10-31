"use client";

import type { ReactNode } from "react";
import { useTranslations } from "@/lib/i18n";
import type { PracticeStatsMode } from "@/lib/shadowing-workspace/learning-modes";
import { videoRemainingSeconds } from "@/lib/shadowing-workspace/video-remaining";
import { useCurrentSentence, useLesson } from "../workspace-context";
import { usePracticeStats } from "./practice-stats-context";

const DASH = "—";
type Stat = "sentence" | "completed" | "accuracy" | "videoLeft";

/**
 * The practice column's lesson strip, in the Figma frame's bottom-bar look (WP spec §3.7): a thin position track, then
 * four stats from real data — the sentence, lines completed (submitted only), accuracy (mean of each line's latest
 * score) and the video time left from this sentence. The track's marker shows where the sentence sits, never a filled
 * bar, so it cannot read as completion. No lesson title (the header names it). Listening shows the URL's exercise
 * only, as a percentage (exercises are never averaged).
 */
export function LessonStatStrip({ mode }: { mode: PracticeStatsMode }) {
  const t = useTranslations("shadowing.workspace.practice.strip");
  const listening = mode !== "pronunciation";
  const { lines, video } = useLesson();
  const { index } = useCurrentSentence();
  const { stats } = usePracticeStats();
  const total = lines.length;
  const accuracy: ReactNode = stats?.mean == null
    ? <><span aria-hidden="true">{DASH}</span>{stats && <span className="sr-only">{t("noScore")}</span>}</>
    : `${Math.round(stats.mean)}${listening ? "%" : ""}`;
  const left = videoRemainingSeconds(lines, index, video.durationSeconds ?? null);
  const cells: { name: Stat; value: ReactNode }[] = [
    { name: "sentence", value: `${index === null ? DASH : index + 1}/${total}` },
    { name: "completed", value: stats ? `${stats.scoredLines}/${total}` : DASH },
    { name: "accuracy", value: accuracy },
    { name: "videoLeft", value: left === null ? DASH : left < 60 ? t("underMinute") : t("minutes", { count: Math.floor(left / 60) }) },
  ];
  return (
    <div data-testid="lesson-stat-strip" data-mode={mode} className="flex items-center gap-md rounded-lg border border-border bg-card px-md py-sm">
      {index !== null && total > 0 && (
        <div role="img" aria-label={t("position", { n: index + 1, total })} className="relative h-2xs min-w-0 flex-1 rounded-full bg-border">
          <span data-position-marker aria-hidden="true" style={{ left: `${total > 1 ? (100 * index) / (total - 1) : 0}%` }}
            className="absolute top-1/2 h-xs w-2xs -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary" />
        </div>
      )}
      <dl aria-label={t("label")} className="grid shrink-0 grid-cols-4 divide-x divide-border text-center">
        {cells.map(({ name, value }) => (
          <div key={name} data-stat={name} className="flex min-w-0 flex-col items-center gap-2xs px-sm">
            <dt className="whitespace-nowrap text-caption text-muted-foreground">{t(name)}</dt>
            <dd className="whitespace-nowrap text-body-lg font-semibold tabular-nums text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
