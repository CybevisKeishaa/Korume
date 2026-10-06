import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { StrokeGuide } from "@/lib/strokes/types";
import { StrokeGuideRow } from "./stroke-guide";

const hito: StrokeGuide = { character: "人", viewBox: 109, strokes: [{ d: "M54,20c1,1", start: [54, 20] }, { d: "M55,50c1,1", start: [55, 50] }] };
const shi: StrokeGuide = { character: "し", viewBox: 109, strokes: [{ d: "c1,2", start: null }] };

describe("StrokeGuideRow (spec W W5, §3.1)", () => {
  it("draws every stroke and numbers each start in KanjiVG order", () => {
    const { container } = render(<StrokeGuideRow glyphs={["人"]} guides={{ 人: hito }} label="Stroke order" />);
    const svg = container.querySelector("svg.vp-guide")!;
    expect(svg.getAttribute("viewBox")).toBe("0 0 109 109");
    expect(svg.querySelectorAll("path.vp-guide-stroke")).toHaveLength(2);
    expect([...svg.querySelectorAll("text")].map((text) => text.textContent)).toEqual(["1", "2"]);
    expect(svg.querySelectorAll("circle")).toHaveLength(2);
  });
  it("skips a grapheme without data and a stroke without a start, never guessing", () => {
    const { container } = render(<StrokeGuideRow glyphs={["T", "し"]} guides={{ し: shi }} label="Stroke order" />);
    expect(container.querySelectorAll("svg.vp-guide")).toHaveLength(1);
    expect(container.querySelectorAll("text")).toHaveLength(0);
  });
  it("renders nothing when no grapheme has a guide", () => {
    const { container } = render(<StrokeGuideRow glyphs={["T"]} guides={{}} label="Stroke order" />);
    expect(container.innerHTML).toBe("");
  });
  it("is presentational: no ids and the svg is hidden from assistive tech", () => {
    const { container } = render(<StrokeGuideRow glyphs={["人"]} guides={{ 人: hito }} label="Stroke order" />);
    expect(container.querySelector("[id]")).toBeNull();
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });
});
