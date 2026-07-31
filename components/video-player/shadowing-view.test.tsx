import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@/test/render";
import userEvent from "@testing-library/user-event";
import { ReadonlyURLSearchParams, useSearchParams } from "next/navigation";
import { ThemeProvider } from "@/components/providers/theme-provider";
import {
  FakeYtPlayer,
  installYouTubeStub,
  YT_PLAYER_STATE,
  type YouTubeStubHandle,
} from "@/test/youtube-stub";
import type { TranscriptWithLines, VideoRow } from "@/lib/video-types";
import { ShadowingView } from "./shadowing-view";

// Only `useSearchParams` is faked — the rest of `next/navigation` (including
// the real `ReadonlyURLSearchParams` used below) stays intact so nothing else
// in the render tree loses its navigation module.
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useSearchParams: vi.fn(),
}));

/** What `useSearchParams()` returns on the next render. Defaults to no params. */
function setSearchParams(query = ""): void {
  vi.mocked(useSearchParams).mockReturnValue(new ReadonlyURLSearchParams(query));
}

const VIDEO: VideoRow = {
  id: "11111111-1111-1111-1111-111111111111",
  youtube_video_id: "abc123",
  title: "Test Video",
  duration_seconds: null,
  thumbnail_url: null,
  jlpt_level_estimate: null,
  added_by_user_id: "user-1",
  library_access: "FREE",
  promotion_starred: false,
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
      furigana_json: [{ text: "こんにちは" }],
    },
    {
      id: "line-2",
      start_time: 3,
      end_time: 6,
      text_jp: "学校",
      text_translation: "School",
      furigana_json: [{ text: "学校", reading: "がっこう" }],
    },
    {
      id: "line-3",
      start_time: 6,
      end_time: null,
      text_jp: "さようなら",
      text_translation: "Goodbye",
      furigana_json: [{ text: "さようなら" }],
    },
  ],
};

interface FetchCall {
  url: string;
  method: string | undefined;
  body: unknown;
}

function mockFetch(): FetchCall[] {
  const calls: FetchCall[] = [];
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({
      url,
      method: init?.method,
      body: init?.body ? JSON.parse(init.body as string) : undefined,
    });
    // The video summary panel (Layer 4) GETs its own endpoint on mount; every
    // video in this suite has no summary generated yet.
    if (url.endsWith("/summary") && (init?.method ?? "GET") === "GET") {
      return { ok: false, status: 404, json: async () => ({ error: "No summary yet" }) } as Response;
    }
    return { ok: true, json: async () => ({}) } as Response;
  });
  vi.stubGlobal("fetch", fn);
  return calls;
}

function renderView(
  video: VideoRow = VIDEO,
  transcript: TranscriptWithLines | null = TRANSCRIPT,
  masteryMap: Record<string, number> = {},
) {
  return render(
    <ThemeProvider>
      <ShadowingView video={video} transcript={transcript} masteryMap={masteryMap} />
    </ThemeProvider>,
  );
}

describe("ShadowingView", () => {
  let yt: YouTubeStubHandle;
  let fetchCalls: FetchCall[];

  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    // No `?line=` unless a test opts in — every assertion below the deep-link
    // ones describes the plain-arrival behavior.
    setSearchParams();
    yt = installYouTubeStub({ duration: 90 });
    fetchCalls = mockFetch();
  });

  afterEach(() => {
    yt.restore();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("shows a no-transcript hint when the video has no transcript yet", async () => {
    renderView(VIDEO, null);
    await waitFor(() => expect(yt.players).toHaveLength(1));
    // Exact-text match (not the regex containment check below) so this
    // proves the wired copy, not just a substring survives.
    expect(screen.getByText("No transcript yet")).toBeInTheDocument();
    expect(
      screen.getByText(
        "This video doesn't have a transcript to shadow against yet. Transcript submission is coming soon.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /こんにちは/ })).not.toBeInTheDocument();
  });

  it("highlights the transcript line matching the current playback time as it advances", async () => {
    renderView();
    await waitFor(() => expect(yt.players).toHaveLength(1));
    const player = yt.players[0]!;

    // Before any tick, currentTime is 0 — line-1 (0–3) is active by default.
    expect(screen.getByRole("button", { name: /こんにちは/ })).toHaveAttribute(
      "aria-current",
      "true",
    );

    vi.useFakeTimers();
    try {
      act(() => player.triggerStateChange(YT_PLAYER_STATE.PLAYING));
      player.setCurrentTimeForTest(4);
      act(() => {
        vi.advanceTimersByTime(250);
      });
    } finally {
      vi.useRealTimers();
    }

    expect(screen.getByRole("button", { name: /学校/ })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(screen.getByRole("button", { name: /こんにちは/ })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("clicking a transcript line seeks the player there and plays", async () => {
    renderView();
    await waitFor(() => expect(yt.players).toHaveLength(1));
    const player = yt.players[0]!;

    await userEvent.click(screen.getByRole("button", { name: /さようなら/ }));

    expect(player.getCurrentTime()).toBe(6);
    expect(player.getPlayerState()).toBe(YT_PLAYER_STATE.PLAYING);
  });

  it("changes the playback rate via the speed control", async () => {
    renderView();
    await waitFor(() => expect(yt.players).toHaveLength(1));
    const player = yt.players[0]!;

    const fast = screen.getByRole("radio", { name: "1.25x" });
    await userEvent.click(fast);

    expect(player.getPlaybackRate()).toBe(1.25);
    expect(fast).toHaveAttribute("aria-checked", "true");
  });

  it("A–B loop: seeks back to A once playback passes B", async () => {
    renderView();
    await waitFor(() => expect(yt.players).toHaveLength(1));
    const player = yt.players[0]!;

    vi.useFakeTimers();
    try {
      act(() => player.triggerStateChange(YT_PLAYER_STATE.PLAYING));

      player.setCurrentTimeForTest(1);
      act(() => {
        vi.advanceTimersByTime(250);
      });
      fireEvent.click(screen.getByRole("button", { name: /set a/i }));

      player.setCurrentTimeForTest(5);
      act(() => {
        vi.advanceTimersByTime(250);
      });
      fireEvent.click(screen.getByRole("button", { name: /set b/i }));

      player.setCurrentTimeForTest(6);
      act(() => {
        vi.advanceTimersByTime(250);
      });

      expect(player.getCurrentTime()).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("toggles translation independently of the furigana mode", async () => {
    renderView();
    await waitFor(() => expect(yt.players).toHaveLength(1));

    const translationToggle = screen.getByRole("button", { name: "Translation" });
    expect(screen.getByText("School")).toBeInTheDocument();

    await userEvent.click(translationToggle);
    expect(screen.queryByText("School")).not.toBeInTheDocument();
    expect(translationToggle).toHaveAttribute("aria-pressed", "false");
  });

  it("defaults to adaptive furigana, showing readings when nothing is mastered yet", async () => {
    renderView();
    await waitFor(() => expect(yt.players).toHaveLength(1));

    expect(screen.getByRole("radio", { name: "Adaptive" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("button", { name: /学校/ }).textContent).toContain("がっこう");
  });

  it("adaptive furigana hides the reading for a word already in masteryMap", async () => {
    renderView(VIDEO, TRANSCRIPT, { 学校: 2 });
    await waitFor(() => expect(yt.players).toHaveLength(1));

    const button = screen.getByRole("button", { name: /学校/ });
    expect(button.textContent).toContain("学校");
    expect(button.textContent).not.toContain("がっこう");
  });

  it("switching to All always shows every reading, overriding mastery", async () => {
    renderView(VIDEO, TRANSCRIPT, { 学校: 2 });
    await waitFor(() => expect(yt.players).toHaveLength(1));

    await userEvent.click(screen.getByRole("radio", { name: "All" }));
    expect(screen.getByRole("button", { name: /学校/ }).textContent).toContain("がっこう");
  });

  it("switching to Off hides every reading regardless of mastery", async () => {
    renderView();
    await waitFor(() => expect(yt.players).toHaveLength(1));

    await userEvent.click(screen.getByRole("radio", { name: "Off" }));
    const button = screen.getByRole("button", { name: /学校/ });
    expect(button.textContent).not.toContain("がっこう");
  });

  it("reports duration once after the player is ready, when the video has none yet", async () => {
    renderView();
    await waitFor(() => expect(yt.players).toHaveLength(1));

    const durationCall = fetchCalls.find((c) => c.url === `/api/videos/${VIDEO.id}`);
    expect(durationCall).toBeDefined();
    expect(durationCall?.method).toBe("PATCH");
    expect(durationCall?.body).toEqual({ durationSeconds: 90 });
  });

  it("does not report duration when the video already has one", async () => {
    renderView({ ...VIDEO, duration_seconds: 120 }, TRANSCRIPT);
    await waitFor(() => expect(yt.players).toHaveLength(1));

    const durationCall = fetchCalls.find((c) => c.url === `/api/videos/${VIDEO.id}`);
    expect(durationCall).toBeUndefined();
  });

  it("saves watch progress on pause", async () => {
    renderView();
    await waitFor(() => expect(yt.players).toHaveLength(1));
    const player = yt.players[0]!;
    player.setCurrentTimeForTest(12);

    act(() => player.triggerStateChange(YT_PLAYER_STATE.PAUSED));

    const progressCall = fetchCalls.find((c) => c.url === `/api/videos/${VIDEO.id}/progress`);
    expect(progressCall).toBeDefined();
    expect(progressCall?.method).toBe("PATCH");
    expect(progressCall?.body).toEqual({ position: 12 });
  });

  it("marks progress completed when playback ends", async () => {
    renderView();
    await waitFor(() => expect(yt.players).toHaveLength(1));
    const player = yt.players[0]!;
    player.setCurrentTimeForTest(90);

    act(() => player.triggerStateChange(YT_PLAYER_STATE.ENDED));

    const progressCall = fetchCalls.find((c) => c.url === `/api/videos/${VIDEO.id}/progress`);
    expect(progressCall?.body).toEqual({ position: 90, completed: true });
  });

  it("shows a shadowing record control for the active transcript line", async () => {
    renderView();
    await waitFor(() => expect(yt.players).toHaveLength(1));

    expect(screen.getByRole("button", { name: /^record$/i })).toBeInTheDocument();
  });

  it("does not show a record control when the video has no transcript", async () => {
    renderView(VIDEO, null);
    await waitFor(() => expect(yt.players).toHaveLength(1));

    expect(screen.queryByRole("button", { name: /^record$/i })).not.toBeInTheDocument();
  });

  it("shows an accessible error state when the player reports an error (e.g. region-locked video)", async () => {
    renderView();
    await waitFor(() => expect(yt.players).toHaveLength(1));
    const player = yt.players[0]!;

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    act(() => player.triggerError(150));

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/can't be played here/i);
    // Exact-text matches for both lines of the alert — the toHaveTextContent
    // check above is a containment match (binding pattern), so it alone
    // cannot prove the second sentence made it through unmutated.
    expect(screen.getByText("This video can't be played here.")).toBeInTheDocument();
    expect(
      screen.getByText("It may be region-locked, private, or unavailable for embedding."),
    ).toBeInTheDocument();
  });

  it("seeks to the ?line= target once the player is ready (journal deep link)", async () => {
    setSearchParams("line=line-2");
    renderView();
    await waitFor(() => expect(yt.players).toHaveLength(1));

    expect(yt.players[0]?.getCurrentTime()).toBe(3);
    expect(screen.getByRole("button", { name: /学校/ })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("button", { name: /こんにちは/ })).not.toHaveAttribute("aria-current");
  });

  it("follows the ?line= deep link even when the video already reported a duration", async () => {
    // The duration report is a one-shot that used to return early out of the
    // ready handler — a deep link into an already-measured video (i.e. every
    // video the Journal can link to) must still land on its line.
    setSearchParams("line=line-3");
    renderView({ ...VIDEO, duration_seconds: 120 }, TRANSCRIPT);
    await waitFor(() => expect(yt.players).toHaveLength(1));

    expect(yt.players[0]?.getCurrentTime()).toBe(6);
    expect(screen.getByRole("button", { name: /さようなら/ })).toHaveAttribute(
      "aria-current",
      "true",
    );
  });

  it("ignores an unknown ?line= id", async () => {
    setSearchParams("line=no-such-line");
    const seekSpy = vi.spyOn(FakeYtPlayer.prototype, "seekTo");
    try {
      renderView();
      await waitFor(() => expect(yt.players).toHaveLength(1));

      expect(seekSpy).not.toHaveBeenCalled();
      expect(yt.players[0]?.getCurrentTime()).toBe(0);
      expect(screen.getByRole("button", { name: /こんにちは/ })).toHaveAttribute(
        "aria-current",
        "true",
      );
    } finally {
      seekSpy.mockRestore();
    }
  });
});
