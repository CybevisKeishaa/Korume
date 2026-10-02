import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { getLineAnalysisForLearner } from "@/lib/analysis/line-analysis";

vi.mock("@/lib/analysis/line-analysis", () => ({ getLineAnalysisForLearner: vi.fn() }));

const LINE_ID = "a0000000-0000-0000-0000-000000000001";
const get = (lineId = LINE_ID) => GET(new Request(`http://localhost/api/lines/${lineId}/analysis`), { params: { lineId } });

beforeEach(() => vi.clearAllMocks());

describe("GET /api/lines/[lineId]/analysis", () => {
  it("forwards lexical scope and defaults omitted scope to full", async () => {
    const analysis = { lineId: LINE_ID, snapshotId: "s", tokens: [], grammar: [], mastery: {} };
    vi.mocked(getLineAnalysisForLearner).mockResolvedValue({ kind: "ok", analysis });
    await GET(new Request(`http://localhost/api/lines/${LINE_ID}/analysis?scope=lexical`), { params: { lineId: LINE_ID } });
    expect(getLineAnalysisForLearner).toHaveBeenLastCalledWith(LINE_ID, "lexical");
    await get();
    expect(getLineAnalysisForLearner).toHaveBeenLastCalledWith(LINE_ID, "full");
  });

  it("rejects an unknown scope without reading", async () => {
    const response = await GET(new Request(`http://localhost/api/lines/${LINE_ID}/analysis?scope=other`), { params: { lineId: LINE_ID } });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid input" });
    expect(getLineAnalysisForLearner).not.toHaveBeenCalled();
  });

  it("rejects a malformed id without reading", async () => {
    expect((await get("nope")).status).toBe(400);
    expect(getLineAnalysisForLearner).not.toHaveBeenCalled();
  });

  it("returns the analysis privately and uncached", async () => {
    const analysis = { lineId: LINE_ID, snapshotId: "s", tokens: [], grammar: [], mastery: {} };
    vi.mocked(getLineAnalysisForLearner).mockResolvedValue({ kind: "ok", analysis });
    const response = await get();
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    await expect(response.json()).resolves.toEqual({ data: analysis });
  });

  it("maps refusals to 401, a generic 404 and 429", async () => {
    vi.mocked(getLineAnalysisForLearner).mockResolvedValueOnce({ kind: "unauthorized" });
    expect((await get()).status).toBe(401);
    vi.mocked(getLineAnalysisForLearner).mockResolvedValueOnce({ kind: "not_found" });
    await expect((await get()).json()).resolves.toEqual({ error: "Not found" });
    vi.mocked(getLineAnalysisForLearner).mockResolvedValueOnce({ kind: "rate_limited", retryAfter: 1_500 });
    expect((await get()).headers.get("Retry-After")).toBe("2");
  });
});
