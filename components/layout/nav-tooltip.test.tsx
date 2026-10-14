import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useNavTooltip } from "./nav-tooltip";

function Harness({ enabled = true }: { enabled?: boolean }) {
  const { tooltip, bind } = useNavTooltip(enabled);
  return (<div><a href="/x" aria-label="Review, 32 due" {...bind("Review · 32")}>R</a><a href="/y" aria-label="Kanji" {...bind("Kanji")}>K</a>{tooltip}</div>);
}

// jsdom has no PointerEvent, so fireEvent.pointerLeave drops relatedTarget; React derives pointerleave from a native
// pointerout, and a MouseEvent carries relatedTarget.
const moveOut = (from: Element, to: Element) => act(() => { from.dispatchEvent(new MouseEvent("pointerout", { bubbles: true, relatedTarget: to })); });

describe("useNavTooltip", () => {
  it("shows the label on hover, beside the link, and hides on leave", () => {
    render(<Harness />);
    fireEvent.pointerEnter(screen.getByLabelText("Review, 32 due"));
    const tip = screen.getByRole("tooltip");
    expect(tip).toHaveTextContent("Review · 32");
    expect(tip).toHaveClass("nav-tooltip");
    expect(tip.style.left).toMatch(/px$/);
    expect(tip.style.top).toMatch(/px$/);
    fireEvent.pointerLeave(screen.getByLabelText("Review, 32 due"));
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
  it("stays open while the pointer moves onto the tooltip, and hides when it leaves it (WCAG 1.4.13 hoverable)", () => {
    render(<Harness />);
    const link = screen.getByLabelText("Review, 32 due");
    fireEvent.pointerEnter(link);
    const tip = screen.getByRole("tooltip");
    moveOut(link, tip);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Review · 32");
    moveOut(tip, link);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Review · 32");
    moveOut(link, tip);
    moveOut(tip, document.body);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
  it("shows on keyboard focus, is described-by linked, and Escape hides it", () => {
    render(<Harness />);
    const link = screen.getByLabelText("Kanji");
    fireEvent.focus(link);
    const tip = screen.getByRole("tooltip");
    expect(link).toHaveAttribute("aria-describedby", tip.id);
    fireEvent.keyDown(link, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
  it("hides on blur and on a scroll that moved its item", () => {
    render(<Harness />);
    const link = screen.getByLabelText("Kanji");
    fireEvent.focus(link);
    fireEvent.blur(link);
    expect(screen.queryByRole("tooltip")).toBeNull();
    fireEvent.focus(link);
    vi.spyOn(link, "getBoundingClientRect").mockReturnValue(new DOMRect(0, -40, 72, 44));
    fireEvent.scroll(window);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
  it("survives a scroll that did not move its item (Chrome's late scroll event for a Tab scroll-into-view)", () => {
    render(<Harness />);
    const link = screen.getByLabelText("Kanji");
    vi.spyOn(link, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 269, 72, 44));
    fireEvent.focus(link);
    fireEvent.scroll(window);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Kanji");
  });
  it("renders nothing when disabled (expanded mode)", () => {
    render(<Harness enabled={false} />);
    fireEvent.pointerEnter(screen.getByLabelText("Kanji"));
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});
