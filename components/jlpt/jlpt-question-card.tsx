"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n";
import type { JlptQuestionPublic } from "@/lib/jlpt-ui";
import { JlptListeningPlayButton } from "./jlpt-listening-play-button";

export interface JlptQuestionCardProps {
  question: JlptQuestionPublic;
  index: number;
  total: number;
  /** "0".."3", undefined when unanswered. */
  selected: string | undefined;
  onSelect: (value: string) => void;
}

const PASSAGE_COLLAPSE_THRESHOLD = 220;
const CHOICE_KEYS = ["1", "2", "3", "4"];

/**
 * One JLPT question: stem, optional passage (collapsible if long), optional
 * listening playback, and a 4-choice radiogroup. Keyboard: Up/Down/Left/Right
 * move + select within the group (roving tabindex), 1-4 jump straight to a
 * choice — scoped to `onKeyDown` on the group container so it never fights
 * typing elsewhere on the page. Focus moves to the question heading whenever
 * `question.id` changes so screen-reader users land on new content instead
 * of a stale, now-hidden radio.
 */
export function JlptQuestionCard({ question, index, total, selected, onSelect }: JlptQuestionCardProps) {
  const t = useTranslations("jlpt");
  const { stem, passage, audio_text, choices } = question.question_data;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const radioRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    headingRef.current?.focus();
  }, [question.id]);

  function focusChoice(i: number) {
    radioRefs.current[i]?.focus();
  }

  function handleGroupKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const currentIdx = selected ? Number(selected) : 0;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      const next = (currentIdx + 1) % choices.length;
      onSelect(String(next));
      focusChoice(next);
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault();
      const prev = (currentIdx - 1 + choices.length) % choices.length;
      onSelect(String(prev));
      focusChoice(prev);
    } else if (CHOICE_KEYS.includes(e.key)) {
      const i = CHOICE_KEYS.indexOf(e.key);
      if (i < choices.length) {
        e.preventDefault();
        onSelect(String(i));
        focusChoice(i);
      }
    }
  }

  return (
    <div className="space-y-4 rounded-lg border border-border p-5">
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="font-jp text-base font-semibold outline-none"
      >
        {t("questionCard.heading", { index: index + 1, total })}
      </h2>

      {passage &&
        (passage.length > PASSAGE_COLLAPSE_THRESHOLD ? (
          <details className="rounded-md border border-border p-3">
            <summary className="cursor-pointer text-sm font-medium">{t("questionCard.readingPassage")}</summary>
            <p className="font-jp mt-2 whitespace-pre-wrap text-base leading-relaxed">{passage}</p>
          </details>
        ) : (
          <div className="rounded-md border border-border bg-muted/40 p-3">
            <p className="font-jp whitespace-pre-wrap text-base leading-relaxed">{passage}</p>
          </div>
        ))}

      <p className="font-jp text-base">{stem}</p>

      {audio_text && <JlptListeningPlayButton text={audio_text} />}

      <div
        role="radiogroup"
        aria-label={t("questionCard.answerChoicesAria", { index: index + 1 })}
        onKeyDown={handleGroupKeyDown}
        className="space-y-2"
      >
        {choices.map((choice, i) => {
          const value = String(i);
          const checked = selected === value;
          const tabIndex = selected !== undefined ? (checked ? 0 : -1) : i === 0 ? 0 : -1;
          return (
            <button
              key={i}
              ref={(el) => {
                radioRefs.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              tabIndex={tabIndex}
              onClick={() => onSelect(value)}
              className={cn(
                "flex w-full items-start gap-3 rounded-md border px-4 py-3 text-left text-sm transition-colors",
                checked ? "border-primary bg-primary/10" : "border-border hover:bg-secondary",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                  checked
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground",
                )}
              >
                {i + 1}
              </span>
              <span className="font-jp">{choice}</span>
              {checked && <span className="sr-only">{t("questionCard.selected")}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
