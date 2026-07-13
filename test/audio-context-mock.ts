/**
 * Fake `window.AudioContext` for jsdom/vitest, for components/utilities that
 * call `decodeAudioData` (waveform/pitch-contour rendering, and the
 * webm→WAV conversion in `lib/audio/blob-to-wav.ts` ahead of Azure Speech
 * calls). jsdom implements no real Web Audio API, so tests that exercise a
 * decode path must install this first. Install/restore pair, consistent
 * with `media-mocks.ts`/`youtube-stub.ts` (CLAUDE.md §7 — no flaky tests,
 * clean up in `afterEach`).
 *
 * Typical usage:
 *
 *   let audio: AudioContextMockHandle;
 *   afterEach(() => audio?.restore());
 *
 *   it("converts a recording before upload", async () => {
 *     audio = mockAudioContext({ channelData: [makeToneBuffer(150, 48000, 0.5)], sampleRate: 48000 });
 *     ...
 *   });
 */

export interface FakeAudioContextOptions {
  /** One `Float32Array` per channel. Defaults to a single ~10ms silent mono channel. */
  channelData?: Float32Array[];
  /** Reported `AudioBuffer.sampleRate`. Defaults to 48000 (typical mic capture rate). */
  sampleRate?: number;
  /** If set, `decodeAudioData` rejects with this instead of resolving. */
  rejectWith?: Error;
}

export interface AudioContextMockHandle {
  /** Restores whatever `window.AudioContext` was before this mock was installed. */
  restore(): void;
}

const DEFAULT_SAMPLE_RATE = 48000;

/** Installs a fake `AudioContext` whose `decodeAudioData` resolves to fixed channel data. */
export function mockAudioContext(options: FakeAudioContextOptions = {}): AudioContextMockHandle {
  const channelData = options.channelData ?? [new Float32Array(480)];
  const sampleRate = options.sampleRate ?? DEFAULT_SAMPLE_RATE;

  class FakeAudioBuffer {
    readonly sampleRate = sampleRate;
    readonly numberOfChannels = channelData.length;
    readonly length = channelData[0]?.length ?? 0;
    getChannelData(channel: number): Float32Array {
      return channelData[channel] ?? new Float32Array(this.length);
    }
  }

  class FakeAudioContext {
    async decodeAudioData(_buf: ArrayBuffer): Promise<AudioBuffer> {
      if (options.rejectWith) throw options.rejectWith;
      return new FakeAudioBuffer() as unknown as AudioBuffer;
    }
    async close(): Promise<void> {
      // no-op: nothing to release in this fake
    }
  }

  const globalWithAudio = globalThis as typeof globalThis & { AudioContext?: typeof AudioContext };
  const original = globalWithAudio.AudioContext;
  globalWithAudio.AudioContext = FakeAudioContext as unknown as typeof AudioContext;

  return {
    restore(): void {
      globalWithAudio.AudioContext = original;
    },
  };
}
