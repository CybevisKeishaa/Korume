import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { render } from "@/test/render";
import { PitchContour } from "./pitch-contour";
import { makeToneBuffer, makeSilenceBuffer } from "@/test/audio-fixtures";

const SAMPLE_RATE = 16000;

/** Minimal fake `AudioBuffer` — just enough for the pitch pipeline's mono read. */
class FakeAudioBuffer {
  readonly sampleRate = SAMPLE_RATE;
  constructor(private readonly channelData: Float32Array) {}
  getChannelData(_channel: number): Float32Array {
    return this.channelData;
  }
}

class ToneAudioContext {
  async decodeAudioData(_buf: ArrayBuffer): Promise<AudioBuffer> {
    // A clean, sustained 150 Hz tone gives the YIN estimator a long, confidently
    // voiced track to plot (well above the extractor's silence/voicing floor).
    const data = makeToneBuffer(150, SAMPLE_RATE, 0.5);
    return new FakeAudioBuffer(data) as unknown as AudioBuffer;
  }
  async close(): Promise<void> {
    // no-op: nothing to release in this fake
  }
}

class SilentAudioContext {
  async decodeAudioData(_buf: ArrayBuffer): Promise<AudioBuffer> {
    const data = makeSilenceBuffer(SAMPLE_RATE, 0.5);
    return new FakeAudioBuffer(data) as unknown as AudioBuffer;
  }
  async close(): Promise<void> {
    // no-op
  }
}

class FailingAudioContext {
  async decodeAudioData(): Promise<AudioBuffer> {
    throw new Error("bad data");
  }
  async close(): Promise<void> {
    // no-op
  }
}

class PendingAudioContext {
  decodeAudioData(): Promise<AudioBuffer> {
    return new Promise(() => {
      // Deliberately never resolves — keeps status at "decoding" so the
      // transient "Analyzing pitch…" message can be observed (review
      // finding, Important 3: this string had a correct pin but no render
      // assertion).
    });
  }
  async close(): Promise<void> {
    // no-op
  }
}

function makeBlob(): Blob {
  return new Blob([new Uint8Array([1, 2, 3])], { type: "audio/webm" });
}

describe("PitchContour", () => {
  let strokeCalls: number;
  let arcCalls: number;

  beforeEach(() => {
    strokeCalls = 0;
    arcCalls = 0;
    // jsdom implements no real canvas 2D backend; stub just the surface
    // PitchContour calls so we can assert it actually drew something.
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(((
      contextId: string,
    ) => {
      if (contextId !== "2d") return null;
      return {
        clearRect: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        arc: vi.fn(() => {
          arcCalls += 1;
        }),
        fill: vi.fn(),
        stroke: vi.fn(() => {
          strokeCalls += 1;
        }),
        strokeStyle: "",
        fillStyle: "",
        lineWidth: 0,
        lineJoin: "",
        lineCap: "",
      } as unknown as CanvasRenderingContext2D;
    }) as typeof HTMLCanvasElement.prototype.getContext);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders nothing when there is no recording yet", () => {
    render(<PitchContour blob={null} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("decodes the blob, extracts F0, and draws the semitone contour", async () => {
    vi.stubGlobal("AudioContext", ToneAudioContext);
    render(<PitchContour blob={makeBlob()} />);

    // Generous timeout: the async decode→extract→render pass can exceed the
    // 1s default under full-suite CPU contention (intermittent failure first
    // seen in Layer 6 integration runs).
    await waitFor(
      () =>
        expect(
          screen.getByRole("img", { name: "Your pitch contour for this take" }),
        ).toBeInTheDocument(),
      { timeout: 5000 },
    );
    // At least the baseline gridline + the contour line were stroked, and
    // voiced frames were marked with dots.
    expect(strokeCalls).toBeGreaterThan(0);
    expect(arcCalls).toBeGreaterThan(0);
  });

  it("uses the translated default accessible label when no override is passed — proves shadowing.pitch.contour.a11y.label is wired", async () => {
    vi.stubGlobal("AudioContext", ToneAudioContext);
    render(<PitchContour blob={makeBlob()} />);
    await waitFor(
      () =>
        expect(
          screen.getByRole("img", { name: "Your pitch contour for this take" }),
        ).toBeInTheDocument(),
      { timeout: 5000 },
    );
  });

  it("uses a caller-supplied label instead of the default — proves the prop is threaded through, not silently dropped for the component's own default", async () => {
    // Deliberately non-English literal (binding pattern 5, per waveform.test.tsx):
    // the default label and the EN catalog value are byte-identical ("Your
    // pitch contour for this take"), so an EN-only assertion can't tell
    // "translation wired through correctly" from "the prop never arrived and
    // the default rendered". A literal that could not possibly come from the
    // default proves the `label` prop actually reaches the rendered aria-label.
    vi.stubGlobal("AudioContext", ToneAudioContext);
    render(<PitchContour blob={makeBlob()} label="Đường cong cao độ của lượt thử nghiệm" />);

    await waitFor(
      () =>
        expect(
          screen.getByRole("img", { name: "Đường cong cao độ của lượt thử nghiệm" }),
        ).toBeInTheDocument(),
      { timeout: 5000 },
    );
  });

  it("shows an analyzing message while the recording is still decoding", async () => {
    vi.stubGlobal("AudioContext", PendingAudioContext);
    render(<PitchContour blob={makeBlob()} />);
    await waitFor(() => expect(screen.getByText("Analyzing pitch…")).toBeInTheDocument());
  });

  it("falls back to a text message when Web Audio isn't available", async () => {
    render(<PitchContour blob={makeBlob()} />);
    await waitFor(
      () => expect(screen.getByText(/pitch contour unavailable/i)).toBeInTheDocument(),
      { timeout: 5000 },
    );
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("falls back to a text message when decoding fails", async () => {
    vi.stubGlobal("AudioContext", FailingAudioContext);
    render(<PitchContour blob={makeBlob()} />);
    await waitFor(
      () => expect(screen.getByText(/pitch contour unavailable/i)).toBeInTheDocument(),
      { timeout: 5000 },
    );
  });

  it("falls back to a text message when the clip is fully unvoiced (silence)", async () => {
    vi.stubGlobal("AudioContext", SilentAudioContext);
    render(<PitchContour blob={makeBlob()} />);
    await waitFor(
      () => expect(screen.getByText(/pitch contour unavailable/i)).toBeInTheDocument(),
      { timeout: 5000 },
    );
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
