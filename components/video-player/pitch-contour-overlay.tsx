"use client";

import { cn } from "@/lib/utils";
import type { PitchAccentScore, PitchOverlayPoint } from "@/lib/pitch";

export interface PitchContourOverlayProps {
  /** Aligned comparison from `scorePitchAccent` (overlay + score + confidence). */
  score: PitchAccentScore;
  /** Accessible label for the plot. */
  label?: string;
  className?: string;
  height?: number;
}

const VIEW_WIDTH = 600;
/** Minimum vertical span (in semitones) to plot even when both takes are nearly flat. */
const MIN_SEMITONE_SPAN = 4;
/** Extra headroom (in semitones) above/below the observed data range. */
const RANGE_PADDING_SEMITONES = 1;

/**
 * Builds one SVG path `d` for a series of overlay points, starting a new
 * subpath (`M`) after every unvoiced gap so gaps are never bridged.
 */
function seriesPath(
  overlay: PitchOverlayPoint[],
  pick: (p: PitchOverlayPoint) => number | null,
  toY: (semitones: number) => number,
): string {
  let d = "";
  let drawing = false;
  for (const p of overlay) {
    const v = pick(p);
    if (v === null) {
      drawing = false;
      continue;
    }
    const x = (p.t * VIEW_WIDTH).toFixed(1);
    const y = toY(v).toFixed(1);
    d += `${drawing ? "L" : "M"}${x} ${y}`;
    drawing = true;
  }
  return d;
}

/**
 * Reference-vs-user pitch contour overlay — the Layer 4 completion of
 * 差別化 #1 (CLAUDE.md §5.1): the seam `pitch-contour.tsx` documents. Both
 * series come pre-aligned from `scorePitchAccent` (normalized time, semitones
 * vs each speaker's own median), so this component only plots.
 *
 * The user's line draws in via the shared `.stroke-draw` reveal (the same
 * one kanji stroke order uses), which the global reduced-motion rules in
 * `globals.css` already disable (CLAUDE.md §2.4) — the reference stays
 * static so the two are visually distinct from the first frame.
 */
export function PitchContourOverlay({
  score,
  label = "Pitch comparison: reference (お手本) vs your take",
  className,
  height = 96,
}: PitchContourOverlayProps) {
  const { overlay } = score;

  const voiced: number[] = [];
  for (const p of overlay) {
    if (p.userSemitones !== null) voiced.push(p.userSemitones);
    if (p.refSemitones !== null) voiced.push(p.refSemitones);
  }
  if (voiced.length === 0) return null; // nothing plottable at all

  let min = Math.min(...voiced) - RANGE_PADDING_SEMITONES;
  let max = Math.max(...voiced) + RANGE_PADDING_SEMITONES;
  if (max - min < MIN_SEMITONE_SPAN) {
    const centre = (max + min) / 2;
    min = centre - MIN_SEMITONE_SPAN / 2;
    max = centre + MIN_SEMITONE_SPAN / 2;
  }
  const toY = (semitones: number) => height - ((semitones - min) / (max - min)) * height;

  const refPath = seriesPath(overlay, (p) => p.refSemitones, toY);
  const userPath = seriesPath(overlay, (p) => p.userSemitones, toY);

  return (
    <div className={cn("space-y-1", className)}>
      <svg
        role="img"
        aria-label={label}
        viewBox={`0 0 ${VIEW_WIDTH} ${height}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height }}
      >
        <path
          data-testid="reference-contour"
          d={refPath}
          fill="none"
          className="stroke-muted-foreground/70"
          strokeWidth={2}
          strokeDasharray="6 4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          data-testid="user-contour"
          d={userPath}
          fill="none"
          pathLength={1}
          className="stroke-draw stroke-primary"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-0 w-5 border-t-2 border-dashed border-muted-foreground/70" />
          お手本
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-0.5 w-5 rounded bg-primary" />
          あなた
        </span>
        {score.lowConfidence ? (
          <span>Not enough voiced audio to compare reliably — try a longer take.</span>
        ) : (
          <span className="text-foreground">
            イントネーション{" "}
            <strong className="text-sm font-semibold">{Math.round(score.score)}</strong>
            <span aria-hidden> / 100</span>
          </span>
        )}
      </div>
    </div>
  );
}
