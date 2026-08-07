import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { UpcomingScreen } from "@/components/layout/upcoming-screen";

describe("UpcomingScreen", () => {
  it("names the screen as a level-1 heading", () => {
    render(
      <UpcomingScreen
        title="Roadmap"
        body="The path…"
        unlocks="Keep studying."
        unlocksLabel="What fills this"
      />,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Roadmap" })).toBeInTheDocument();
  });

  it("states what would fill the screen, not a delivery promise", () => {
    render(
      <UpcomingScreen
        title="Roadmap"
        body="The path…"
        unlocks="Keep studying."
        unlocksLabel="What fills this"
      />,
    );
    expect(screen.getByText("Keep studying.")).toBeInTheDocument();
  });

  it("states what is missing, and labels the unlocks section", () => {
    render(
      <UpcomingScreen
        title="Roadmap"
        body="The path…"
        unlocks="Keep studying."
        unlocksLabel="What fills this"
      />,
    );
    expect(screen.getByText("The path…")).toBeInTheDocument();
    expect(screen.getByText("What fills this")).toBeInTheDocument();
  });

  it("renders no chart, meter or progress element", () => {
    // The whole point of an honest empty state: a placeholder visualisation
    // would render data the system does not have.
    const { container } = render(
      <UpcomingScreen
        title="Statistics"
        body="The numbers…"
        unlocks="Nothing yet."
        unlocksLabel="What fills this"
      />,
    );
    expect(container.querySelector("svg, canvas, progress, meter")).toBeNull();
  });
});
