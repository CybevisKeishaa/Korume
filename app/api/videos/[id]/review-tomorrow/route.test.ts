import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ scheduleReviewTomorrow: vi.fn() }));
vi.mock("@/lib/summary/review-tomorrow", () => ({ scheduleReviewTomorrow: mocks.scheduleReviewTomorrow }));

import { POST } from "./route";

const VIDEO_ID = "a0000000-0000-0000-0000-000000000001";
const context = { params: { id: VIDEO_ID } };
const post = (body: unknown) => POST(new Request(`http://localhost/api/videos/${VIDEO_ID}/review-tomorrow`, {
  method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" },
}), context);

beforeEach(() => vi.clearAllMocks());

describe("POST /api/videos/[id]/review-tomorrow", () => {
  it("rejects malformed input, invalid ids, and client-supplied review targets", async () => {
    const malformed = await POST(new Request("http://localhost/x", { method: "POST", body: "{" }), context);
    expect(malformed.status).toBe(400);
    await expect(malformed.json()).resolves.toEqual({ error: "Invalid JSON" });
    expect((await POST(new Request("http://localhost/x", { method: "POST", body: "{}" }), { params: { id: "invalid" } })).status).toBe(400);
    for (const body of [{ timeZone: "" }, { targets: [{ lineId: "extra" }] }]) {
      expect((await post(body)).status, JSON.stringify(body)).toBe(400);
    }
    expect(mocks.scheduleReviewTomorrow).not.toHaveBeenCalled();
  });

  it.each([
    [{ kind: "unauthorized" }, 401, { error: "Unauthorized" }],
    [{ kind: "not_found" }, 404, { error: "Not found" }],
  ] as const)("maps %j", async (result, status, body) => {
    mocks.scheduleReviewTomorrow.mockResolvedValue(result);
    const response = await post({});
    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual(body);
  });

  it("returns Retry-After in rounded-up seconds", async () => {
    mocks.scheduleReviewTomorrow.mockResolvedValue({ kind: "rate_limited", retryAfter: 4_200 });
    const response = await post({});
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("5");
    await expect(response.json()).resolves.toEqual({ error: "Too many requests, slow down" });
  });

  it("returns the service's server-computed schedule", async () => {
    mocks.scheduleReviewTomorrow.mockResolvedValue({ kind: "ok", scheduled: 2, dueAt: "2026-10-04T17:00:00.000Z" });
    const response = await post({});
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: { scheduled: 2, dueAt: "2026-10-04T17:00:00.000Z" } });
    expect(mocks.scheduleReviewTomorrow).toHaveBeenCalledWith(VIDEO_ID);
  });

  it("returns an opaque 500 when the service throws", async () => {
    mocks.scheduleReviewTomorrow.mockRejectedValue(new Error("database"));
    const response = await post({});
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Something went wrong. Please try again." });
  });
});
