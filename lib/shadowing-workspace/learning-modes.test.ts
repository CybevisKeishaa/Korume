import { describe, expect, it } from "vitest";
import { completedModes, LEARNING_MODES, shouldRenderModeNav, practiceModeFromPath } from "./learning-modes";

describe("learning modes", () => {
  it("Shadowing, Pronunciation and Summary are complete; the bar renders (practice modes D24)", () => {
    expect(completedModes().map(({ id }) => id)).toEqual(["shadowing", "pronunciation", "summary"]);
    expect(shouldRenderModeNav()).toBe(true);
  });

  it("shows navigation for two complete modes in their registry order", () => {
    const modes = LEARNING_MODES.map((mode) => ({ ...mode, complete: mode.id === "shadowing" || mode.id === "listening" }));
    expect(completedModes(modes).map(({ id }) => id)).toEqual(["shadowing", "listening"]);
    expect(shouldRenderModeNav(modes)).toBe(true);
  });
});


describe("practiceModeFromPath", () => {
  it.each([
    ["/shadowing/abc", "shadowing"],
    ["/en/shadowing/abc/pronunciation", "pronunciation"],
    ["/shadowing/abc/pronunciation/", "pronunciation"],
    ["/shadowing/abc/listening", "listening"],
    ["/shadowing/abc/summary", "shadowing"],
    ["/shadowing/abc/listening/extra", "shadowing"],
    ["/other", "shadowing"],
  ])("%s resolves to %s", (path, expected) => {
    expect(practiceModeFromPath(path)).toBe(expected);
  });
});
