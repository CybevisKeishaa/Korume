import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { Waveform } from "./waveform";

/** Minimal fake `AudioBuffer` — just enough for `Waveform`'s envelope pass. */
class FakeAudioBuffer {
  constructor(private readonly channelData: Float32Array) {}
  getChannelData(_channel: number): Float32Array {
    return this.channelData;
  }
}

class FakeAudioContext {
  async decodeAudioData(_buf: ArrayBuffer): Promise<AudioBuffer> {
    const data = new Float32Array(200).map((_, i) => Math.sin(i));
    return new FakeAudioBuffer(data) as unknown as AudioBuffer;
  }
  async close(): Promise<void> {
    // no-op: nothing to release in this fake
  }
}

class FailingAudioContext extends FakeAudioContext {
  async decodeAudioData(): Promise<AudioBuffer> {
    throw new Error("bad data");
  }
}

function makeBlob(): Blob {
  return new Blob([new Uint8Array([1, 2, 3])], { type: "audio/webm" });
}

describe("Waveform", () => {
  let fillRectCalls: number;

  beforeEach(() => {
    fillRectCalls = 0;
    // jsdom implements no real canvas 2D backend; stub just the surface
    // Waveform calls so we can assert it actually drew something.
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(((
      contextId: string,
    ) => {
      if (contextId !== "2d") return null;
      return {
        clearRect: vi.fn(),
        fillRect: vi.fn(() => {
          fillRectCalls += 1;
        }),
        fillStyle: "",
      } as unknown as CanvasRenderingContext2D;
    }) as typeof HTMLCanvasElement.prototype.getContext);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders nothing when there is no recording yet", () => {
    render(<Waveform blob={null} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("decodes the blob and draws the amplitude envelope", async () => {
    vi.stubGlobal("AudioContext", FakeAudioContext);
    render(<Waveform blob={makeBlob()} label="Take 1 waveform" />);

    await waitFor(() =>
      expect(screen.getByRole("img", { name: "Take 1 waveform" })).toBeInTheDocument(),
    );
    expect(fillRectCalls).toBeGreaterThan(0);
  });

  it("falls back to a text message when Web Audio isn't available", async () => {
    render(<Waveform blob={makeBlob()} />);
    await waitFor(() =>
      expect(screen.getByText(/waveform preview unavailable/i)).toBeInTheDocument(),
    );
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("falls back to a text message when decoding fails", async () => {
    vi.stubGlobal("AudioContext", FailingAudioContext);
    render(<Waveform blob={makeBlob()} />);
    await waitFor(() =>
      expect(screen.getByText(/waveform preview unavailable/i)).toBeInTheDocument(),
    );
  });
});
