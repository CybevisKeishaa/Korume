import type { PlotPoint } from "@/lib/pitch";

/**
 * Points → an SVG path `d` string, starting a new subpath (`M`) after every
 * unvoiced gap (`null`) so gaps are never bridged by a straight line.
 *
 * Used by `pitch-chart.tsx` for §4's two overlaid contours — fix round 1, F4:
 * this same pen-up/pen-down state machine used to be duplicated byte-for-byte
 * in two files, untested in either, and exercised only by "a `[data-contour]`
 * element exists", which passes for any non-empty string. (The second caller
 * was §3's step-3 mini contour; task A2 replaced that card's art with an
 * amplitude waveform, so §4 is the only caller today.)
 *
 * ## ⚠️ Why the segments are CURVES and not line-tos (owner ruling, 2026-09-03)
 *
 * This emitted `L` commands, which made every sample a corner. A pitch contour
 * has ~170 samples across ~480 CSS px — one every 2.8 px — so the trace read
 * as a jagged polygon: the owner's words for it were "trông rất xấu", and the
 * fix is not in the data alone. Even a perfectly smooth series drawn with
 * line-tos has discontinuous curvature at every vertex, which the eye reads as
 * a generated chart rather than as a voice.
 *
 * Consecutive samples are therefore joined with cubic Béziers whose control
 * points come from each sample's NEIGHBOURS (Catmull-Rom, tension 1/6):
 *
 *     c1 = p1 + (p2 - p0) / 6      c2 = p2 - (p3 - p1) / 6
 *
 * Catmull-Rom is chosen over an approximating spline because it INTERPOLATES:
 * the curve passes exactly through every reading, so smoothing changes how the
 * pitch is drawn and never what it says. Both properties are pinned in
 * `contour-path.test.ts`, including that a collinear run stays collinear —
 * i.e. the smoothing invents no wobble the data does not contain.
 *
 * Deliberately NOT in `lib/pitch/plot.ts`: that module's own doc comment
 * promises "no DOM, canvas or SVG" — SVG path-string formatting is
 * presentation glue, not the plotting mathematics `toPlotPoints` owns, so it
 * lives with the marketing components that consume it instead.
 */
export function toPath(points: readonly (PlotPoint | null)[]): string {
  return runsOf(points).map(subpath).join(" ");
}

/** Splits the samples into the voiced runs between gaps, dropping empties. */
function runsOf(points: readonly (PlotPoint | null)[]): PlotPoint[][] {
  const runs: PlotPoint[][] = [];
  let current: PlotPoint[] = [];
  for (const point of points) {
    if (point) {
      current.push(point);
      continue;
    }
    if (current.length > 0) runs.push(current);
    current = [];
  }
  if (current.length > 0) runs.push(current);
  return runs;
}

const n = (value: number) => value.toFixed(2);

/**
 * One voiced run as its own subpath.
 *
 * A run is smoothed against ITSELF only — `runsOf` has already cut it at the
 * gaps — so the tangent at a phrase edge can never be bent toward a phrase the
 * speaker had not begun. One sample is a bare move-to and two are a line,
 * because a Catmull-Rom segment needs a neighbour on each side to have a
 * direction, and a curve through two points is a line anyway.
 */
function subpath(run: PlotPoint[]): string {
  const [first] = run;
  if (!first) return "";

  const start = `M${n(first.x)} ${n(first.y)}`;
  if (run.length === 1) return start;
  if (run.length === 2) {
    const [, second] = run;
    return second ? `${start} L${n(second.x)} ${n(second.y)}` : start;
  }

  const at = (i: number): PlotPoint =>
    run[Math.min(Math.max(i, 0), run.length - 1)] as PlotPoint;

  const segments = run.slice(1).map((_, index) => {
    // The run's own ends duplicate their neighbour (`at` clamps), which is the
    // standard Catmull-Rom endpoint condition: the curve leaves and arrives
    // along the chord instead of overshooting past the first or last reading.
    const p0 = at(index - 1);
    const p1 = at(index);
    const p2 = at(index + 1);
    const p3 = at(index + 2);

    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;

    return `C${n(c1x)} ${n(c1y)} ${n(c2x)} ${n(c2y)} ${n(p2.x)} ${n(p2.y)}`;
  });

  return `${start} ${segments.join(" ")}`;
}
