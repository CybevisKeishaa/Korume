import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@/test/render";
import { KorumeCard } from "./korume-card";
import { WeaknessCard } from "./weakness-card";

vi.mock("@/components/companion/companion-anchor", () => ({ CompanionAnchor: () => <div data-testid="companion-anchor" /> }));

describe("KorumeCard", () => {
  it("does not render when disabled and stays silent without a cue", () => {
    const { rerender } = render(<KorumeCard enabled={false} cue={null} />);
    expect(screen.queryByTestId("companion-anchor")).not.toBeInTheDocument();
    rerender(<KorumeCard enabled cue={null} />);
    expect(screen.getByTestId("companion-anchor")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("renders only the actions supported by a cue", () => {
    render(<><WeaknessCard rows={[]} /><KorumeCard enabled cue={{ key: "cue.weakSkill", values: { skill: "listening", score: 42 }, practiceHref: "/shadowing/v1/listening?format=typing", viewWeakness: true }} /></>);
    expect(screen.getByRole("link", { name: "Practice now" })).toHaveAttribute("href", "/en/shadowing/v1/listening?format=typing");
    fireEvent.click(screen.getByRole("button", { name: "View weakness" }));
    expect(document.activeElement).toHaveAttribute("id", "weakness-snapshot");
  });

  it("labels every resolver skill key from the catalog, pronunciation included", () => {
    render(<KorumeCard enabled cue={{ key: "cue.weeklyImproved", values: { skill: "pronunciation", points: 8 }, practiceHref: null, viewWeakness: false }} />);
    expect(screen.getByText("“Your Pronunciation rose 8 points compared with the previous 7 days.”")).toBeInTheDocument();
  });
});
