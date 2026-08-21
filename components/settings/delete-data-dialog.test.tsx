import { afterEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { screen } from "@testing-library/react";
import { render } from "@/test/render";
import { DeleteDataDialog } from "./delete-data-dialog";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("DeleteDataDialog", () => {
  it("keeps confirm disabled until the word is typed AND the box is ticked", async () => {
    render(<DeleteDataDialog open tier="erase_all" onClose={vi.fn()} onConfirmed={vi.fn()} />);
    const confirm = screen.getByRole("button", { name: "Delete all my data" });
    expect(confirm).toBeDisabled();

    await userEvent.type(screen.getByLabelText("Type DELETE to confirm."), "DELETE");
    expect(confirm).toBeDisabled();

    await userEvent.click(screen.getByRole("checkbox"));
    expect(confirm).toBeEnabled();
  });

  it("rejects a lowercase confirmation", async () => {
    render(<DeleteDataDialog open tier="erase_all" onClose={vi.fn()} onConfirmed={vi.fn()} />);
    await userEvent.type(screen.getByLabelText("Type DELETE to confirm."), "delete");
    await userEvent.click(screen.getByRole("checkbox"));
    expect(screen.getByRole("button", { name: "Delete all my data" })).toBeDisabled();
  });

  it("lists all six categories the frame draws", () => {
    render(<DeleteDataDialog open tier="erase_all" onClose={vi.fn()} onConfirmed={vi.fn()} />);
    const items = screen.getAllByTestId("delete-category");
    expect(items).toHaveLength(6);
  });

  it("never tells the user the action is irreversible", () => {
    render(<DeleteDataDialog open tier="erase_all" onClose={vi.fn()} onConfirmed={vi.fn()} />);
    expect(screen.queryByText(/cannot be undone/i)).not.toBeInTheDocument();
    expect(screen.getByText(/7 days to change your mind/i)).toBeInTheDocument();
  });

  it("treats Escape as Keep my data", async () => {
    const onClose = vi.fn();
    render(<DeleteDataDialog open tier="erase_all" onClose={onClose} onConfirmed={vi.fn()} />);
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  it("surfaces a translated error and never the server's own message", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "pg: duplicate key value violates ..." }), { status: 409 }),
    );
    render(<DeleteDataDialog open tier="erase_all" onClose={vi.fn()} onConfirmed={vi.fn()} />);
    await userEvent.type(screen.getByLabelText("Type DELETE to confirm."), "DELETE");
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: "Delete all my data" }));
    expect(await screen.findByRole("alert")).not.toHaveTextContent("duplicate key");
  });

  /**
   * Fix round 2, Important: 409 (already pending) and 401 (signed out) are
   * not "try again" situations — retrying either cannot possibly succeed,
   * and for 409 specifically the user has no pending-state banner yet
   * (Task 11's) to tell them a request already exists, so a generic "please
   * try again" would send them retrying forever. The branch reads
   * `response.status` only and never calls `.json()` on the failure path —
   * a status code is not server-supplied text, so this keeps the same
   * no-parse discipline the "never the server's own message" test above
   * checks for.
   */
  it.each([
    [409, "deletion request is already in progress"],
    [401, "session has expired"],
    [429, "Too many attempts"],
  ])("maps status %i to its own translated message, not the generic fallback", async (status, expectedText) => {
    vi.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({}), { status }));
    render(<DeleteDataDialog open tier="erase_all" onClose={vi.fn()} onConfirmed={vi.fn()} />);
    await userEvent.type(screen.getByLabelText("Type DELETE to confirm."), "DELETE");
    await userEvent.click(screen.getByRole("checkbox"));

    await userEvent.click(screen.getByRole("button", { name: "Delete all my data" }));

    const alert = await screen.findByRole("alert");
    // en catalog check below is deliberately loose (matches the shipped
    // en copy's key phrase) — the exact strings are pinned in
    // messages/en/settings.pin.test.ts; this test only proves the STATUS
    // routes to a distinct message rather than the generic "please try
    // again" fallback used for anything else (e.g. 500).
    expect(alert.textContent?.toLowerCase()).toContain(expectedText.toLowerCase());
    expect(alert).not.toHaveTextContent("We couldn't schedule the deletion");
  });

  it("falls back to the generic message for a status with no specific mapping (500)", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({}), { status: 500 }));
    render(<DeleteDataDialog open tier="erase_all" onClose={vi.fn()} onConfirmed={vi.fn()} />);
    await userEvent.type(screen.getByLabelText("Type DELETE to confirm."), "DELETE");
    await userEvent.click(screen.getByRole("checkbox"));

    await userEvent.click(screen.getByRole("button", { name: "Delete all my data" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't schedule the deletion");
  });

  /**
   * Fix round 2, minor #1: the one path where the never-render-a-server-
   * string guarantee was previously unexercised — a rejected fetch (e.g. a
   * dropped connection) never even reaches a `.status` to branch on.
   */
  it("shows the generic translated error when fetch itself rejects, never a raw error", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
    render(<DeleteDataDialog open tier="erase_all" onClose={vi.fn()} onConfirmed={vi.fn()} />);
    await userEvent.type(screen.getByLabelText("Type DELETE to confirm."), "DELETE");
    await userEvent.click(screen.getByRole("checkbox"));

    await userEvent.click(screen.getByRole("button", { name: "Delete all my data" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("We couldn't schedule the deletion");
    expect(alert).not.toHaveTextContent("Failed to fetch");
    expect(alert).not.toHaveTextContent("TypeError");
  });

  it("renders the support footer line", () => {
    render(<DeleteDataDialog open tier="erase_all" onClose={vi.fn()} onConfirmed={vi.fn()} />);
    expect(screen.getByText("If you need help, contact Korume Support.")).toBeInTheDocument();
  });

  /**
   * Task 11: the success body used to be trusted via a bare type cast with
   * no runtime check. That was harmless while nothing consumed the value —
   * it stops being harmless the moment `PrivacyScreen` threads it into
   * `DeletionPendingBanner`'s rendered date. This proves a malformed shape
   * (here: `tier` outside the real enum, and no `requestedAt`/`executeAfter`
   * at all) is caught at this boundary and never reaches `onConfirmed`.
   */
  it("never lets a malformed success body reach onConfirmed unvalidated", async () => {
    const onConfirmed = vi.fn();
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: { id: "r1", tier: "not_a_real_tier" } }), { status: 200 }),
    );
    render(<DeleteDataDialog open tier="erase_all" onClose={vi.fn()} onConfirmed={onConfirmed} />);
    await userEvent.type(screen.getByLabelText("Type DELETE to confirm."), "DELETE");
    await userEvent.click(screen.getByRole("checkbox"));

    await userEvent.click(screen.getByRole("button", { name: "Delete all my data" }));

    expect(onConfirmed).not.toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't schedule the deletion");
  });
});

/**
 * Fix round 1 (2026-08-21): `close_account` reuses this dialog with its own,
 * independent copy block (`settings.deleteDialog.close_account`) — the
 * Danger Zone's "Delete Account" row opens this same component rather than
 * routing away. Same structure, same a11y guarantees (Dialog primitive
 * supplies the focus trap / Escape / focus-return; the confirm button keeps
 * the contrast-tested `bg-danger`/`text-danger-foreground` pairing), only
 * the words differ — and they must never claim data is deleted.
 */
describe("DeleteDataDialog — tier=close_account", () => {
  it("renders close-account copy, not the erase-all dialog's wording", () => {
    render(<DeleteDataDialog open tier="close_account" onClose={vi.fn()} onConfirmed={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Close my account" })).toBeInTheDocument();
    // "Keep my account" appears twice by design (the × close button's
    // aria-label and the visible Keep button share the same dismiss
    // semantics — the established pattern from
    // components/video-player/pin-line-control.tsx's closeLabel).
    expect(screen.getAllByRole("button", { name: "Keep my account" })).toHaveLength(2);
    expect(screen.queryByText("Delete all my data")).not.toBeInTheDocument();
  });

  it("never claims the account's learning data is deleted", () => {
    render(<DeleteDataDialog open tier="close_account" onClose={vi.fn()} onConfirmed={vi.fn()} />);
    expect(screen.queryByText(/cannot be undone/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/will be deleted/i)).not.toBeInTheDocument();
    expect(screen.getByText(/does not delete your learning data/i)).toBeInTheDocument();
  });

  it("keeps confirm disabled until typed AND ticked, and keeps the AA-tested destructive-fill pairing", async () => {
    render(<DeleteDataDialog open tier="close_account" onClose={vi.fn()} onConfirmed={vi.fn()} />);
    const confirm = screen.getByRole("button", { name: "Close my account" });
    expect(confirm).toBeDisabled();

    await userEvent.type(screen.getByLabelText("Type DELETE to confirm."), "DELETE");
    expect(confirm).toBeDisabled();

    await userEvent.click(screen.getByRole("checkbox"));
    expect(confirm).toBeEnabled();
    // Same pairing lib/design-tokens.contrast.test.ts asserts clears AA
    // ("--danger-foreground" aliases "--ink-950") — not a literal "ink-950"
    // class, which does not exist in this repo's Tailwind config.
    expect(confirm).toHaveClass("bg-danger", "text-danger-foreground");
  });

  it("treats Escape as Keep my account", async () => {
    const onClose = vi.fn();
    render(<DeleteDataDialog open tier="close_account" onClose={onClose} onConfirmed={vi.fn()} />);
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  it("posts tier: close_account to the same /api/user/deletion endpoint", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ data: { id: "r1", tier: "close_account", requestedAt: "x", executeAfter: "y" } }),
        { status: 200 },
      ),
    );
    const onConfirmed = vi.fn();
    render(<DeleteDataDialog open tier="close_account" onClose={vi.fn()} onConfirmed={onConfirmed} />);
    await userEvent.type(screen.getByLabelText("Type DELETE to confirm."), "DELETE");
    await userEvent.click(screen.getByRole("checkbox"));

    await userEvent.click(screen.getByRole("button", { name: "Close my account" }));

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/user/deletion",
      expect.objectContaining({
        body: JSON.stringify({ tier: "close_account", confirmation: "DELETE", acknowledged: true }),
      }),
    );
    expect(onConfirmed).toHaveBeenCalled();
  });
});
