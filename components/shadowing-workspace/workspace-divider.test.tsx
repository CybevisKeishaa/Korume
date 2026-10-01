import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clampSplit, WorkspaceDivider } from "./workspace-divider";

describe("WorkspaceDivider", () => {
  // A failed assertion must not leak the getBoundingClientRect spy into later tests.
  afterEach(() => vi.restoreAllMocks());

  it("moves by five percent from the keyboard and exposes its percent value", () => {
    const onChange = vi.fn();
    render(<WorkspaceDivider ratio={0.5} onChange={onChange} workspaceRef={{ current: null }} ariaLabel="Resize workspace panes" controls="workspace-player-pane" />);
    const divider = screen.getByRole("separator");

    expect(divider).toHaveAttribute("aria-orientation", "vertical");
    expect(divider).toHaveAttribute("aria-valuenow", "50");
    fireEvent.keyDown(divider, { key: "ArrowRight" });
    fireEvent.keyDown(divider, { key: "ArrowLeft" });

    expect(onChange).toHaveBeenNthCalledWith(1, 0.55);
    expect(onChange).toHaveBeenNthCalledWith(2, 0.45);
  });

  it("clamps a drag ratio to leave both workspace panes at their token minimums", () => {
    expect(clampSplit(0.1, 1000, 220, 200)).toBe(0.22);
    expect(clampSplit(0.9, 1000, 220, 200)).toBe(0.8);
  });

  it("clamps a pointer drag using the measured workspace and token widths", () => {
    const workspace = document.createElement("div");
    const onChange = vi.fn();
    const widths = [1000, 220, 200, 1000, 220, 200, 1000];
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(() => {
      const width = widths.shift() ?? 0;
      return { x: 0, y: 0, top: 0, left: 0, bottom: 0, right: width, width, height: 0, toJSON: () => ({}) };
    });
    render(<WorkspaceDivider ratio={0.5} onChange={onChange} workspaceRef={{ current: workspace }} ariaLabel="Resize workspace panes" controls="workspace-player-pane" />);
    const divider = screen.getByRole("separator");
    Object.assign(divider, { setPointerCapture: vi.fn(), hasPointerCapture: () => true });

    fireEvent(divider, new MouseEvent("pointerdown", { bubbles: true, clientX: 10 }));

    expect(onChange).toHaveBeenCalledWith(0.22);
  });

  it("reports its real clamped range instead of the impossible full range", () => {
    const workspace = document.createElement("div");
    const widths = [1000, 220, 200];
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(() => {
      const width = widths.shift() ?? 0;
      return { x: 0, y: 0, top: 0, left: 0, bottom: 0, right: width, width, height: 0, toJSON: () => ({}) };
    });
    render(<WorkspaceDivider ratio={0.5} onChange={vi.fn()} workspaceRef={{ current: workspace }} ariaLabel="Resize workspace panes" controls="workspace-player-pane" />);

    expect(screen.getByRole("separator")).toHaveAttribute("aria-valuemin", "22");
    expect(screen.getByRole("separator")).toHaveAttribute("aria-valuemax", "80");
  });
});
