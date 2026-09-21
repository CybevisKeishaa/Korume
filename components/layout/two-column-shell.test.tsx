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

  it("keeps the rail sticky inside its grid track", () => {
    render(
      <TwoColumnShell rail={<p>companion</p>} railLabel="Companion">
        <p>main</p>
      </TwoColumnShell>,
    );
    const rail = screen.getByRole("complementary", { name: "Companion" });
    expect(rail.className).toContain("sticky");
    expect(rail.className).toContain("top-md-lg");
    // The rail is a GRID TRACK now, not an element width. A percentage in the
    // track resolves against the grid content box; the same percentage on the
    // aside would resolve against the track, i.e. 27.5% of 27.5%.
    expect(rail.className).toContain("w-full");
    expect(rail.className).not.toContain("w-[--layout-companion-width]");
    expect(rail.className).not.toContain("shrink-0");
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

  it("defines the rail track as a share of the shell, with density-scaled bounds", async () => {
    // Read the declaration out of the stylesheet rather than the DOM: jsdom
    // does not resolve clamp(), so asserting a computed width here would be a
    // false green (docs/lessons.md: prove the subject exists first).
    const css = await import("node:fs/promises").then((fs) =>
      fs.readFile("app/globals.css", "utf8"),
    );
    expect(css).toMatch(
      /--layout-companion-width:\s*clamp\(\s*calc\(240\s*\*\s*var\(--density-unit\)\)\s*,\s*27\.5%\s*,\s*calc\(340\s*\*\s*var\(--density-unit\)\)\s*\)/,
    );
    expect(css).not.toContain("--layout-companion-width: 300px;");
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
