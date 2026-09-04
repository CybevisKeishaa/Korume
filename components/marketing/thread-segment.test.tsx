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
});
