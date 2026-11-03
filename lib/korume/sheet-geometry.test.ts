import { describe, expect, it } from "vitest";
import { besideLauncher, centred, clampPoint, clampRail, clampRect, parseStoredPoint, resizeRect } from "./sheet-geometry";

const b = { vw: 1280, vh: 529, margin: 16, minW: 340, minH: 380 };
const t = { railMin: 260, railMax: 520, chatMin: 380 };

describe("sheet geometry", () => {
  it("clampRect sizes first, then positions", () => {
    expect(clampRect({ x: -50, y: 0, w: 2000, h: 100 }, b)).toEqual({ x: 16, y: 16, w: 1248, h: 380 });
  });
  it("resizeRect west keeps the east edge", () => {
    expect(resizeRect({ x: 100, y: 100, w: 400, h: 400 }, "w", -50, 0, b)).toEqual({ x: 50, y: 100, w: 450, h: 400 });
  });
  it("resizeRect nw stops at the minimum with the far edges fixed", () => {
    const r = resizeRect({ x: 100, y: 100, w: 400, h: 400 }, "nw", 200, 200, b);
    expect([r.w, r.h, r.x + r.w, r.y + r.h]).toEqual([340, 380, 500, 500]);
  });
  it("resizeRect se stops at the viewport margin", () => {
    const r = resizeRect({ x: 100, y: 100, w: 400, h: 400 }, "se", 5000, 5000, b);
    expect([r.x + r.w, r.y + r.h]).toEqual([1264, 513]);
  });
  it("besideLauncher grows away from the bottom-right corner", () => {
    const r = besideLauncher({ w: 400, h: 560 }, { x: 1180, y: 440, w: 64, h: 64 }, b);
    expect(r.x).toBe(844);
    expect(r.h).toBe(497);
    expect(r.y + r.h).toBeLessThanOrEqual(513);
  });
  it("besideLauncher from the top-left starts at the launcher", () => {
    const r = besideLauncher({ w: 400, h: 400 }, { x: 20, y: 20, w: 64, h: 64 }, b);
    expect([r.x, r.y]).toEqual([20, 20]);
  });
  it("centred clamps the height", () => {
    expect(centred({ w: 1040, h: 680 }, b)).toEqual({ x: 120, y: 16, w: 1040, h: 497 });
  });
  it("clampRail respects the chat minimum", () => {
    expect(clampRail(600, 900, t)).toBe(520);
    expect(clampRail(300, 600, t)).toBe(260);
    expect(clampRail(520, 760, t)).toBe(380); // the chat minimum binds below railMax
  });
  it("clampPoint keeps the mascot on screen", () => {
    expect(clampPoint({ x: 5000, y: -9 }, { w: 64, h: 64 }, b)).toEqual({ x: 1200, y: 16 });
  });
  it("parseStoredPoint rejects garbage", () => {
    expect(parseStoredPoint("{bad")).toBeNull();
    expect(parseStoredPoint('{"x":"a","y":1}')).toBeNull();
    expect(parseStoredPoint(null)).toBeNull();
    expect(parseStoredPoint("null")).toBeNull();
    expect(parseStoredPoint('{"x":5,"y":6}')).toEqual({ x: 5, y: 6 });
  });
});
