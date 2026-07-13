import { describe, expect, it } from "vitest";
import { MAX_SPEECH_AUDIO_BYTES, validateAudioSize } from "./audio";

describe("validateAudioSize", () => {
  it("accepts a normal-sized file", () => {
    expect(validateAudioSize({ size: 1024 })).toEqual({ ok: true });
  });

  it("rejects an empty file", () => {
    expect(validateAudioSize({ size: 0 })).toEqual({ ok: false, reason: "empty" });
  });

  it("accepts a file exactly at the cap", () => {
    expect(validateAudioSize({ size: MAX_SPEECH_AUDIO_BYTES })).toEqual({ ok: true });
  });

  it("rejects a file one byte over the cap", () => {
    expect(validateAudioSize({ size: MAX_SPEECH_AUDIO_BYTES + 1 })).toEqual({
      ok: false,
      reason: "too_large",
    });
  });

  it("honors a custom cap", () => {
    expect(validateAudioSize({ size: 500 }, 400)).toEqual({ ok: false, reason: "too_large" });
    expect(validateAudioSize({ size: 400 }, 400)).toEqual({ ok: true });
  });
});
