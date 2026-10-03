import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";
import { createThread, listThreads } from "@/lib/data/korume";

vi.mock("@/lib/data/korume", () => ({ createThread: vi.fn(), listThreads: vi.fn() }));

const THREAD = "b0000000-0000-4000-8000-000000000001";
const VIDEO = "c0000000-0000-4000-8000-000000000001";
const LINE = "d0000000-0000-4000-8000-000000000001";
const view = { id: THREAD, title: null, anchor: null, originRoute: null, updatedAt: "2026-10-03T00:00:00.000Z" };
const post = (body: unknown) => POST(new Request("http://localhost/api/korume/threads", {
  method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" },
}));

beforeEach(() => vi.clearAllMocks());

describe("POST /api/korume/threads", () => {
  it("rejects malformed JSON, a client route and half anchors before the data layer", async () => {
    expect((await POST(new Request("http://localhost/x", { method: "POST", body: "{" }))).status).toBe(400);
    for (const bad of [
      { threadId: THREAD, originRoute: "/x" },
      { threadId: THREAD, span: { start: 0, end: 1 } },
      { threadId: THREAD, lineId: LINE },
      { threadId: "x" },
    ]) expect((await post(bad)).status, JSON.stringify(bad)).toBe(400);
    expect(createThread).not.toHaveBeenCalled();
  });

  it("answers 201 on create and 200 on an idempotent replay", async () => {
    vi.mocked(createThread).mockResolvedValueOnce({ kind: "ok", created: true, thread: view });
    const created = await post({ threadId: THREAD, videoId: VIDEO, lineId: LINE });
    expect(created.status).toBe(201);
    await expect(created.json()).resolves.toEqual({ thread: view });
    vi.mocked(createThread).mockResolvedValueOnce({ kind: "ok", created: false, thread: view });
    expect((await post({ threadId: THREAD })).status).toBe(200);
  });

  it.each([
    [{ kind: "unauthorized" }, 401, { error: "unauthorized" }],
    [{ kind: "disabled" }, 403, { error: "companion_disabled" }],
    [{ kind: "unavailable" }, 503, { error: "ai_unavailable", reason: "preferences_unavailable" }],
    [{ kind: "invalid" }, 400, { error: "invalid" }],
    [{ kind: "not_found" }, 404, { error: "not_found" }],
    [{ kind: "conflict" }, 409, { error: "thread_conflict" }],
    [{ kind: "rate_limited", retryAfter: 1500 }, 429, { error: "rate_limited" }],
  ] as const)("maps %j", async (result, status, body) => {
    vi.mocked(createThread).mockResolvedValue(result);
    const response = await post({ threadId: THREAD });
    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual(body);
    if (status === 429) expect(response.headers.get("Retry-After")).toBe("2");
  });

  it("hides a server failure behind an opaque 500", async () => {
    vi.mocked(createThread).mockRejectedValue(new Error("relation conversation_sessions secret detail"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await post({ threadId: THREAD });
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("secret");
  });
});

describe("GET /api/korume/threads", () => {
  it("passes the cursor through and returns the page", async () => {
    vi.mocked(listThreads).mockResolvedValue({ kind: "ok", threads: [view], nextCursor: "abc" });
    const response = await GET(new Request("http://localhost/api/korume/threads?cursor=xyz"));
    expect(listThreads).toHaveBeenCalledWith("xyz");
    await expect(response.json()).resolves.toEqual({ threads: [view], nextCursor: "abc" });
  });
});
