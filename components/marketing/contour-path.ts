import type { PlotPoint } from "@/lib/pitch";

/**
 * Points → an SVG path `d` string, starting a new subpath (`M`) after every
 * unvoiced gap (`null`) so gaps are never bridged by a straight line.
 *
 * Shared by `pitch-showcase.tsx` (§4's two overlaid contours) and
 * `journey.tsx` (step 3's mini contour) — fix round 1, F4: this same
 * twelve-line pen-up/pen-down state machine used to be duplicated
 * byte-for-byte in both files, untested in either, and exercised only by "a
 * `[data-contour]` element exists", which passes for any non-empty string.
 *
 * Deliberately NOT in `lib/pitch/plot.ts`: that module's own doc comment
 * promises "no DOM, canvas or SVG" — SVG path-string formatting is
 * presentation glue, not the plotting mathematics `toPlotPoints` owns, so it
 * lives with the marketing components that consume it instead.
 */
export function toPath(points: readonly (PlotPoint | null)[]): string {
  let path = "";
  let penDown = false;
  for (const point of points) {
    if (!point) {
      penDown = false;
      continue;
    }
    path += `${penDown ? "L" : "M"}${point.x.toFixed(2)} ${point.y.toFixed(2)} `;
    penDown = true;
  }
  return path.trim();
}
