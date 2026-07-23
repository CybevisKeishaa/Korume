import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { StrokeOrder } from "./stroke-order";

/**
 * Characterization test pinning `StrokeOrder`'s `aria-label` before it's
 * extracted into the `kanji` namespace with an ICU argument for the
 * character (binding pattern 1). This is the only user-visible copy in this
 * file — the stroke animation and its reduce-motion fallback are untouched
 * (CLAUDE.md §2.4, load-bearing).
 */
describe("StrokeOrder", () => {
  it("labels the animated glyph with the character being drawn", () => {
    render(
      <ThemeProvider>
        <StrokeOrder character="一" />
      </ThemeProvider>,
    );
    expect(screen.getByRole("img", { name: "Stroke order for 一" })).toBeInTheDocument();
  });

  it("falls back to a static glyph (no aria-label) for characters without stroke data", () => {
    render(
      <ThemeProvider>
        <StrokeOrder character="水" />
      </ThemeProvider>,
    );
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
