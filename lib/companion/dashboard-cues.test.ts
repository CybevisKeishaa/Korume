import { describe, expect, it } from "vitest";
import { resolveDashboardCue, type DashboardFacts } from "./dashboard-cues";

const noFacts: DashboardFacts = {
  missionCompletedToday: false,
  weeklyDeltas: { listening: null, pronunciation: null },
  weakest: [],
};

describe("resolveDashboardCue", () => {
  it("prioritizes a completed mission over every other cue", () => {
    expect(resolveDashboardCue({
      ...noFacts,
      missionCompletedToday: true,
      weeklyDeltas: { listening: 8, pronunciation: 6 },
      weakest: [{ family: "listening", metric: "accuracy", score: 40, practiceHref: "/shadowing/a/listening?format=typing" }],
    })).toEqual({ key: "cue.missionCompleted", values: {}, practiceHref: null, viewWeakness: false });
  });

  it("selects the largest significant positive weekly improvement, breaking ties with listening", () => {
    expect(resolveDashboardCue({ ...noFacts, weeklyDeltas: { listening: 8, pronunciation: 6 } }))
      .toEqual({ key: "cue.weeklyImproved", values: { skill: "listening", points: 8 }, practiceHref: null, viewWeakness: false });
    expect(resolveDashboardCue({ ...noFacts, weeklyDeltas: { listening: 5, pronunciation: 5 } }))
      .toEqual({ key: "cue.weeklyImproved", values: { skill: "listening", points: 5 }, practiceHref: null, viewWeakness: false });
  });

  it("does not turn small or negative changes into improvement cues", () => {
    expect(resolveDashboardCue({ ...noFacts, weeklyDeltas: { listening: 4, pronunciation: -8 } })).toBeNull();
  });

  it("uses the first actionable weakness when no higher-priority cue exists", () => {
    expect(resolveDashboardCue({
      ...noFacts,
      weakest: [
        { family: "reading", metric: "score", score: 40, practiceHref: null },
        { family: "listening", metric: "accuracy", score: 55, practiceHref: "/shadowing/a/listening?format=typing" },
      ],
    })).toEqual({
      key: "cue.weakSkill", values: { skill: "listening", score: 55 },
      practiceHref: "/shadowing/a/listening?format=typing", viewWeakness: true,
    });
  });

  it("is silent when no fact warrants a cue", () => {
    expect(resolveDashboardCue(noFacts)).toBeNull();
  });

  it("is deterministic for the same facts", () => {
    const facts: DashboardFacts = {
      ...noFacts,
      weakest: [{ family: "pronunciation", metric: "pitch", score: 61, practiceHref: "/shadowing/a" }],
    };
    expect(resolveDashboardCue(facts)).toEqual(resolveDashboardCue(facts));
  });
});
