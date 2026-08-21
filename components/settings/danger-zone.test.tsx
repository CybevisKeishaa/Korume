import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { screen } from "@testing-library/react";
import { render } from "@/test/render";
import { DangerZone } from "./danger-zone";

describe("DangerZone", () => {
  it("renders all three designed rows, none of them disabled", () => {
    render(<DangerZone onCloseAccount={vi.fn()} onEraseAll={vi.fn()} memoryHref="/settings/privacy/memory" />);
    const actions = screen.getAllByRole("button").concat(screen.getAllByRole("link"));
    expect(actions).toHaveLength(3);
    for (const action of actions) expect(action).not.toBeDisabled();
    expect(screen.getByText("Delete Korume Memory")).toBeInTheDocument();
    expect(screen.getByText("Delete Account")).toBeInTheDocument();
    expect(screen.getByText("Delete all my data")).toBeInTheDocument();
  });

  it("points the memory row at a real destination rather than doing nothing", () => {
    render(<DangerZone onCloseAccount={vi.fn()} onEraseAll={vi.fn()} memoryHref="/settings/privacy/memory" />);
    expect(screen.getByRole("link", { name: "Manage" })).toHaveAttribute("href", expect.stringContaining("/settings/privacy/memory"));
  });

  it("is fully keyboard operable and fires the right handler", async () => {
    const onEraseAll = vi.fn();
    render(<DangerZone onCloseAccount={vi.fn()} onEraseAll={onEraseAll} memoryHref="/x" />);
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.keyboard("{Enter}");
    expect(onEraseAll).toHaveBeenCalledTimes(1);
  });
});
