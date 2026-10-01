import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, PUT } from "./route";
import { setSentenceMark } from "@/lib/data/sentence-marks";

vi.mock("@/lib/data/sentence-marks", () => ({ setSentenceMark: vi.fn() }));

const LINE_ID = "a0000000-0000-0000-0000-000000000001";
const request = (method: string, body?: unknown) => new Request("http://localhost/api/sentence-marks", {
  method, ...(body === undefined ? {} : { body: JSON.stringify(body), headers: { "content-type": "application/json" } }),
});

beforeEach(() => vi.clearAllMocks());

describe("/api/sentence-marks", () => {
  it("rejects malformed JSON and invalid bodies", async () => {
    const malformed = await PUT(new Request("http://localhost/api/sentence-marks", { method: "PUT", body: "{" }));
    expect(malformed.status).toBe(400);
    await expect(malformed.json()).resolves.toEqual({ error: "Invalid JSON" });

    const invalid = await PUT(request("PUT", { transcriptLineId: LINE_ID, kind: "bookmark", extra: true }));
    expect(invalid.status).toBe(400);
    await expect(invalid.json()).resolves.toEqual({ error: "Invalid input" });
    for (const body of [{ transcriptLineId: "not-a-uuid", kind: "bookmark" }, { transcriptLineId: LINE_ID, kind: "pin" }]) {
      const rejected = await PUT(request("PUT", body));
      expect(rejected.status).toBe(400);
    }
    expect(setSentenceMark).not.toHaveBeenCalled();
  });

  it("marks and unmarks idempotently", async () => {
    vi.mocked(setSentenceMark).mockResolvedValue({ ok: true });
    const marked = await PUT(request("PUT", { transcriptLineId: LINE_ID, kind: "bookmark" }));
    await expect(marked.json()).resolves.toEqual({ data: { marked: true } });
    expect(setSentenceMark).toHaveBeenLastCalledWith(LINE_ID, "bookmark", true);

    const unmarked = await DELETE(request("DELETE", { transcriptLineId: LINE_ID, kind: "bookmark" }));
    await expect(unmarked.json()).resolves.toEqual({ data: { marked: false } });
    expect(setSentenceMark).toHaveBeenLastCalledWith(LINE_ID, "bookmark", false);
  });

  it.each([
    [{ ok: false, status: 401 } as const, 401, { error: "Unauthorized" }],
    [{ ok: false, status: 404 } as const, 404, { error: "Not found" }],
  ])("returns refusal %# without leaking a line id", async (result, status, body) => {
    vi.mocked(setSentenceMark).mockResolvedValue(result);
    const response = await PUT(request("PUT", { transcriptLineId: LINE_ID, kind: "bookmark" }));
    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual(body);
  });

  it("returns retry seconds and an opaque 500", async () => {
    vi.mocked(setSentenceMark).mockResolvedValueOnce({ ok: false, status: 429, retryAfter: 4_200 });
    const limited = await PUT(request("PUT", { transcriptLineId: LINE_ID, kind: "bookmark" }));
    expect(limited.headers.get("Retry-After")).toBe("5");

    vi.mocked(setSentenceMark).mockRejectedValueOnce(new Error("database"));
    const failed = await PUT(request("PUT", { transcriptLineId: LINE_ID, kind: "bookmark" }));
    expect(failed.status).toBe(500);
    await expect(failed.json()).resolves.toEqual({ error: "Something went wrong. Please try again." });
  });
});
