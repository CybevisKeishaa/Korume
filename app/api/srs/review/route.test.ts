import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { submitReview } from "@/lib/data/srs";

vi.mock("@/lib/data/srs", () => ({ submitReview: vi.fn() }));

const UUID = "5b0c2a4e-8f1d-4c3b-9a7e-2d6f1e0b9c8a";
const post = (body: unknown) =>
  POST(new Request("http://localhost/api/srs/review", { method: "POST", body: JSON.stringify(body) }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(submitReview).mockResolvedValue({
    ok: true,
    data: { repetitions: 1, intervalDays: 1, easeFactor: 2.5, nextReviewAt: "2026-11-07T00:00:00.000Z" },
  });
});

describe("POST /api/srs/review", () => {
  it.each([
    { itemType: "kanji", itemId: "abc" },
    { itemType: "kanji", itemId: "日本" },
    { itemType: "kanji", itemId: "" },
    { itemType: "kanji", itemId: UUID },
    { itemType: "vocab", itemId: "日" },
  ])("400 before any query for %j", async (body) => {
    const response = await post({ ...body, quality: 4 });
    expect(response.status).toBe(400);
    expect(submitReview).not.toHaveBeenCalled();
  });

  it("passes a kanji literal through", async () => {
    const response = await post({ itemType: "kanji", itemId: "𠮟", quality: 4 });
    expect(response.status).toBe(200);
    expect(submitReview).toHaveBeenCalledWith({ itemType: "kanji", itemId: "𠮟", quality: 4 });
  });
});
