import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import en from "@/messages/en/profile.json";
import { LearningJourney } from "./learning-journey";
import { makeView } from "./view-fixture";

const t = en.journey;

describe("LearningJourney", () => {
  it("lists items in the given order, marking only the first as current", () => {
    render(<LearningJourney items={makeView().journey} />);
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveAttribute("aria-current", "step");
    expect(items[1]).not.toHaveAttribute("aria-current");
    expect(items[0]).toHaveTextContent(t.kind.first_shadow);
    expect(items[0]).toHaveTextContent("頑張って, said aloud after the voice.");
    expect(items[1]).toHaveTextContent(t.line.first_activity);
    expect(screen.getByText("Aug 2026")).toBeInTheDocument();
  });

  it("uses the label-free line when label is null", () => {
    render(<LearningJourney items={[{ kind: "first_shadow", at: "2026-08-01T00:00:00.000Z", label: null }]} />);
    expect(screen.getByText("Your voice began to find its rhythm.")).toBeInTheDocument();
  });

  it("skips an unknown kind instead of rendering it raw", () => {
    const items = [{ kind: "mystery" as never, at: "2026-08-01T00:00:00.000Z", label: null }, ...makeView().journey];
    render(<LearningJourney items={items} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.queryByText("mystery")).toBeNull();
  });

  it("invites the first lesson when empty", () => {
    render(<LearningJourney items={[]} />);
    expect(screen.getByRole("link", { name: t.emptyCta })).toHaveAttribute("href", expect.stringContaining("/shadowing"));
  });
});
