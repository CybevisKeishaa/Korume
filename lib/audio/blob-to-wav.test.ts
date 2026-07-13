import { afterEach, describe, expect, it } from "vitest";
import { mockAudioContext, type AudioContextMockHandle } from "@/test/audio-context-mock";
import { readBlobBytes } from "@/test/blob-utils";
import { blobToWav16kMono } from "./blob-to-wav";

describe("blobToWav16kMono", () => {
  let audio: AudioContextMockHandle | undefined;

  afterEach(() => {
    audio?.restore();
  });

  it("decodes a recorded blob and returns a 16kHz mono WAV blob", async () => {
    audio = mockAudioContext({
      channelData: [new Float32Array([0, 0.5, -0.5, 1, -1])],
      sampleRate: 16000,
    });

    const input = new Blob([new Uint8Array([1, 2, 3])], { type: "audio/webm" });
    const wav = await blobToWav16kMono(input);

    expect(wav.type).toBe("audio/wav");
    const buffer = await readBlobBytes(wav);
    const view = new DataView(buffer);
    expect(String.fromCharCode(...new Uint8Array(buffer, 0, 4))).toBe("RIFF");
    expect(view.getUint32(24, true)).toBe(16000); // sample rate in the WAV header
    expect(view.getUint16(22, true)).toBe(1); // mono
  });

  it("downmixes stereo input to mono", async () => {
    audio = mockAudioContext({
      channelData: [new Float32Array([1, 1]), new Float32Array([-1, -1])],
      sampleRate: 16000,
    });

    const wav = await blobToWav16kMono(new Blob([new Uint8Array([1])]));
    const buffer = await readBlobBytes(wav);
    const view = new DataView(buffer);
    // +1/-1 averaged is 0 for every sample.
    expect(view.getInt16(44, true)).toBe(0);
  });

  it("propagates a decode failure", async () => {
    audio = mockAudioContext({ rejectWith: new Error("corrupt audio") });
    await expect(blobToWav16kMono(new Blob([new Uint8Array([1])]))).rejects.toThrow(
      "corrupt audio",
    );
  });

  it("throws a clear error when Web Audio isn't available", async () => {
    await expect(blobToWav16kMono(new Blob([new Uint8Array([1])]))).rejects.toThrow(
      /web audio/i,
    );
  });
});
