import { describe, expect, it } from "vitest";
import { completedModes, LEARNING_MODES, shouldRenderModeNav } from "./learning-modes";

describe("learning modes", () => {
  it("Shadowing and Summary are complete; the bar renders (summary spec 2026-10-04 §7.1)", () => {
    expect(completedModes().map(({ id }) => id)).toEqual(["shadowing", "summary"]);
    expect(shouldRenderModeNav()).toBe(true);
  });

  it("shows navigation for two complete modes in their registry order", () => {
    const modes = LEARNING_MODES.map((mode) => ({ ...mode, complete: mode.id === "shadowing" || mode.id === "listening" }));
    expect(completedModes(modes).map(({ id }) => id)).toEqual(["shadowing", "listening"]);
    expect(shouldRenderModeNav(modes)).toBe(true);
  });
});
