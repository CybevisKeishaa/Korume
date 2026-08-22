import { describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { screen } from "@testing-library/react";
import { render } from "@/test/render";
import { DangerZone } from "./danger-zone";

describe("DangerZone", () => {
  it("renders all three designed rows, none of them disabled", () => {
    render(
      <DangerZone
        onCloseAccount={vi.fn()}
        onEraseAll={vi.fn()}
        memoryHref="/settings/privacy/memory"
        pendingRequest={false}
      />,
    );
    const actions = screen.getAllByRole("button").concat(screen.getAllByRole("link"));
    expect(actions).toHaveLength(3);
    for (const action of actions) expect(action).not.toBeDisabled();
    expect(screen.getByText("Delete Korume Memory")).toBeInTheDocument();
    expect(screen.getByText("Delete Account")).toBeInTheDocument();
    expect(screen.getByText("Delete all my data")).toBeInTheDocument();
  });

  it("points the memory row at a real destination rather than doing nothing", () => {
    render(
      <DangerZone
        onCloseAccount={vi.fn()}
        onEraseAll={vi.fn()}
        memoryHref="/settings/privacy/memory"
        pendingRequest={false}
      />,
    );
    expect(screen.getByRole("link", { name: "Manage" })).toHaveAttribute("href", expect.stringContaining("/settings/privacy/memory"));
  });

  it("is fully keyboard operable and fires the right handler", async () => {
    const onEraseAll = vi.fn();
    render(<DangerZone onCloseAccount={vi.fn()} onEraseAll={onEraseAll} memoryHref="/x" pendingRequest={false} />);
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.keyboard("{Enter}");
    expect(onEraseAll).toHaveBeenCalledTimes(1);
  });

  /**
   * Task 11: the account_deletion_requests table allows only one LIVE
   * request per user (partial unique index) — re-opening either dialog
   * while one is pending can only produce the 409 the API already refuses.
   * The user must never be invited into an action that cannot succeed, so
   * both destructive rows are disabled while `pendingRequest` is true. The
   * memory row is untouched: it has no confirmation flow of its own in this
   * branch and is unrelated to the deletion-request lifecycle.
   */
  it("disables the two destructive rows while a deletion request is already pending", () => {
    const onCloseAccount = vi.fn();
    const onEraseAll = vi.fn();
    render(
      <DangerZone
        onCloseAccount={onCloseAccount}
        onEraseAll={onEraseAll}
        memoryHref="/settings/privacy/memory"
        pendingRequest
      />,
    );

    expect(screen.getByRole("button", { name: "Review" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Review deletion" })).toBeDisabled();
    expect(screen.getByRole("link", { name: "Manage" })).not.toHaveAttribute("aria-disabled");
    expect(onCloseAccount).not.toHaveBeenCalled();
    expect(onEraseAll).not.toHaveBeenCalled();
  });

  it("does not call onCloseAccount/onEraseAll when their rows are disabled by a pending request", async () => {
    const onCloseAccount = vi.fn();
    const onEraseAll = vi.fn();
    render(
      <DangerZone
        onCloseAccount={onCloseAccount}
        onEraseAll={onEraseAll}
        memoryHref="/settings/privacy/memory"
        pendingRequest
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Review" }));
    await userEvent.click(screen.getByRole("button", { name: "Review deletion" }));

    expect(onCloseAccount).not.toHaveBeenCalled();
    expect(onEraseAll).not.toHaveBeenCalled();
  });
});
