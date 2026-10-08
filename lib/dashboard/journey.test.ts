import { describe, expect, it } from "vitest";
import type { JlptLevel } from "@/lib/conversation-types";
import { buildJourney, type JourneyLevelRow } from "./journey";

const LEVELS: readonly JlptLevel[] = ["N5", "N4", "N3", "N2", "N1"];

function row(level: JlptLevel, coreTotal = 0, coreCompleted = 0, plusAccessible = 0): JourneyLevelRow {
  return {
    level,
    coreTotal,
    coreCompleted,
    plusTotal: plusAccessible,
    plusAccessible,
    next: coreCompleted < coreTotal ? { videoId: `${level}-video`, title: `${level} lesson`, position: coreCompleted + 1 } : null,
  };
}

function rows(overrides: Partial<Record<JlptLevel, JourneyLevelRow>> = {}): JourneyLevelRow[] {
  return LEVELS.map((level) => overrides[level] ?? row(level));
}

describe("buildJourney", () => {
  it("reports authoring when no level has core curriculum", () => {
    expect(buildJourney(rows())).toEqual({ kind: "authoring" });
  });

  it("uses the first incomplete available level as current", () => {
    expect(buildJourney(rows({ N5: row("N5", 3, 3), N4: row("N4", 2, 1) }))).toEqual({
      kind: "active",
      current: "N4",
      next: { videoId: "N4-video", title: "N4 lesson" },
      remaining: 1,
      plus: { total: 0, accessible: 0 },
      nodes: [
        { level: "N5", state: "completed", percent: 100 },
        { level: "N4", state: "current", percent: 50 },
        { level: "N3", state: "unavailable", percent: null },
      ],
    });
  });

  it.each([
    ["N5", ["N5", "N4", "N3"]],
    ["N4", ["N5", "N4", "N3"]],
    ["N3", ["N4", "N3", "N2"]],
    ["N2", ["N3", "N2", "N1"]],
    ["N1", ["N3", "N2", "N1"]],
  ] as const)("uses the C5 window when %s is current", (current, expectedLevels) => {
    expect(["N5", "N4", "N3", "N2", "N1"]).toHaveLength(5);
    const currentIndex = LEVELS.indexOf(current);
    const input = rows(Object.fromEntries(LEVELS.map((level, index) => [level, row(level, 1, index < currentIndex ? 1 : 0)])));

    const journey = buildJourney(input);
    expect(journey.kind).toBe("active");
    if (journey.kind !== "active") return;
    expect(journey.nodes.map((node) => node.level)).toEqual(expectedLevels);
  });

  it("keeps a completed later level completed while the first incomplete level is current", () => {
    const journey = buildJourney(rows({ N5: row("N5", 2, 1), N4: row("N4", 2, 2) }));
    expect(journey).toMatchObject({ kind: "active", current: "N5" });
    expect(journey.kind === "active" && journey.nodes.find((node) => node.level === "N4")).toEqual({
      level: "N4", state: "completed", percent: 100,
    });
  });

  it("locks incomplete curriculum after the current level and keeps missing curriculum unavailable", () => {
    const journey = buildJourney(rows({ N5: row("N5", 2, 1), N4: row("N4", 2, 0) }));
    expect(journey).toMatchObject({ kind: "active" });
    expect(journey.kind === "active" && journey.nodes).toEqual([
      { level: "N5", state: "current", percent: 50 },
      { level: "N4", state: "locked", percent: 0 },
      { level: "N3", state: "unavailable", percent: null },
    ]);
  });

  it("shows the highest three available completed levels without inventing a next lesson", () => {
    expect(buildJourney(rows({ N5: row("N5", 1, 1), N4: row("N4", 1, 1) }))).toEqual({
      kind: "complete",
      nodes: [
        { level: "N5", state: "completed", percent: 100 },
        { level: "N4", state: "completed", percent: 100 },
      ],
    });
  });

  it("never lets PLUS accessibility change core states or percentages", () => {
    const before = rows({ N5: row("N5", 2, 1) });
    const after = rows({ N5: row("N5", 2, 1, 4) });
    const beforeJourney = buildJourney(before);
    const afterJourney = buildJourney(after);
    expect(beforeJourney.kind).toBe("active");
    expect(afterJourney.kind).toBe("active");
    if (beforeJourney.kind !== "active" || afterJourney.kind !== "active") return;
    expect(afterJourney.nodes).toEqual(beforeJourney.nodes);
  });
});
