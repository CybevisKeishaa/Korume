"use client";

import { cn } from "@/lib/utils";

export interface JlptQuestionNavigatorProps {
  count: number;
  currentIndex: number;
  answeredIndexes: Set<number>;
  onSelect: (index: number) => void;
}

/**
 * Grid of numbered question buttons (spec §5.7): shows answered/unanswered
 * state and the current question. State is conveyed through the accessible
 * name (never color alone) plus a border/fill change, so it reads correctly
 * without color vision.
 */
export function JlptQuestionNavigator({
  count,
  currentIndex,
  answeredIndexes,
  onSelect,
}: JlptQuestionNavigatorProps) {
  return (
    <nav aria-label="Question navigator" className="grid grid-cols-6 gap-2 sm:grid-cols-10">
      {Array.from({ length: count }, (_, i) => {
        const answered = answeredIndexes.has(i);
        const current = i === currentIndex;
        return (
          <button
            key={i}
            type="button"
            onClick={() => onSelect(i)}
            aria-current={current ? "true" : undefined}
            aria-label={`Question ${i + 1}${current ? ", current" : ""}${answered ? ", answered" : ", not answered"}`}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-md border text-sm font-medium transition-colors",
              current
                ? "border-primary bg-primary text-primary-foreground"
                : answered
                  ? "border-success/50 bg-success/10 text-success"
                  : "border-border bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            {i + 1}
          </button>
        );
      })}
    </nav>
  );
}
