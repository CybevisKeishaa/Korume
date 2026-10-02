import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, PUT } from "./route";
import { deleteSentenceNote, setSentenceNote } from "@/lib/data/notes";

vi.mock("@/lib/data/notes", () => ({ setSentenceNote: vi.fn(), deleteSentenceNote: vi.fn() }));

const LINE_ID = "a0000000-0000-0000-0000-000000000001";
const request = (method: string, body?: unknown) => new Request("http://localhost/api/sentence-notes", {
  method, ...(body === undefined ? {} : { body: JSON.stringify(body), headers: { "content-type": "application/json" } }),
});

beforeEach(() => vi.clearAllMocks());

describe("/api/sentence-notes", () => {
  it("rejects malformed JSON and invalid bodies", async () => {
    const malformed = await PUT(new Request("http://localhost/api/sentence-notes", { method: "PUT", body: "{" }));
    expect(malformed.status).toBe(400);
    await expect(malformed.json()).resolves.toEqual({ error: "Invalid JSON" });
    for (const body of [
      { transcriptLineId: LINE_ID, body: "a", extra: true },
      { transcriptLineId: "not-a-uuid", body: "a" },
      { transcriptLineId: LINE_ID, body: "x".repeat(4001) },
      { transcriptLineId: LINE_ID },
    ]) {
      const rejected = await PUT(request("PUT", body));
      expect(rejected.status, JSON.stringify(body).slice(0, 60)).toBe(400);
    }
    expect((await DELETE(request("DELETE", { transcriptLineId: "nope" }))).status).toBe(400);
    expect(setSentenceNote).not.toHaveBeenCalled();
    expect(deleteSentenceNote).not.toHaveBeenCalled();
  });

  it("saves and deletes idempotently", async () => {
    vi.mocked(setSentenceNote).mockResolvedValue({ ok: true });
    vi.mocked(deleteSentenceNote).mockResolvedValue({ ok: true });
    const saved = await PUT(request("PUT", { transcriptLineId: LINE_ID, body: "memo" }));
    await expect(saved.json()).resolves.toEqual({ data: { saved: true } });
    expect(setSentenceNote).toHaveBeenLastCalledWith(LINE_ID, "memo");

    const deleted = await DELETE(request("DELETE", { transcriptLineId: LINE_ID }));
    await expect(deleted.json()).resolves.toEqual({ data: { saved: false } });
    expect(deleteSentenceNote).toHaveBeenLastCalledWith(LINE_ID);
  });

  it.each([
    [{ ok: false, status: 401 } as const, 401, { error: "Unauthorized" }],
    [{ ok: false, status: 404 } as const, 404, { error: "Not found" }],
  ])("returns refusal %# without leaking a line id", async (result, status, body) => {
    vi.mocked(setSentenceNote).mockResolvedValue(result);
    const response = await PUT(request("PUT", { transcriptLineId: LINE_ID, body: "memo" }));
    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual(body);
  });

  it("returns retry seconds and an opaque 500", async () => {
    vi.mocked(setSentenceNote).mockResolvedValueOnce({ ok: false, status: 429, retryAfter: 4_200 });
    const limited = await PUT(request("PUT", { transcriptLineId: LINE_ID, body: "memo" }));
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBe("5");

    vi.mocked(setSentenceNote).mockRejectedValueOnce(new Error("database"));
    const failed = await PUT(request("PUT", { transcriptLineId: LINE_ID, body: "memo" }));
    expect(failed.status).toBe(500);
    await expect(failed.json()).resolves.toEqual({ error: "Something went wrong. Please try again." });
  });
});
