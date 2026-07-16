import { describe, expect, it } from "vitest";
import { dedupeKeyFor, titleFor } from "./dedupe";

describe("dedupeKeyFor", () => {
  it("is constant for once-in-a-lifetime types", () => {
    expect(dedupeKeyFor("first_shadow")).toBe("first_shadow");
  });
  it("scopes companion_grew per target phase", () => {
    expect(dedupeKeyFor("companion_grew", { phase: 2 })).toBe("companion_grew:2");
    expect(dedupeKeyFor("companion_grew", { phase: 3 })).toBe("companion_grew:3");
  });
  it("scopes line/card/video/jlpt types by their ref", () => {
    expect(dedupeKeyFor("line_mastered", { lineId: "L1" })).toBe("line_mastered:L1");
    expect(dedupeKeyFor("mining_saved", { cardId: "C1" })).toBe("mining_saved:C1");
    expect(dedupeKeyFor("first_video_completed", { videoId: "V1" })).toBe("first_video_completed:V1");
    expect(dedupeKeyFor("jlpt_passed", { jlptLevel: "N4" })).toBe("jlpt_passed:N4");
    expect(dedupeKeyFor("pinned_line", { lineId: "L9" })).toBe("pinned_line:L9");
  });
  it("throws when a required ref is missing", () => {
    expect(() => dedupeKeyFor("line_mastered")).toThrow();
  });
});

describe("titleFor", () => {
  it("returns a non-AI template string for discovered types", () => {
    expect(titleFor("first_shadow")).toBeTruthy();
    expect(titleFor("companion_grew", { phase: 2 })).toContain("2");
  });
  it("returns null for gifted pins (learner supplies their own)", () => {
    expect(titleFor("pinned_line")).toBeNull();
  });
});
