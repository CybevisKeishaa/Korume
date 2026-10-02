import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { StrokeOrder } from "./stroke-order";

const ICHI = ["M16,55 L93,55"];
const GREEN = ["M27,14c0,1,0,2-0,3", "M38,25c0,1-0,2-0,3", "M34,49c2,2,5,6,6,11"];

describe("StrokeOrder", () => {
  it("labels the animated glyph with the character being drawn", () => {
    render(
      <ThemeProvider>
        <StrokeOrder character="一" paths={ICHI} />
      </ThemeProvider>,
    );
    expect(screen.getByRole("img", { name: "Stroke order for 一" })).toBeInTheDocument();
  });

  it("draws one path per stroke from the geometry it is given", () => {
    const { container } = render(
      <ThemeProvider>
        <StrokeOrder character="緑" paths={GREEN} />
      </ThemeProvider>,
    );
    expect([...container.querySelectorAll("path")].map((path) => path.getAttribute("d"))).toEqual(GREEN);
    expect(container.querySelectorAll("line")).toHaveLength(2); // the writing guide
  });

  it.each([[undefined], [[]]])("falls back to a static glyph without stroke geometry (%j)", (paths) => {
    render(
      <ThemeProvider>
        <StrokeOrder character="水" paths={paths} />
      </ThemeProvider>,
    );
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("水")).toBeInTheDocument();
  });

  it("remounts the strokes when replayKey changes so the animation restarts", () => {
    const { container, rerender } = render(
      <ThemeProvider>
        <StrokeOrder character="緑" paths={GREEN} replayKey={0} />
      </ThemeProvider>,
    );
    const first = container.querySelector("path");
    rerender(
      <ThemeProvider>
        <StrokeOrder character="緑" paths={GREEN} replayKey={0} />
      </ThemeProvider>,
    );
    expect(container.querySelector("path")).toBe(first);
    rerender(
      <ThemeProvider>
        <StrokeOrder character="緑" paths={GREEN} replayKey={1} />
      </ThemeProvider>,
    );
    expect(container.querySelector("path")).not.toBe(first);
  });
});
