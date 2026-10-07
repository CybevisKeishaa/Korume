import { beforeEach, describe, expect, it, vi } from "vitest";
import { heartbeat } from "@/lib/data/study-time";
import { POST } from "./route";

vi.mock("@/lib/data/study-time", () => ({ heartbeat: vi.fn() }));

const BODY = {
  clientPresenceId: "11111111-1111-4111-8111-111111111111",
  sessionId: null,
  surface: "shadowing",
  contextId: "123e4567-e89b-12d3-a456-426614174000",
  seq: 0,
  kind: "start",
};

function post(body: unknown, raw?: string) {
  return POST(new Request("http://x/api/study/heartbeat", { method: "POST", body: raw ?? JSON.stringify(body) }));
}

beforeEach(() => vi.resetAllMocks());

describe("POST /api/study/heartbeat", () => {
  it.each([
    ["unknown surface", { ...BODY, surface: "karaoke" }],
    ["invalid context for the surface", { ...BODY, contextId: "abc" }],
    ["null context where an id is required", { ...BODY, contextId: null }],
    ["negative seq", { ...BODY, seq: -1 }],
    ["fractional seq", { ...BODY, seq: 1.5 }],
    ["extra userId", { ...BODY, userId: "u1" }],
    ["client duration", { ...BODY, durationSeconds: 60 }],
    ["non-uuid presence", { ...BODY, clientPresenceId: "x" }],
    ["bad kind", { ...BODY, kind: "pause" }],
  ])("400 on %s", async (_n, body) => {
    expect((await post(body)).status).toBe(400);
    expect(heartbeat).not.toHaveBeenCalled();
  });

  it("400 on invalid JSON", async () => {
    expect((await post(null, "{nope")).status).toBe(400);
  });

  it("200 with data on ok, passing the parsed input through", async () => {
    vi.mocked(heartbeat).mockResolvedValue({ kind: "ok", sessionId: "s1", acceptedSeq: 0, segmented: false });
    const res = await post(BODY);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { sessionId: "s1", acceptedSeq: 0, segmented: false } });
    expect(heartbeat).toHaveBeenCalledWith(BODY);
  });

  it("accepts null context for korume_chat", async () => {
    vi.mocked(heartbeat).mockResolvedValue({ kind: "ok", sessionId: "s1", acceptedSeq: 0, segmented: false });
    expect((await post({ ...BODY, surface: "korume_chat", contextId: null })).status).toBe(200);
  });

  it("maps 401, 404 and 429 with Retry-After", async () => {
    vi.mocked(heartbeat).mockResolvedValueOnce({ kind: "unauthorized" });
    expect((await post(BODY)).status).toBe(401);
    vi.mocked(heartbeat).mockResolvedValueOnce({ kind: "not_found" });
    expect((await post(BODY)).status).toBe(404);
    vi.mocked(heartbeat).mockResolvedValueOnce({ kind: "rate_limited", retryAfter: 4200 });
    const res = await post(BODY);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("5");
  });

  it("500 opaque on a thrown error", async () => {
    vi.mocked(heartbeat).mockRejectedValue(new Error("secret db detail"));
    const res = await post(BODY);
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("secret");
  });
});
