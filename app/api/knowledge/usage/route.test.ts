import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { getKnowledgeUsage } from "@/lib/data/knowledge";

vi.mock("@/lib/data/knowledge", () => ({ getKnowledgeUsage: vi.fn() }));

beforeEach(() => vi.clearAllMocks());

describe("GET /api/knowledge/usage", () => {
  it("returns the learner's usage uncached", async () => {
    vi.mocked(getKnowledgeUsage).mockResolvedValue({ kind: "ok", usage: { plan: "plus", remainingPercent: 75, resetsAt: "2026-11-01T00:00:00.000Z" } });
    const response = await GET();
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ data: { plan: "plus", remainingPercent: 75, resetsAt: "2026-11-01T00:00:00.000Z" } });
  });

  it("refuses anonymous and rate-limited callers", async () => {
    vi.mocked(getKnowledgeUsage).mockResolvedValueOnce({ kind: "unauthorized" });
    expect((await GET()).status).toBe(401);
    vi.mocked(getKnowledgeUsage).mockResolvedValueOnce({ kind: "rate_limited", retryAfter: 2_000 });
    const limited = await GET();
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBe("2");
  });
});
