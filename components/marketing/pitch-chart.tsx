import { semitoneRange, toPlotPoints, toSemitones } from "@/lib/pitch";
import type { PitchContour, SemitoneRange } from "@/lib/pitch";
import { DEMO_REF_HZ, NATIVE_DEMO_CONTOUR, USER_DEMO_CONTOUR } from "@/lib/marketing/pitch-demo";
import { toPath } from "./contour-path";
import type { Translator } from "./translator";

/**
 * §4's overlaid pitch contours and their legend (spec §7, §13).
 *
 * ⚠️ The frame draws a BAR CHART here. Pitch is a continuous quantity, so bars
 * do not merely look worse — they misrepresent the product's headline
 * differentiator (CLAUDE.md §5 #1). The reference draws two overlaid contours,
 * and it is right.
 *
 * "Same shape as the real one" is enforced by SHARED CODE: the points below
 * come from `toPlotPoints`, the identical function `components/video-player/
 * pitch-contour.tsx` uses on real recorded audio. If the real renderer's
 * plotting changes, this changes with it. Do not reimplement the mapping here.
 *
 * ## One vertical window for both traces (task A3)
 *
 * `toPlotPoints` normalizes a contour to its OWN observed range unless it is
 * given one. Calling it once per contour — which this section used to do —
 * stretched the flatter "You" track to the same full height as the native one
 * and silently erased the only thing the overlay exists to show. Both traces
 * are now plotted against a single `semitoneRange` computed over both, which
 * is what `pitch-contour-overlay.tsx` already does for real takes.
 *
 * ## Which line is dashed, and why it flipped
 *
 * Fix round 1 (F3) dashed the NATIVE line, mirroring the in-product overlay
 * where the reference take is the dashed one. F3's actual requirement was WCAG
 * 1.4.1 — the two contours must be distinguishable by more than colour — and
 * WHICH of the two got dashed was arbitrary. Reference `346:6275` makes the
 * native contour the dominant solid line, so the pair now differs by dash AND
 * by stroke weight, with `LegendSwatch` rendering the matching pattern and
 * weight for each label. Keep the swatch in sync with the line it stands for.
 *
 * ⚠️ This is deliberately the OPPOSITE convention from
 * `components/video-player/pitch-contour-overlay.tsx` (dashed grey reference,
 * solid accent user). The marketing chart's subject is the native model you
 * are copying; the product chart's subject is your own take. Reported to the
 * controller as a cross-surface inconsistency worth a product ruling.
 *
 * NO MOTION. This is the static half of spec §13; the whole-page motion pass
 * is a later task. Nothing here declares a transition, keyframe or trigger.
 *
 * Rule #0 note: every number below is an SVG `viewBox` coordinate or a stroke
 * width in that coordinate system — an internal coordinate space, not a CSS
 * px/rem literal copied out of the frame (same house exception the previous
 * `VIEWBOX_WIDTH` / `SWATCH_VIEW_WIDTH` comments record).
 */
const VIEWBOX_WIDTH = 600;
const VIEWBOX_HEIGHT = 190;

/** Dash pattern shared by the "You" contour and its legend swatch. */
const USER_DASH = "8 5";
/** The native line dominates; the user line reads as the comparison against it. */
const NATIVE_STROKE = 2.4;
const USER_STROKE = 1.4;

/**
 * Faint horizontal rules behind the traces, as the reference draws them: they
 * give the contour a plane to move against instead of floating in a void.
 * Purely decorative — they carry no scale, no tick labels and no value, so
 * they need no catalog string and are hidden from assistive tech.
 */
const GRIDLINE_COUNT = 4;
const GRIDLINE_YS = Array.from(
  { length: GRIDLINE_COUNT },
  (_, i) => ((i + 1) * VIEWBOX_HEIGHT) / (GRIDLINE_COUNT + 1),
);

/** Internal coordinate system for the legend line swatches (see the docblock). */
const SWATCH_VIEW_WIDTH = 24;
const SWATCH_VIEW_HEIGHT = 8;

function contourPath(contour: PitchContour, range: SemitoneRange): string {
  const { points } = toPlotPoints(contour, DEMO_REF_HZ, VIEWBOX_WIDTH, VIEWBOX_HEIGHT, range);
  return toPath(points);
}

/**
 * A small line icon next to a legend label (WCAG 1.4.1): the two contours must
 * be distinguishable by more than colour alone, so the swatch repeats both the
 * dash state and the relative weight of the line it stands for.
 *
 * `stroke-current` inherits the colour from the parent `<span>`'s text colour
 * class, so the swatch and its label never fall out of sync. The `viewBox` is
 * 24x8 and the element is rendered at exactly 24x8 CSS px, so `strokeWidth`
 * here is the width the line actually draws at.
 */
function LegendSwatch({ dashed, weight }: { dashed: boolean; weight: number }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox={`0 0 ${SWATCH_VIEW_WIDTH} ${SWATCH_VIEW_HEIGHT}`}
      className="h-xs w-lg shrink-0"
    >
      <line
        x1={0}
        y1={SWATCH_VIEW_HEIGHT / 2}
        x2={SWATCH_VIEW_WIDTH}
        y2={SWATCH_VIEW_HEIGHT / 2}
        className="stroke-current"
        strokeWidth={weight}
        strokeLinecap="round"
        strokeDasharray={dashed ? USER_DASH : undefined}
      />
    </svg>
  );
}

export function PitchChart({ t }: { t: Translator }) {
  const range = semitoneRange([
    ...toSemitones(NATIVE_DEMO_CONTOUR, DEMO_REF_HZ),
    ...toSemitones(USER_DEMO_CONTOUR, DEMO_REF_HZ),
  ]);
  const nativePath = contourPath(NATIVE_DEMO_CONTOUR, range);
  const userPath = contourPath(USER_DEMO_CONTOUR, range);

  return (
    <>
      <div className="flex items-center gap-md text-caption">
        <span className="flex items-center gap-xs text-primary-strong">
          <LegendSwatch dashed={false} weight={NATIVE_STROKE} />
          {t("pitch.legend.native")}
        </span>
        <span className="flex items-center gap-xs text-muted-foreground">
          <LegendSwatch dashed weight={USER_STROKE} />
          {t("pitch.legend.you")}
        </span>
      </div>

      <svg
        role="img"
        aria-label={t("pitch.chartLabel")}
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
        className="mt-sm w-full"
        preserveAspectRatio="none"
      >
        <g data-gridlines aria-hidden="true" className="stroke-border">
          {GRIDLINE_YS.map((y) => (
            <line key={y} data-gridline x1={0} y1={y} x2={VIEWBOX_WIDTH} y2={y} strokeWidth={1} />
          ))}
        </g>
        <path
          data-contour="native"
          d={nativePath}
          fill="none"
          className="stroke-primary-strong"
          strokeWidth={NATIVE_STROKE}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          data-contour="you"
          d={userPath}
          fill="none"
          className="stroke-muted-foreground"
          strokeWidth={USER_STROKE}
          strokeDasharray={USER_DASH}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </>
  );
}
