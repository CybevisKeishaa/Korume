import { describe, expect, it } from "vitest";
import { toPath } from "./contour-path";
import type { PlotPoint } from "@/lib/pitch";

const p = (x: number, y: number): PlotPoint => ({ x, y });

/** Every coordinate pair a path command ends on, in order. */
function anchors(d: string): Array<[number, number]> {
  return [...d.matchAll(/[MC]((?:\s*-?[\d.]+){2,6})/g)].map((m) => {
    const nums = (m[1] ?? "").trim().split(/\s+/).map(Number);
    const y = nums[nums.length - 1];
    const x = nums[nums.length - 2];
    return [x ?? Number.NaN, y ?? Number.NaN];
  });
}

describe("toPath", () => {
  it("returns an empty string for no points", () => {
    expect(toPath([])).toBe("");
  });

  it("returns an empty string when every point is a gap", () => {
    expect(toPath([null, null, null])).toBe("");
  });

  it("draws a single point as a bare move-to", () => {
    expect(toPath([p(3, 4)])).toBe("M3.00 4.00");
  });

  it("draws TWO points as a line — a curve through two points is a line", () => {
    expect(toPath([p(0, 0), p(2, 2)])).toBe("M0.00 0.00 L2.00 2.00");
  });

  it("draws three or more points as CUBIC CURVES, never as line segments", () => {
    // ⚠️ This is the whole reason the module was rewritten (owner ruling,
    // 2026-09-03). A pitch contour joined by `L` commands is a polygon: every
    // sample is a corner, and at ~170 samples across ~480 px the trace reads
    // as a jagged generated chart rather than as a voice. Curvature has to be
    // continuous, so consecutive samples are joined by Bézier segments whose
    // control points come from their neighbours (Catmull-Rom).
    const d = toPath([p(0, 10), p(10, 0), p(20, 10), p(30, 0)]);

    expect(d).toContain("C");
    expect(d.match(/\bL/g), "no straight segments may survive").toBeNull();
    // One move-to plus one curve per interval.
    expect(d.match(/M/g)).toHaveLength(1);
    expect(d.match(/C/g)).toHaveLength(3);
  });

  it("passes exactly THROUGH every sample — smoothing may not move the data", () => {
    // A spline that approximates rather than interpolates would redraw the
    // pitch, not just the line between readings. Catmull-Rom interpolates, and
    // this is what pins that choice.
    const points = [p(0, 10), p(10, 0), p(20, 10), p(30, 4), p(40, 8)];
    const got = anchors(toPath(points));

    expect(got).toHaveLength(points.length);
    points.forEach((point, i) => {
      expect(got[i]?.[0], `x of sample ${i}`).toBeCloseTo(point.x, 2);
      expect(got[i]?.[1], `y of sample ${i}`).toBeCloseTo(point.y, 2);
    });
  });

  it("does not bow a straight run — smoothing adds no wobble that is not in the data", () => {
    // Catmull-Rom through collinear samples yields collinear control points,
    // so a flat stretch of a contour stays flat instead of gaining ripples.
    const d = toPath([p(0, 5), p(10, 5), p(20, 5), p(30, 5)]);
    const ys = [...d.matchAll(/-?[\d.]+\s+(-?[\d.]+)/g)].map((m) => Number(m[1]));

    expect(ys.length).toBeGreaterThan(3);
    for (const y of ys) expect(y).toBeCloseTo(5, 6);
  });

  it("starts a NEW subpath after a gap, rather than bridging it with a line", () => {
    const d = toPath([p(0, 0), null, p(2, 2)]);

    // Fix round 1, F4: this is the one behaviour that justifies this module
    // existing at all — without it, an unvoiced span would render as a
    // straight line jumping across the gap instead of two disconnected
    // strokes. Two `M`s prove two subpaths; no drawing command between them
    // proves neither point touching the gap was connected to the other.
    expect(d).toBe("M0.00 0.00 M2.00 2.00");
    expect(d.match(/M/g)).toHaveLength(2);
    expect(d.match(/[LC]/g)).toBeNull();
  });

  it("smooths each side of a gap independently — a curve may not reach across it", () => {
    // The tangent at the last sample before a gap must be computed from that
    // run alone. Borrowing a neighbour from the far side would bend the line
    // toward a phrase the speaker had not started yet.
    const d = toPath([p(0, 0), p(10, 0), p(20, 0), null, p(30, 90), p(40, 90), p(50, 90)]);

    expect(d.match(/M/g)).toHaveLength(2);
    // Two runs of three samples: two curve segments each, and every control
    // point stays on its own run's flat line.
    expect(d.match(/C/g)).toHaveLength(4);
    const [firstRun = "", secondRun = ""] = d.split("M").filter(Boolean);
    expect(firstRun).not.toContain("90");
    expect(secondRun).not.toContain(" 0.00");
  });

  it("handles a gap at the start — the first real point still opens its own subpath", () => {
    expect(toPath([null, p(1, 1), p(2, 2)])).toBe("M1.00 1.00 L2.00 2.00");
  });

  it("handles a gap at the end — trailing nulls add nothing", () => {
    expect(toPath([p(0, 0), p(1, 1), null])).toBe("M0.00 0.00 L1.00 1.00");
  });

  it("handles consecutive gaps as a single break, not one break per null", () => {
    const d = toPath([p(0, 0), null, null, null, p(4, 4)]);

    expect(d).toBe("M0.00 0.00 M4.00 4.00");
    expect(d.match(/M/g)).toHaveLength(2);
  });
});
