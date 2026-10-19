"use client";

import { useId, useState } from "react";
import { useTranslations } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { alignWords } from "@/lib/pronunciation/align-words";
import type { Assessment } from "@/lib/pronunciation/assessment";
import { GRADE_TEXT, scoreGrade, wordGrade, type Grade } from "@/lib/pronunciation/grade";
import { PlayGlyph } from "../player-glyphs";

/** A fresh result or a scored history item; a stored row may lack any of the three. */
type Result = { pronunciationScore: number | null; rhythmScore: number | null; assessment: Assessment | null };

/** Below this Azure reports that much of the sentence was not read, i.e. the learner read something else. */
const MISMATCH_COMPLETENESS_BELOW = 50;
const LABEL: Record<Grade, "keepPractising" | "good" | "excellent"> = { needsWork: "keepPractising", good: "good", strong: "excellent" };
const CHIP: Record<Grade | "none", string> = {
  needsWork: "border-danger/40 bg-danger/10",
  good: "border-accent/40 bg-accent/10",
  strong: "border-success/40 bg-success/10",
  none: "border-border bg-muted",
};
const CARD = "rounded-lg border border-border bg-card p-md";

/**
 * The scored take, read like the owner's sample (2026-10-19): the sentence score first, then Accuracy · Fluency ·
 * Completeness, what the scorer heard beside the take, every word with its own score, and a plain warning when what
 * was read is not this sentence. Only Azure's numbers: no invented average.
 */
export function PronunciationAnalysis({ result, lineText, onPlayTake, canPlayTake }: {
  result: Result; lineText: string; onPlayTake(): void; canPlayTake: boolean;
}) {
  const t = useTranslations("shadowing.workspace.practice.pronunciation");
  const titleId = useId();
  const wordsId = useId();
  const helpId = useId();
  const [help, setHelp] = useState(false);
  const { assessment } = result;
  const overall = result.pronunciationScore === null ? null : scoreGrade(result.pronunciationScore);
  const metrics = ([["accuracy", assessment?.accuracy ?? null], ["rhythm", result.rhythmScore], ["completeness", assessment?.completeness ?? null]] as const)
    .filter((metric): metric is readonly ["accuracy" | "rhythm" | "completeness", number] => metric[1] !== null);
  const words = assessment?.words ?? null;
  const mismatch = assessment !== null && (
    (assessment.completeness !== null && assessment.completeness < MISMATCH_COMPLETENESS_BELOW)
    || (words !== null && words.length > 0 && alignWords(lineText, words) === null));

  return <div className="space-y-sm">
    {overall && result.pronunciationScore !== null && <section aria-labelledby={titleId} className={cn(CARD, "flex items-start justify-between gap-md bg-primary/5")}>
      <div className="space-y-2xs">
        <h3 id={titleId} className="text-body font-semibold">{t("analysis.title")}</h3>
        <p className="text-caption text-muted-foreground">{t("analysis.subtitle")}</p>
      </div>
      <div className="text-end">
        <p className={cn("text-display font-bold tabular-nums", GRADE_TEXT[overall])}>{Math.round(result.pronunciationScore)}</p>
        <p className="mt-xs text-caption text-muted-foreground">{t(`label.${LABEL[overall]}`)}</p>
      </div>
    </section>}

    {metrics.length > 0 && <dl className="grid grid-cols-3 gap-sm">
      {metrics.map(([key, value]) => <div key={key} className={CARD}>
        <dt className="text-caption text-muted-foreground">{t(key)}</dt>
        <dd className={cn("mt-xs text-heading font-bold tabular-nums", GRADE_TEXT[scoreGrade(value)])}>{Math.round(value)}</dd>
      </div>)}
    </dl>}

    {assessment === null && <p className="text-caption text-muted-foreground">{t("noDetail")}</p>}

    {assessment?.recognizedText && <div className={CARD}>
      <p className="text-caption font-semibold text-muted-foreground">{t("heard")}</p>
      <div className="mt-xs flex items-center gap-sm">
        <button type="button" aria-label={t("playMine")} disabled={!canPlayTake} onClick={onPlayTake}
          className="flex h-control-sm aspect-square shrink-0 items-center justify-center rounded-md bg-muted text-foreground hover:bg-muted/70 disabled:opacity-50">
          <PlayGlyph className="size-icon-xs" />
        </button>
        <p lang="ja" className="font-jp text-body-lg">{assessment.recognizedText}</p>
      </div>
    </div>}

    {words && words.length > 0 && <div className={CARD}>
      <div className="flex items-center gap-xs">
        <h4 id={wordsId} className="text-caption font-semibold text-muted-foreground">{t("analysis.words")}</h4>
        <button type="button" aria-label={t("analysis.wordsHelpLabel")} aria-expanded={help} aria-controls={helpId} onClick={() => setHelp(!help)}
          className="flex size-icon-md items-center justify-center rounded-full border border-border text-caption text-muted-foreground hover:bg-muted">?</button>
      </div>
      {help && <p id={helpId} className="mt-xs text-caption text-muted-foreground">{t("analysis.wordsHelp")}</p>}
      <ul aria-labelledby={wordsId} className="mt-sm flex flex-wrap gap-xs">
        {words.map((word, index) => {
          const grade = wordGrade(word);
          const omitted = word.errorType === "Omission";
          return <li key={`${index}-${word.word}`} data-grade={grade ?? undefined}
            className={cn("flex items-baseline gap-xs rounded-lg border px-sm py-xs", CHIP[grade ?? "none"])}>
            <span lang="ja" className={cn("font-jp text-body", omitted ? "text-muted-foreground line-through" : grade ? GRADE_TEXT[grade] : "text-foreground")}>{word.word}</span>
            {omitted && <span className="sr-only">{t("analysis.notHeard")}</span>}
            {word.accuracy !== null && <span className={cn("text-caption font-bold tabular-nums", grade ? GRADE_TEXT[grade] : "text-muted-foreground")}>{Math.round(word.accuracy)}</span>}
          </li>;
        })}
      </ul>
    </div>}

    {mismatch && <p role="note" className="rounded-lg border border-accent/50 bg-accent/10 p-md text-body text-foreground">{t("analysis.mismatch")}</p>}
  </div>;
}
