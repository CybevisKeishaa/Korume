import { beforeEach, describe, expect, it, vi } from "vitest";

const getKanjiExamples = vi.hoisted(() => vi.fn());
const requireUser = vi.hoisted(() => vi.fn());
const rateLimit = vi.hoisted(() => vi.fn());
vi.mock("@/lib/data/kanji-lessons", () => ({ getKanjiExamples }));
vi.mock("@/lib/data/videos", () => ({ requireUser }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit }));

import { GET } from "./route";

const call = (literal: string, query = "") => GET(new Request(`http://test/api/kanji/examples/x${query}`), { params: { literal } });

beforeEach(() => {
  vi.clearAllMocks();
  requireUser.mockResolvedValue({ id: "u1" });
  rateLimit.mockReturnValue({ ok: true, retryAfter: 0 });
  getKanjiExamples.mockResolvedValue([]);
});

describe("GET /api/kanji/examples/[literal]", () => {
  it("returns a page for a URL-encoded kanji, offset defaulting to 0", async () => {
    getKanjiExamples.mockResolvedValue([{ lineId: "l1" }]);
    const response = await call(encodeURIComponent("緑"), "?offset=3");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: [{ lineId: "l1" }] });
    expect(getKanjiExamples).toHaveBeenCalledWith("緑", 3);
    await call("緑");
    expect(getKanjiExamples).toHaveBeenLastCalledWith("緑", 0);
  });

  it.each(["-1", "9999", "301", "1.5", "abc"])("offset %s is 400", async (offset) => {
    expect((await call("緑", `?offset=${offset}`)).status).toBe(400);
    expect(getKanjiExamples).not.toHaveBeenCalled();
  });

  it("accepts the upper bound 300", async () => {
    expect((await call("緑", "?offset=300")).status).toBe(200);
  });

  it("400 for a non-kanji, 401 signed out, 429 with Retry-After", async () => {
    expect((await call("abc")).status).toBe(400);
    requireUser.mockResolvedValueOnce(null);
    expect((await call("緑")).status).toBe(401);
    rateLimit.mockReturnValueOnce({ ok: false, retryAfter: 2_500 });
    const limited = await call("緑");
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBe("3");
  });

  it("returns an opaque 500 on an unexpected failure", async () => {
    getKanjiExamples.mockRejectedValueOnce(new Error("db down"));
    expect((await call("緑")).status).toBe(500);
  });
});
