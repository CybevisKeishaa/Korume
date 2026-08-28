/**
 * Plotting mathematics for the pitch contour, shared by every renderer.
 *
 * Rendering-agnostic in the same sense as `contour.ts`: plain numbers out, no
 * DOM, canvas or SVG. It lives here rather than inside the canvas component
 * because the landing page's §4 showcase must be the SAME SHAPE as the real
 * scorer (spec §7) — and the way to guarantee that is shared code, not a second
 * implementation that looks similar.
 *
 * Consumers: `components/video-player/pitch-contour.tsx` (canvas, real audio)
 * and `components/marketing/pitch-showcase.tsx` (SVG, illustrative fixtures).
 */
import { hzToSemitones } from "./contour";
import type { PitchContour } from "./types";

export interface PlotPoint {
  x: number;
  y: number;
}

/** Minimum vertical span (in semitones) to plot even when the take is nearly flat. */
export const MIN_SEMITONE_SPAN = 4;
/** Extra headroom (in semitones) above/below the observed data range. */
export const RANGE_PADDING_SEMITONES = 1;

/** Maps contour frames to canvas-space points, one per frame, `null` = gap (unvoiced). */
export function toPlotPoints(
  contour: PitchContour,
  refHz: number,
  canvasWidth: number,
  canvasHeight: number,
): { points: (PlotPoint | null)[]; baselineY: number } {
  const frames = contour.frames;
  const maxTime = frames.length > 0 ? (frames[frames.length - 1] as { time: number }).time : 0;

  const semitones = frames.map((f) => (f.hz === null ? null : hzToSemitones(f.hz, refHz)));
  const voiced = semitones.filter((s): s is number => s !== null);
  const dataMin = voiced.length > 0 ? Math.min(...voiced) : 0;
  const dataMax = voiced.length > 0 ? Math.max(...voiced) : 0;

  let min = dataMin - RANGE_PADDING_SEMITONES;
  let max = dataMax + RANGE_PADDING_SEMITONES;
  if (max - min < MIN_SEMITONE_SPAN) {
    const centre = (max + min) / 2;
    min = centre - MIN_SEMITONE_SPAN / 2;
    max = centre + MIN_SEMITONE_SPAN / 2;
  }
  const span = max - min;

  const toY = (semitone: number) => canvasHeight - ((semitone - min) / span) * canvasHeight;
  const toX = (time: number) => (maxTime > 0 ? (time / maxTime) * canvasWidth : 0);

  const points = frames.map((f, i) => {
    const s = semitones[i];
    if (s === null || s === undefined) return null;
    return { x: toX(f.time), y: toY(s) };
  });

  return { points, baselineY: toY(0) };
}
