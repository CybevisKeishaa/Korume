"use client";

import { useTranslations } from "@/lib/i18n";
import type { ListeningExercise } from "@/lib/shadowing-workspace/learning-modes";
import { useLesson } from "../workspace-context";
import { PracticeStatsProvider, usePracticeStats } from "./practice-stats-context";

const EXERCISES: readonly ListeningExercise[] = ["dictation", "cloze"];

/** This lesson's progress in one exercise, from its own stats; nothing until a line is done (spec §3.0). */
function Progress() {
  const tl = useTranslations("shadowing.workspace.practice.listening");
  const { stats } = usePracticeStats();
  if (!stats || stats.scoredLines === 0) return null;
  return <span data-testid="listening-picker-progress" className="text-caption tabular-nums text-muted-foreground">
    {tl("picker.progress", { done: stats.scoredLines, total: stats.lineCount })}
  </span>;
}

/**
 * "Bạn muốn luyện nghe theo cách nào?" (spec §3.0): the practice column with no exercise chosen. The owner's copy,
 * in the workspace's card style; choosing a card only reports it, the caller replaces the URL.
 */
export function ListeningPicker({ onChoose }: { onChoose(exercise: ListeningExercise): void }) {
  const tl = useTranslations("shadowing.workspace.practice.listening");
  const { video } = useLesson();
  return (
    <section aria-label={tl("region")} className="flex h-full min-h-0 flex-col gap-md overflow-y-auto p-md">
      <h2 className="text-heading font-semibold text-foreground">{tl("picker.heading")}</h2>
      {EXERCISES.map((exercise) => (
        <button key={exercise} type="button" onClick={() => onChoose(exercise)}
          className="flex flex-col items-start gap-xs rounded-lg border border-border bg-card p-md text-left transition-colors hover:border-primary hover:bg-muted">
          <span className="text-body-lg font-semibold text-foreground">{tl(`format.${exercise}`)}</span>
          <span className="text-body text-muted-foreground">{tl(`picker.${exercise}.body`)}</span>
          <span className="rounded-full bg-accent/20 px-sm py-2xs text-caption font-semibold text-accent-strong">{tl(`picker.${exercise}.tag`)}</span>
          <PracticeStatsProvider videoId={video.id} mode={exercise}><Progress /></PracticeStatsProvider>
        </button>
      ))}
    </section>
  );
}
