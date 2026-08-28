import { describe, expect, it } from "vitest";
import { toPlotPoints, MIN_SEMITONE_SPAN, RANGE_PADDING_SEMITONES } from "./plot";
import type { PitchContour } from "./types";

const contour = (hz: (number | null)[]): PitchContour => ({
  frames: hz.map((v, i) => ({ time: i * 0.01, hz: v })),
  sampleRate: 16000,
});

describe("toPlotPoints", () => {
  it("maps the first and last frame to the horizontal extremes", () => {
    const { points } = toPlotPoints(contour([200, 220, 240]), 220, 300, 100);

    expect(points).toHaveLength(3);
    expect(points[0]?.x).toBe(0);
    expect(points[2]?.x).toBe(300);
  });

  it("emits null for unvoiced frames so the renderer can break the line", () => {
    const { points } = toPlotPoints(contour([200, null, 240]), 220, 300, 100);

    expect(points).toHaveLength(3);
    expect(points[1]).toBeNull();
  });

  it("puts a higher pitch higher on the canvas (y grows downward)", () => {
    const { points } = toPlotPoints(contour([200, 300]), 220, 300, 100);

    expect(points[0]).not.toBeNull();
    expect(points[1]).not.toBeNull();
    expect(points[1]!.y).toBeLessThan(points[0]!.y);
  });

  it("widens a nearly-flat take to the minimum span rather than amplifying noise", () => {
    // Two frames a hair apart: without a floor these would fill the full height.
    const { points } = toPlotPoints(contour([220, 221]), 220, 300, 100);

    expect(MIN_SEMITONE_SPAN).toBe(4);
    const drop = Math.abs(points[1]!.y - points[0]!.y);
    expect(drop).toBeLessThan(10);
  });

  it("places the reference baseline inside the plot", () => {
    const { baselineY } = toPlotPoints(contour([200, 240]), 220, 300, 100);

    expect(baselineY).toBeGreaterThan(0);
    expect(baselineY).toBeLessThan(100);
    expect(RANGE_PADDING_SEMITONES).toBe(1);
  });

  it("returns a point per frame even when nothing is voiced", () => {
    const { points } = toPlotPoints(contour([null, null]), 220, 300, 100);

    expect(points).toHaveLength(2);
    expect(points.every((p) => p === null)).toBe(true);
  });
});
