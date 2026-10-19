"use client";

import { Fragment, type ComponentProps } from "react";
import { useTranslations } from "@/lib/i18n";
import type { WordSpan } from "@/lib/pronunciation/align-words";
import { REVIEW_PRONUNCIATION_BELOW, STRONG_PRONUNCIATION_AT } from "@/lib/summary/thresholds";
import { RubySentence } from "../ruby-sentence";

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
        const tone = span.errorType !== "None" || (span.accuracy !== null && span.accuracy < REVIEW_PRONUNCIATION_BELOW)
          ? "text-danger-strong underline decoration-wavy" : span.accuracy !== null && span.accuracy >= STRONG_PRONUNCIATION_AT
            ? "text-success-strong" : span.accuracy === null ? "text-inherit" : "text-accent-strong";
        return <Fragment key={index}>{before}<mark data-error-type={span.errorType} className={`rounded-sm bg-transparent ${tone}`}>{chars.slice(start, finish).join("")}</mark></Fragment>;
      })}{chars.slice(end).join("")}</>;
  };
  return <>
    {reading ? <RubySentence {...reading} renderText={renderText} /> : <p lang="ja" className="font-jp text-body-lg">{renderText(text, 0)}</p>}
    {spans === null && !reading?.hidden && <p className="text-caption text-muted-foreground">{t("remarkUnaligned")}</p>}
  </>;
}
