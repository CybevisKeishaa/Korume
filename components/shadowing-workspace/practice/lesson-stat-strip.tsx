"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { useTranslations } from "@/lib/i18n";
import type { PracticeModeId } from "@/lib/shadowing-workspace/learning-modes";
import { useCurrentSentence, useLesson } from "../workspace-context";
import { usePracticeStats } from "./practice-stats-context";

export function LessonStatStrip({ mode }: { mode: Exclude<PracticeModeId, "shadowing"> }) {
  const t = useTranslations("shadowing");
  const { video, lines } = useLesson();
  const { index } = useCurrentSentence();
  const { stats } = usePracticeStats();
  const root = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setCompact(entry.contentRect.width < 420);
    });
    if (root.current) observer.observe(root.current);
    return () => observer.disconnect();
  }, []);

  const cells = [
    ...(stats && !compact ? [video.title] : []),
    t("workspace.practice.strip.sentence", { current: index === null ? "—" : index + 1, total: lines.length }),
    ...(stats ? [t("workspace.practice.strip.scored", { count: stats.scoredLines, total: lines.length })] : []),
    ...(stats && !compact ? [stats.mean === null ? t("workspace.practice.strip.noScore") : t("workspace.practice.strip.average", { value: Math.round(stats.mean) })] : []),
  ];
  return (
    <div ref={root} data-testid="lesson-stat-strip" data-mode={mode} data-compact={compact ? "" : undefined} className="flex flex-wrap items-center justify-center gap-x-xs gap-y-2xs rounded-lg border border-border bg-card px-md py-sm text-body text-foreground">
      {cells.map((cell, position) => <Fragment key={position}>{position > 0 && <span aria-hidden="true"> · </span>}<span>{cell}</span></Fragment>)}
    </div>
  );
}
