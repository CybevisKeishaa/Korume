import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@/test/render";
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

  it("labels the panel for screen readers with the active line's text", () => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ShadowingRecorderPanel videoId="video-1" lineId="line-1" lineText="こんにちは" />,
    );

    expect(
      screen.getByRole("heading", { name: 'Shadowing recorder for "こんにちは"' }),
    ).toBeInTheDocument();
  });

  it("labels the waveform preview once a take is recorded — carry-forward #1 from the 11a player shell", async () => {
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

    render(<ShadowingRecorderPanel videoId="video-1" lineId="line-1" />);
    await recordAndStop();

    await waitFor(() =>
      expect(screen.getByRole("img", { name: "Your recording waveform" })).toBeInTheDocument(),
    );
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

  it("shows a friendly message when saving requires signing in (401)", async () => {
    fetchMock = vi.fn(async () => jsonResponse(401, { error: "unauthorized" }));
    vi.stubGlobal("fetch", fetchMock);

    render(<ShadowingRecorderPanel videoId="video-1" lineId="line-1" />);
    await recordAndStop();

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Sign in to save your recordings.",
      ),
    );
  });

  it("falls back to a generic wait message when the upload is rate-limited without a usable Retry-After", async () => {
    fetchMock = vi.fn(async () => jsonResponse(429, {}));
    vi.stubGlobal("fetch", fetchMock);

    render(<ShadowingRecorderPanel videoId="video-1" lineId="line-1" />);
    await recordAndStop();

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Too many recordings — please wait a moment and try again.",
      ),
    );
  });

  it("shows the generic saving-failed message on an unmapped status", async () => {
    fetchMock = vi.fn(async () => jsonResponse(500, { error: "boom" }));
    vi.stubGlobal("fetch", fetchMock);

    render(<ShadowingRecorderPanel videoId="video-1" lineId="line-1" />);
    await recordAndStop();

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Something went wrong saving your recording.",
      ),
    );
  });

  it("shows the promoted common.errors.network message when the upload fetch itself throws", async () => {
    fetchMock = vi.fn(async () => {
      throw new Error("offline");
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ShadowingRecorderPanel videoId="video-1" lineId="line-1" />);
    await recordAndStop();

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Network error — check your connection and try again.",
      ),
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

      await waitFor(() => expect(screen.getByText("発音 82")).toBeInTheDocument());
      expect(screen.getByText("リズム 75")).toBeInTheDocument();
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

    it("shows a translated tooltip for each word's error type and accuracy score", async () => {
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

      await waitFor(() =>
        expect(screen.getByText("こんにちは", { selector: "span" })).toHaveAttribute(
          "title",
          "Correct (82)",
        ),
      );
      expect(screen.getByText("です")).toHaveAttribute("title", "Mispronunciation (40)");
      expect(
        screen.getByRole("list", { name: "Word-level pronunciation" }),
      ).toBeInTheDocument();
    });

    it("shows the exact 'Scoring…' busy label while the score request is in flight", async () => {
      let resolveScore: (value: Response) => void = () => undefined;
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
          new Promise<Response>((resolve) => {
            resolveScore = resolve;
          }),
      });
      vi.stubGlobal("fetch", fetchMock);

      const scoreButton = await recordUploadAndScoreButton();
      await userEvent.click(scoreButton);

      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Scoring…" })).toBeInTheDocument(),
      );

      resolveScore(
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
      );
      await waitFor(() => expect(screen.getByText(/発音/)).toBeInTheDocument());
    });

    it("shows a wait message when scoring is rate-limited with a numeric Retry-After", async () => {
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
        "/api/pronunciation/score": () => jsonResponse(429, {}, { "Retry-After": "42" }),
      });
      vi.stubGlobal("fetch", fetchMock);

      const scoreButton = await recordUploadAndScoreButton();
      await userEvent.click(scoreButton);

      await waitFor(() =>
        expect(screen.getByRole("alert")).toHaveTextContent(
          "Too many scoring requests — try again in 42s.",
        ),
      );
    });

    it("falls back to a generic wait message when scoring is rate-limited without a usable Retry-After", async () => {
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
        "/api/pronunciation/score": () => jsonResponse(429, {}),
      });
      vi.stubGlobal("fetch", fetchMock);

      const scoreButton = await recordUploadAndScoreButton();
      await userEvent.click(scoreButton);

      await waitFor(() =>
        expect(screen.getByRole("alert")).toHaveTextContent(
          "Too many scoring requests — please wait a moment and try again.",
        ),
      );
    });

    it("shows a friendly message when the recording can no longer be found to score (404)", async () => {
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
        "/api/pronunciation/score": () => jsonResponse(404, {}),
      });
      vi.stubGlobal("fetch", fetchMock);

      const scoreButton = await recordUploadAndScoreButton();
      await userEvent.click(scoreButton);

      await waitFor(() =>
        expect(screen.getByRole("alert")).toHaveTextContent(
          "That recording could no longer be found to score.",
        ),
      );
    });

    it("shows a friendly message when the recording fails validation (422)", async () => {
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
        "/api/pronunciation/score": () => jsonResponse(422, {}),
      });
      vi.stubGlobal("fetch", fetchMock);

      const scoreButton = await recordUploadAndScoreButton();
      await userEvent.click(scoreButton);

      await waitFor(() =>
        expect(screen.getByRole("alert")).toHaveTextContent(
          "That recording couldn't be scored — try recording again.",
        ),
      );
    });

    it("shows the generic scoring-failed message on an unmapped status", async () => {
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
        "/api/pronunciation/score": () => jsonResponse(500, {}),
      });
      vi.stubGlobal("fetch", fetchMock);

      const scoreButton = await recordUploadAndScoreButton();
      await userEvent.click(scoreButton);

      await waitFor(() =>
        expect(screen.getByRole("alert")).toHaveTextContent(
          "Something went wrong scoring your pronunciation.",
        ),
      );
    });

    it("shows the promoted common.errors.network message when the score fetch itself throws", async () => {
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
        "/api/pronunciation/score": () => {
          throw new Error("offline");
        },
      });
      vi.stubGlobal("fetch", fetchMock);

      const scoreButton = await recordUploadAndScoreButton();
      await userEvent.click(scoreButton);

      await waitFor(() =>
        expect(screen.getByRole("alert")).toHaveTextContent(
          "Network error — check your connection and try again.",
        ),
      );
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

  describe("peer review sharing", () => {
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

    async function recordUploadAndFindShareButton() {
      render(<ShadowingRecorderPanel videoId="video-1" lineId="line-1" lineText="こんにちは" />);
      await recordAndStop();
      await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/saved/i));
      return screen.findByRole("button", { name: /share for peer feedback/i });
    }

    it("explains consent before sharing", async () => {
      fetchMock = routedFetch({ "/api/shadowing/session": sessionCreated });
      vi.stubGlobal("fetch", fetchMock);

      await recordUploadAndFindShareButton();
      expect(
        screen.getByText(/shares this one recording publicly for feedback.*revoke anytime/i),
      ).toBeInTheDocument();
    });

    it("shares the saved session for peer feedback", async () => {
      fetchMock = routedFetch({
        "/api/shadowing/session": sessionCreated,
        "/api/peer-review/shares": () =>
          jsonResponse(201, { data: { id: "share-1", createdAt: "2026-07-12T00:05:00.000Z" } }),
      });
      vi.stubGlobal("fetch", fetchMock);

      const shareButton = await recordUploadAndFindShareButton();
      await userEvent.click(shareButton);

      await waitFor(() => expect(screen.getByText(/shared for peer feedback/i)).toBeInTheDocument());
      const shareCall = fetchMock.mock.calls.find((c) => c[0] === "/api/peer-review/shares");
      expect(shareCall).toBeDefined();
      const [, init] = shareCall as [string, RequestInit];
      expect(init.method).toBe("POST");
      expect(JSON.parse(init.body as string)).toEqual({ sessionId: "rec-1" });
      expect(screen.getByRole("button", { name: /revoke/i })).toBeInTheDocument();
    });

    it("revokes a share after confirming", async () => {
      fetchMock = routedFetch({
        "/api/shadowing/session": sessionCreated,
        "/api/peer-review/shares": () =>
          jsonResponse(201, { data: { id: "share-1", createdAt: "2026-07-12T00:05:00.000Z" } }),
        "/api/peer-review/shares/share-1": () => jsonResponse(204, null),
      });
      vi.stubGlobal("fetch", fetchMock);

      const shareButton = await recordUploadAndFindShareButton();
      await userEvent.click(shareButton);
      await waitFor(() => expect(screen.getByRole("button", { name: /revoke/i })).toBeInTheDocument());

      await userEvent.click(screen.getByRole("button", { name: /revoke/i }));
      await userEvent.click(screen.getByRole("button", { name: /yes/i }));

      await waitFor(() =>
        expect(screen.getByRole("button", { name: /share for peer feedback/i })).toBeInTheDocument(),
      );
    });

    it("shows a wait message when sharing is rate-limited", async () => {
      fetchMock = routedFetch({
        "/api/shadowing/session": sessionCreated,
        "/api/peer-review/shares": () => jsonResponse(429, {}, { "Retry-After": "20" }),
      });
      vi.stubGlobal("fetch", fetchMock);

      const shareButton = await recordUploadAndFindShareButton();
      await userEvent.click(shareButton);

      expect(await screen.findByText(/try again in 20s/i)).toBeInTheDocument();
    });

    it("falls back to a generic wait message when sharing is rate-limited without a usable Retry-After", async () => {
      fetchMock = routedFetch({
        "/api/shadowing/session": sessionCreated,
        "/api/peer-review/shares": () => jsonResponse(429, {}),
      });
      vi.stubGlobal("fetch", fetchMock);

      const shareButton = await recordUploadAndFindShareButton();
      await userEvent.click(shareButton);

      expect(
        await screen.findByText("Too many requests — please wait a moment and try again."),
      ).toBeInTheDocument();
    });

    it("shows the generic share-failed message on an unmapped status", async () => {
      fetchMock = routedFetch({
        "/api/shadowing/session": sessionCreated,
        "/api/peer-review/shares": () => jsonResponse(500, {}),
      });
      vi.stubGlobal("fetch", fetchMock);

      const shareButton = await recordUploadAndFindShareButton();
      await userEvent.click(shareButton);

      expect(
        await screen.findByText("Couldn't share this recording — please try again."),
      ).toBeInTheDocument();
    });

    it("shows the promoted common.errors.network message when the share fetch itself throws", async () => {
      fetchMock = routedFetch({
        "/api/shadowing/session": sessionCreated,
        "/api/peer-review/shares": () => {
          throw new Error("offline");
        },
      });
      vi.stubGlobal("fetch", fetchMock);

      const shareButton = await recordUploadAndFindShareButton();
      await userEvent.click(shareButton);

      expect(
        await screen.findByText("Network error — check your connection and try again."),
      ).toBeInTheDocument();
    });

    it("shows the exact 'Sharing…' busy label while the share request is in flight", async () => {
      let resolveShare: (value: Response) => void = () => undefined;
      fetchMock = routedFetch({
        "/api/shadowing/session": sessionCreated,
        "/api/peer-review/shares": () =>
          new Promise<Response>((resolve) => {
            resolveShare = resolve;
          }),
      });
      vi.stubGlobal("fetch", fetchMock);

      const shareButton = await recordUploadAndFindShareButton();
      await userEvent.click(shareButton);

      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Sharing…" })).toBeInTheDocument(),
      );

      resolveShare(
        jsonResponse(201, { data: { id: "share-1", createdAt: "2026-07-12T00:05:00.000Z" } }),
      );
      await waitFor(() =>
        expect(screen.getByText("Shared for peer feedback.")).toBeInTheDocument(),
      );
    });

    it("shows a friendly message when revoking a share fails", async () => {
      fetchMock = routedFetch({
        "/api/shadowing/session": sessionCreated,
        "/api/peer-review/shares": () =>
          jsonResponse(201, { data: { id: "share-1", createdAt: "2026-07-12T00:05:00.000Z" } }),
        "/api/peer-review/shares/share-1": () => jsonResponse(500, {}),
      });
      vi.stubGlobal("fetch", fetchMock);

      const shareButton = await recordUploadAndFindShareButton();
      await userEvent.click(shareButton);
      await waitFor(() =>
        expect(screen.getByRole("button", { name: /revoke/i })).toBeInTheDocument(),
      );

      await userEvent.click(screen.getByRole("button", { name: /revoke/i }));
      await userEvent.click(screen.getByRole("button", { name: /yes/i }));

      await waitFor(() =>
        expect(
          screen.getByText("Couldn't revoke this share — please try again."),
        ).toBeInTheDocument(),
      );
    });

    it("shows the promoted common.errors.network message when revoking a share's fetch itself throws", async () => {
      fetchMock = routedFetch({
        "/api/shadowing/session": sessionCreated,
        "/api/peer-review/shares": () =>
          jsonResponse(201, { data: { id: "share-1", createdAt: "2026-07-12T00:05:00.000Z" } }),
        "/api/peer-review/shares/share-1": () => {
          throw new Error("offline");
        },
      });
      vi.stubGlobal("fetch", fetchMock);

      const shareButton = await recordUploadAndFindShareButton();
      await userEvent.click(shareButton);
      await waitFor(() =>
        expect(screen.getByRole("button", { name: /revoke/i })).toBeInTheDocument(),
      );

      await userEvent.click(screen.getByRole("button", { name: /revoke/i }));
      await userEvent.click(screen.getByRole("button", { name: /yes/i }));

      await waitFor(() =>
        expect(
          screen.getByText("Network error — check your connection and try again."),
        ).toBeInTheDocument(),
      );
    });
  });
});
