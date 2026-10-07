import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkUsername } from "@/lib/data/profile-write";

vi.mock("@/lib/data/profile-write", () => ({ checkUsername: vi.fn() }));

import { GET } from "./route";

const get = (query: string) => GET(new Request(`http://x/api/profile/username${query}`));

beforeEach(() => vi.resetAllMocks());

describe("GET /api/profile/username", () => {
  it("passes the raw value through and returns the availability", async () => {
    vi.mocked(checkUsername).mockResolvedValue({ ok: true, data: { available: true } });
    const res = await get("?value=Keishaa");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { available: true } });
    expect(checkUsername).toHaveBeenCalledWith("Keishaa");
  });

  it("returns the reason when unavailable, and nothing else", async () => {
    vi.mocked(checkUsername).mockResolvedValue({ ok: true, data: { available: false, reason: "taken" } });
    expect(await (await get("?value=keishaa")).json()).toEqual({ data: { available: false, reason: "taken" } });
  });

  it("a missing value is checked as an empty string (format), not an error", async () => {
    vi.mocked(checkUsername).mockResolvedValue({ ok: true, data: { available: false, reason: "format" } });
    await get("");
    expect(checkUsername).toHaveBeenCalledWith("");
  });

  it("401 when signed out", async () => {
    vi.mocked(checkUsername).mockResolvedValue({ ok: false, status: 401 });
    expect((await get("?value=abc")).status).toBe(401);
  });

  it("429 with Retry-After", async () => {
    vi.mocked(checkUsername).mockResolvedValue({ ok: false, status: 429, retryAfter: 1200 });
    const res = await get("?value=abc");
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("2");
  });

  it("500 opaque when the lookup throws", async () => {
    vi.mocked(checkUsername).mockRejectedValue(new Error("db down"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const res = await get("?value=abc");
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("db down");
    spy.mockRestore();
  });
});
