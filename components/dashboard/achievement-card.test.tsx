import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { AchievementCard } from "./achievement-card";

describe("AchievementCard", () => {
  it("localizes real database badge keys for both earned and in-progress badges", () => {
    render(<AchievementCard snapshot={{
      earned: [{ id: "a", name: "first_steps", description: null, iconUrl: null, earnedOn: "2026-10-09" }],
      inProgress: [{ id: "b", name: "week_streak", description: null, iconUrl: null, progress: { kind: "streak", current: 3, target: 7 } }],
    }} today="2026-10-10" />);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual(["First StepsEarned yesterday", "7-Day StreakCurrent streak 3/7"]);
    expect(screen.queryByText(/first_steps|week_streak/)).not.toBeInTheDocument();
  });

  it("renders earned badges before progress and links to Profile", () => {
    render(<AchievementCard snapshot={{ earned: [{ id: "a", name: "First step", description: null, iconUrl: null, earnedOn: "2026-10-09" }], inProgress: [] }} today="2026-10-10" />);
    expect(screen.getByText("Earned yesterday")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View achievements" })).toHaveAttribute("href", "/en/profile#achievements");
  });

  it("recognizes yesterday across a month boundary", () => {
    render(<AchievementCard snapshot={{ earned: [{ id: "a", name: "First step", description: null, iconUrl: null, earnedOn: "2026-02-28" }], inProgress: [] }} today="2026-03-01" />);
    expect(screen.getByText("Earned yesterday")).toBeInTheDocument();
  });

  it("prints an older study date in the locale without shifting it", () => {
    render(<AchievementCard snapshot={{ earned: [{ id: "a", name: "First step", description: null, iconUrl: null, earnedOn: "2026-10-01" }], inProgress: [] }} today="2026-10-10" />);
    expect(screen.getByText("Earned Oct 1, 2026")).toBeInTheDocument();
  });

  it("shows the empty state for a new account", () => {
    render(<AchievementCard snapshot={{ earned: [], inProgress: [] }} today="2026-10-10" />);
    expect(screen.getByText("Your first achievement will appear here.")).toBeInTheDocument();
  });

  it("renders a local error instead of an empty achievement state", () => {
    render(<AchievementCard error snapshot={{ earned: [], inProgress: [] }} today="2026-10-10" />);
    expect(screen.getByText("This part couldn't load right now.")).toBeInTheDocument();
  });
});
