import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import en from "@/messages/en/profile.json";
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
});
