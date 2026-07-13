import { describe, expect, it } from "vitest";
import { contentTypeForFormat, ttsRequestSchema } from "./speech";
import { DEFAULT_TTS_FORMAT } from "@/lib/speech-scoring";

describe("ttsRequestSchema", () => {
  it("accepts a minimal valid payload", () => {
    expect(ttsRequestSchema.safeParse({ text: "こんにちは" }).success).toBe(true);
  });

  it("accepts an optional voice and format", () => {
    const result = ttsRequestSchema.safeParse({
      text: "こんにちは",
      voice: "ja-JP-NanamiNeural",
      format: "riff-16khz-16bit-mono-pcm",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty text", () => {
    expect(ttsRequestSchema.safeParse({ text: "" }).success).toBe(false);
  });

  it("rejects text over 300 characters", () => {
    expect(ttsRequestSchema.safeParse({ text: "あ".repeat(301) }).success).toBe(false);
  });

  it("rejects an unsupported format", () => {
    expect(ttsRequestSchema.safeParse({ text: "こんにちは", format: "mp3" }).success).toBe(false);
  });

  it("rejects a missing text", () => {
    expect(ttsRequestSchema.safeParse({}).success).toBe(false);
  });
});

describe("contentTypeForFormat", () => {
  it("maps the default mp3 format to audio/mpeg", () => {
    expect(contentTypeForFormat(DEFAULT_TTS_FORMAT)).toBe("audio/mpeg");
  });

  it("maps the 16kHz PCM WAV format to audio/wav", () => {
    expect(contentTypeForFormat("riff-16khz-16bit-mono-pcm")).toBe("audio/wav");
  });

  it("defaults to audio/mpeg when format is undefined", () => {
    expect(contentTypeForFormat(undefined)).toBe("audio/mpeg");
  });
});
