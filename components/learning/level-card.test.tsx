import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { LevelCard } from "./level-card";

describe("LevelCard", () => {
  it("shows the level, xp and an accessible progress bar toward the next level", () => {
    render(
      <LevelCard
        xp={150}
        level={{ level: 2, levelFloorXp: 100, nextLevelXp: 300, progressRatio: 0.25 }}
      />,
    );

    expect(screen.getByRole("heading", { name: "Level 2" })).toBeInTheDocument();
    expect(screen.getByText("150 XP")).toBeInTheDocument();

    const progress = screen.getByRole("progressbar");
    expect(progress).toHaveAttribute("aria-valuenow", "25");
    expect(progress).toHaveAttribute("aria-valuemin", "0");
    expect(progress).toHaveAttribute("aria-valuemax", "100");
    expect(progress).toHaveAttribute("aria-label", "Progress to level 3");
    // Progress must also be visible as text, not conveyed by color/width alone.
    expect(screen.getByText(/25%/)).toBeInTheDocument();
    expect(screen.getByText(/50 XP to level 3/)).toBeInTheDocument();
  });

  it("renders 0% progress without dividing by zero when the span is 0", () => {
    render(
      <LevelCard xp={0} level={{ level: 1, levelFloorXp: 0, nextLevelXp: 0, progressRatio: 0 }} />,
    );
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  });
});
