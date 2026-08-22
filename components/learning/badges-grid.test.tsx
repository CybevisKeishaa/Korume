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

  it("renders a well-formed icon URL as a CSS mask, so currentColor (earned/locked) drives its colour", () => {
    render(
      <BadgesGrid
        badges={[
          {
            id: "b1",
            name: "Week Streak",
            description: null,
            iconUrl: "/badges/week_streak.svg",
            earnedAt: "2026-07-01T00:00:00.000Z",
          },
        ]}
      />,
    );
    const mask = screen.getByTestId("badge-icon-mask");
    // The URL must reach the mask's style, not an <img src> — an <img>-loaded
    // SVG is an isolated document where currentColor cannot resolve against
    // the page.
    expect(mask.getAttribute("style")).toContain("/badges/week_streak.svg");
  });

  it("falls back to the default icon rather than emitting a broken mask when iconUrl does not match the expected /badges/<slug>.svg shape", () => {
    render(
      <BadgesGrid
        badges={[
          {
            id: "b1",
            name: "Week Streak",
            description: null,
            // Injection-shaped: would break out of the CSS url(...) if it
            // reached the style unguarded.
            iconUrl: "javascript:alert(1)",
            earnedAt: "2026-07-01T00:00:00.000Z",
          },
        ]}
      />,
    );
    expect(screen.queryByTestId("badge-icon-mask")).not.toBeInTheDocument();
    // The earned fallback star still renders — the badge doesn't go blank.
    expect(screen.getByText("Week Streak")).toBeInTheDocument();
  });
});
