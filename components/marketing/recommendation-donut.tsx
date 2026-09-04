/**
 * §5's familiar-words donut (spec §13.1.2/13.1.3 — "recommendation cũng sẽ cần
 * đặc sắc và giống ảnh png hơn").
 *
 * ⚠️ DECORATIVE, ALWAYS. Reference `346:6275` draws a real green ring around the
 * percentage; the arc repeats a number that is already rendered as HTML text
 * beside it (`recommend.familiar.value` + `.unit`). So the whole SVG is
 * `aria-hidden` + `focusable="false"`, and deleting this file would cost the
 * section its texture and no meaning at all — `recommendation.test.tsx` proves
 * that by removing the node and re-reading the value.
 *
 * ## Rule #0
 *
 * Every number below is an SVG `viewBox` coordinate, a stroke width in that
 * coordinate system, or a rendered pixel size passed as a `width`/`height`
 * attribute. Both are the house exception the `VIEWBOX_WIDTH` comments in
 * `pitch-chart.tsx` record: an internal coordinate space is not a CSS literal
 * copied out of the frame, and an intrinsic element size is the escape Rule #0
 * itself points at. No class name here carries a px or rem value.
 *
 * ## NO MOTION
 *
 * The whole-page motion pass is a later task. Nothing here declares a
 * transition, keyframe or scroll trigger, so this section's reduced-motion
 * obligation is satisfied vacuously — exactly as §2's, §3's and §4's are. The
 * arc is deliberately built as a `stroke-dasharray` sweep rather than a drawn
 * path, because that is the one shape a later `stroke-dashoffset` tween can
 * animate without re-authoring the geometry.
 */

/** The ring's own coordinate space. Square, so one number covers both axes. */
const VIEWBOX = 100;
/** Leaves room for half the stroke plus the glow's blur at every edge. */
const RADIUS = 40;
const STROKE = 9;

/** The full ring, in viewBox units. Exported so tests reason in real lengths. */
export const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * How much of the ring a percentage paints, in viewBox units.
 *
 * DERIVED, never restated: the rendered `stroke-dasharray` is this function's
 * output, so the arc cannot silently disagree with the number typeset inside
 * it. `familiar.value` is user-editable copy — a translator writing `"140"` or
 * `"a lot"` must not paint an arc longer than the ring it sits on — hence the
 * clamp and the NaN floor rather than a bare multiply.
 */
export function arcLength(percent: number): number {
  if (!Number.isFinite(percent)) return 0;
  const clamped = Math.min(Math.max(percent, 0), 100);
  return (CIRCUMFERENCE * clamped) / 100;
}

/**
 * Rendered size in CSS px. The ring is a fixed-size figure, not a fluid one.
 *
 * 72 is the reference's own size carried across, not a taste call: `346:6275`
 * draws the ring 56px wide on an 864px-wide export of a 1440 frame, i.e. ~93
 * CSS px, and this page's showcase column renders at 0.78x the reference's
 * (754 against ~965 CSS px — the container geometry A3 recorded). 93 x 0.78 =
 * 73. Growing it past that is what pushes the percentage typeset inside the
 * ring into the stroke, since the inner disc is only 75% of this.
 */
const SIZE = 72;

export interface FamiliarDonutProps {
  /** The percentage to sweep. Read from the catalog by the caller. */
  percent: number;
}

/**
 * Track + swept arc, rotated so the sweep starts at twelve o'clock and runs
 * clockwise, as the reference draws it. The arc is painted twice: once blurred
 * as a glow, once crisp on top. That soft halo — plus the round line cap and
 * the two-stop gradient along the sweep — is what stops the ring reading as the
 * flat progress bar the first §2/§3/§4 builds were rejected for (spec §13).
 */
export function FamiliarDonut({ percent }: FamiliarDonutProps) {
  const drawn = arcLength(percent);
  const dash = `${drawn} ${CIRCUMFERENCE}`;
  const centre = VIEWBOX / 2;

  return (
    <svg
      data-familiar-donut
      viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
      width={SIZE}
      height={SIZE}
      aria-hidden="true"
      focusable="false"
      className="shrink-0 overflow-visible"
    >
      <defs>
        <linearGradient id="recommend-donut-sweep" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="1" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.55" />
        </linearGradient>
        <filter id="recommend-donut-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.5" />
        </filter>
      </defs>

      {/* The unfamiliar remainder: present, quiet, never absent — the ring has
          to read as a whole for the sweep to read as a fraction of it. */}
      <circle
        cx={centre}
        cy={centre}
        r={RADIUS}
        fill="none"
        strokeWidth={STROKE}
        className="stroke-border"
      />

      {/* -90deg: SVG angles start at three o'clock; the reference starts the
          sweep at twelve. Applied to both arcs so the glow tracks the line. */}
      <g transform={`rotate(-90 ${centre} ${centre})`}>
        <circle
          cx={centre}
          cy={centre}
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={dash}
          filter="url(#recommend-donut-glow)"
          opacity="0.35"
        />
        <circle
          data-familiar-arc
          cx={centre}
          cy={centre}
          r={RADIUS}
          fill="none"
          stroke="url(#recommend-donut-sweep)"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={dash}
        />
      </g>
    </svg>
  );
}
