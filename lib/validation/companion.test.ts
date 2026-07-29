import { describe, expect, it } from "vitest";
import { pinMemorySchema } from "./companion";

describe("pinMemorySchema", () => {
  it("accepts a valid pin — transcriptLineId + note only", () => {
    const r = pinMemorySchema.safeParse({
      transcriptLineId: "11111111-1111-1111-1111-111111111111",
      note: "This gave me chills",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data).toEqual({
        transcriptLineId: "11111111-1111-1111-1111-111111111111",
        note: "This gave me chills",
      });
    }
  });

  it("rejects videoId/lineTextJp/timestampSeconds — pinMemory derives these server-side, a client asserting them is a 400 not a silent no-op (review finding #1)", () => {
    const r = pinMemorySchema.safeParse({
      transcriptLineId: "11111111-1111-1111-1111-111111111111",
      videoId: "22222222-2222-2222-2222-222222222222",
      lineTextJp: "逃げろ",
      timestampSeconds: 12.5,
    });
    expect(r.success).toBe(false);
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
