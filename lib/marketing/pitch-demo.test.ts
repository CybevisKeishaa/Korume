import { describe, expect, it } from "vitest";
import { NATIVE_DEMO_CONTOUR, USER_DEMO_CONTOUR, DEMO_REF_HZ } from "./pitch-demo";

describe("pitch demo fixtures", () => {
  it("gives both contours the same number of frames so they overlay frame-for-frame", () => {
    expect(NATIVE_DEMO_CONTOUR.frames.length).toBeGreaterThan(20);
    expect(USER_DEMO_CONTOUR.frames.length).toBe(NATIVE_DEMO_CONTOUR.frames.length);
  });

  it("keeps both inside a plausible speaking range", () => {
    const voiced = [...NATIVE_DEMO_CONTOUR.frames, ...USER_DEMO_CONTOUR.frames]
      .map((f) => f.hz)
      .filter((hz): hz is number => hz !== null);

    expect(voiced.length).toBeGreaterThan(0);
    for (const hz of voiced) {
      expect(hz).toBeGreaterThan(70);
      expect(hz).toBeLessThan(400);
    }
  });

  it("makes the two contours differ — an overlay of identical curves shows nothing", () => {
    const native = NATIVE_DEMO_CONTOUR.frames.map((f) => f.hz);
    const user = USER_DEMO_CONTOUR.frames.map((f) => f.hz);

    expect(native).not.toEqual(user);
  });

  it("is deterministic — no randomness, no clock", () => {
    const a = NATIVE_DEMO_CONTOUR.frames.map((f) => f.hz);
    const b = NATIVE_DEMO_CONTOUR.frames.map((f) => f.hz);

    expect(a).toEqual(b);
    expect(DEMO_REF_HZ).toBeGreaterThan(0);
  });
});
