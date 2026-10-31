import { describe, expect, it } from "vitest";
import { modeQuality } from "./thresholds";

const scored = (score: number) => ({ kind: "scored" as const, score });

describe("modeQuality (spec §5.1 table)", () => {
  it("keeps pronunciation boundary scores on the intended quality side", () => {
    expect([59, 60, 79, 80].map((score) => modeQuality("pronunciation", scored(score))))
      .toEqual(["needs_work", "practiced", "practiced", "strong"]);
  });

  it.each(["listeningDictation", "listeningCloze"] as const)("keeps %s boundary scores on the one Listening cut", (mode) => {
    expect([79, 80, 94, 95].map((score) => modeQuality(mode, scored(score))))
      .toEqual(["needs_work", "practiced", "practiced", "strong"]);
  });

  it("keeps retention boundary scores on the intended quality side", () => {
    expect([49, 50, 79, 80].map((score) => modeQuality("retention", scored(score))))
      .toEqual(["needs_work", "practiced", "practiced", "strong"]);
    expect(modeQuality("retention", { kind: "not_enough_data" })).toBe("not_started");
  });

  it("maps shadowing completion, progress, and absence directly", () => {
    expect(modeQuality("shadowing", { kind: "complete" })).toBe("strong");
    expect(modeQuality("shadowing", { kind: "in_progress", percent: 10 })).toBe("practiced");
    expect(modeQuality("shadowing", { kind: "not_started" })).toBe("not_started");
  });

  it("reads a watched-to position as practised, never strong", () => {
    expect(modeQuality("shadowing", { kind: "reached", line: 51, total: 194 })).toBe("practiced");
    expect(modeQuality("shadowing", { kind: "reached", line: 194, total: 194 })).toBe("practiced");
  });
});
