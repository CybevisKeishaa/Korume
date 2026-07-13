import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  mockGetUserMedia,
  mockMediaRecorder,
  type GetUserMediaMockHandle,
  type MediaRecorderMockHandle,
} from "@/test/media-mocks";
import { mockAudioContext, type AudioContextMockHandle } from "@/test/audio-context-mock";
import { readBlobBytes } from "@/test/blob-utils";
import { VoiceRecorderButton } from "./voice-recorder-button";

function jsonResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (name: string) => headers[name] ?? null } as Headers,
    json: async () => body,
  } as unknown as Response;
}

describe("VoiceRecorderButton", () => {
  let gum: GetUserMediaMockHandle;
  let mr: MediaRecorderMockHandle;
  let audio: AudioContextMockHandle;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    gum = mockGetUserMedia();
    mr = mockMediaRecorder([new Uint8Array([1, 2, 3])]);
    audio = mockAudioContext({
      channelData: [new Float32Array([0, 0.5, -0.5, 1])],
      sampleRate: 48000,
    });
  });

  afterEach(() => {
    gum.restore();
    mr.restore();
    audio.restore();
    vi.unstubAllGlobals();
  });

  async function recordAndStop() {
    await userEvent.click(screen.getByRole("button", { name: /record voice message/i }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /stop recording/i })).toBeInTheDocument(),
    );
    await userEvent.click(screen.getByRole("button", { name: /stop recording/i }));
  }

  it("records, transcribes via STT, and reports the result", async () => {
    fetchMock = vi.fn(async () =>
      jsonResponse(200, { data: { text: "こんにちは", confidence: 0.92 } }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const onTranscribed = vi.fn();

    render(<VoiceRecorderButton onTranscribed={onTranscribed} />);
    await recordAndStop();

    await waitFor(() => expect(onTranscribed).toHaveBeenCalledTimes(1));
    const [call] = onTranscribed.mock.calls[0] as [{ text: string; confidence: number; blob: Blob }];
    expect(call.text).toBe("こんにちは");
    expect(call.confidence).toBe(0.92);
    expect(call.blob).toBeInstanceOf(Blob);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/speech/stt");
    expect(init.method).toBe("POST");
    const body = init.body as FormData;
    expect(body.get("audio")).toBeInstanceOf(Blob);
  });

  it("uploads a 16kHz mono WAV conversion, not the raw webm recording", async () => {
    fetchMock = vi.fn(async () =>
      jsonResponse(200, { data: { text: "こんにちは", confidence: 0.92 } }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const onTranscribed = vi.fn();

    render(<VoiceRecorderButton onTranscribed={onTranscribed} />);
    await recordAndStop();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const uploaded = (init.body as FormData).get("audio") as File;
    expect(uploaded.type).toBe("audio/wav");
    expect(uploaded.name).toBe("voice-message.wav");

    const bytes = await readBlobBytes(uploaded);
    const view = new DataView(bytes);
    expect(String.fromCharCode(...new Uint8Array(bytes, 0, 4))).toBe("RIFF");
    expect(view.getUint32(24, true)).toBe(16000); // resampled to 16kHz
    expect(view.getUint16(22, true)).toBe(1); // mono

    // The blob handed back to the caller stays the original recording.
    await waitFor(() => expect(onTranscribed).toHaveBeenCalledTimes(1));
    const [call] = onTranscribed.mock.calls[0] as [{ blob: Blob }];
    expect(call.blob.type).toContain("webm");
  });

  it("shows a friendly message and skips the upload when conversion fails", async () => {
    audio.restore();
    audio = mockAudioContext({ rejectWith: new Error("corrupt audio") });
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<VoiceRecorderButton onTranscribed={vi.fn()} />);
    await recordAndStop();

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(/couldn't process that recording/i),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("degrades to a disabled, tooltip-explained state when speech isn't configured (503)", async () => {
    fetchMock = vi.fn(async () => jsonResponse(503, { error: "Speech recognition is not configured" }));
    vi.stubGlobal("fetch", fetchMock);
    const onTranscribed = vi.fn();

    render(<VoiceRecorderButton onTranscribed={onTranscribed} />);
    await recordAndStop();

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(/isn't set up yet/i),
    );
    expect(onTranscribed).not.toHaveBeenCalled();

    // Persistently disabled afterwards, with an explanatory tooltip.
    const micButton = screen.getByRole("button", { name: /record voice message/i });
    expect(micButton).toBeDisabled();
    expect(micButton).toHaveAttribute("title", expect.stringMatching(/isn't set up yet/i));
  });

  it("shows a wait message on 429 with Retry-After", async () => {
    fetchMock = vi.fn(async () => jsonResponse(429, {}, { "Retry-After": "12" }));
    vi.stubGlobal("fetch", fetchMock);

    render(<VoiceRecorderButton onTranscribed={vi.fn()} />);
    await recordAndStop();

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(/try again in 12s/i),
    );
  });

  it("shows a friendly message when microphone permission is denied", async () => {
    gum.restore();
    gum = mockGetUserMedia({ rejectWith: new DOMException("nope", "NotAllowedError") });
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<VoiceRecorderButton onTranscribed={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: /record voice message/i }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(/microphone access was denied/i),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
