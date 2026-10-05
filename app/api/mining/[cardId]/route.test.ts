import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE } from "./route";
import { deleteMiningCard } from "@/lib/data/mining";

vi.mock("@/lib/data/mining", () => ({ deleteMiningCard: vi.fn() }));

const CARD_ID = "20000000-0000-4000-8000-000000000001";
function remove(cardId: string) {
  return DELETE(new Request(`http://localhost/api/mining/${cardId}`, { method: "DELETE" }), { params: { cardId } });
}

beforeEach(() => vi.clearAllMocks());

describe("DELETE /api/mining/[cardId]", () => {
  it("rejects an invalid id before accessing data", async () => {
    expect((await remove("not-a-uuid")).status).toBe(400);
    expect(deleteMiningCard).not.toHaveBeenCalled();
  });

  it("returns 204 after removing the caller's card", async () => {
    vi.mocked(deleteMiningCard).mockResolvedValue({ ok: true });
    expect((await remove(CARD_ID)).status).toBe(204);
    expect(deleteMiningCard).toHaveBeenCalledWith(CARD_ID);
  });

  it("maps a rate-limited delete to 429 with Retry-After in seconds", async () => {
    vi.mocked(deleteMiningCard).mockResolvedValue({ ok: false, status: 429, retryAfter: 4_200 });
    const response = await remove(CARD_ID);
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("5");
  });

  it.each([401, 404] as const)("maps a %i data-layer refusal", async (status) => {
    vi.mocked(deleteMiningCard).mockResolvedValue({ ok: false, status });
    expect((await remove(CARD_ID)).status).toBe(status);
  });
});
