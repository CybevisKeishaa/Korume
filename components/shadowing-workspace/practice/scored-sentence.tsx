"use client";

import { Fragment, type ComponentProps } from "react";
import { useTranslations } from "@/lib/i18n";
import type { WordSpan } from "@/lib/pronunciation/align-words";
import { REVIEW_PRONUNCIATION_BELOW, STRONG_PRONUNCIATION_AT } from "@/lib/summary/thresholds";
import { RubySentence } from "../ruby-sentence";

type Grade = "needsWork" | "good" | "strong";
const GRADES: readonly Grade[] = ["needsWork", "good", "strong"];
const TONE: Record<Grade | "none", string> = {
  needsWork: "text-danger-strong underline decoration-wavy",
  good: "text-accent-strong",
  strong: "text-success-strong",
  none: "text-inherit",
};

function gradeOf(span: WordSpan): Grade | null {
  if (span.errorType !== "None" || (span.accuracy !== null && span.accuracy < REVIEW_PRONUNCIATION_BELOW)) return "needsWork";
  if (span.accuracy === null) return null;
  return span.accuracy >= STRONG_PRONUNCIATION_AT ? "strong" : "good";
}

export function ScoredSentence({ text, spans, reading }: { text: string; spans: WordSpan[] | null; reading?: ComponentProps<typeof RubySentence> }) {
  const t = useTranslations("shadowing.workspace.practice.pronunciation");
  const renderText = (part: string, offset: number) => {
    if (!spans) return part;
    const chars = Array.from(part);
    let end = 0;
    return <>{spans.filter((span) => span.start < offset + chars.length && span.end > offset).map((span, index) => {
        const start = Math.max(0, span.start - offset);
        const finish = Math.min(chars.length, span.end - offset);
        const before = chars.slice(end, start).join("");
        end = finish;
        return <Fragment key={index}>{before}<mark data-error-type={span.errorType} className={`rounded-sm bg-transparent ${TONE[gradeOf(span) ?? "none"]}`}>{chars.slice(start, finish).join("")}</mark></Fragment>;
      })}{chars.slice(end).join("")}</>;
  };
  // Colour alone carries no grade to a screen reader (WCAG 1.4.1). The words are listed beside the sentence, never
  // inside it: selection offsets count the sentence's base text only.
  const chars = Array.from(text);
  const graded = (grade: Grade) => (spans ?? []).filter((span) => gradeOf(span) === grade).map((span) => chars.slice(span.start, span.end).join(""));
  const summary = GRADES.map((grade) => [grade, graded(grade)] as const).filter(([, words]) => words.length > 0);
  return <>
    {reading ? <RubySentence {...reading} renderText={renderText} /> : <p lang="ja" className="font-jp text-body-lg">{renderText(text, 0)}</p>}
    {summary.length > 0 && !reading?.hidden && <p data-testid="word-grades" className="sr-only">
      {summary.map(([grade, words]) => t(`wordGrade.${grade}`, { words: words.join("、") })).join(" ")}
    </p>}
    {spans === null && !reading?.hidden && <p className="text-caption text-muted-foreground">{t("remarkUnaligned")}</p>}
  </>;
}
