import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { StreakCard } from "./streak-card";

describe("StreakCard", () => {
  it("shows current and longest streak when active today", () => {
    render(
      <StreakCard streakCurrent={5} streakLongest={9} lastActiveDate="2026-07-13" today="2026-07-13" />,
    );
    expect(screen.getByRole("heading", { name: "Streak" })).toBeInTheDocument();
    expect(screen.getByText(/5/)).toBeInTheDocument();
    expect(screen.getByText("day streak")).toBeInTheDocument();
    expect(screen.getByText("Longest: 9 days")).toBeInTheDocument();
    expect(screen.queryByText(/keep it going today/i)).not.toBeInTheDocument();
  });

  it("shows a neutral, non-guilt-tripping nudge when the user hasn't studied today yet (product principle G3)", () => {
    render(
      <StreakCard streakCurrent={5} streakLongest={9} lastActiveDate="2026-07-12" today="2026-07-13" />,
    );
    expect(
      screen.getByText("Keep it going today — study one item to extend it."),
    ).toBeInTheDocument();
    // No FOMO/guilt language.
    expect(screen.queryByText(/lose your streak/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/about to/i)).not.toBeInTheDocument();
  });

  it("handles a brand-new user with no activity yet", () => {
    render(<StreakCard streakCurrent={0} streakLongest={0} lastActiveDate={null} today="2026-07-13" />);
    expect(screen.getByText(/keep it going today/i)).toBeInTheDocument();
  });
});
