import { describe, expect, it } from "vitest";
import { pinMemorySchema } from "./companion";

describe("pinMemorySchema", () => {
  it("accepts a valid pin", () => {
    const r = pinMemorySchema.safeParse({
      transcriptLineId: "11111111-1111-1111-1111-111111111111",
      videoId: "22222222-2222-2222-2222-222222222222",
      lineTextJp: "逃げろ",
      timestampSeconds: 12.5,
      note: "This gave me chills",
    });
    expect(r.success).toBe(true);
  });
  it("requires transcriptLineId", () => {
    expect(pinMemorySchema.safeParse({ lineTextJp: "x" }).success).toBe(false);
  });
  it("rejects a note longer than 500 chars (anti-abuse)", () => {
    const r = pinMemorySchema.safeParse({
      transcriptLineId: "11111111-1111-1111-1111-111111111111",
      note: "x".repeat(501),
    });
    expect(r.success).toBe(false);
  });
});
