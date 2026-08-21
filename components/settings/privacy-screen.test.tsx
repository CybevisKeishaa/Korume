import { afterEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@/test/render";
import { PrivacyScreen } from "./privacy-screen";

const PENDING = {
  id: "req1",
  tier: "erase_all" as const,
  requestedAt: "2026-08-20T10:00:00.000Z",
  executeAfter: "2026-08-27T10:00:00.000Z",
};

const CLOSE_ACCOUNT_PENDING = { ...PENDING, tier: "close_account" as const };

afterEach(() => {
  vi.restoreAllMocks();
});

describe("PrivacyScreen", () => {
  it("composes the AI-training toggle above the Danger Zone, seeded with the server-read consent value", () => {
    render(<PrivacyScreen initialAiTrainingConsent pending={null} />);
    expect(screen.getByText("Help improve Korume's models")).toBeInTheDocument();
    expect(screen.getByText("Control your Korume data")).toBeInTheDocument();
    expect((screen.getByRole("checkbox", { name: /Help improve Korume's models/ }) as HTMLInputElement).checked).toBe(
      true,
    );
  });

  it("opens the delete-all-my-data dialog from the Danger Zone's erase-all row", async () => {
    render(<PrivacyScreen initialAiTrainingConsent={false} pending={null} />);
    expect(screen.queryByLabelText("Type DELETE to confirm.")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Review deletion" }));

    expect(screen.getByLabelText("Type DELETE to confirm.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete all my data" })).toBeInTheDocument();
  });

  it("closes the dialog on Escape", async () => {
    render(<PrivacyScreen initialAiTrainingConsent={false} pending={null} />);
    await userEvent.click(screen.getByRole("button", { name: "Review deletion" }));
    expect(screen.getByLabelText("Type DELETE to confirm.")).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");

    expect(screen.queryByLabelText("Type DELETE to confirm.")).not.toBeInTheDocument();
  });

  // Fix round 1 (2026-08-21): the close-account row now opens the SAME
  // dialog as erase-all, distinguished by tier — not a route to an unbuilt
  // page. See privacy-screen.tsx's file header for why reusing the dialog is
  // safe here (each tier carries its own, independent copy block).
  it("opens the same dialog from the Danger Zone's close-account row, with close-account copy — not the erase-all dialog's wording", async () => {
    render(<PrivacyScreen initialAiTrainingConsent={false} pending={null} />);
    expect(screen.queryByLabelText("Type DELETE to confirm.")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Review" }));

    expect(screen.getByLabelText("Type DELETE to confirm.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close my account" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete all my data" })).not.toBeInTheDocument();
    expect(screen.queryByText(/will be deleted/i)).not.toBeInTheDocument();
  });

  it("does not leak state between the two rows: closing the close-account dialog and reopening erase-all shows erase-all's copy", async () => {
    render(<PrivacyScreen initialAiTrainingConsent={false} pending={null} />);

    await userEvent.click(screen.getByRole("button", { name: "Review" }));
    expect(screen.getByRole("button", { name: "Close my account" })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByLabelText("Type DELETE to confirm.")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Review deletion" }));

    expect(screen.getByRole("button", { name: "Delete all my data" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Close my account" })).not.toBeInTheDocument();
  });

  /**
   * Fix round 2, Critical: `DeleteDataDialog` is mounted unconditionally and
   * merely hidden by `open` — Radix stops RENDERING children when closed,
   * it does not unmount them — so `typed`/`acknowledged`/`error`/
   * `submitting` used to survive a close. Without `key={openTier ?? "closed"}`
   * on the `<DeleteDataDialog>` call site, this sequence left the erase-all
   * confirm button already ENABLED on an acknowledgement the user gave for
   * closing their account (which explicitly promises data is KEPT) — one
   * click would then have permanently scheduled erasure of everything, with
   * zero fresh input for that specific, more destructive action. This is
   * the test that would have caught it before it shipped.
   */
  it("does not carry a typed confirmation across a close and a tier switch", async () => {
    render(<PrivacyScreen initialAiTrainingConsent={false} pending={null} />);

    // Arm the gate under close_account: type DELETE, tick the box.
    await userEvent.click(screen.getByRole("button", { name: "Review" }));
    await userEvent.type(screen.getByLabelText("Type DELETE to confirm."), "DELETE");
    await userEvent.click(screen.getByRole("checkbox"));
    expect(screen.getByRole("button", { name: "Close my account" })).toBeEnabled();

    // Back out without confirming.
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByLabelText("Type DELETE to confirm.")).not.toBeInTheDocument();

    // Open erase_all — a different, more destructive action.
    await userEvent.click(screen.getByRole("button", { name: "Review deletion" }));

    expect((screen.getByLabelText("Type DELETE to confirm.") as HTMLInputElement).value).toBe("");
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(false);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete all my data" })).toBeDisabled();
  });

  it("still points the memory row at an honest not-built destination — no confirmation flow exists for it in this branch", () => {
    render(<PrivacyScreen initialAiTrainingConsent={false} pending={null} />);
    expect(screen.getByRole("link", { name: "Manage" })).toHaveAttribute(
      "href",
      expect.stringContaining("/settings/privacy/memory"),
    );
  });

  /**
   * Task 11: the pending prop (server-read via `getPendingDeletion` in
   * page.tsx) seeds the one state no Figma frame draws. Its presence must
   * also disable the two destructive Danger Zone rows — re-opening either
   * dialog under a live request can only produce the 409 the API refuses.
   */
  describe("with a pending deletion request already on the server", () => {
    it("shows the deletion-pending banner instead of an untouched Danger Zone", () => {
      render(<PrivacyScreen initialAiTrainingConsent={false} pending={PENDING} />);
      expect(screen.getByRole("status")).toHaveTextContent(/nothing has been removed yet/i);
    });

    it("disables the two destructive Danger Zone rows", () => {
      render(<PrivacyScreen initialAiTrainingConsent={false} pending={PENDING} />);
      expect(screen.getByRole("button", { name: "Review" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Review deletion" })).toBeDisabled();
    });

    it("removes the banner and re-enables the Danger Zone after a successful cancel", async () => {
      vi.spyOn(global, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ data: { cancelled: true } }), { status: 200 }),
      );
      render(<PrivacyScreen initialAiTrainingConsent={false} pending={PENDING} />);
      expect(screen.getByRole("status")).toBeInTheDocument();

      await userEvent.click(screen.getByRole("button", { name: "Cancel deletion" }));

      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Review" })).toBeEnabled();
      expect(screen.getByRole("button", { name: "Review deletion" })).toBeEnabled();
    });
  });

  /**
   * Fix round 1, Important #1: `close_account` is data-preserving —
   * rendering erase-all's banner wording for it would tell the user the
   * opposite of what `dangerZone.closeAccount.body` and the dialog they just
   * confirmed both promised. Every fixture before this fix round was
   * `tier: "erase_all"`, so this path had zero coverage.
   */
  describe("with a pending close_account request already on the server", () => {
    it("shows close-account banner copy, never erase-all's, with both rows still disabled", () => {
      render(<PrivacyScreen initialAiTrainingConsent={false} pending={CLOSE_ACCOUNT_PENDING} />);
      const status = screen.getByRole("status");
      expect(status).toHaveTextContent(/account is scheduled to close/i);
      expect(screen.queryByText(/scheduled for deletion/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/nothing has been removed yet/i)).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Review" })).toBeDisabled();
      expect(screen.getByRole("button", { name: "Review deletion" })).toBeDisabled();
    });
  });

  /**
   * Fix round 1, Important #3(b): a failed `getPendingDeletion` read must
   * surface as an honest "we don't know", not silently masquerade as "no
   * request" — the dangerous direction to be wrong in during the 7-day
   * cancellation window. Locking the user out of the Danger Zone over a
   * transient read failure would be the WORSE error (it blocks the GDPR
   * right this page exists to serve), so the rows stay enabled; a POST from
   * this state re-syncs correctly through the 409 branch below if a request
   * actually exists.
   */
  describe("when the server-side pending-deletion read failed", () => {
    it("shows a neutral notice, no cancel button, and an enabled Danger Zone", () => {
      render(<PrivacyScreen initialAiTrainingConsent={false} pending="unknown" />);
      expect(screen.getByRole("status")).toHaveTextContent(/couldn't check/i);
      expect(screen.queryByRole("button", { name: "Cancel deletion" })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Review" })).toBeEnabled();
      expect(screen.getByRole("button", { name: "Review deletion" })).toBeEnabled();
    });
  });

  /**
   * Fix round 1, Important #3(a)/(c) — the unifying `refreshPending()`
   * mechanism. A stale/second tab still shows an enabled Danger Zone; its
   * POST can only 409 (the schema's partial unique index forbids two
   * pending rows). The old behaviour left the user reading "you already
   * have a pending request" with no banner and no way to see or cancel it —
   * `refreshPending()` re-fetches `GET /api/user/deletion` and updates the
   * whole screen from the true server state in the same pass.
   */
  describe("re-syncing when the dialog's own belief about pending-state is wrong", () => {
    it("shows the banner and disables the Danger Zone after the dialog's POST 409s", async () => {
      vi.spyOn(global, "fetch").mockImplementation(async (_input, init) => {
        if (init?.method === "POST") {
          return new Response(JSON.stringify({ error: "A deletion request is already pending" }), { status: 409 });
        }
        return new Response(JSON.stringify({ data: PENDING }), { status: 200 });
      });
      render(<PrivacyScreen initialAiTrainingConsent={false} pending={null} />);

      await userEvent.click(screen.getByRole("button", { name: "Review deletion" }));
      await userEvent.type(screen.getByLabelText("Type DELETE to confirm."), "DELETE");
      await userEvent.click(screen.getByRole("checkbox"));
      await userEvent.click(screen.getByRole("button", { name: "Delete all my data" }));

      expect(await screen.findByRole("alert")).toHaveTextContent(/already in progress/i);

      // The re-sync runs in the background while the dialog is still open —
      // Radix correctly marks the rest of the page `aria-hidden` while a
      // modal is open, so the banner behind it is (rightly) unreachable to
      // an assistive-tech query until the user dismisses the dialog, the
      // same way they would to see it visually. Escape is the existing
      // "Keep my data" affordance; asserting on the banner immediately after
      // proves the re-sync had already completed in the background, not
      // that closing triggers a fresh fetch.
      await userEvent.keyboard("{Escape}");

      expect(await screen.findByRole("status")).toHaveTextContent(/nothing has been removed yet/i);
      expect(screen.getByRole("button", { name: "Review deletion" })).toBeDisabled();
    });

    it("re-syncs from the server when the dialog's success body is malformed", async () => {
      vi.spyOn(global, "fetch").mockImplementation(async (_input, init) => {
        if (init?.method === "POST") {
          return new Response(JSON.stringify({ data: { id: "r1", tier: "not_a_real_tier" } }), { status: 200 });
        }
        return new Response(JSON.stringify({ data: PENDING }), { status: 200 });
      });
      render(<PrivacyScreen initialAiTrainingConsent={false} pending={null} />);

      await userEvent.click(screen.getByRole("button", { name: "Review deletion" }));
      await userEvent.type(screen.getByLabelText("Type DELETE to confirm."), "DELETE");
      await userEvent.click(screen.getByRole("checkbox"));
      await userEvent.click(screen.getByRole("button", { name: "Delete all my data" }));

      expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't schedule the deletion");

      // Same reasoning as the 409 test above: the banner behind the still-
      // open dialog is `aria-hidden` until the dialog is dismissed.
      await userEvent.keyboard("{Escape}");

      expect(await screen.findByRole("status")).toHaveTextContent(/nothing has been removed yet/i);
    });
  });

  /**
   * Task 11's success path: `DeleteDataDialog` hands the newly-created
   * `PendingDeletion` to `onConfirmed` — the banner must appear from that
   * value directly, with no reload and no re-fetch.
   *
   * Fix round 1, Important #4: `Dialog` restores focus to the trigger it
   * captured on open; `onConfirmed` sets `pending` and closes the dialog in
   * the same handler, so by the time focus would be restored the trigger
   * (the "Delete all my data" Danger Zone row) already carries `disabled` —
   * `.focus()` on a disabled button is a no-op, so focus would land nowhere
   * immediately after the most destructive action in the product. Focus
   * must land on the banner instead.
   */
  it("shows the deletion-pending banner immediately after a successful erase-all confirmation, without a reload", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: PENDING }), { status: 200 }),
    );
    render(<PrivacyScreen initialAiTrainingConsent={false} pending={null} />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Review deletion" }));
    await userEvent.type(screen.getByLabelText("Type DELETE to confirm."), "DELETE");
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: "Delete all my data" }));

    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent(/nothing has been removed yet/i);
    expect(screen.queryByLabelText("Type DELETE to confirm.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Review deletion" })).toBeDisabled();
    // Fix round 1, #9: "without a reload" was in the test's name but not in
    // its assertions — exactly one fetch (the POST) must have happened.
    expect(global.fetch).toHaveBeenCalledTimes(1);
    // Fix round 1, Important #4: focus lands inside the banner, not nowhere.
    // `document.activeElement` defaults to `document.body` when nothing is
    // explicitly focused, and `body` always "contains" `status` regardless —
    // asserting containment alone would pass even if focus never moved, so
    // the `not.toBe(document.body)` guard is load-bearing, not decorative.
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement).toContainElement(status);
  });
});
