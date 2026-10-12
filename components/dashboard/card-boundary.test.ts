import { describe, expect, it, vi } from "vitest";
import { loadCard } from "./card-boundary";

describe("loadCard", () => {
  it("isolates a recoverable card failure and logs the named event", async () => {
    const error = new Error("unavailable");
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(loadCard("quick", async () => { throw error; })).resolves.toEqual({ kind: "error" });
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ event: "dashboard_card_failed", card: "quick", error }));
    log.mockRestore();
  });

  it("does not hide an authentication failure", async () => {
    const error = Object.assign(new Error("signed out"), { status: 401 });

    await expect(loadCard("quick", async () => { throw error; })).rejects.toBe(error);
  });

  it("keeps a recoverable context failure local so the header can use its fallback", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(loadCard("context", async () => { throw new Error("preferences unavailable"); }))
      .resolves.toEqual({ kind: "error" });
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ event: "dashboard_card_failed", card: "context" }));
    log.mockRestore();
  });
});
