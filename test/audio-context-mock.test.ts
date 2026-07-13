import { afterEach, describe, expect, it } from "vitest";
import { mockAudioContext, type AudioContextMockHandle } from "./audio-context-mock";

describe("mockAudioContext", () => {
  let handle: AudioContextMockHandle | undefined;

  afterEach(() => {
    handle?.restore();
  });

  it("installs a fake AudioContext whose decodeAudioData resolves to the given channel data", async () => {
    const left = new Float32Array([0.1, 0.2, 0.3]);
    handle = mockAudioContext({ channelData: [left], sampleRate: 16000 });

    const ctx = new AudioContext();
    const buffer = await ctx.decodeAudioData(new ArrayBuffer(0));

    expect(buffer.sampleRate).toBe(16000);
    expect(buffer.numberOfChannels).toBe(1);
    expect(Array.from(buffer.getChannelData(0))).toEqual(Array.from(left));
  });

  it("supports multi-channel data", async () => {
    const left = new Float32Array([1, 1]);
    const right = new Float32Array([-1, -1]);
    handle = mockAudioContext({ channelData: [left, right] });

    const ctx = new AudioContext();
    const buffer = await ctx.decodeAudioData(new ArrayBuffer(0));

    expect(buffer.numberOfChannels).toBe(2);
    expect(Array.from(buffer.getChannelData(1))).toEqual([-1, -1]);
  });

  it("rejects with the configured error", async () => {
    handle = mockAudioContext({ rejectWith: new Error("bad data") });
    const ctx = new AudioContext();
    await expect(ctx.decodeAudioData(new ArrayBuffer(0))).rejects.toThrow("bad data");
  });

  it("restores the previous global afterward", () => {
    const before = (globalThis as { AudioContext?: unknown }).AudioContext;
    handle = mockAudioContext();
    expect((globalThis as { AudioContext?: unknown }).AudioContext).not.toBe(before);
    handle.restore();
    expect((globalThis as { AudioContext?: unknown }).AudioContext).toBe(before);
  });
});
