import { describe, expect, it, vi } from "vitest";

const getKanjiForLearner = vi.hoisted(() => vi.fn());
vi.mock("@/lib/dictionary/kanji-data-service", () => ({ getKanjiForLearner }));

import { GET } from "./route";

const call = (literal: string) => GET(new Request("http://test/api/dictionary/kanji/x"), { params: { literal } });

describe("GET /api/dictionary/kanji/[literal]", () => {
  it("returns the data envelope", async () => {
    getKanjiForLearner.mockResolvedValue({ ok: true, data: { literal: "緑" } });
    const response = await call("緑");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: { literal: "緑" } });
    expect(getKanjiForLearner).toHaveBeenCalledWith("緑");
  });

  it.each([400, 401, 404])("maps status %i", async (status) => {
    getKanjiForLearner.mockResolvedValue({ ok: false, status });
    expect((await call("緑")).status).toBe(status);
  });

  it("sends Retry-After in seconds on 429", async () => {
    getKanjiForLearner.mockResolvedValue({ ok: false, status: 429, retryAfter: 2_500 });
    const response = await call("緑");
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("3");
  });
});
