import { describe, expect, it } from "vitest";
import { speechKeyFor } from "./speech";
import type { ExperienceContext } from "./contexts";

describe("speechKeyFor", () => {
  it("maps every context to a distinct companion.* key", () => {
    const contexts: ExperienceContext[] = ["finished_shadowing", "memory_created", "empty_library", "empty_mining_deck"];
    const keys = contexts.map((c) => speechKeyFor(c, 1));
    expect(keys).toEqual([
      "speech.finishedShadowing",
      "speech.memoryCreated",
      "speech.emptyLibrary",
      "speech.emptyMiningDeck",
    ]);
    expect(new Set(keys).size).toBe(4);
  });

  it("is phase-stable in this plan (register shifts arrive with adaptive voice)", () => {
    expect(speechKeyFor("finished_shadowing", 1)).toBe(speechKeyFor("finished_shadowing", 4));
  });
});
