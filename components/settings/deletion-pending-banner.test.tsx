import { afterEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { screen } from "@testing-library/react";
import { render } from "@/test/render";
import { DeletionPendingBanner } from "./deletion-pending-banner";

const PENDING = {
  id: "req1",
  tier: "erase_all" as const,
  requestedAt: "2026-08-20T10:00:00.000Z",
  executeAfter: "2026-08-27T10:00:00.000Z",
};

const CLOSE_ACCOUNT_PENDING = { ...PENDING, tier: "close_account" as const };

// Fix round 1, #12: four tests below spy on `global.fetch`; none restored it
// before this — mirrors the `afterEach` already present in
// `privacy-screen.test.tsx`.
afterEach(() => {
  vi.restoreAllMocks();
});

describe("DeletionPendingBanner", () => {
  it("states the execution date and that nothing has been removed yet", () => {
    render(<DeletionPendingBanner pending={PENDING} onCancelled={vi.fn()} refreshPending={vi.fn()} />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(/nothing has been removed yet/i);
    // Locale-correctness (task constraint): the date is formatted through
    // useFormatter against the same VN_TIME_ZONE the rest of the app pins
    // (journal-view.tsx), not the environment's zone — 10:00 UTC on the 27th
    // stays the 27th in Asia/Ho_Chi_Minh (UTC+7), so a day-boundary bug
    // would show up here as "August 26" or "August 28" instead.
    expect(status).toHaveTextContent(/August 27, 2026/);
  });

  /**
   * Fix round 1, Important #1: `close_account` is data-preserving —
   * `deleteDialog.close_account.acknowledge` and `dangerZone.closeAccount.body`
   * both promise learning data is KEPT. Rendering erase-all's "scheduled for
   * deletion" wording for this tier would tell the user the opposite of what
   * they were just promised. This is the "absence" half of the coverage —
   * not just that close-account copy appears, but that erase-all's copy does
   * NOT (the exact class of gap the review found: every fixture in the diff
   * was `tier: "erase_all"`, so the wrong-copy path had zero coverage).
   */
  it("renders tier-specific copy for close_account, never the erase-all wording", () => {
    render(<DeletionPendingBanner pending={CLOSE_ACCOUNT_PENDING} onCancelled={vi.fn()} refreshPending={vi.fn()} />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(/account is scheduled to close/i);
    expect(status).toHaveTextContent(/kept, not deleted/i);
    expect(screen.queryByText(/scheduled for deletion/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/nothing has been removed yet/i)).not.toBeInTheDocument();
  });

  /**
   * Fix round 1, Important #2: the explanation for why BOTH Danger Zone rows
   * stay disabled while a request is pending lives here, as visible text —
   * not only in a disabled button's (unreachable) aria-describedby.
   */
  it("tells the user how to switch to the other kind of request", () => {
    render(<DeletionPendingBanner pending={PENDING} onCancelled={vi.fn()} refreshPending={vi.fn()} />);
    expect(screen.getByText(/close your account/i)).toBeInTheDocument();
    expect(screen.getByText(/cancel this request first/i)).toBeInTheDocument();
  });

  it("cancels through the API and tells the parent", async () => {
    const onCancelled = vi.fn();
    vi.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ data: { cancelled: true } }), { status: 200 }));
    render(<DeletionPendingBanner pending={PENDING} onCancelled={onCancelled} refreshPending={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Cancel deletion" }));
    expect(global.fetch).toHaveBeenCalledWith("/api/user/deletion", expect.objectContaining({ method: "DELETE" }));
    expect(onCancelled).toHaveBeenCalledTimes(1);
  });

  /**
   * Fix round 1, ruled-up #7: a `404` means "no pending request" — which
   * could mean this exact request was already cancelled from another tab.
   * Assuming "cancelled" here (the old behaviour) or showing a "try again"
   * error (impossible to satisfy — a second cancel of an already-cancelled
   * request 404s forever) are both wrong. The server decides; this tab only
   * asks it via `refreshPending()`.
   */
  it("does not assume cancelled on a 404 — re-syncs from the server instead", async () => {
    const onCancelled = vi.fn();
    const refreshPending = vi.fn();
    vi.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ error: "No pending deletion request" }), { status: 404 }));
    render(<DeletionPendingBanner pending={PENDING} onCancelled={onCancelled} refreshPending={refreshPending} />);
    await userEvent.click(screen.getByRole("button", { name: "Cancel deletion" }));
    expect(onCancelled).not.toHaveBeenCalled();
    expect(refreshPending).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  /**
   * Fix round 1, ruled-up #7: 401/429 mirror `DeleteDataDialog`'s own
   * mapping (`deleteDialog.signedOut` / `deleteDialog.tooMany`) rather than
   * collapsing to the generic `pending.failed` — the same feature shipping
   * two different behaviours for the same two statuses is a "one fact, one
   * home" violation (CLAUDE.md §6).
   */
  it.each([
    [401, "session has expired"],
    [429, "Too many attempts"],
  ])("maps status %i to the dialog's own translated message", async (status, expectedText) => {
    const refreshPending = vi.fn();
    vi.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({}), { status }));
    render(<DeletionPendingBanner pending={PENDING} onCancelled={vi.fn()} refreshPending={refreshPending} />);
    await userEvent.click(screen.getByRole("button", { name: "Cancel deletion" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent?.toLowerCase()).toContain(expectedText.toLowerCase());
    expect(refreshPending).not.toHaveBeenCalled();
  });

  it("never renders the server's own error text on a failed cancel", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "pg: duplicate key value violates ..." }), { status: 500 }),
    );
    render(<DeletionPendingBanner pending={PENDING} onCancelled={vi.fn()} refreshPending={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Cancel deletion" }));
    const alert = await screen.findByRole("alert");
    expect(alert).not.toHaveTextContent("duplicate key");
    // Fix round 1, #8: the negative assertion above is mutation-sensitive
    // (it would fail if the server's raw text leaked through) but a missing
    // or renamed `pending.failed` key rendering as an empty/raw key path
    // would also satisfy it — this positive assertion pins what SHOULD show.
    expect(alert).toHaveTextContent("We couldn't cancel the request");
  });

  it("shows the generic translated error when the fetch itself rejects, never a raw error", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
    const onCancelled = vi.fn();
    render(<DeletionPendingBanner pending={PENDING} onCancelled={onCancelled} refreshPending={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Cancel deletion" }));
    const alert = await screen.findByRole("alert");
    expect(alert).not.toHaveTextContent("Failed to fetch");
    expect(alert).not.toHaveTextContent("TypeError");
    // Fix round 1, #8: positive counterpart to the two negative assertions
    // above — see the "duplicate key" test's comment for why both are
    // needed.
    expect(alert).toHaveTextContent("We couldn't cancel the request");
    expect(onCancelled).not.toHaveBeenCalled();
  });

  /**
   * Fix round 1, Important #4/#6: focus moves onto the banner itself when it
   * appears (not the disabled trigger `Dialog` would otherwise restore focus
   * to), and the `role="alert"` cancel-failure line is a SIBLING of
   * `role="status"`, not nested inside it — nesting is undefined behaviour
   * and re-announces the whole card on some screen readers. Both are
   * asserted together here because they are the same DOM restructuring
   * (fix round 1, #6's "render the error as a sibling" resolution).
   */
  it("focuses itself on mount, and keeps the alert region outside the status region", () => {
    render(<DeletionPendingBanner pending={PENDING} onCancelled={vi.fn()} refreshPending={vi.fn()} />);
    const status = screen.getByRole("status");
    // tabIndex={-1} on the outer container, not on the status region itself
    // — the container is what receives focus on mount.
    expect(document.activeElement).not.toBe(status);
    expect(document.activeElement).toHaveAttribute("tabindex", "-1");
    expect(document.activeElement).toContainElement(status);
  });
});
