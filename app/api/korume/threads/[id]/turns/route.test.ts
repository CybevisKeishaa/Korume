import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { postTurn } from "@/lib/data/korume";

vi.mock("@/lib/data/korume", () => ({ postTurn: vi.fn() }));

const THREAD = "b0000000-0000-4000-8000-000000000001";
const TURN = "e0000000-0000-4000-8000-000000000001";
const BODY = { turnId: TURN, text: "Why は?", locale: "en" };
const post = (body: unknown, id = THREAD) => POST(new Request(`http://localhost/api/korume/threads/${id}/turns`, {
  method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" },
}), { params: { id } });
const message = { id: "m", turnId: TURN, role: "assistant", text: "t", answer: null, grounding: null, createdAt: "x" };

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.useRealTimers());

describe("POST /api/korume/threads/[id]/turns", () => {
  it("refuses a malformed id, malformed JSON and anything the client must not send", async () => {
    expect((await post(BODY, "nope")).status).toBe(404);
    expect((await POST(new Request("http://localhost/x", { method: "POST", body: "{" }), { params: { id: THREAD } })).status).toBe(400);
    for (const bad of [
      { ...BODY, role: "assistant" }, { ...BODY, tier: "plus" }, { ...BODY, credits: 1 }, { ...BODY, locale: "ja" },
      { turnId: "x", text: "a", locale: "en" }, { turnId: TURN, text: "  ", locale: "en" },
    ]) expect((await post(bad)).status, JSON.stringify(bad)).toBe(400);
    expect(postTurn).not.toHaveBeenCalled();
  });

  it.each([
    [{ status: "answered", message }, 200, { message }],
    [{ status: "pending" }, 202, { pending: true }],
    [{ status: "not_found" }, 404, { error: "not_found" }],
    [{ status: "conflict" }, 409, { error: "turn_conflict" }],
    [{ status: "quota_exhausted", reason: "free_daily_limit", limit: 10, resetsAt: "2026-10-04T00:00:00.000Z" }, 402,
      { error: "quota_exhausted", reason: "free_daily_limit", limit: 10, resetsAt: "2026-10-04T00:00:00.000Z" }],
    [{ status: "quota_exhausted", reason: "plus_credits_exhausted", resetsAt: "2026-11-01T00:00:00.000Z" }, 402,
      { error: "quota_exhausted", reason: "plus_credits_exhausted", resetsAt: "2026-11-01T00:00:00.000Z" }],
    [{ status: "answer_failed" }, 502, { error: "answer_failed", retryable: true }],
    [{ status: "ai_unavailable", reason: "budget" }, 503, { error: "ai_unavailable", reason: "budget" }],
    [{ kind: "unauthorized" }, 401, { error: "unauthorized" }],
    [{ kind: "disabled" }, 403, { error: "companion_disabled" }],
    [{ kind: "unavailable" }, 503, { error: "ai_unavailable", reason: "preferences_unavailable" }],
    [{ kind: "rate_limited", retryAfter: 1000 }, 429, { error: "rate_limited" }],
  ] as const)("maps %j", async (result, status, body) => {
    vi.mocked(postTurn).mockResolvedValue(result as never);
    const response = await post(BODY);
    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual(body);
  });

  it("answers the Plus fuse with 429 and a Retry-After until its reset", async () => {
    vi.useFakeTimers({ now: new Date("2026-10-03T23:59:00.000Z") });
    vi.mocked(postTurn).mockResolvedValue({ status: "fuse_tripped", resetsAt: "2026-10-04T00:00:00.000Z" });
    const response = await post(BODY);
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
    await expect(response.json()).resolves.toEqual({ error: "fuse_tripped", resetsAt: "2026-10-04T00:00:00.000Z" });
  });

  it("hides a server failure behind an opaque 500", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(postTurn).mockRejectedValue(new Error("relation ai_reservations detail"));
    const response = await post(BODY);
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("ai_reservations");
  });
});
