/**
 * The Korume Learning Thread, as a segment (spec §3).
 *
 * ⚠️ There is no page-spanning thread element. Each section owns its own
 * segment; continuity comes from the shared tokens in `app/globals.css`, not
 * from DOM topology. Two adjacent segments may differ completely in geometry.
 *
 * ⚠️ Morphology is a PROP, never a new component. §4's pitch contours and §6's
 * chain cascade are the KNOWLEDGE CURVE and PATH morphologies already, realised
 * by shipped mechanisms — they are frozen and get no segment (spec §3.3).
 *
 * ## `vectorEffect="non-scaling-stroke"` (review fix round 1, I4)
 *
 * `--thread-width` is an INVARIANT token, but a plain SVG stroke is not: it is
 * drawn in the path's local user-space, which each caller's `className` then
 * scales to its own rendered box. §5's own first segment already proved it —
 * `connection`'s `viewBox="0 0 96 24"` rendered at `w-3xl h-md` (64x16 CSS px)
 * is a uniform 2/3 scale, so an unmarked 2px stroke draws at 1.33px, 67% of
 * the token, and any later section's sizing could rescale it again, silently.
 * `non-scaling-stroke` is the SVG feature built for exactly this: it evaluates
 * stroke geometry in SCREEN units, ignoring the viewBox->viewport transform,
 * so the token's width holds regardless of how a caller sizes the box — and
 * local geometry (the `PATHS`/`VIEWBOXES` below) stays free to differ per
 * morphology, which the spec requires.
 *
 * ⚠️ Verified in a real browser, not assumed: `non-scaling-stroke` moves stroke
 * geometry into screen space, and this segment's draw (`stroke-dasharray`/
 * `stroke-dashoffset` in `app/globals.css`) depends on `pathLength={1}`
 * normalizing that SAME path to a 0..1 dash coordinate system. The two turned
 * out not to conflict — `pathLength` governs the dash coordinate system,
 * `vector-effect` only the stroke's WIDTH scaling — confirmed by rendering
 * `/en#recommend`, reading `getComputedStyle(path).strokeWidth` in real CSS px
 * against the token, and watching the sweep still animate 0 -> drawn under
 * both normal and reduced motion (task 4 fix round 1 report has the numbers).
 */
export const THREAD_SEGMENT_ATTR = "data-thread-segment";

export const THREAD_MORPHOLOGIES = ["line", "connection", "resolution"] as const;
export type ThreadMorphology = (typeof THREAD_MORPHOLOGIES)[number];

/** Local geometry per morphology — free to differ, by design. */
const PATHS: Record<ThreadMorphology, string> = {
  line: "M 12 0 L 12 64",
  connection: "M 0 12 L 96 12",
  resolution: "M 12 0 C 12 28 12 40 4 56",
};

const VIEWBOXES: Record<ThreadMorphology, string> = {
  line: "0 0 24 64",
  connection: "0 0 96 24",
  resolution: "0 0 24 64",
};

export function ThreadSegment({
  morphology,
  className,
}: {
  morphology: ThreadMorphology;
  className?: string;
}) {
  return (
    <svg
      {...{ [THREAD_SEGMENT_ATTR]: morphology }}
      viewBox={VIEWBOXES[morphology]}
      aria-hidden="true"
      focusable="false"
      className={className}
      preserveAspectRatio="none"
    >
      <path
        d={PATHS[morphology]}
        fill="none"
        pathLength={1}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
