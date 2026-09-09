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
      <TwoColumnShell railLabel="Companion" data-testid="shell-without-rail">
        <p>main</p>
      </TwoColumnShell>,
    );
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    expect(screen.getByTestId("shell-without-rail").className).toContain(
      "grid-cols-[minmax(0,1fr)]",
    );
  });

  it("keeps the rail sticky at its layout-token width", () => {
    render(
      <TwoColumnShell rail={<p>companion</p>} railLabel="Companion">
        <p>main</p>
      </TwoColumnShell>,
    );
    const rail = screen.getByRole("complementary", { name: "Companion" });
    expect(rail.className).toContain("sticky");
    expect(rail.className).toContain("top-md-lg");
    expect(rail.className).toContain("w-[--layout-companion-width]");
  });

  it("keeps main and rail in the desktop grid without hiding the rail", () => {
    render(
      <TwoColumnShell rail={<p>companion</p>} railLabel="Companion" data-testid="shell">
        <p>main</p>
      </TwoColumnShell>,
    );
    const shell = screen.getByTestId("shell");
    const main = screen.getByText("main").parentElement;
    const rail = screen.getByRole("complementary", { name: "Companion" });

    expect(shell.className).toContain("grid-cols-[minmax(0,1fr)_var(--layout-companion-width)]");
    expect(main).toHaveClass("min-w-0");
    expect(rail.className).not.toContain("hidden");
  });

  it("owns the grid gutter and column gap without a centered maximum measure", () => {
    render(
      <TwoColumnShell railLabel="Companion" data-testid="shell">
        <p>main</p>
      </TwoColumnShell>,
    );
    const shell = screen.getByTestId("shell");
    expect(shell).toHaveClass("grid");
    expect(shell.className).toContain("px-[--layout-gutter]");
    expect(shell.className).toContain("gap-[--layout-column-gap]");
    expect(shell.className).not.toContain("max-w-content");
    expect(shell.className).not.toContain("mx-auto");
  });
});
