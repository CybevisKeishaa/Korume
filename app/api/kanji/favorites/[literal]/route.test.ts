import { beforeEach, describe, expect, it, vi } from "vitest";

const setKanjiFavorite = vi.hoisted(() => vi.fn());
vi.mock("@/lib/data/kanji-learner", () => ({ setKanjiFavorite }));

import { DELETE, PUT } from "./route";

const request = (method: string) => new Request("http://test/api/kanji/favorites/x", { method });

beforeEach(() => vi.clearAllMocks());

describe("/api/kanji/favorites/[literal]", () => {
  it("PUT favorites and DELETE unfavorites, passing a URL-encoded non-BMP literal through", async () => {
    setKanjiFavorite.mockResolvedValue({ ok: true });
    const put = await PUT(request("PUT"), { params: { literal: encodeURIComponent("𠮟") } });
    await expect(put.json()).resolves.toEqual({ data: { favorite: true } });
    expect(setKanjiFavorite).toHaveBeenLastCalledWith("%F0%A0%AE%9F", true);
    const del = await DELETE(request("DELETE"), { params: { literal: "緑" } });
    await expect(del.json()).resolves.toEqual({ data: { favorite: false } });
    expect(setKanjiFavorite).toHaveBeenLastCalledWith("緑", false);
  });

  it.each([[400, "Invalid kanji"], [401, "Unauthorized"], [404, "Not found"]])("maps status %i", async (status, error) => {
    setKanjiFavorite.mockResolvedValue({ ok: false, status });
    const response = await PUT(request("PUT"), { params: { literal: "abc" } });
    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual({ error });
  });

  it("429 carries Retry-After in whole seconds", async () => {
    setKanjiFavorite.mockResolvedValue({ ok: false, status: 429, retryAfter: 4_200 });
    const response = await PUT(request("PUT"), { params: { literal: "緑" } });
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("5");
  });

  it("returns an opaque 500 on an unexpected failure", async () => {
    setKanjiFavorite.mockRejectedValueOnce(new Error("db down"));
    const response = await PUT(request("PUT"), { params: { literal: "緑" } });
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Something went wrong. Please try again." });
  });
});
