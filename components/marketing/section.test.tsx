import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { Section } from "./section";

describe("Section", () => {
  it("renders the heading at level 2 by default and links it to the section", () => {
    render(
      <Section id="journey" eyebrow="Start with something real" heading="Don't study Japanese in isolation.">
        <p>body</p>
      </Section>,
    );

    const heading = screen.getByRole("heading", { level: 2, name: "Don't study Japanese in isolation." });
    expect(heading).toBeInTheDocument();

    const region = screen.getByRole("region", { name: "Don't study Japanese in isolation." });
    expect(region).toHaveAttribute("id", "journey");
  });

  it("renders the eyebrow as text, not as a heading", () => {
    render(
      <Section id="s" eyebrow="One learning journey" heading="Everything connects.">
        <p>body</p>
      </Section>,
    );

    expect(screen.getByText("One learning journey")).toBeInTheDocument();
    expect(screen.getAllByRole("heading")).toHaveLength(1);
  });

  it("omits the eyebrow element entirely when none is given", () => {
    const { container } = render(
      <Section id="s" heading="Only a heading">
        <p>body</p>
      </Section>,
    );

    expect(container.querySelectorAll("[data-eyebrow]")).toHaveLength(0);
  });

  it("renders its children", () => {
    render(
      <Section id="s" heading="H">
        <p>the body</p>
      </Section>,
    );

    expect(screen.getByText("the body")).toBeInTheDocument();
  });

  it("renders the heading at level 1 when headingLevel is 1, and still links it to the section", () => {
    render(
      <Section id="hero" heading="Learn Japanese through video." headingLevel={1}>
        <p>body</p>
      </Section>,
    );

    const heading = screen.getByRole("heading", { level: 1, name: "Learn Japanese through video." });
    expect(heading).toBeInTheDocument();

    const region = screen.getByRole("region", { name: "Learn Japanese through video." });
    expect(region).toHaveAttribute("id", "hero");
  });

  it("omits the rail element entirely in the stacked layout", () => {
    const { container } = render(
      <Section id="s" heading="Only a heading">
        <p>body</p>
      </Section>,
    );

    expect(container.querySelectorAll("[data-section-rail]")).toHaveLength(0);
  });

  it("moves body copy into a left rail when `rail` is given, without unlabelling the region", () => {
    // Task A1 (spec §13): the split layout is what fixes §2's composition, and
    // §3-§9 inherit it. The accessible structure must survive the change — one
    // heading, still level 2, still the region's name.
    render(
      <Section
        id="problem"
        eyebrow="Japanese isn't a textbook"
        heading="You can study Japanese for years."
        rail={<p>Traditional study separates everything.</p>}
      >
        <p>the showcase</p>
      </Section>,
    );

    expect(screen.getByText("Traditional study separates everything.")).toBeInTheDocument();
    expect(screen.getByText("the showcase")).toBeInTheDocument();
    expect(screen.getByText("Japanese isn't a textbook")).toBeInTheDocument();

    const heading = screen.getByRole("heading", {
      level: 2,
      name: "You can study Japanese for years.",
    });
    expect(heading).toBeInTheDocument();
    expect(screen.getAllByRole("heading")).toHaveLength(1);

    const region = screen.getByRole("region", { name: "You can study Japanese for years." });
    expect(region).toHaveAttribute("id", "problem");
  });

  it("puts the rail beside the heading, not around the showcase", () => {
    // Guards the arrangement the composition depends on: rail copy shares the
    // narrow left column with the heading, and `children` stays out of it.
    const { container } = render(
      <Section id="s" heading="H" rail={<p>rail copy</p>}>
        <p>showcase copy</p>
      </Section>,
    );

    const rails = Array.from(container.querySelectorAll("[data-section-rail]"));
    expect(rails).toHaveLength(1);

    const [rail] = rails;
    if (!rail) throw new Error("no [data-section-rail] was rendered");
    expect(rail.textContent).toBe("rail copy");

    const column = rail.parentElement;
    if (!column) throw new Error("the rail has no parent column");
    expect(column.querySelector("h2")).not.toBeNull();
    expect(column.textContent).not.toContain("showcase copy");
  });
});
