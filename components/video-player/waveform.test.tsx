import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@/test/render";
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

  it("decodes the blob and draws the amplitude envelope, using the default accessible label", async () => {
    vi.stubGlobal("AudioContext", FakeAudioContext);
    render(<Waveform blob={makeBlob()} />);

    await waitFor(() =>
      expect(screen.getByRole("img", { name: "Recording waveform" })).toBeInTheDocument(),
    );
    expect(fillRectCalls).toBeGreaterThan(0);
  });

  it("uses a caller-supplied label instead of the default — proves the prop is threaded through, not silently dropped for the component's own default", async () => {
    // Deliberately non-English literal (binding pattern 5): the default label
    // and the EN catalog value are byte-identical ("Recording waveform"), so
    // an EN-only assertion cannot tell "translation wired through correctly"
    // from "the prop never arrived and the default rendered". Asserting a
    // literal that could not possibly come from the default proves the
    // `label` prop actually reaches the rendered aria-label.
    vi.stubGlobal("AudioContext", FakeAudioContext);
    render(<Waveform blob={makeBlob()} label="Dạng sóng bản ghi thử nghiệm" />);

    await waitFor(() =>
      expect(
        screen.getByRole("img", { name: "Dạng sóng bản ghi thử nghiệm" }),
      ).toBeInTheDocument(),
    );
  });

  it("shows a processing message while the recording is still decoding", async () => {
    class PendingAudioContext extends FakeAudioContext {
      decodeAudioData(): Promise<AudioBuffer> {
        return new Promise(() => {
          // Deliberately never resolves — keeps status at "decoding" so the
          // transient processing message can be observed.
        });
      }
    }
    vi.stubGlobal("AudioContext", PendingAudioContext);
    render(<Waveform blob={makeBlob()} />);
    await waitFor(() =>
      expect(screen.getByText("Processing recording…")).toBeInTheDocument(),
    );
  });

  it("falls back to a text message when Web Audio isn't available", async () => {
    render(<Waveform blob={makeBlob()} />);
    await waitFor(() =>
      expect(screen.getByText("Waveform preview unavailable.")).toBeInTheDocument(),
    );
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("falls back to a text message when decoding fails", async () => {
    vi.stubGlobal("AudioContext", FailingAudioContext);
    render(<Waveform blob={makeBlob()} />);
    await waitFor(() =>
      expect(screen.getByText("Waveform preview unavailable.")).toBeInTheDocument(),
    );
  });
});
