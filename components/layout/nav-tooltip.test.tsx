import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useNavTooltip } from "./nav-tooltip";

function Harness({ enabled = true }: { enabled?: boolean }) {
  const { tooltip, bind } = useNavTooltip(enabled);
  return (<div><a href="/x" aria-label="Review, 32 due" {...bind("Review · 32")}>R</a><a href="/y" aria-label="Kanji" {...bind("Kanji")}>K</a>{tooltip}</div>);
}

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
  it("shows on keyboard focus, is described-by linked, and Escape hides it", () => {
    render(<Harness />);
    const link = screen.getByLabelText("Kanji");
    fireEvent.focus(link);
    const tip = screen.getByRole("tooltip");
    expect(link).toHaveAttribute("aria-describedby", tip.id);
    fireEvent.keyDown(link, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
  it("hides on blur and on scroll", () => {
    render(<Harness />);
    const link = screen.getByLabelText("Kanji");
    fireEvent.focus(link);
    fireEvent.blur(link);
    expect(screen.queryByRole("tooltip")).toBeNull();
    fireEvent.focus(link);
    fireEvent.scroll(window);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
  it("renders nothing when disabled (expanded mode)", () => {
    render(<Harness enabled={false} />);
    fireEvent.pointerEnter(screen.getByLabelText("Kanji"));
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});
