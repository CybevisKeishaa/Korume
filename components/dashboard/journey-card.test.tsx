import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { JourneyCard } from "./journey-card";

describe("JourneyCard", () => {
  it("renders authoring without a misleading zero percent", () => {
    render(<JourneyCard view={{ kind: "authoring" }} />);
    expect(screen.getByText("The JLPT journey is being prepared.")).toBeInTheDocument();
    expect(screen.queryByText("0%")).not.toBeInTheDocument();
  });

  it("renders active nodes, next milestone, remaining count, and Plus total", () => {
    render(<JourneyCard view={{ kind: "active", current: "N5", next: { videoId: "v1", title: "Café" }, remaining: 2, plus: { total: 3, accessible: 1 }, nodes: [
      { level: "N5", state: "current", percent: 50 }, { level: "N4", state: "locked", percent: 0 }, { level: "N3", state: "unavailable", percent: null },
    ] }} />);
    expect(screen.getByText("Next milestone")).toBeInTheDocument();
    expect(screen.getByText("Café")).toBeInTheDocument();
    expect(screen.getByText("2 lessons remaining")).toBeInTheDocument();
    expect(screen.getByText("+3 Plus lessons")).toBeInTheDocument();
    expect(screen.getByText(/N5/)).not.toHaveTextContent("Locked");
    expect(screen.getByText("N5").closest("li")).toHaveAttribute("aria-current", "step");
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.queryByText(/Roadmap/)).not.toBeInTheDocument();
  });

  it("accepts a structured-cloneable journey view", () => {
    expect(() => structuredClone({ kind: "complete", nodes: [] })).not.toThrow();
  });

  it("keeps a card failure distinct from the authoring state", () => {
    render(<JourneyCard error view={{ kind: "authoring" }} />);
    expect(screen.getByText("This part couldn't load right now.")).toBeInTheDocument();
    expect(screen.queryByText("The JLPT journey is being prepared.")).not.toBeInTheDocument();
  });

  it("renders the completed journey state", () => {
    render(<JourneyCard view={{ kind: "complete", nodes: [
      { level: "N3", state: "completed", percent: 100 },
      { level: "N2", state: "completed", percent: 100 },
      { level: "N1", state: "completed", percent: 100 },
    ] }} />);
    expect(screen.getByText("You've completed the current journey.")).toBeInTheDocument();
    const nodes = screen.getAllByRole("listitem");
    expect(nodes).toHaveLength(3);
    expect(nodes.map((node) => node.textContent)).toEqual([
      "N3Completed100%", "N2Completed100%", "N1Completed100%",
    ]);
    expect(screen.queryByText("Next milestone")).not.toBeInTheDocument();
    expect(screen.queryByText(/lessons remaining|Plus lessons/)).not.toBeInTheDocument();
  });

  it("hides the next-milestone line when no next lesson exists", () => {
    render(<JourneyCard view={{ kind: "active", current: "N5", next: null, remaining: 0, plus: { total: 0, accessible: 0 }, nodes: [] }} />);
    expect(screen.queryByText(/Next milestone/)).not.toBeInTheDocument();
  });
});
