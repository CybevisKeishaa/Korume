import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import en from "@/messages/en/profile.json";
import common from "@/messages/en/common.json";
import { AchievementsCard } from "./achievements-card";
import { makeView } from "./view-fixture";

describe("AchievementsCard", () => {
  it("renders a chip per achievement under a heading", () => {
    render(<AchievementsCard achievements={makeView().achievements} />);
    expect(screen.getByRole("heading", { name: en.achievements.title })).toBeInTheDocument();
    expect(screen.getByText("First Shadow")).toBeInTheDocument();
  });
  it("shows the empty state", () => {
    render(<AchievementsCard achievements={[]} />);
    expect(screen.getByText(en.achievements.empty)).toBeInTheDocument();
  });
  it("names seeded badges with their copy and humanizes an unknown key", () => {
    const at = "2026-08-01T00:00:00.000Z";
    render(<AchievementsCard achievements={[
      { id: "b1", name: "month_streak", iconUrl: null, earnedAt: at },
      { id: "b2", name: "future_badge", iconUrl: null, earnedAt: at },
    ]} />);
    expect(screen.getByText(common.badges.month_streak.name)).toHaveAttribute("title", common.badges.month_streak.description);
    expect(screen.getByText("Future badge")).toBeInTheDocument();
    expect(screen.queryByText(/_/)).toBeNull();
  });
});
