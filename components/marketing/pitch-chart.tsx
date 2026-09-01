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
 *
 * ## Why THREE, and why the panel (fix round 1, F1 + F4)
 *
 * The first build drew FOUR rules and no frame, on the reading that "two are
 * clearly visible in the 4x crop, consistent with four evenly spaced rules".
 * Re-measured on `ref/s4-pitch.png` (luminance differenced against y±8 to
 * defeat the card's vertical gradient) the reference is unambiguous:
 *
 *   verticals   x = 550 and x = 1280..1283, both spanning y 48..235
 *   horizontals y = 44, 92, 140, 190, 238 — five rules, evenly spaced 48 apart
 *   the y=44 and y=238 rules run exactly 550..1280, i.e. the verticals' span
 *
 * So the reference frames its chart in a BORDERED INSET PANEL whose own top
 * and bottom edges are the outer two lines of an even five-line grid, with
 * THREE interior rules inside it. The build's fourth rule was a misreading,
 * and `expect(lines).toHaveLength(4)` then froze the misreading in a test that
 * mutation-checked perfectly against the implementer's own constant.
 *
 * The panel is a real CSS border on the wrapper rather than an SVG `<rect>`:
 * that keeps it on the `--border` token, gives it the radius scale, and — the
 * reason that matters — makes the five-line grid EVEN BY CONSTRUCTION at every
 * width, because the SVG fills the wrapper's content box exactly and the three
 * interior rules sit at H/4, H/2, 3H/4 of it.
 *
 * ⚠️ Known divergence: the reference puts the legend INSIDE the panel, in the
 * grid's top band. Ours sits above the panel. Our showcase card is ~21%
 * narrower than the reference's, so at 320px the panel is ~75 CSS px tall and
 * a top band would be ~19px — less than the 18px line box of the caption plus
 * any padding, so the legend would spill onto the trace. Reported, not fixed.
 */
const GRIDLINE_COUNT = 3;
const GRIDLINE_YS = Array.from(
  { length: GRIDLINE_COUNT },
  (_, i) => ((i + 1) * VIEWBOX_HEIGHT) / (GRIDLINE_COUNT + 1),
);

/**
 * ~1 CSS px at 1280, where the viewBox scales by 0.73 — so an interior rule
 * draws at the same weight as the panel's own 1px CSS border and the five-line
 * grid reads as one grid rather than as a box with fainter lines inside it.
 */
const GRIDLINE_STROKE = 1.4;

/**
 * The traces are plotted into an inset region of the panel rather than edge to
 * edge, so a round line cap at either end never lands on the frame. Both are
 * viewBox coordinates (the house exception the docblock records).
 */
const PLOT_INSET_X = 14;
const PLOT_INSET_Y = 18;
const PLOT_WIDTH = VIEWBOX_WIDTH - PLOT_INSET_X * 2;
const PLOT_HEIGHT = VIEWBOX_HEIGHT - PLOT_INSET_Y * 2;

/** Internal coordinate system for the legend line swatches (see the docblock). */
const SWATCH_VIEW_WIDTH = 24;
const SWATCH_VIEW_HEIGHT = 8;

function contourPath(contour: PitchContour, range: SemitoneRange): string {
  const { points } = toPlotPoints(contour, DEMO_REF_HZ, PLOT_WIDTH, PLOT_HEIGHT, range);
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

      {/* The inset plot panel. Its own top and bottom borders are the outer two
          lines of the reference's even five-line grid — see GRIDLINE_COUNT.
          `overflow-hidden` is what lets the rules run the panel's full width
          without poking through the corner radius. No padding: the SVG fills
          the content box exactly, which is what keeps the grid even. */}
      <div
        data-plot-panel
        className="mt-sm overflow-hidden rounded-md border border-border"
      >
        <svg
          role="img"
          aria-label={t("pitch.chartLabel")}
          viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
          className="block w-full"
          preserveAspectRatio="none"
        >
          <g data-gridlines aria-hidden="true" className="stroke-border">
            {GRIDLINE_YS.map((y) => (
              <line
                key={y}
                data-gridline
                x1={0}
                y1={y}
                x2={VIEWBOX_WIDTH}
                y2={y}
                strokeWidth={GRIDLINE_STROKE}
              />
            ))}
          </g>
          <g transform={`translate(${PLOT_INSET_X} ${PLOT_INSET_Y})`}>
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
          </g>
        </svg>
      </div>
    </>
  );
}
