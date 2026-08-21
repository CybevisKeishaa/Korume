import { describe, expect, it, vi } from "vitest";
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

describe("DeletionPendingBanner", () => {
  it("states the execution date and that nothing has been removed yet", () => {
    render(<DeletionPendingBanner pending={PENDING} onCancelled={vi.fn()} />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(/nothing has been removed yet/i);
    // Locale-correctness (task constraint): the date is formatted through
    // useFormatter against the same VN_TIME_ZONE the rest of the app pins
    // (journal-view.tsx), not the environment's zone — 10:00 UTC on the 27th
    // stays the 27th in Asia/Ho_Chi_Minh (UTC+7), so a day-boundary bug
    // would show up here as "August 26" or "August 28" instead.
    expect(status).toHaveTextContent(/August 27, 2026/);
  });

  it("cancels through the API and tells the parent", async () => {
    const onCancelled = vi.fn();
    vi.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ data: { cancelled: true } }), { status: 200 }));
    render(<DeletionPendingBanner pending={PENDING} onCancelled={onCancelled} />);
    await userEvent.click(screen.getByRole("button", { name: "Cancel deletion" }));
    expect(global.fetch).toHaveBeenCalledWith("/api/user/deletion", expect.objectContaining({ method: "DELETE" }));
    expect(onCancelled).toHaveBeenCalledTimes(1);
  });

  it("does not tell the parent it was cancelled when the API refuses", async () => {
    const onCancelled = vi.fn();
    vi.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ error: "No pending deletion request" }), { status: 404 }));
    render(<DeletionPendingBanner pending={PENDING} onCancelled={onCancelled} />);
    await userEvent.click(screen.getByRole("button", { name: "Cancel deletion" }));
    expect(onCancelled).not.toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  it("never renders the server's own error text on a failed cancel", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "pg: duplicate key value violates ..." }), { status: 500 }),
    );
    render(<DeletionPendingBanner pending={PENDING} onCancelled={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Cancel deletion" }));
    const alert = await screen.findByRole("alert");
    expect(alert).not.toHaveTextContent("duplicate key");
  });

  it("shows the generic translated error when the fetch itself rejects, never a raw error", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
    const onCancelled = vi.fn();
    render(<DeletionPendingBanner pending={PENDING} onCancelled={onCancelled} />);
    await userEvent.click(screen.getByRole("button", { name: "Cancel deletion" }));
    const alert = await screen.findByRole("alert");
    expect(alert).not.toHaveTextContent("Failed to fetch");
    expect(alert).not.toHaveTextContent("TypeError");
    expect(onCancelled).not.toHaveBeenCalled();
  });
});
