// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { scoreSession, type ScoreSessionResult } from "@/lib/data/pronunciation";
import { POST } from "./route";
vi.mock("@/lib/data/pronunciation", () => ({ scoreSession: vi.fn() }));
const sessionId = "550e8400-e29b-41d4-a716-446655440000";
const data = { sessionId, lineId: sessionId, pronunciationScore: 88, rhythmScore: 76, assessment: { v: 1 as const, accuracy: 91, completeness: 100, recognizedText: "今日は", words: [] } };
function request(body: unknown = { sessionId }) { return new Request("http://localhost/api/pronunciation/score", { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }); }
function privateResponse(response: Response, status: number) { expect(response.status).toBe(status); expect(response.headers.get("Cache-Control")).toBe("private, no-store"); }
beforeEach(() => { vi.resetAllMocks(); vi.mocked(scoreSession).mockResolvedValue({ ok: true, data }); });
describe("POST scoring a saved session", () => {
  it("returns the scores and forwards only the saved session id", async () => {
    const response = await POST(request()); privateResponse(response, 200);
    expect(await response.json()).toEqual({ data }); expect(scoreSession).toHaveBeenCalledTimes(1); expect(scoreSession).toHaveBeenCalledWith(sessionId);
  });
  it.each([{ sessionId: "x" }, { sessionId, referenceText: "untrusted" }, { sessionId, audio: "untrusted" }, {}])("rejects invalid/extra JSON %j", async (body) => {
    privateResponse(await POST(request(body)), 400); expect(scoreSession).not.toHaveBeenCalled();
  });
  it("returns private 400 for invalid JSON", async () => { privateResponse(await POST(new Request("http://localhost", { method: "POST", body: "{" })), 400); expect(scoreSession).not.toHaveBeenCalled(); });
  it.each(["not_claimable", "legacy_format", "superseded"] as const)("preserves conflict reason %s", async (reason) => {
    vi.mocked(scoreSession).mockResolvedValue({ ok: false, status: 409, reason });
    const response = await POST(request()); privateResponse(response, 409); expect(await response.json()).toMatchObject({ error: expect.any(String), reason });
  });
  it.each([401, 422, 502, 503] as const)("returns private %s", async (status) => {
    vi.mocked(scoreSession).mockResolvedValue({ ok: false, status }); privateResponse(await POST(request()), status);
  });
  it.each([[12_000, "12"], [1500, "2"], [0, "0"], [null, null]] as const)("only sends supplied retry timing %s", async (retryAfter, header) => {
    const result: ScoreSessionResult = { ok: false, status: 429, retryAfter }; vi.mocked(scoreSession).mockResolvedValue(result);
    const response = await POST(request()); privateResponse(response, 429); expect(response.headers.get("Retry-After")).toBe(header);
  });
  it("returns a private generic 500 for unexpected failures", async () => {
    vi.mocked(scoreSession).mockRejectedValue(new Error("private detail"));
    const response = await POST(request()); privateResponse(response, 500); expect(JSON.stringify(await response.json())).not.toContain("private detail");
  });
});
