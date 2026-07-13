import { describe, expect, it } from "vitest";
import { MAX_AUDIO_BYTES, shadowingSessionSchema, validateAudioFile } from "./shadowing";

describe("shadowingSessionSchema", () => {
  it("accepts valid videoId/lineId uuids", () => {
    const result = shadowingSessionSchema.safeParse({
      videoId: "550e8400-e29b-41d4-a716-446655440000",
      lineId: "550e8400-e29b-41d4-a716-446655440001",
    });
    expect(result.success).toBe(true);
  });

  it("rejects non-uuid ids", () => {
    const result = shadowingSessionSchema.safeParse({ videoId: "not-a-uuid", lineId: "also-not" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing field", () => {
    const result = shadowingSessionSchema.safeParse({ videoId: "550e8400-e29b-41d4-a716-446655440000" });
    expect(result.success).toBe(false);
  });

  it("accepts an optional pitchScore, coerced from a form-field string", () => {
    const result = shadowingSessionSchema.safeParse({
      videoId: "550e8400-e29b-41d4-a716-446655440000",
      lineId: "550e8400-e29b-41d4-a716-446655440001",
      pitchScore: "82.5",
    });
    expect(result.success).toBe(true);
    expect(result.success && result.data.pitchScore).toBe(82.5);
  });

  it("omits pitchScore cleanly when absent", () => {
    const result = shadowingSessionSchema.safeParse({
      videoId: "550e8400-e29b-41d4-a716-446655440000",
      lineId: "550e8400-e29b-41d4-a716-446655440001",
    });
    expect(result.success && result.data.pitchScore).toBeUndefined();
  });

  it("rejects a pitchScore below 0", () => {
    const result = shadowingSessionSchema.safeParse({
      videoId: "550e8400-e29b-41d4-a716-446655440000",
      lineId: "550e8400-e29b-41d4-a716-446655440001",
      pitchScore: "-1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a pitchScore above 100", () => {
    const result = shadowingSessionSchema.safeParse({
      videoId: "550e8400-e29b-41d4-a716-446655440000",
      lineId: "550e8400-e29b-41d4-a716-446655440001",
      pitchScore: "101",
    });
    expect(result.success).toBe(false);
  });
});

describe("validateAudioFile", () => {
  it("accepts a webm file within the size limit", () => {
    expect(validateAudioFile({ size: 1024, type: "audio/webm" })).toEqual({ ok: true });
  });

  it.each(["audio/webm", "audio/ogg", "audio/mp4"] as const)("accepts allowed mime type %s", (type) => {
    expect(validateAudioFile({ size: 1024, type })).toEqual({ ok: true });
  });

  it("rejects a disallowed mime type", () => {
    expect(validateAudioFile({ size: 1024, type: "video/mp4" })).toEqual({ ok: false, reason: "bad_type" });
  });

  it("rejects an empty/unknown mime type", () => {
    expect(validateAudioFile({ size: 1024, type: "" })).toEqual({ ok: false, reason: "bad_type" });
  });

  it("accepts a file exactly at the size cap", () => {
    expect(validateAudioFile({ size: MAX_AUDIO_BYTES, type: "audio/webm" })).toEqual({ ok: true });
  });

  it("rejects a file over the size cap", () => {
    expect(validateAudioFile({ size: MAX_AUDIO_BYTES + 1, type: "audio/webm" })).toEqual({
      ok: false,
      reason: "too_large",
    });
  });

  it("reports bad_type before too_large when both are wrong", () => {
    expect(validateAudioFile({ size: MAX_AUDIO_BYTES + 1, type: "video/mp4" })).toEqual({
      ok: false,
      reason: "bad_type",
    });
  });
});
