/**
 * §2's constellation connectors — the dotted paths that leave each chip and
 * converge on a glowing node above the example sentence (spec §13.1.2).
 *
 * ⚠️ DECORATIVE, ALWAYS (spec §13.2). Nothing here is derived from user state,
 * SRS data or the difficulty engine; nothing is clickable; deleting the whole
 * layer loses decoration and no meaning — every chip says what it is in its own
 * visible text. Hence `aria-hidden`, `focusable="false"`, `pointer-events-none`
 * and no focusable descendant.
 *
 * ## Why three SVGs and not one stretched overlay
 *
 * The previous version drew six straight rays in `viewBox="0 0 100 100"` with
 * `preserveAspectRatio="none"`. In a box that is not square that maps x and y
 * by different factors, so the "star" shears, the stroke width differs between
 * a near-vertical ray and a near-horizontal one, and the dash rhythm goes
 * uneven along any diagonal. That is the crude stretched asterisk the user saw.
 *
 * The fix is to stop stretching. The layer is a three-column grid that mirrors
 * the chip grid exactly (`grid-cols-3` + the same `gap-sm`), so each column's
 * centre line sits on its chip's centre line. Each column holds its own SVG
 * with the SAME narrow viewBox and the DEFAULT `preserveAspectRatio`
 * (`xMidYMid meet`) — a uniform scale, so circles stay circular and dashes stay
 * even. Because the viewBox is much narrower than it is tall while the grid
 * cell is wider than it is tall, `meet` is always height-constrained: the
 * vertical axis maps 1:1 onto the band, and all three columns resolve to the
 * identical scale factor. Stroke width and dash spacing are therefore uniform
 * across every ray at every viewport, which is what a single stretched overlay
 * could not promise.
 *
 * Coordinates are in viewBox units and express PROPORTIONS of the band, not
 * pixels — y runs 0 (bottom edge of the top chips) to 100 (top edge of the
 * bottom chips), x is 0 on the column's centre line. Rule #0 is about class
 * names copying Figma pixels; an SVG's internal coordinate system is its own
 * unitless space (same reasoning as `pitch-showcase.tsx`'s VIEWBOX_WIDTH).
 */

/** Symmetric about x=0 so centring the SVG in its column centres the ray. */
const VIEW_BOX = "-24 0 48 100";
/** Where the side rays turn inward — the example sentence's vertical middle. */
const TURN_Y = 48;
/**
 * Corner radius of that turn, and how far the ray points on past it.
 *
 * Fix F3: `TIP_X` was 9, which at the layer's 1.12 scale left only ~3.4px of
 * straight run after the corner — about ONE dash, so the turn read as a
 * detached speck rather than as direction. The reference's horizontal run is
 * ~15px at build scale and carries two or three dashes; 13 units x 1.12 = 14.6px
 * reproduces that. The tip still clears the example sentence (measured).
 */
const TURN_R = 6;
const TIP_X = 13;
/** The glowing node sits high in the band, above the sentence, as 346:6275 does. */
const NODE_Y = 20;
/** The centre ray to the bottom chips restarts below the translation line. */
const BOTTOM_RAY_Y = 78;
const DASH = "1.6 3.4";

const GLOW_ID = "problem-node-glow";
const FLARE_ID = "problem-node-flare";

/**
 * Left rays: drop out of the top chip / rise out of the bottom chip, then turn
 * inward on a rounded corner and point at the sentence. `sweep` flips the whole
 * figure for the right-hand column.
 */
function SideRays({ sweep }: { sweep: 1 | -1 }) {
  const turnEnd = TURN_R * sweep;
  const tip = TIP_X * sweep;

  return (
    <>
      <path d={`M0 0 V${TURN_Y - TURN_R} Q0 ${TURN_Y} ${turnEnd} ${TURN_Y} H${tip}`} />
      <path d={`M0 100 V${TURN_Y + TURN_R} Q0 ${TURN_Y} ${turnEnd} ${TURN_Y} H${tip}`} />
    </>
  );
}

function ColumnSvg({ column, children }: { column: string; children: React.ReactNode }) {
  return (
    <svg
      data-connector-column={column}
      aria-hidden="true"
      focusable="false"
      viewBox={VIEW_BOX}
      className="h-full w-full overflow-visible"
    >
      <g
        fill="none"
        strokeWidth={1}
        strokeDasharray={DASH}
        strokeLinecap="round"
        className="stroke-primary/55"
      >
        {children}
      </g>
    </svg>
  );
}

/**
 * The centre column: a straight ray down to the node, the node itself, and a
 * straight ray on to the bottom chip. The node's warm bloom and the thin
 * horizontal flare through it are `<defs>` gradients rather than a CSS shadow
 * so they scale with the drawing; `overflow-visible` lets the flare spill past
 * the narrow viewBox across the neighbouring columns, as the reference's does.
 *
 * The gradient ids are module constants, not `useId()` — this section renders
 * once per page and `Problem` is a server component, where hooks are not
 * available.
 */
function CentreColumn() {
  return (
    <svg
      data-connector-column="centre"
      aria-hidden="true"
      focusable="false"
      viewBox={VIEW_BOX}
      className="h-full w-full overflow-visible"
    >
      <defs>
        <radialGradient id={GLOW_ID}>
          <stop offset="0" stopColor="hsl(var(--primary))" stopOpacity={0.7} />
          <stop offset="0.4" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
          <stop offset="1" stopColor="hsl(var(--primary))" stopOpacity={0} />
        </radialGradient>
        {/*
          Fix F4: this was a `<rect height="1">` under a horizontal-only
          gradient — diffuse across the flare but knife-sharp top and bottom, so
          just above the sentence it read as a divider rule rather than as light.
          A radial gradient painted onto a wide, shallow ellipse falls off on
          BOTH axes, which is what the reference's flare does.
        */}
        <radialGradient id={FLARE_ID}>
          <stop offset="0" stopColor="hsl(var(--primary))" stopOpacity={0.75} />
          <stop offset="0.35" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
          <stop offset="1" stopColor="hsl(var(--primary))" stopOpacity={0} />
        </radialGradient>
      </defs>

      <g
        fill="none"
        strokeWidth={1}
        strokeDasharray={DASH}
        strokeLinecap="round"
        className="stroke-primary/55"
      >
        <path d={`M0 0 V${NODE_Y - 3}`} />
        <path d={`M0 100 V${BOTTOM_RAY_Y}`} />
      </g>

      <g data-connector-node>
        <circle cx="0" cy={NODE_Y} r="17" fill={`url(#${GLOW_ID})`} />
        <ellipse cx="0" cy={NODE_Y} rx="60" ry="3.4" fill={`url(#${FLARE_ID})`} />
        <circle cx="0" cy={NODE_Y} r="2" className="fill-primary" />
      </g>
    </svg>
  );
}

/**
 * Overlay for the band between the two chip rows. Absolutely fills its
 * positioned parent, so the band's own height — set by the sentence it wraps —
 * is what the 0..100 coordinate space maps onto.
 *
 * Desktop only (`hidden lg:grid`) — but NOT for the reason an earlier version of
 * this comment claimed (fix F5). The chip grid goes three-across at `sm:`, not
 * `lg:`, so between 640px and 1024px the three column centres do exist and this
 * layer could geometrically connect them. It stays hidden there deliberately:
 * that range is `Section`'s stacked layout, where the constellation spans the
 * full container, so the band is far wider than tall and the figure's
 * proportions — a long drop closing on a small inward nub — stop reading.
 * Restyling the rays for the stacked composition is not this task's scope.
 * Below `sm:` the chips genuinely are one column and there is nothing to
 * connect. Two later tasks read this file; the stated reason has to be true.
 */
export function ProblemConnectors() {
  return (
    <div
      data-connector
      aria-hidden="true"
      // `grid-rows-1` is load-bearing, not decoration: it makes the single row
      // `minmax(0, 1fr)` — a DEFINITE height. Without it the row is auto, each
      // SVG's `h-full` cannot resolve (the percentage would be cyclic), and the
      // SVG falls back to sizing itself from its viewBox aspect — which
      // rendered the rays ~2.5x too tall, spilling far past the band.
      className="pointer-events-none absolute inset-0 hidden grid-cols-3 grid-rows-1 gap-sm lg:grid"
    >
      <ColumnSvg column="left">
        <SideRays sweep={1} />
      </ColumnSvg>
      <CentreColumn />
      <ColumnSvg column="right">
        <SideRays sweep={-1} />
      </ColumnSvg>
    </div>
  );
}
