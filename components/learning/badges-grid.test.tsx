import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { BadgesGrid } from "./badges-grid";
import type { BadgeSummary } from "@/lib/user-stats-types";

const badges: BadgeSummary[] = [
  {
    id: "b1",
    name: "First Steps",
    description: "Complete your first review.",
    iconUrl: null,
    earnedAt: "2026-07-01T00:00:00.000Z",
  },
  {
    id: "b2",
    name: "Streak Master",
    description: "Reach a 7-day streak.",
    iconUrl: null,
    earnedAt: null,
  },
];

describe("BadgesGrid", () => {
  it("renders every badge with an accessible label describing name + state + description", () => {
    render(<BadgesGrid badges={badges} />);

    const earned = screen.getByLabelText(/first steps.*earned.*complete your first review/i);
    expect(earned).toBeInTheDocument();

    const locked = screen.getByLabelText(/streak master.*locked.*reach a 7-day streak/i);
    expect(locked).toBeInTheDocument();
  });

  it("marks the locked badge with a visible label, not color alone", () => {
    render(<BadgesGrid badges={badges} />);
    // "Locked" text (or equivalent) must be visible, not just a css class.
    expect(screen.getByText("Locked")).toBeInTheDocument();
  });

  it("shows the earned date for an earned badge", () => {
    render(<BadgesGrid badges={badges} />);
    expect(
      screen.getByText(new Date("2026-07-01T00:00:00.000Z").toLocaleDateString()),
    ).toBeInTheDocument();
  });

  it("renders a calm empty state when there are no badges in the catalog", () => {
    render(<BadgesGrid badges={[]} />);
    expect(screen.getByText("No badges in the catalog yet.")).toBeInTheDocument();
  });

  it("still renders a badge whose icon is null", () => {
    render(
      <BadgesGrid
        badges={[{ id: "b1", name: "First Steps", description: null, iconUrl: null, earnedAt: null }]}
      />,
    );
    expect(screen.getByText("First Steps")).toBeInTheDocument();
  });
});
