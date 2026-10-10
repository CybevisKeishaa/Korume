import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { AchievementCard } from "./achievement-card";

describe("AchievementCard", () => {
  it("renders earned badges before progress and links to Profile", () => {
    render(<AchievementCard snapshot={{ earned: [{ id: "a", name: "First step", description: null, iconUrl: null, earnedAt: "2026-10-09T12:00:00Z" }], inProgress: [] }} today="2026-10-10" />);
    expect(screen.getByText(/First step · Earned yesterday/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View achievements" })).toHaveAttribute("href", "/en/profile#achievements");
  });

  it("recognizes yesterday across a month boundary", () => {
    render(<AchievementCard snapshot={{ earned: [{ id: "a", name: "First step", description: null, iconUrl: null, earnedAt: "2026-02-28T12:00:00Z" }], inProgress: [] }} today="2026-03-01" />);
    expect(screen.getByText(/First step · Earned yesterday/)).toBeInTheDocument();
  });

  it("renders a local error instead of an empty achievement state", () => {
    render(<AchievementCard error snapshot={{ earned: [], inProgress: [] }} today="2026-10-10" />);
    expect(screen.getByText("This part couldn't load right now.")).toBeInTheDocument();
  });
});
