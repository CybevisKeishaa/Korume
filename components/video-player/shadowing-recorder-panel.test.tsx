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
import { makeToneBuffer } from "@/test/audio-fixtures";
import { encodeWavPCM16, floatTo16BitPCM } from "@/lib/audio/pcm-encode";
import { clearReferenceContourCache } from "@/lib/pitch/reference";
import { ShadowingRecorderPanel } from "./shadowing-recorder-panel";

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

describe("ShadowingRecorderPanel", () => {
  let gum: GetUserMediaMockHandle;
  let mr: MediaRecorderMockHandle;
  let audio: AudioContextMockHandle;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    gum = mockGetUserMedia();
    mr = mockMediaRecorder([new Uint8Array([9, 9, 9])]);
    audio = mockAudioContext({
      channelData: [new Float32Array([0, 0.5, -0.5, 1])],
      sampleRate: 48000,
    });
  });

  afterEach(() => {
    gum.restore();
    mr.restore();
    audio.restore();
    clearReferenceContourCache();
    vi.unstubAllGlobals();
  });

  async function recordAndStop() {
    await userEvent.click(screen.getByRole("button", { name: /^record$/i }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /stop recording/i })).toBeInTheDocument(),
    );
    await userEvent.click(screen.getByRole("button", { name: /stop recording/i }));
  }

  it("records, uploads as multipart form data, and offers playback of the saved recording", async () => {
    fetchMock = vi.fn(async () =>
      jsonResponse(201, {
        data: {
          id: "rec-1",
          recordingPath: "recordings/rec-1.webm",
          signedUrl: "https://example.test/signed/rec-1.webm",
          createdAt: "2026-07-12T00:00:00.000Z",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ShadowingRecorderPanel videoId="video-1" lineId="line-1" lineText="こんにちは" />,
    );

    await recordAndStop();

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/saved/i));

    // With lineText set the panel may also request a TTS pitch reference —
    // exactly one call must be the session upload.
    const sessionCalls = fetchMock.mock.calls.filter((c) => c[0] === "/api/shadowing/session");
    expect(sessionCalls).toHaveLength(1);
    const [, init] = sessionCalls[0] as [string, RequestInit];
    expect(init.method).toBe("POST");
    const body = init.body as FormData;
    expect(body.get("videoId")).toBe("video-1");
    expect(body.get("lineId")).toBe("line-1");
    expect(body.get("audio")).toBeInstanceOf(Blob);

    const audioEl = screen.getByLabelText(/play your saved recording/i);
    expect(audioEl).toHaveAttribute("src", "https://example.test/signed/rec-1.webm");
  });

  it("shows a friendly message when microphone permission is denied", async () => {
    gum.restore();
    gum = mockGetUserMedia({
      rejectWith: new DOMException("nope", "NotAllowedError"),
    });
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<ShadowingRecorderPanel videoId="video-1" lineId="line-1" />);
    await userEvent.click(screen.getByRole("button", { name: /^record$/i }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(/microphone access was denied/i),
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /^record$/i })).toBeEnabled();
  });

  it("shows a wait message when the API rate-limits the upload", async () => {
    fetchMock = vi.fn(async () => jsonResponse(429, {}, { "Retry-After": "30" }));
    vi.stubGlobal("fetch", fetchMock);

    render(<ShadowingRecorderPanel videoId="video-1" lineId="line-1" />);
    await recordAndStop();

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(/try again in 30s/i),
    );
  });

  it("shows a generic message when the upload fails validation", async () => {
    fetchMock = vi.fn(async () => jsonResponse(422, { error: "bad file" }));
    vi.stubGlobal("fetch", fetchMock);

    render(<ShadowingRecorderPanel videoId="video-1" lineId="line-1" />);
    await recordAndStop();

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(/couldn't be saved/i),
    );
  });

  describe("pronunciation scoring", () => {
    function routedFetch(
      handlers: Record<string, () => Response | Promise<Response>>,
    ): ReturnType<typeof vi.fn> {
      return vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        const handler = handlers[url];
        if (!handler) throw new Error(`No handler for ${url}`);
        return handler();
      });
    }

    async function recordUploadAndScoreButton() {
      render(
        <ShadowingRecorderPanel videoId="video-1" lineId="line-1" lineText="こんにちは" />,
      );
      await recordAndStop();
      await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/saved/i));
      return screen.findByRole("button", { name: /score my pronunciation/i });
    }

    it("scores the saved recording against the line text and shows the results", async () => {
      fetchMock = routedFetch({
        "/api/shadowing/session": () =>
          jsonResponse(201, {
            data: {
              id: "rec-1",
              recordingPath: "recordings/rec-1.webm",
              signedUrl: "https://example.test/signed/rec-1.webm",
              createdAt: "2026-07-12T00:00:00.000Z",
            },
          }),
        "/api/pronunciation/score": () =>
          jsonResponse(200, {
            data: {
              recognizedText: "こんにちは",
              pronunciationScore: 82,
              fluencyScore: 75,
              accuracyScore: 90,
              completenessScore: 100,
              words: [
                { word: "こんにちは", accuracyScore: 82, errorType: "None" },
                { word: "です", accuracyScore: 40, errorType: "Mispronunciation" },
              ],
            },
          }),
      });
      vi.stubGlobal("fetch", fetchMock);

      const scoreButton = await recordUploadAndScoreButton();
      await userEvent.click(scoreButton);

      await waitFor(() => expect(screen.getByText(/発音/)).toBeInTheDocument());
      expect(screen.getByText(/82/)).toBeInTheDocument();
      expect(screen.getByText(/リズム/)).toBeInTheDocument();
      expect(screen.getByText(/75/)).toBeInTheDocument();
      expect(screen.getByText("こんにちは", { selector: "span" })).toBeInTheDocument();
      expect(screen.getByText("です")).toBeInTheDocument();

      const scoreCall = fetchMock.mock.calls.find((c) => c[0] === "/api/pronunciation/score");
      expect(scoreCall).toBeDefined();
      const [, init] = scoreCall as [string, RequestInit];
      expect(init.method).toBe("POST");
      const body = init.body as FormData;
      expect(body.get("referenceText")).toBe("こんにちは");
      expect(body.get("shadowingSessionId")).toBe("rec-1");
      expect(body.get("audio")).toBeInstanceOf(Blob);
    });

    it("uploads a 16kHz mono WAV conversion to the scoring endpoint, not raw webm", async () => {
      fetchMock = routedFetch({
        "/api/shadowing/session": () =>
          jsonResponse(201, {
            data: {
              id: "rec-1",
              recordingPath: "recordings/rec-1.webm",
              signedUrl: "https://example.test/signed/rec-1.webm",
              createdAt: "2026-07-12T00:00:00.000Z",
            },
          }),
        "/api/pronunciation/score": () =>
          jsonResponse(200, {
            data: {
              recognizedText: "こんにちは",
              pronunciationScore: 82,
              fluencyScore: 75,
              accuracyScore: 90,
              completenessScore: 100,
              words: [],
            },
          }),
      });
      vi.stubGlobal("fetch", fetchMock);

      const scoreButton = await recordUploadAndScoreButton();
      await userEvent.click(scoreButton);
      await waitFor(() => expect(screen.getByText(/発音/)).toBeInTheDocument());

      // The storage upload keeps the original webm; only the Azure-bound
      // scoring request converts.
      const sessionCall = fetchMock.mock.calls.find((c) => c[0] === "/api/shadowing/session");
      const sessionAudio = ((sessionCall as [string, RequestInit])[1].body as FormData).get(
        "audio",
      ) as File;
      expect(sessionAudio.type).toContain("webm");

      const scoreCall = fetchMock.mock.calls.find((c) => c[0] === "/api/pronunciation/score");
      const uploaded = ((scoreCall as [string, RequestInit])[1].body as FormData).get(
        "audio",
      ) as File;
      expect(uploaded.type).toBe("audio/wav");
      expect(uploaded.name).toBe("recording.wav");

      const bytes = await readBlobBytes(uploaded);
      const view = new DataView(bytes);
      expect(String.fromCharCode(...new Uint8Array(bytes, 0, 4))).toBe("RIFF");
      expect(view.getUint32(24, true)).toBe(16000); // resampled to 16kHz
      expect(view.getUint16(22, true)).toBe(1); // mono
    });

    it("shows a friendly error and skips the request when WAV conversion fails", async () => {
      fetchMock = routedFetch({
        "/api/shadowing/session": () =>
          jsonResponse(201, {
            data: {
              id: "rec-1",
              recordingPath: "recordings/rec-1.webm",
              signedUrl: "https://example.test/signed/rec-1.webm",
              createdAt: "2026-07-12T00:00:00.000Z",
            },
          }),
      });
      vi.stubGlobal("fetch", fetchMock);
      audio.restore();
      audio = mockAudioContext({ rejectWith: new Error("corrupt audio") });

      const scoreButton = await recordUploadAndScoreButton();
      await userEvent.click(scoreButton);

      await waitFor(() =>
        expect(screen.getByText(/couldn't process that recording/i)).toBeInTheDocument(),
      );
      const scoreCall = fetchMock.mock.calls.find((c) => c[0] === "/api/pronunciation/score");
      expect(scoreCall).toBeUndefined();
    });

    it("degrades to a disabled, tooltip-explained state when scoring isn't configured (503)", async () => {
      fetchMock = routedFetch({
        "/api/shadowing/session": () =>
          jsonResponse(201, {
            data: {
              id: "rec-1",
              recordingPath: "recordings/rec-1.webm",
              signedUrl: "https://example.test/signed/rec-1.webm",
              createdAt: "2026-07-12T00:00:00.000Z",
            },
          }),
        "/api/pronunciation/score": () =>
          jsonResponse(503, { error: "Pronunciation scoring is not configured" }),
      });
      vi.stubGlobal("fetch", fetchMock);

      const scoreButton = await recordUploadAndScoreButton();
      await userEvent.click(scoreButton);

      await waitFor(() =>
        expect(screen.getByText(/isn't set up yet/i)).toBeInTheDocument(),
      );
      expect(scoreButton).toBeDisabled();
      expect(scoreButton).toHaveAttribute("title", expect.stringMatching(/isn't set up yet/i));
    });
  });

  describe("pitch contour overlay", () => {
    function routedFetch(
      handlers: Record<string, () => Response | Promise<Response>>,
    ): ReturnType<typeof vi.fn> {
      return vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        const handler = handlers[url];
        if (!handler) throw new Error(`No handler for ${url}`);
        return handler();
      });
    }

    const sessionCreated = () =>
      jsonResponse(201, {
        data: {
          id: "rec-1",
          recordingPath: "recordings/rec-1.webm",
          signedUrl: "https://example.test/signed/rec-1.webm",
          createdAt: "2026-07-12T00:00:00.000Z",
        },
      });

    function ttsWavResponse(): Response {
      const bytes = encodeWavPCM16(
        floatTo16BitPCM(makeToneBuffer(150, 16000, 0.5)),
        16000,
        1,
      );
      return {
        status: 200,
        ok: true,
        arrayBuffer: async () => bytes,
      } as unknown as Response;
    }

    function useVoicedRecording() {
      audio.restore();
      audio = mockAudioContext({
        channelData: [makeToneBuffer(150, 48000, 0.5)],
        sampleRate: 48000,
      });
    }

    it("overlays the user's contour on the TTS reference and attaches the pitch score to the upload", async () => {
      useVoicedRecording();
      fetchMock = routedFetch({
        "/api/shadowing/session": sessionCreated,
        "/api/speech/tts": ttsWavResponse,
      });
      vi.stubGlobal("fetch", fetchMock);

      render(
        <ShadowingRecorderPanel videoId="video-1" lineId="line-1" lineText="こんにちは" />,
      );
      await recordAndStop();

      // Overlay replaces the user-only contour once the comparison lands.
      await waitFor(() => expect(screen.getByTestId("user-contour")).toBeInTheDocument());
      expect(screen.getByTestId("reference-contour")).toBeInTheDocument();
      expect(screen.getByText(/イントネーション/)).toBeInTheDocument();

      await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/saved/i));
      const sessionCall = fetchMock.mock.calls.find((c) => c[0] === "/api/shadowing/session");
      const body = (sessionCall as [string, RequestInit])[1].body as FormData;
      const pitchScore = Number(body.get("pitchScore"));
      expect(pitchScore).toBeGreaterThan(50);
      expect(pitchScore).toBeLessThanOrEqual(100);
    });

    it("degrades to the user-only contour and a scoreless upload when TTS isn't configured", async () => {
      useVoicedRecording();
      fetchMock = routedFetch({
        "/api/shadowing/session": sessionCreated,
        "/api/speech/tts": () => jsonResponse(503, { error: "Speech synthesis is not configured" }),
      });
      vi.stubGlobal("fetch", fetchMock);

      render(
        <ShadowingRecorderPanel videoId="video-1" lineId="line-1" lineText="こんにちは" />,
      );
      await recordAndStop();

      await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/saved/i));
      expect(screen.queryByTestId("user-contour")).not.toBeInTheDocument();

      const sessionCall = fetchMock.mock.calls.find((c) => c[0] === "/api/shadowing/session");
      const body = (sessionCall as [string, RequestInit])[1].body as FormData;
      expect(body.get("pitchScore")).toBeNull();
    });

    it("never blocks saving the recording on a hung TTS request", async () => {
      useVoicedRecording();
      fetchMock = routedFetch({
        "/api/shadowing/session": sessionCreated,
        "/api/speech/tts": () =>
          new Promise<Response>(() => {
            /* never settles — simulates a hung TTS request */
          }),
      });
      vi.stubGlobal("fetch", fetchMock);

      render(
        <ShadowingRecorderPanel
          videoId="video-1"
          lineId="line-1"
          lineText="こんにちは"
          pitchScoreUploadBudgetMs={25}
        />,
      );
      await recordAndStop();

      await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/saved/i));
      const sessionCall = fetchMock.mock.calls.find((c) => c[0] === "/api/shadowing/session");
      const body = (sessionCall as [string, RequestInit])[1].body as FormData;
      expect(body.get("pitchScore")).toBeNull();
    });
  });
});
