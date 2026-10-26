import { describe, expect, it } from "vitest";
import { completedModes, dictationFormat, LEARNING_MODES, listeningExercise, panelFormat, practiceModeFromPath, practiceStatsMode, shouldRenderModeNav } from "./learning-modes";

describe("learning modes", () => {
  it("all four modes are complete; the bar renders (practice modes D24)", () => {
    expect(completedModes().map(({ id }) => id)).toEqual(["shadowing", "pronunciation", "listening", "summary"]);
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

describe("listeningExercise / dictationFormat / practiceStatsMode (spec §3.0)", () => {
  it.each([
    ["dictation", { exercise: "dictation", easyFromLegacy: false, legacy: false }],
    ["cloze", { exercise: "cloze", easyFromLegacy: false, legacy: false }],
    ["typing", { exercise: "dictation", easyFromLegacy: false, legacy: true }],
    ["word_bank", { exercise: "dictation", easyFromLegacy: true, legacy: true }],
    ["foo", { exercise: null, easyFromLegacy: false, legacy: false }],
    ["", { exercise: null, easyFromLegacy: false, legacy: false }],
    [null, { exercise: null, easyFromLegacy: false, legacy: false }],
  ] as const)("format param %j reads as %j", (param, expected) => {
    expect(listeningExercise(param)).toEqual(expected);
  });

  it.each([["typing", "typing"], ["dictation", "typing"], ["word_bank", "word_bank"], [null, "word_bank"], ["cloze", "word_bank"], ["foo", "word_bank"]] as const)(
    "until the picker, format param %j renders today's %s panel (ruling P2)", (param, expected) => {
      expect(panelFormat(param)).toBe(expected);
    },
  );

  it("Chép chính tả writes typing, or word_bank in Chế độ dễ", () => {
    expect(dictationFormat(false)).toBe("typing");
    expect(dictationFormat(true)).toBe("word_bank");
  });

  it("maps a practice mode and the exercise to the stats mode; Shadowing and a Listening without exercise have none", () => {
    expect(practiceStatsMode("listening", "dictation")).toBe("dictation");
    expect(practiceStatsMode("listening", "cloze")).toBe("cloze");
    expect(practiceStatsMode("listening", null)).toBeNull();
    expect(practiceStatsMode("pronunciation", "cloze")).toBe("pronunciation");
    expect(practiceStatsMode("pronunciation", null)).toBe("pronunciation");
    expect(practiceStatsMode("shadowing", "dictation")).toBeNull();
  });
});
