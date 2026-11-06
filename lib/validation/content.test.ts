import { describe, expect, it } from "vitest";
import { srsReviewSchema } from "./content";

const UUID = "5b0c2a4e-8f1d-4c3b-9a7e-2d6f1e0b9c8a";

describe("srsReviewSchema (itemId validated by itemType)", () => {
  it.each([
    { itemType: "kanji", itemId: "日" },
    { itemType: "kanji", itemId: "𠮟" },
    { itemType: "vocab", itemId: UUID },
  ])("accepts %j", (body) => {
    expect(srsReviewSchema.safeParse({ ...body, quality: 4 }).success).toBe(true);
  });

  it.each([
    { itemType: "kanji", itemId: "abc" },
    { itemType: "kanji", itemId: "日本" },
    { itemType: "kanji", itemId: "" },
    { itemType: "kanji", itemId: UUID },
    { itemType: "vocab", itemId: "日" },
  ])("rejects %j", (body) => {
    expect(srsReviewSchema.safeParse({ ...body, quality: 4 }).success).toBe(false);
  });

  it("keeps the quality rule on both branches", () => {
    expect(srsReviewSchema.safeParse({ itemType: "kanji", itemId: "日", quality: 6 }).success).toBe(false);
    expect(srsReviewSchema.safeParse({ itemType: "vocab", itemId: UUID, quality: 1.5 }).success).toBe(false);
  });
});
