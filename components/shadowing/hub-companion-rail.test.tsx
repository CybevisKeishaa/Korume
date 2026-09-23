import { describe, expect, it } from "vitest";
import enShadowing from "@/messages/en/shadowing.json";
import { render, screen } from "@/test/render";
import { HubCompanionRail } from "./hub-companion-rail";

const labels = {
  preparation: enShadowing.hub.rail.preparation,
  noPreparation: enShadowing.hub.rail.noPreparation,
  todayGoal: enShadowing.hub.rail.todayGoal,
  noGoal: enShadowing.hub.rail.noGoal,
  dailyGoal: (minutes: number) => enShadowing.hub.rail.dailyGoal.replace("{minutes}", String(minutes)),
  weeklyProgress: enShadowing.hub.rail.weeklyProgress,
  noWeeklyActivity: enShadowing.hub.rail.noWeeklyActivity,
  suggestion: enShadowing.hub.rail.suggestion,
  noSuggestion: enShadowing.hub.rail.noSuggestion,
  openLesson: enShadowing.hub.actions.openLesson,
  knownWordFit: (percent: number) => `${percent}% words you know`,
};

const rail = {
  stats: {
    xp: 42,
    level: { level: 2, levelFloorXp: 20, nextLevelXp: 100, progressRatio: 0.275 },
    streakCurrent: 4,
    streakLongest: 9,
    lastActiveDate: "2026-09-07",
    badges: [],
    srsDueCount: 3,
  },
  suggestion: {
    lesson: { id: "lesson-1", youtubeVideoId: "yt-1", title: "Ordering at a restaurant", durationSeconds: 600, thumbnailUrl: null, jlptLevelEstimate: "N4" },
    reason: { kind: "known-word-fit" as const, knownRatio: 0.78, totalWords: 100, knownWords: 78 },
  },
};

describe("HubCompanionRail", () => {
  it("uses labelled regions for the truthful continuity summary and exposes a suggestion link", () => {
    render(<HubCompanionRail rail={rail} labels={labels} dailyGoalMinutes={null} />);

    expect(screen.getByRole("region", { name: labels.preparation })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: labels.todayGoal })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: labels.weeklyProgress })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: `${labels.openLesson}: Ordering at a restaurant` })).toHaveAttribute("href", "/en/shadowing/lesson-1");
    expect(screen.getByText("78% words you know")).toBeInTheDocument();
  });

  /**
   * ⚠️ Restored during review of the daily-goal change, which had replaced this
   * test with two narrower ones and silently dropped three of its assertions:
   * that `noPreparation` and `noSuggestion` render at all, and that NO "Open
   * lesson" link exists when there is no rail to link to. The last is a real
   * behavioural guard — this component's whole contract is that it is "a
   * truthful study summary", so a link to a lesson that does not exist is the
   * exact defect it must not have.
   */
  it("renders explicit empty states rather than a fabricated lesson job, goal, chart, or insight", () => {
    render(<HubCompanionRail rail={null} labels={labels} dailyGoalMinutes={null} />);

    expect(screen.getByText(labels.noPreparation)).toBeInTheDocument();
    expect(screen.getByText(labels.noGoal)).toBeInTheDocument();
    expect(screen.getByText(labels.noWeeklyActivity)).toBeInTheDocument();
    expect(screen.getByText(labels.noSuggestion)).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: new RegExp(labels.openLesson) })).not.toBeInTheDocument();
  });

  /**
   * The goal is a number the user set, not a measurement of what they did
   * today — nothing counts minutes studied. So the card states the target and
   * stops: no bar, no "0 of 20", no percentage. A `progressbar` here would be
   * inventing data (spec §4.2).
   */
  it("renders the daily goal and no progress bar when a goal is set", () => {
    render(<HubCompanionRail rail={null} labels={labels} dailyGoalMinutes={20} />);

    expect(screen.getByText(labels.dailyGoal(20))).toBeInTheDocument();
    expect(screen.queryByText(labels.noGoal)).not.toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("does not announce an empty weekly state as a completed activity history", () => {
    render(<HubCompanionRail rail={rail} labels={labels} dailyGoalMinutes={null} />);

    expect(screen.getByText(labels.noWeeklyActivity)).toBeInTheDocument();
    expect(screen.queryByLabelText(/weekly activity chart/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Current streak")).not.toBeInTheDocument();
    expect(screen.queryByText("4")).not.toBeInTheDocument();
    expect(screen.queryByText("3 reviews due")).not.toBeInTheDocument();
  });
});
