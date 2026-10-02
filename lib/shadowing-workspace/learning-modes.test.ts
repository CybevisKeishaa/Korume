import { describe, expect, it } from "vitest";
import { completedModes, LEARNING_MODES, shouldRenderModeNav } from "./learning-modes";

describe("learning modes", () => {
  it("exposes only shadowing as complete in 1a", () => {
    expect(completedModes()).toEqual([{ id: "shadowing", segment: "", complete: true }]);
    expect(shouldRenderModeNav()).toBe(false);
  });

  it("shows navigation for two complete modes in their registry order", () => {
    const modes = [...LEARNING_MODES, { id: "listening" as const, segment: "listening" as const, complete: true }];
    expect(completedModes(modes).map(({ id }) => id)).toEqual(["shadowing", "listening"]);
    expect(shouldRenderModeNav(modes)).toBe(true);
  });
});
