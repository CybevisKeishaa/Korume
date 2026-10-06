import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WritingRows } from "./writing-cells";

describe("WritingRows (spec W §3.1–§3.2, W8)", () => {
  it("practice: repetition 1 is the black model, 2 the grey trace, the rest blank — whole groups", () => {
    const { container } = render(<WritingRows cells={2} model={["苦", "手"]} mode="practice" density="compact" />);
    const groups = [...container.querySelectorAll(".vp-group")];
    expect(groups).toHaveLength(6);
    expect(groups[0]?.querySelectorAll(".vp-model")).toHaveLength(2);
    expect(groups[0]?.textContent).toBe("苦手");
    expect(groups[1]?.querySelectorAll(".vp-trace")).toHaveLength(2);
    expect(groups.slice(2).every((group) => group.textContent === "")).toBe(true);
    expect(container.querySelectorAll(".vp-row")).toHaveLength(1);
    expect([...container.querySelectorAll(".vp-row")].every((row) => row.querySelectorAll(".vp-group").length === 6)).toBe(true);
  });
  it("self-test: every cell is blank and the group width still matches the hidden word", () => {
    const { container } = render(<WritingRows cells={3} model={null} mode="selfTest" density="airy" />);
    expect(container.textContent).toBe("");
    expect(container.querySelector(".vp-group")?.querySelectorAll(".vp-cell")).toHaveLength(3);
  });
  it("sets the cell size as an mm custom property", () => {
    const { container } = render(<WritingRows cells={20} model={null} mode="selfTest" density="airy" />);
    expect((container.firstElementChild as HTMLElement).style.getPropertyValue("--vp-cell")).toBe("9.1mm");
  });
});
