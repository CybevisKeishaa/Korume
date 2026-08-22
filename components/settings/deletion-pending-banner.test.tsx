import { createRef } from "react";
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
   * Fix round 2 (2026-08-21): round 1 had this banner focus itself from a
   * mount-time `useEffect`, reasoned as the fix for Important #4. The
   * re-review found that effect reintroduced the SAME defect via a path it
   * couldn't see — mounting while a `Dialog` is still open and trapping
   * focus. Focus ownership moved up to `PrivacyScreen`, which can see WHY
   * the banner appeared and the mount effect could not. This is the
   * regression guard for that removal: rendering this component standalone
   * must never move focus by itself, in any circumstance, including mount.
   *
   * ⚠️ The whole-branch review flagged this as an `L-004` inert test on the
   * grounds that it "guards code that no longer exists, with no mutation RED".
   * It is KEPT, with the missing evidence supplied instead: the thing it
   * guards is the ABSENCE of a mount-time focus effect, and the mutation that
   * breaks that is re-introducing the effect — which is precisely the defect
   * this branch already shipped once. Re-adding it (a `useRef` + a
   * `useEffect(() => selfRef.current?.focus(), [])` merged into the forwarded
   * ref) turns this assertion, and only this one, red:
   *
   *   FAIL … > never focuses itself — focus ownership belongs to PrivacyScreen
   *     → expected <div tabindex="-1" …> to be <body>…</body>
   *
   * and removing it again restores 12/12. A guard against re-adding deleted
   * code is a real guard; what was missing was the proof, not the assertion.
   */
  it("never focuses itself — focus ownership belongs to PrivacyScreen (fix round 2)", () => {
    render(<DeletionPendingBanner pending={PENDING} onCancelled={vi.fn()} refreshPending={vi.fn()} />);
    // Direct equality to `document.body`, not a containment check: `body`
    // always contains every element in the tree regardless of focus, so
    // `not.toContainElement` would pass vacuously even if this component DID
    // steal focus (L-004 — the same trap the corresponding `PrivacyScreen`
    // assertion documents from the other direction).
    expect(document.activeElement).toBe(document.body);
  });

  /**
   * Fix round 1, #6: the `role="alert"` cancel-failure line is a SIBLING of
   * `role="status"`, not nested inside it — nesting is undefined behaviour
   * and re-announces the whole card on some screen readers.
   */
  it("keeps the alert region as a sibling of the status region, not nested inside it", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "pg: duplicate key value violates ..." }), { status: 500 }),
    );
    render(<DeletionPendingBanner pending={PENDING} onCancelled={vi.fn()} refreshPending={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Cancel deletion" }));
    const alert = await screen.findByRole("alert");
    const status = screen.getByRole("status");
    expect(status).not.toContainElement(alert);
  });

  /**
   * Fix round 2: `PrivacyScreen` directs focus here via the forwarded `ref`
   * (its own docstring explains when). This is the contract test for that —
   * a focusable, `tabIndex={-1}` root that actually accepts focus when asked.
   */
  it("forwards ref to a focusable, tabIndex=-1 root", () => {
    const ref = createRef<HTMLDivElement>();
    render(<DeletionPendingBanner ref={ref} pending={PENDING} onCancelled={vi.fn()} refreshPending={vi.fn()} />);
    expect(ref.current).toHaveAttribute("tabindex", "-1");
    ref.current?.focus();
    expect(document.activeElement).toBe(ref.current);
  });
});
