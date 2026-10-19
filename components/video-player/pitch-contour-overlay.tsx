"use client";

import { useTranslations } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { PitchAccentScore, PitchOverlayPoint } from "@/lib/pitch";

export interface PitchContourOverlayProps {
  /** Aligned comparison from `scorePitchAccent` (overlay + score + confidence). */
  score: PitchAccentScore;
  /**
   * Accessible label for the plot. Optional override — omit it to fall back
   * to the translated `shadowing.pitch.overlay.a11y.label` string via
   * `useTranslations`; pass it when a caller needs a more specific label.
   */
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
 * Longest unvoiced stretch (normalized time, voiced edge to voiced edge) drawn through. Japanese speech is full of
 * voiceless consonants and devoiced vowels (す, つ, き…), so breaking at every one chops the contour into dashes the
 * learner reads as noise; a longer stretch is a real pause and stays a break.
 */
const BRIDGE_GAP = 0.08;

/** Linear fill for interior unvoiced runs whose span is at most `maxSpan`; edges and longer runs stay null. */
export function bridgeShortGaps(points: { t: number; v: number | null }[], maxSpan = BRIDGE_GAP): (number | null)[] {
  const out = points.map((p) => p.v);
  let last = -1;
  points.forEach((p, i) => {
    if (p.v === null) return;
    const before = last >= 0 ? points[last] : undefined;
    if (before && before.v !== null && i - last > 1 && p.t - before.t <= maxSpan) {
      for (let k = last + 1; k < i; k++) {
        const ratio = ((points[k] as { t: number }).t - before.t) / (p.t - before.t);
        out[k] = before.v + (p.v - before.v) * ratio;
      }
    }
    last = i;
  });
  return out;
}

/**
 * Builds one SVG path `d` for a series of overlay points, starting a new subpath (`M`) after every unvoiced gap that
 * survives `bridgeShortGaps`, so a pause is never bridged.
 */
function seriesPath(
  overlay: PitchOverlayPoint[],
  pick: (p: PitchOverlayPoint) => number | null,
  toY: (semitones: number) => number,
): string {
  const values = bridgeShortGaps(overlay.map((p) => ({ t: p.t, v: pick(p) })));
  let d = "";
  let drawing = false;
  overlay.forEach((p, i) => {
    const v = values[i] ?? null;
    if (v === null) {
      drawing = false;
      return;
    }
    const x = (p.t * VIEW_WIDTH).toFixed(1);
    const y = toY(v).toFixed(1);
    d += `${drawing ? "L" : "M"}${x} ${y}`;
    drawing = true;
  });
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
  label,
  className,
  height = 96,
}: PitchContourOverlayProps) {
  const t = useTranslations("shadowing");
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
        aria-label={label ?? t("pitch.overlay.a11y.label")}
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

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-muted-foreground">
        <span data-testid="reference-legend" className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-0 w-5 border-t-2 border-dashed border-muted-foreground/70" />
          {t("pitch.overlay.reference")}
        </span>
        <span data-testid="user-legend" className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-0.5 w-5 rounded bg-primary" />
          {t("pitch.overlay.user")}
        </span>
        {score.lowConfidence ? (
          <span>{t("pitch.overlay.lowConfidence")}</span>
        ) : (
          <span className="text-foreground">
            {t("pitch.overlay.intonation")}{" "}
            <strong className="text-body font-semibold">{Math.round(score.score)}</strong>
            <span aria-hidden>{t("pitch.overlay.scoreSuffix")}</span>
          </span>
        )}
      </div>
    </div>
  );
}
