import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  mockGetUserMedia,
  mockMediaRecorder,
  type GetUserMediaMockHandle,
  type MediaRecorderMockHandle,
} from "@/test/media-mocks";
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
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    gum = mockGetUserMedia();
    mr = mockMediaRecorder([new Uint8Array([9, 9, 9])]);
  });

  afterEach(() => {
    gum.restore();
    mr.restore();
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

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/shadowing/session");
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
});
