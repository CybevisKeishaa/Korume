import { afterEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";
import { act } from "@testing-library/react";
import enSettings from "@/messages/en/settings.json";
import { render, screen } from "@/test/render";
import { DeletionControls } from "./deletion-controls";
import type { PendingDeletion } from "@/lib/data/account-deletion";

const PENDING: PendingDeletion = {
  id: "req1",
  tier: "erase_all",
  requestedAt: "2026-09-20T10:00:00.000Z",
  executeAfter: "2026-09-27T10:00:00.000Z",
};

afterEach(() => vi.unstubAllGlobals());

describe("DeletionControls", () => {
  it("renders the three Danger Zone rows", () => {
    render(<DeletionControls initialPending={null} />);

    expect(screen.getByText(enSettings.dangerZone.memory.title)).toBeInTheDocument();
    expect(screen.getByText(enSettings.dangerZone.closeAccount.title)).toBeInTheDocument();
    expect(screen.getByText(enSettings.dangerZone.eraseAll.title)).toBeInTheDocument();
  });

  /**
   * ⚠️ `refreshPending`'s sequence guard had NO test before this one — it was
   * added in a fix round, moved here by the Task 9 extraction, and deleting it
   * left the whole suite green. Mutation-checked now: neutering
   * `if (seq === refreshSeqRef.current)` reddens this test and nothing else.
   *
   * The race is real on this screen. Two re-syncs can overlap — a cancel that
   * 404s while a 409 re-sync from the dialog is still in flight — and if the
   * older GET lands last it overwrites the newer truth. Here the stale answer
   * says "no request at all" while the live one says a deletion IS scheduled;
   * letting the straggler win would hide a pending account deletion behind a
   * screen that looks untouched.
   */
  it("lets a newer re-sync win when an older one resolves after it", async () => {
    const user = userEvent.setup();
    const deferred: { resolve: (r: Response) => void }[] = [];

    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init?: RequestInit) => {
        // The cancel itself: 404 means "no pending request", which is exactly
        // the branch that triggers a re-sync rather than trusting itself.
        if (init?.method === "DELETE") {
          return Promise.resolve(new Response(JSON.stringify({ error: "x" }), { status: 404 }));
        }
        // The re-sync GET — held open so both can be in flight at once.
        return new Promise<Response>((resolve) => deferred.push({ resolve }));
      }),
    );

    render(<DeletionControls initialPending={PENDING} />);
    const cancel = () => screen.getByRole("button", { name: "Cancel deletion" });

    await user.click(cancel());
    await user.click(cancel());
    expect(deferred).toHaveLength(2);

    // Newest answers first and is applied: a request really is still pending.
    await act(async () => {
      (deferred[1] as { resolve: (r: Response) => void }).resolve(
        new Response(JSON.stringify({ data: PENDING }), { status: 200 }),
      );
    });
    // Then the straggler arrives claiming there is none. It must be dropped.
    await act(async () => {
      (deferred[0] as { resolve: (r: Response) => void }).resolve(
        new Response(JSON.stringify({ data: null }), { status: 200 }),
      );
    });

    expect(screen.getByRole("status")).toHaveTextContent(/nothing has been removed yet/i);
    expect(screen.getByRole("button", { name: enSettings.dangerZone.eraseAll.action })).toBeDisabled();
  });
});
