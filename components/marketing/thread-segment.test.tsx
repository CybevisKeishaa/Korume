import { render } from "@/test/render";
import { describe, expect, it } from "vitest";
import { ThreadSegment, THREAD_MORPHOLOGIES, THREAD_SEGMENT_ATTR } from "./thread-segment";

describe("<ThreadSegment />", () => {
  it("offers every morphology the spec names", () => {
    expect(THREAD_MORPHOLOGIES).toEqual(["line", "connection", "resolution"]);
    expect(THREAD_MORPHOLOGIES.length).toBeGreaterThan(0);
  });

  it.each(THREAD_MORPHOLOGIES)("renders the %s morphology, marked and hidden from AT", (m) => {
    const { container } = render(<ThreadSegment morphology={m} />);
    const svg = container.querySelector(`[${THREAD_SEGMENT_ATTR}]`);
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute(THREAD_SEGMENT_ATTR, m);
    // The thread carries no information a screen reader needs; the section's
    // own copy does. It must not appear in the accessibility tree.
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  // Review fix round 1 (m3): the test above only ever asserted the wrapper
  // `<svg>` — dropping `pathLength` (the dash-draw's normalized coordinate
  // system, `app/globals.css`'s `stroke-draw` keyframe depends on it reading
  // 0..1) or `vectorEffect="non-scaling-stroke"` (I4 — keeps the invariant
  // `--thread-width` from silently rescaling with each caller's box) was
  // GREEN. This asserts the thing that actually draws.
  it.each(THREAD_MORPHOLOGIES)("draws the %s morphology with a normalized, non-scaling path", (m) => {
    const { container } = render(<ThreadSegment morphology={m} />);
    const path = container.querySelector("path");
    expect(path).not.toBeNull();
    expect(path).toHaveAttribute("pathLength", "1");
    expect(path).toHaveAttribute("vector-effect", "non-scaling-stroke");
  });
});
