import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";
import { getGloss, requestGloss } from "@/lib/dictionary/lookup";

vi.mock("@/lib/dictionary/lookup", () => ({ getGloss: vi.fn(), requestGloss: vi.fn() }));

const READY = { entSeq: 1141070, status: "ready" as const, glossesVi: ["mưa"], note: null, source: "ai" as const };
const get = (query: string) => GET(new Request(`http://localhost/api/dictionary/gloss${query}`));
const post = (body: unknown) => POST(new Request("http://localhost/api/dictionary/gloss", { method: "POST", body: JSON.stringify(body) }));

beforeEach(() => vi.clearAllMocks());

describe("/api/dictionary/gloss", () => {
  it("validates the entry id on both methods", async () => {
    for (const query of ["", "?entryId=abc", "?entryId=-1", "?entryId=1&x=2"]) expect((await get(query)).status, query).toBe(400);
    for (const body of [{}, { entryId: "1" }, { entryId: 1, userId: "u" }]) expect((await post(body)).status, JSON.stringify(body)).toBe(400);
    expect(getGloss).not.toHaveBeenCalled();
    expect(requestGloss).not.toHaveBeenCalled();
  });

  it("GET reads, POST requests; neither crosses over", async () => {
    vi.mocked(getGloss).mockResolvedValue({ kind: "ok", gloss: READY });
    await expect((await get("?entryId=1141070")).json()).resolves.toEqual({ data: READY });
    expect(getGloss).toHaveBeenCalledWith(1141070);
    expect(requestGloss).not.toHaveBeenCalled();

    vi.mocked(requestGloss).mockResolvedValue({ kind: "ok", gloss: { ...READY, status: "pending", glossesVi: [], source: null } });
    const pending = await post({ entryId: 1141070 });
    expect(pending.status).toBe(202);
    expect(requestGloss).toHaveBeenCalledWith(1141070);
  });

  it("maps refusals", async () => {
    vi.mocked(requestGloss).mockResolvedValueOnce({ kind: "unavailable" });
    expect((await post({ entryId: 1 })).status).toBe(503);
    vi.mocked(requestGloss).mockResolvedValueOnce({ kind: "rate_limited", retryAfter: 2_000 });
    expect((await post({ entryId: 1 })).headers.get("Retry-After")).toBe("2");
    vi.mocked(getGloss).mockResolvedValueOnce({ kind: "not_found" });
    expect((await get("?entryId=1")).status).toBe(404);
    vi.mocked(getGloss).mockResolvedValueOnce({ kind: "unauthorized" });
    expect((await get("?entryId=1")).status).toBe(401);
  });
});
