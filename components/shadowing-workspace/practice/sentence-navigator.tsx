"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useCurrentSentence, useLesson, usePlaybackController } from "../workspace-context";
import { usePracticeStats } from "./practice-stats-context";

const WINDOW = 8;
const BEFORE_CURRENT = 3;
const CONTROL = "flex h-control-sm aspect-square shrink-0 items-center justify-center rounded-full text-caption font-bold tabular-nums aria-disabled:opacity-50";
const REVIEW_TONE = "bg-muted text-accent-strong ring-1 ring-accent";
const TONES = {
  none: "bg-muted text-muted-foreground",
  scored: "bg-muted text-success-strong ring-1 ring-success",
  needs_review: REVIEW_TONE,
  unscored: "bg-muted text-muted-foreground ring-1 ring-border",
  // P4: a shown answer reads as review.
  revealed: REVIEW_TONE,
};

/** Current and returned sentence indices are zero-based. */
export function navigatorWindow(current: number, total: number): number[] {
  const start = Math.max(0, Math.min(current - BEFORE_CURRENT, total - WINDOW));
  return Array.from({ length: Math.min(WINDOW, total) }, (_, index) => start + index);
}

export function SentenceNavigator({ disabled = false, disabledHint }: { disabled?: boolean; disabledHint?: string }) {
  const t = useTranslations("shadowing.workspace.practice");
  const { lines } = useLesson();
  const { index } = useCurrentSentence();
  const controller = usePlaybackController();
  const { stats } = usePracticeStats();
  const [anchor, setAnchor] = useState(index ?? 0);
  useEffect(() => { if (index !== null) setAnchor(index); }, [index]);
  const chips = navigatorWindow(anchor, lines.length);
  const earlierDisabled = disabled || chips.length === 0 || chips[0] === 0;
  const laterDisabled = disabled || chips.length === 0 || chips.at(-1) === lines.length - 1;
  const hint = disabled ? disabledHint : undefined;

  return (
    <nav aria-label={t("navigator.label")} className="flex flex-wrap items-center gap-sm">
      <span className="text-caption font-bold uppercase tracking-wide text-primary-strong">{t("navigator.label")}</span>
      <div className="flex min-w-0 items-center gap-2xs">
        <button type="button" aria-label={t("navigator.earlier")} aria-disabled={earlierDisabled} title={hint}
          className={cn(CONTROL, "text-muted-foreground")}
          onClick={() => { if (!earlierDisabled) setAnchor((chips[0] ?? 0) - WINDOW + BEFORE_CURRENT); }}>
          <ChevronLeft aria-hidden="true" className="size-icon-sm" />
        </button>
        <ol className="flex flex-wrap gap-2xs">
          {chips.map((sentenceIndex) => {
            const line = lines[sentenceIndex];
            if (!line) return null;
            const entry = stats?.lines[line.id];
            const state = entry?.state ?? "none";
            const stateLabel = state === "scored"
              ? t("navigator.state.scored", { score: entry?.score ?? 0 })
              : t(`navigator.state.${state}`);
            return (
              <li key={line.id}>
                <button type="button" aria-current={sentenceIndex === index ? "true" : undefined} aria-disabled={disabled}
                  title={hint} aria-label={t("navigator.chip", { number: sentenceIndex + 1, state: stateLabel })}
                  onClick={() => { if (!disabled) controller.seekToSentence(sentenceIndex); }} data-state={state}
                  className={cn(CONTROL, sentenceIndex === index ? "bg-primary text-primary-foreground" : TONES[state])}>
                  {sentenceIndex + 1}
                </button>
              </li>
            );
          })}
        </ol>
        <button type="button" aria-label={t("navigator.later")} aria-disabled={laterDisabled} title={hint}
          className={cn(CONTROL, "text-muted-foreground")}
          onClick={() => { if (!laterDisabled) setAnchor((chips[0] ?? 0) + WINDOW + BEFORE_CURRENT); }}>
          <ChevronRight aria-hidden="true" className="size-icon-sm" />
        </button>
      </div>
    </nav>
  );
}
