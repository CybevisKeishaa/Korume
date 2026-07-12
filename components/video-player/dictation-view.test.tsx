import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { installYouTubeStub, type YouTubeStubHandle } from "@/test/youtube-stub";
import type { TranscriptWithLines, VideoRow } from "@/lib/video-types";
import { DictationView } from "./dictation-view";

const VIDEO: VideoRow = {
  id: "11111111-1111-1111-1111-111111111111",
  youtube_video_id: "abc123",
  title: "Test Video",
  duration_seconds: null,
  thumbnail_url: null,
  jlpt_level_estimate: null,
  added_by_user_id: "user-1",
  status: "approved",
  created_at: "2026-01-01T00:00:00.000Z",
};

const TRANSCRIPT: TranscriptWithLines = {
  id: "transcript-1",
  video_id: VIDEO.id,
  source: "youtube_caption",
  language: "ja",
  created_at: "2026-01-01T00:00:00.000Z",
  lines: [
    {
      id: "line-1",
      start_time: 0,
      end_time: 3,
      text_jp: "こんにちは",
      text_translation: "Hello",
      furigana_json: null,
    },
    {
      id: "line-2",
      start_time: 3,
      end_time: 6,
      text_jp: "学校",
      text_translation: "School",
      furigana_json: null,
    },
  ],
};

function renderView(
  video: VideoRow = VIDEO,
  transcript: TranscriptWithLines | null = TRANSCRIPT,
) {
  return render(
    <ThemeProvider>
      <DictationView video={video} transcript={transcript} />
    </ThemeProvider>,
  );
}

function stubFetchOnce(response: { ok: boolean; status?: number; body: unknown }) {
  const fn = vi.fn(async (_url: string, _init?: RequestInit) => {
    return {
      ok: response.ok,
      status: response.status ?? (response.ok ? 200 : 400),
      json: async () => response.body,
    } as Response;
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("DictationView", () => {
  let yt: YouTubeStubHandle;

  beforeEach(() => {
    yt = installYouTubeStub({ duration: 90 });
  });

  afterEach(() => {
    yt.restore();
    vi.unstubAllGlobals();
  });

  it("shows a no-transcript hint when the video has no transcript yet", async () => {
    renderView(VIDEO, null);
    await waitFor(() => expect(yt.players).toHaveLength(1));
    expect(screen.getByText(/no transcript yet/i)).toBeInTheDocument();
  });

  it("types and submits, posting {videoId, lineId, userInput} and rendering the accuracy", async () => {
    renderView();
    await waitFor(() => expect(yt.players).toHaveLength(1));

    const fetchMock = stubFetchOnce({
      ok: true,
      body: {
        data: { accuracy: 80, diff: [{ type: "match", expected: "a", actual: "a" }] },
      },
    });

    await userEvent.type(screen.getByLabelText(/type what you hear/i), "こんにちわ");
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const call = fetchMock.mock.calls[0]!;
    const [url, init] = call;
    expect(url).toBe("/api/dictation/attempt");
    expect(JSON.parse(init?.body as string)).toEqual({
      videoId: VIDEO.id,
      lineId: TRANSCRIPT.lines[0]!.id,
      userInput: "こんにちわ",
    });

    expect(await screen.findByText("Accuracy: 80%")).toBeInTheDocument();
  });

  it("renders wrong/missing/extra diff markers with a non-color cue", async () => {
    renderView();
    await waitFor(() => expect(yt.players).toHaveLength(1));

    stubFetchOnce({
      ok: true,
      body: {
        data: {
          accuracy: 50,
          diff: [
            { type: "wrong", expected: "は", actual: "ば" },
            { type: "missing", expected: "。" },
            { type: "extra", actual: "!" },
          ],
        },
      },
    });

    await userEvent.type(screen.getByLabelText(/type what you hear/i), "x");
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText(/wrong, expected は/i)).toBeInTheDocument();
    expect(screen.getByText(/^missing$/i)).toBeInTheDocument();
    expect(screen.getByText(/extra, not scored/i)).toBeInTheDocument();
  });

  it("shows a friendly message on a 401 response", async () => {
    renderView();
    await waitFor(() => expect(yt.players).toHaveLength(1));
    stubFetchOnce({ ok: false, status: 401, body: { error: "Unauthorized" } });

    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/sign in/i);
  });

  it("shows a friendly message on a 400 response", async () => {
    renderView();
    await waitFor(() => expect(yt.players).toHaveLength(1));
    stubFetchOnce({ ok: false, status: 400, body: { error: "Invalid line" } });

    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't be scored/i);
  });

  it("hides the answer text until Reveal is pressed, and Hide re-hides it", async () => {
    renderView();
    await waitFor(() => expect(yt.players).toHaveLength(1));

    expect(screen.queryByText("こんにちは")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /reveal answer/i }));
    expect(screen.getByText("こんにちは")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /hide answer/i }));
    expect(screen.queryByText("こんにちは")).not.toBeInTheDocument();
  });

  it("moves to the next line, resetting the input and hiding the previous result", async () => {
    renderView();
    await waitFor(() => expect(yt.players).toHaveLength(1));

    stubFetchOnce({
      ok: true,
      body: { data: { accuracy: 100, diff: [{ type: "match", expected: "a", actual: "a" }] } },
    });

    await userEvent.type(screen.getByLabelText(/type what you hear/i), "test");
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(await screen.findByText("Accuracy: 100%")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /next line/i }));

    expect(screen.getByText("Line 2 of 2")).toBeInTheDocument();
    expect(screen.queryByText("Accuracy: 100%")).not.toBeInTheDocument();
    expect(screen.getByLabelText(/type what you hear/i)).toHaveValue("");
  });
});
