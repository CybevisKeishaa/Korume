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
      <path d={PATHS[morphology]} fill="none" pathLength={1} />
    </svg>
  );
}
