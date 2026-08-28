import { describe, expect, it } from "vitest";
import { toPath } from "./contour-path";
import type { PlotPoint } from "@/lib/pitch";

const p = (x: number, y: number): PlotPoint => ({ x, y });

describe("toPath", () => {
  it("returns an empty string for no points", () => {
    expect(toPath([])).toBe("");
  });

  it("returns an empty string when every point is a gap", () => {
    expect(toPath([null, null, null])).toBe("");
  });

  it("draws one unbroken subpath when there are no gaps", () => {
    const d = toPath([p(0, 0), p(1, 1), p(2, 2)]);

    expect(d).toBe("M0.00 0.00 L1.00 1.00 L2.00 2.00");
    // Exactly one `M` (move-to) — a single subpath, never bridged into two.
    expect(d.match(/M/g)).toHaveLength(1);
  });

  it("starts a NEW subpath after a gap, rather than bridging it with a line", () => {
    const d = toPath([p(0, 0), null, p(2, 2)]);

    // Fix round 1, F4: this is the one behaviour that justifies this module
    // existing at all — without it, an unvoiced span would render as a
    // straight line jumping across the gap instead of two disconnected
    // strokes. Two `M`s prove two subpaths; zero `L`s proves neither point
    // touching the gap was ever connected to the other by a line-to.
    expect(d).toBe("M0.00 0.00 M2.00 2.00");
    expect(d.match(/M/g)).toHaveLength(2);
    expect(d.match(/L/g)).toBeNull();
  });

  it("handles a gap at the start — the first real point still opens its own subpath", () => {
    const d = toPath([null, p(1, 1), p(2, 2)]);

    expect(d).toBe("M1.00 1.00 L2.00 2.00");
  });

  it("handles a gap at the end — trailing nulls add nothing", () => {
    const d = toPath([p(0, 0), p(1, 1), null]);

    expect(d).toBe("M0.00 0.00 L1.00 1.00");
  });

  it("handles consecutive gaps as a single break, not one break per null", () => {
    const d = toPath([p(0, 0), null, null, null, p(4, 4)]);

    expect(d).toBe("M0.00 0.00 M4.00 4.00");
    expect(d.match(/M/g)).toHaveLength(2);
  });
});
