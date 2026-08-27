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
});
