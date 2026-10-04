import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { createMiningCard } from "@/lib/data/mining";

vi.mock("@/lib/data/mining", () => ({ createMiningCard: vi.fn(), listMiningCards: vi.fn() }));

const LINE_ID = "10000000-0000-4000-8000-000000000001";
const CARD = { id: "20000000-0000-4000-8000-000000000001" };
function post(body: unknown) {
  return POST(new Request("http://localhost/api/mining", { method: "POST", body: JSON.stringify(body) }));
}

beforeEach(() => vi.clearAllMocks());

describe("POST /api/mining", () => {
  it("returns 201 for a new legacy selection", async () => {
    vi.mocked(createMiningCard).mockResolvedValue({ ok: true, data: CARD as never, created: true });
    const response = await post({ lineId: LINE_ID, targetWord: "雨" });
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ data: CARD });
  });

  it("returns 200 when a Summary vocabulary save already exists", async () => {
    vi.mocked(createMiningCard).mockResolvedValue({ ok: true, data: CARD as never, created: false });
    const response = await post({ lineId: LINE_ID, targetWord: "雨", sourceKind: "vocabulary" });
    expect(response.status).toBe(200);
  });

  it.each([
    { lineId: LINE_ID, targetWord: "雨", sourceKind: "sentence" },
    { lineId: LINE_ID, targetWord: "雨", sourceRef: "雨" },
  ])("rejects an untrusted provenance field", async (body) => {
    const response = await post(body);
    expect(response.status).toBe(400);
    expect(createMiningCard).not.toHaveBeenCalled();
  });
});
