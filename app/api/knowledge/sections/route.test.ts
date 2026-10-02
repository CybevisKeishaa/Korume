import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { requestKnowledgeSection } from "@/lib/data/knowledge";

vi.mock("@/lib/data/knowledge", () => ({ requestKnowledgeSection: vi.fn() }));

const LINE_ID = "a0000000-0000-0000-0000-000000000001";
const VALID = { transcriptLineId: LINE_ID, section: "lite", locale: "vi" };
const post = (body: unknown) => POST(new Request("http://localhost/api/knowledge/sections", {
  method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" },
}));

beforeEach(() => vi.clearAllMocks());

describe("POST /api/knowledge/sections", () => {
  it("rejects malformed JSON and any field the client must not send", async () => {
    const malformed = await POST(new Request("http://localhost/x", { method: "POST", body: "{" }));
    await expect(malformed.json()).resolves.toEqual({ error: "Invalid JSON" });
    for (const extra of [{ tier: "plus" }, { variant: "full" }, { credits: 1 }, { text: "今日は" }, { price: 0 }]) {
      expect((await post({ ...VALID, ...extra })).status, JSON.stringify(extra)).toBe(400);
    }
    for (const bad of [
      { ...VALID, transcriptLineId: "x" },
      { ...VALID, locale: "ja" },
      { ...VALID, section: "Lite!" },
      { ...VALID, span: { start: 3, end: 3 } },
      { ...VALID, span: { start: -1, end: 2 } },
      { ...VALID, span: { start: 0, end: 2, extra: 1 } },
    ]) expect((await post(bad)).status, JSON.stringify(bad)).toBe(400);
    expect(requestKnowledgeSection).not.toHaveBeenCalled();
  });

  it.each([
    [{ kind: "unauthorized" }, 401, { error: "Unauthorized" }],
    [{ kind: "invalid" }, 400, { error: "Invalid input" }],
    [{ kind: "not_found" }, 404, { error: "Not found" }],
  ] as const)("maps refusal %j", async (result, status, body) => {
    vi.mocked(requestKnowledgeSection).mockResolvedValue(result);
    const response = await post(VALID);
    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual(body);
  });

  it("returns ready content labelled as AI-generated", async () => {
    vi.mocked(requestKnowledgeSection).mockResolvedValue({
      kind: "outcome", section: "lite", outcome: { status: "ready", access: "full", content: { summary: "雨" }, model: "m" },
    });
    const response = await post(VALID);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: { status: "ready", section: "lite", access: "full", content: { summary: "雨" }, model: "m", source: "ai_generated" },
    });
    expect(requestKnowledgeSection).toHaveBeenCalledWith(VALID);
  });

  it("answers pending with 202, retryAfterMs and a Retry-After header", async () => {
    vi.mocked(requestKnowledgeSection).mockResolvedValue({ kind: "outcome", section: "lite", outcome: { status: "pending", retryAfterMs: 1500 } });
    const response = await post(VALID);
    expect(response.status).toBe(202);
    expect(response.headers.get("Retry-After")).toBe("2");
    await expect(response.json()).resolves.toEqual({ data: { status: "pending", section: "lite", retryAfterMs: 1500 } });
  });

  it("answers an exhausted quota with 402 and its reset time, and an unavailable AI with 503", async () => {
    vi.mocked(requestKnowledgeSection).mockResolvedValueOnce({
      kind: "outcome", section: "lite", outcome: { status: "quota_exhausted", resetsAt: "2026-10-03T00:00:00.000Z" },
    });
    const quota = await post(VALID);
    expect(quota.status).toBe(402);
    await expect(quota.json()).resolves.toEqual({ error: "quota_exhausted", resetsAt: "2026-10-03T00:00:00.000Z" });

    vi.mocked(requestKnowledgeSection).mockResolvedValueOnce({ kind: "outcome", section: "lite", outcome: { status: "ai_unavailable", reason: "budget" } });
    const resting = await post(VALID);
    expect(resting.status).toBe(503);
    await expect(resting.json()).resolves.toEqual({ error: "ai_unavailable", reason: "budget" });
  });

  it("answers 429 with Retry-After and an opaque 500", async () => {
    vi.mocked(requestKnowledgeSection).mockResolvedValueOnce({ kind: "rate_limited", retryAfter: 4_200 });
    const limited = await post(VALID);
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBe("5");
    vi.mocked(requestKnowledgeSection).mockRejectedValueOnce(new Error("db"));
    const failed = await post(VALID);
    expect(failed.status).toBe(500);
    await expect(failed.json()).resolves.toEqual({ error: "Something went wrong. Please try again." });
  });
});
