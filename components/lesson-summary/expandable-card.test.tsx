import { fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "@/test/render";
import { Clamp, ExpandableCard } from "./expandable-card";

// jsdom has no layout: fake "this text is taller than its clamp box".
function fakeOverflow(cut: boolean) {
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(cut ? 100 : 20);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(20);
}

afterEach(() => vi.restoreAllMocks());

const card = () => (
  <ExpandableCard data-testid="card">
    <Clamp lines={3}>long text</Clamp>
    <button type="button">inner</button>
  </ExpandableCard>
);

describe("ExpandableCard", () => {
  it("clamps cut text; a card click opens it, and Show less closes it", () => {
    fakeOverflow(true);
    render(card());
    expect(screen.getByText("long text")).toHaveClass("line-clamp-3");
    expect(screen.getByRole("button", { name: "Show more" })).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(screen.getByText("long text"));
    expect(screen.getByText("long text")).not.toHaveClass("line-clamp-3");
    fireEvent.click(screen.getByRole("button", { name: "Show less" }));
    expect(screen.getByText("long text")).toHaveClass("line-clamp-3");
  });

  it("a click on the card's own control does not toggle it", () => {
    fakeOverflow(true);
    render(card());
    fireEvent.click(screen.getByRole("button", { name: "inner" }));
    expect(screen.getByText("long text")).toHaveClass("line-clamp-3");
  });

  it("text that fits gets no toggle and a card click does nothing", () => {
    fakeOverflow(false);
    render(card());
    expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
    fireEvent.click(screen.getByTestId("card"));
    expect(screen.getByText("long text")).toHaveClass("line-clamp-3");
  });
});
