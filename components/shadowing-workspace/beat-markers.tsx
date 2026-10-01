"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";
import { useCurrentSentence, useLesson } from "./workspace-context";

/**
 * One SVG for every sentence start (spec §7.3): Ep.729 has 282 lines, so a DOM control per sentence is
 * forbidden. Purely visual — `aria-hidden`, no pointer events; the range input underneath is the control.
 */
// Memoised: its parent re-renders every animation frame with the clock; 282 lines must not be re-diffed each time.
export const BeatMarkers = memo(function BeatMarkers({ duration }: { duration: number | null }) {
  const { lines } = useLesson();
  const { index } = useCurrentSentence();
  if (!duration || duration <= 0 || lines.length === 0) return null;
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className="pointer-events-none absolute inset-x-0 top-1/2 h-2 w-full -translate-y-1/2"
      viewBox="0 0 1000 10"
      preserveAspectRatio="none"
      data-testid="beat-markers"
    >
      {lines.map((line) => {
        const x = Math.min(1000, Math.max(0, (line.startTime / duration) * 1000));
        return (
          <line
            key={line.id}
            x1={x}
            x2={x}
            y1={0}
            y2={10}
            vectorEffect="non-scaling-stroke"
            className={cn(line.index === index ? "stroke-primary opacity-60" : "stroke-muted-foreground opacity-30")}
          />
        );
      })}
    </svg>
  );
});
