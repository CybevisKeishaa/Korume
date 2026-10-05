import { act, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "@/test/render";
import { CARD_CLICK_DELAY_MS, Clamp, ExpandableCard } from "./expandable-card";

// jsdom has no layout: fake "this text is taller than its clamp box".
function fakeOverflow(cut: boolean) {
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(cut ? 100 : 20);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(20);
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** A card click toggles only once the double-click window has passed. */
const settle = () => act(() => { vi.advanceTimersByTime(CARD_CLICK_DELAY_MS); });

const card = () => (
  <ExpandableCard data-testid="card">
    <Clamp lines={3}>long text</Clamp>
    <button type="button">inner</button>
  </ExpandableCard>
);

describe("ExpandableCard", () => {
  it("clamps cut text; a card click opens it, and Show less closes it", () => {
    vi.useFakeTimers();
    fakeOverflow(true);
    render(card());
    expect(screen.getByText("long text")).toHaveClass("line-clamp-3");
    expect(screen.getByRole("button", { name: "Show more" })).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(screen.getByText("long text"), { detail: 1 });
    settle();
    expect(screen.getByText("long text")).not.toHaveClass("line-clamp-3");
    fireEvent.click(screen.getByRole("button", { name: "Show less" }));
    expect(screen.getByText("long text")).toHaveClass("line-clamp-3");
  });

  it("a double-click that selects a word does not toggle the card (m6)", () => {
    vi.useFakeTimers();
    fakeOverflow(true);
    render(card());
    const text = screen.getByText("long text");
    fireEvent.click(text, { detail: 1 });
    // The browser selects the word between the two clicks; jsdom does not, so model it.
    vi.spyOn(window, "getSelection").mockReturnValue({ toString: () => "long" } as Selection);
    fireEvent.click(text, { detail: 2 });
    fireEvent.doubleClick(text, { detail: 2 });
    settle();
    expect(text).toHaveClass("line-clamp-3");
  });

  it("a double-click that selects nothing (card padding) does not toggle it either", () => {
    vi.useFakeTimers();
    fakeOverflow(true);
    render(card());
    fireEvent.click(screen.getByTestId("card"), { detail: 1 });
    fireEvent.click(screen.getByTestId("card"), { detail: 2 });
    settle();
    expect(screen.getByText("long text")).toHaveClass("line-clamp-3");
  });

  it("a click on the card's own control does not toggle it", () => {
    vi.useFakeTimers();
    fakeOverflow(true);
    render(card());
    fireEvent.click(screen.getByRole("button", { name: "inner" }), { detail: 1 });
    settle();
    expect(screen.getByText("long text")).toHaveClass("line-clamp-3");
  });

  it("Show more pressed while a card click is pending is not undone by it", () => {
    vi.useFakeTimers();
    fakeOverflow(true);
    render(card());
    fireEvent.click(screen.getByText("long text"), { detail: 1 });
    fireEvent.click(screen.getByRole("button", { name: "Show more" }), { detail: 0 });
    settle();
    expect(screen.getByText("long text")).not.toHaveClass("line-clamp-3");
  });

  it("a pending click does not open text that stopped being cut, which would leave no way to close it", () => {
    vi.useFakeTimers();
    fakeOverflow(true);
    render(card());
    fireEvent.click(screen.getByText("long text"), { detail: 1 });
    vi.restoreAllMocks();
    fakeOverflow(false);
    settle();
    expect(screen.getByText("long text")).toHaveClass("line-clamp-3");
  });

  it("re-measures when the text changes but the clamp box keeps its size", async () => {
    fakeOverflow(false);
    const { rerender } = render(<ExpandableCard><Clamp lines={3}>short</Clamp></ExpandableCard>);
    expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
    fakeOverflow(true);
    rerender(<ExpandableCard><Clamp lines={3}>now a much longer text</Clamp></ExpandableCard>);
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByRole("button", { name: "Show more" })).toBeInTheDocument();
  });

  it("text that fits gets no toggle and a card click does nothing", () => {
    vi.useFakeTimers();
    fakeOverflow(false);
    render(card());
    expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
    fireEvent.click(screen.getByTestId("card"), { detail: 1 });
    settle();
    expect(screen.getByText("long text")).toHaveClass("line-clamp-3");
  });
});
