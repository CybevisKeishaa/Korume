import { useRef } from "react";
import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { render } from "@/test/render";
import { clampPipDelta, PipDragHandle } from "./pip-drag-handle";

function Pane({ onSurfaceClick }: { onSurfaceClick?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div ref={ref} data-testid="pane">
      <PipDragHandle paneRef={ref} label="Move" />
      <div data-testid="surface" onClick={onSurfaceClick} />
      <button type="button">Play</button>
    </div>
  );
}

// jsdom has no PointerEvent, so fireEvent.pointer* would drop pointerId and the coordinates.
if (typeof window.PointerEvent === "undefined") {
  class PointerEventShim extends MouseEvent {
    pointerId: number;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
    }
  }
  vi.stubGlobal("PointerEvent", PointerEventShim);
}

const BOX = { left: 500, top: 300, right: 780, bottom: 470, x: 500, y: 300, width: 280, height: 170, toJSON: () => ({}) };

describe("clampPipDelta", () => {
  const box = { left: 100, top: 50, right: 400, bottom: 250 };
  it("passes a move that stays inside the viewport", () => {
    expect(clampPipDelta(box, -40, 30, 1000, 600)).toEqual({ x: -40, y: 30 });
  });
  it("stops every edge at the viewport", () => {
    expect(clampPipDelta(box, -500, -500, 1000, 600)).toEqual({ x: -100, y: -50 });
    expect(clampPipDelta(box, 900, 900, 1000, 600)).toEqual({ x: 600, y: 350 });
  });
});

describe("PipDragHandle", () => {
  it("moves the pane with the arrow keys, clamps at the edge, and clears the transform on unmount", () => {
    const { unmount } = render(<Pane />);
    const pane = screen.getByTestId("pane");
    pane.getBoundingClientRect = () => ({ left: 20, top: 300, right: 300, bottom: 470, x: 20, y: 300, width: 280, height: 170, toJSON: () => ({}) });
    const handle = screen.getByRole("button", { name: "Move" });
    fireEvent.keyDown(handle, { key: "ArrowUp" });
    expect(pane.style.transform).toBe("translate(0px, -16px)");
    fireEvent.keyDown(handle, { key: "ArrowLeft" }); // 20px of room: one 16px step fits
    expect(pane.style.transform).toBe("translate(-16px, -16px)");
    pane.getBoundingClientRect = () => ({ left: 4, top: 284, right: 284, bottom: 454, x: 4, y: 284, width: 280, height: 170, toJSON: () => ({}) });
    fireEvent.keyDown(handle, { key: "ArrowLeft" }); // only 4px left
    expect(pane.style.transform).toBe("translate(-20px, -16px)");
    unmount();
    expect(pane.style.transform).toBe("");
  });

  it("drags the whole pane from the video, swallows the click that ends a drag, and keeps a plain click", () => {
    const onSurfaceClick = vi.fn();
    render(<Pane onSurfaceClick={onSurfaceClick} />);
    const pane = screen.getByTestId("pane");
    pane.getBoundingClientRect = () => BOX;
    const surface = screen.getByTestId("surface");
    fireEvent.pointerDown(surface, { pointerId: 1, button: 0, clientX: 600, clientY: 400 });
    fireEvent.pointerMove(surface, { pointerId: 1, clientX: 602, clientY: 401 });
    expect(pane.style.transform).toBe("");
    fireEvent.pointerMove(document.body, { pointerId: 1, clientX: 400, clientY: 100 }); // a fast drag is already off the pane
    expect(pane.style.transform).toBe("translate(-200px, -300px)");
    fireEvent.pointerUp(document.body, { pointerId: 1 });
    fireEvent.click(surface);
    expect(onSurfaceClick).not.toHaveBeenCalled();
    fireEvent.pointerMove(document.body, { pointerId: 1, clientX: 0, clientY: 0 });
    expect(pane.style.transform).toBe("translate(-200px, -300px)"); // released: later moves do nothing
    fireEvent.pointerDown(surface, { pointerId: 2, button: 0, clientX: 600, clientY: 400 });
    fireEvent.pointerUp(surface, { pointerId: 2 });
    fireEvent.click(surface);
    expect(onSurfaceClick).toHaveBeenCalledOnce();
  });

  it("never starts a drag from a control", () => {
    render(<Pane />);
    const pane = screen.getByTestId("pane");
    pane.getBoundingClientRect = () => BOX;
    const play = screen.getByRole("button", { name: "Play" });
    fireEvent.pointerDown(play, { pointerId: 1, button: 0, clientX: 600, clientY: 400 });
    fireEvent.pointerMove(play, { pointerId: 1, clientX: 400, clientY: 100 });
    expect(pane.style.transform).toBe("");
  });
});
