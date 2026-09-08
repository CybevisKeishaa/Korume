import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { HubCompanionRail } from "./hub-companion-rail";

const labels = {
  preparation: "Lesson preparation",
  noPreparation: "No lesson is being prepared right now.",
  todayGoal: "Today's goal",
  noGoal: "No daily goal is set yet.",
  weeklyProgress: "Weekly progress",
  noWeeklyActivity: "No weekly shadowing activity has been recorded yet.",
  streak: "Current streak",
  reviewsDue: (count: number) => `${count} reviews due`,
  suggestion: "Suggested next lesson",
  noSuggestion: "No lesson suggestion is available yet.",
  openLesson: "Open lesson",
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
    render(<HubCompanionRail rail={rail} labels={labels} />);

    expect(screen.getByRole("region", { name: "Lesson preparation" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Today's goal" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Weekly progress" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open lesson: Ordering at a restaurant" })).toHaveAttribute("href", "/en/shadowing/lesson-1");
    expect(screen.getByText("78% words you know")).toBeInTheDocument();
  });

  it("renders explicit empty states rather than a fabricated lesson job, goal, chart, or insight", () => {
    render(<HubCompanionRail rail={null} labels={labels} />);

    expect(screen.getByText("No lesson is being prepared right now.")).toBeInTheDocument();
    expect(screen.getByText("No daily goal is set yet.")).toBeInTheDocument();
    expect(screen.getByText("No weekly shadowing activity has been recorded yet.")).toBeInTheDocument();
    expect(screen.getByText("No lesson suggestion is available yet.")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Open lesson/ })).not.toBeInTheDocument();
  });

  it("does not announce an empty weekly state as a completed activity history", () => {
    render(<HubCompanionRail rail={rail} labels={labels} />);

    expect(screen.getByText("No weekly shadowing activity has been recorded yet.")).toBeInTheDocument();
    expect(screen.queryByLabelText(/weekly activity chart/i)).not.toBeInTheDocument();
  });
});
