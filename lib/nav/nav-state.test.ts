import { describe, expect, it } from "vitest";
import { activeKey, dueLabel, navCookieValue, parseNavCookie, placeMenu, readNavCookie, REVIEW_ROUTES } from "./nav-state";

describe("nav cookie", () => {
  it("parses only the two known values", () => {
    expect(parseNavCookie("collapsed")).toBe(true);
    expect(parseNavCookie("expanded")).toBe(false);
    expect(parseNavCookie("rail")).toBeNull();
    expect(parseNavCookie(undefined)).toBeNull();
  });
  it("reads the value out of a full cookie header", () => {
    expect(readNavCookie("a=1; korume_nav=collapsed; b=2")).toBe(true);
    expect(readNavCookie("xkorume_nav=collapsed")).toBeNull();
    expect(readNavCookie("")).toBeNull();
  });
  it("writes a year-long, site-wide, lax cookie", () => {
    expect(navCookieValue(true)).toBe("korume_nav=collapsed; path=/; max-age=31536000; samesite=lax");
    expect(navCookieValue(false)).toBe("korume_nav=expanded; path=/; max-age=31536000; samesite=lax");
  });
});

describe("activeKey", () => {
  const candidates = [
    { key: "kanji", prefixes: ["/kanji"] },
    { key: "mining", prefixes: ["/mining"] },
    { key: "review", prefixes: REVIEW_ROUTES },
    { key: "dashboard", prefixes: ["/dashboard"] },
  ];
  it("matches exact and nested paths", () => {
    expect(activeKey("/dashboard", candidates)).toBe("dashboard");
    expect(activeKey("/kanji/42", candidates)).toBe("kanji");
  });
  it("lets the longest prefix win so review routes light Ôn tập, not their parent", () => {
    expect(activeKey("/kanji/review", candidates)).toBe("review");
    expect(activeKey("/mining/review", candidates)).toBe("review");
    expect(activeKey("/review", candidates)).toBe("review");
  });
  it("does not match a sibling that only shares characters", () => {
    expect(activeKey("/kanjix", candidates)).toBeNull();
    expect(activeKey("/settings", candidates)).toBeNull();
  });
});

describe("dueLabel", () => {
  it("caps at 99+", () => {
    expect(dueLabel(7)).toBe("7");
    expect(dueLabel(99)).toBe("99");
    expect(dueLabel(100)).toBe("99+");
  });
});

describe("placeMenu", () => {
  const viewport = { width: 1280, height: 529 };
  const menu = { width: 216, height: 220 };
  it("opens above the trigger, left-aligned", () => {
    expect(placeMenu({ left: 12, top: 470, right: 228, bottom: 514 }, menu, viewport, "above")).toEqual({ left: 12, top: 242 });
  });
  it("flips below when above would leave the viewport", () => {
    expect(placeMenu({ left: 12, top: 100, right: 228, bottom: 144 }, menu, viewport, "above")).toEqual({ left: 12, top: 152 });
  });
  it("opens to the right of a rail trigger, bottom-aligned, clamped inside", () => {
    expect(placeMenu({ left: 14, top: 470, right: 58, bottom: 514 }, menu, viewport, "right")).toEqual({ left: 66, top: 294 });
    expect(placeMenu({ left: 14, top: 10, right: 58, bottom: 54 }, menu, viewport, "right")).toEqual({ left: 66, top: 8 });
  });
  it("never leaves the right or bottom edge", () => {
    const placed = placeMenu({ left: 1200, top: 500, right: 1270, bottom: 520 }, menu, viewport, "right");
    expect(placed.left + menu.width).toBeLessThanOrEqual(1272);
    expect(placed.top + menu.height).toBeLessThanOrEqual(521);
  });
});
