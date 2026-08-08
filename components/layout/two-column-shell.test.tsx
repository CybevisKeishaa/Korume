import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { TwoColumnShell } from "@/components/layout/two-column-shell";

describe("TwoColumnShell", () => {
  it("renders the rail as a complementary landmark with an accessible name", () => {
    render(
      <TwoColumnShell rail={<p>companion</p>} railLabel="Companion">
        <p>main</p>
      </TwoColumnShell>,
    );
    expect(screen.getByRole("complementary", { name: "Companion" })).toBeInTheDocument();
  });

  it("omits the rail element entirely when no rail is passed", () => {
    // Explore is single-column (spec D14). An empty <aside> would still be a
    // landmark screen readers announce, so it must not be rendered at all.
    render(
      <TwoColumnShell railLabel="Companion">
        <p>main</p>
      </TwoColumnShell>,
    );
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });

  it("sticks the rail and sizes it from the layout token", () => {
    render(
      <TwoColumnShell rail={<p>companion</p>} railLabel="Companion">
        <p>main</p>
      </TwoColumnShell>,
    );
    const rail = screen.getByRole("complementary", { name: "Companion" });
    expect(rail.className).toContain("sticky");
    expect(rail.className).toContain("xl:top-md-lg");
    expect(rail.className).toContain("xl:w-companion");
  });

  it("hides the rail below xl so main content keeps the full width", () => {
    render(
      <TwoColumnShell rail={<p>companion</p>} railLabel="Companion">
        <p>main</p>
      </TwoColumnShell>,
    );
    expect(screen.getByRole("complementary", { name: "Companion" }).className).toContain("hidden");
    expect(screen.getByRole("complementary", { name: "Companion" }).className).toContain("xl:block");
  });

  it("owns the shell measure, so pages inside it need no Container", () => {
    // --layout-content-max is the SHADOWING SHELL's width, consumed here and
    // nowhere else. components/ui/container.tsx keeps max-w-6xl on purpose:
    // Pricing, Settings and Auth will each want their own measure, and this
    // token is not a claim that every page should be 1240px.
    render(
      <TwoColumnShell railLabel="Companion" data-testid="shell">
        <p>main</p>
      </TwoColumnShell>,
    );
    const shell = screen.getByTestId("shell");
    expect(shell.className).toContain("max-w-content");
    expect(shell.className).toContain("mx-auto");
  });
});
