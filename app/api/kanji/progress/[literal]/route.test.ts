import { beforeEach, describe, expect, it, vi } from "vitest";

const addKanjiToReview = vi.hoisted(() => vi.fn());
vi.mock("@/lib/data/kanji-learner", () => ({ addKanjiToReview }));

import { PUT } from "./route";

const call = (literal: string) => PUT(new Request("http://test/api/kanji/progress/x", { method: "PUT" }), { params: { literal } });

beforeEach(() => vi.clearAllMocks());

describe("PUT /api/kanji/progress/[literal]", () => {
  it("adds a URL-encoded non-BMP kanji to review", async () => {
    addKanjiToReview.mockResolvedValue({ ok: true });
    const response = await call(encodeURIComponent("𠮟"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: { inReview: true } });
    expect(addKanjiToReview).toHaveBeenCalledWith("%F0%A0%AE%9F");
  });

  it.each([[400, "Invalid kanji"], [401, "Unauthorized"], [404, "Not found"]])("maps status %i", async (status, error) => {
    addKanjiToReview.mockResolvedValue({ ok: false, status });
    const response = await call("abc");
    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual({ error });
  });

  it("429 carries Retry-After in whole seconds", async () => {
    addKanjiToReview.mockResolvedValue({ ok: false, status: 429, retryAfter: 2_500 });
    const response = await call("緑");
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("3");
  });

  it("returns an opaque 500 on an unexpected failure", async () => {
    addKanjiToReview.mockRejectedValueOnce(new Error("db down"));
    expect((await call("緑")).status).toBe(500);
  });
});
