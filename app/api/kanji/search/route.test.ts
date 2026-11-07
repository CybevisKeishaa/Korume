import { beforeEach, describe, expect, it, vi } from "vitest";

const searchKanjiInSnapshot = vi.hoisted(() => vi.fn());
const requireUser = vi.hoisted(() => vi.fn());
const rateLimit = vi.hoisted(() => vi.fn());
vi.mock("@/lib/dictionary/kanji-data-service", () => ({ searchKanjiInSnapshot }));
vi.mock("@/lib/data/videos", () => ({ requireUser }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit }));

import { GET } from "./route";

const call = (q: string | null) =>
  GET(new Request(`http://test/api/kanji/search${q === null ? "" : `?q=${encodeURIComponent(q)}`}`));

beforeEach(() => {
  vi.clearAllMocks();
  requireUser.mockResolvedValue({ id: "u1" });
  rateLimit.mockReturnValue({ ok: true, retryAfter: 0 });
  searchKanjiInSnapshot.mockResolvedValue({ query: "日本語", mode: "chars", results: [] });
});

describe("GET /api/kanji/search", () => {
  it("passes the trimmed query and returns the search as is", async () => {
    const body = { query: "日本語", mode: "chars", results: [{ literal: "日", hanViet: ["Nhật"], meaningVi: "vi-1", meaningEn: "day" }] };
    searchKanjiInSnapshot.mockResolvedValue(body);
    const response = await call("  日本語 ");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(body);
    expect(searchKanjiInSnapshot).toHaveBeenCalledWith("日本語");
    expect(rateLimit).toHaveBeenCalledWith("kanji-search:u1", { limit: 60, windowMs: 60_000 });
  });

  it.each([null, "", "   ", "x".repeat(41)])("q=%j is 400 and searches nothing", async (q) => {
    const response = await call(q);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid request" });
    expect(searchKanjiInSnapshot).not.toHaveBeenCalled();
  });

  it("accepts 40 characters (after the trim)", async () => {
    expect((await call(` ${"x".repeat(40)} `)).status).toBe(200);
  });

  it("401 signed out, 429 with Retry-After, neither searches", async () => {
    requireUser.mockResolvedValueOnce(null);
    expect((await call("日")).status).toBe(401);
    rateLimit.mockReturnValueOnce({ ok: false, retryAfter: 2_500 });
    const limited = await call("日");
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBe("3");
    expect(searchKanjiInSnapshot).not.toHaveBeenCalled();
  });

  it("returns an opaque 500 on an unexpected failure", async () => {
    searchKanjiInSnapshot.mockRejectedValueOnce(new Error("db down: secret detail"));
    const response = await call("日");
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Something went wrong. Please try again." });
  });
});
