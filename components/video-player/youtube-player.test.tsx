import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, waitFor } from "@testing-library/react";
import {
  installYouTubeStub,
  YT_PLAYER_STATE,
  type YouTubeStubHandle,
} from "@/test/youtube-stub";
import { YouTubePlayer, type YouTubePlayerHandle } from "./youtube-player";

describe("YouTubePlayer", () => {
  let yt: YouTubeStubHandle;

  beforeEach(() => {
    yt = installYouTubeStub({ duration: 90 });
  });

  afterEach(() => {
    yt.restore();
    vi.useRealTimers();
  });

  it("constructs a YT.Player for the given videoId and fires onReady", async () => {
    const onReady = vi.fn();
    render(<YouTubePlayer videoId="abc123" onReady={onReady} />);

    await waitFor(() => expect(yt.players).toHaveLength(1));
    expect(yt.players[0]?.videoId).toBe("abc123");
    expect(onReady).toHaveBeenCalledOnce();
  });

  it("exposes an imperative handle that proxies seek/play/pause/rate/duration to the player", async () => {
    const ref = createRef<YouTubePlayerHandle>();
    render(<YouTubePlayer ref={ref} videoId="abc123" />);
    await waitFor(() => expect(yt.players).toHaveLength(1));
    const player = yt.players[0]!;

    act(() => ref.current?.seekTo(42));
    expect(player.getCurrentTime()).toBe(42);

    act(() => ref.current?.play());
    expect(player.getPlayerState()).toBe(YT_PLAYER_STATE.PLAYING);

    act(() => ref.current?.pause());
    expect(player.getPlayerState()).toBe(YT_PLAYER_STATE.PAUSED);

    act(() => ref.current?.setPlaybackRate(1.25));
    expect(player.getPlaybackRate()).toBe(1.25);

    expect(ref.current?.getDuration()).toBe(90);
    expect(ref.current?.getPlayerState()).toBe(YT_PLAYER_STATE.PAUSED);
  });

  it("returns safe defaults from the handle before the player is ready", () => {
    const ref = createRef<YouTubePlayerHandle>();
    render(<YouTubePlayer ref={ref} videoId="abc123" />);
    // Synchronous assertions only — the fake player hasn't been constructed
    // yet (that happens in a microtask), so the handle must not throw.
    expect(ref.current?.getCurrentTime()).toBe(0);
    expect(ref.current?.getDuration()).toBe(0);
    expect(ref.current?.getPlayerState()).toBe(YT_PLAYER_STATE.UNSTARTED);
  });

  it("forwards every native state transition via onStateChange", async () => {
    const onStateChange = vi.fn();
    render(<YouTubePlayer videoId="abc123" onStateChange={onStateChange} />);
    await waitFor(() => expect(yt.players).toHaveLength(1));

    act(() => yt.players[0]!.triggerStateChange(YT_PLAYER_STATE.PLAYING));
    expect(onStateChange).toHaveBeenCalledWith(YT_PLAYER_STATE.PLAYING);

    act(() => yt.players[0]!.triggerStateChange(YT_PLAYER_STATE.PAUSED));
    expect(onStateChange).toHaveBeenCalledWith(YT_PLAYER_STATE.PAUSED);
  });

  it("polls onTick on an interval while PLAYING and stops polling once paused", async () => {
    const onTick = vi.fn();
    render(<YouTubePlayer videoId="abc123" onTick={onTick} tickIntervalMs={100} />);
    await waitFor(() => expect(yt.players).toHaveLength(1));
    const player = yt.players[0]!;

    vi.useFakeTimers();
    try {
      act(() => player.triggerStateChange(YT_PLAYER_STATE.PLAYING));
      player.setCurrentTimeForTest(5);
      act(() => {
        vi.advanceTimersByTime(250);
      });
      expect(onTick).toHaveBeenCalledWith(5);
      expect(onTick.mock.calls.length).toBeGreaterThanOrEqual(2);

      act(() => player.triggerStateChange(YT_PLAYER_STATE.PAUSED));
      onTick.mockClear();
      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(onTick).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("forwards native onError with the YouTube error code", async () => {
    const onError = vi.fn();
    render(<YouTubePlayer videoId="abc123" onError={onError} />);
    await waitFor(() => expect(yt.players).toHaveLength(1));

    act(() => yt.players[0]!.triggerError(150));

    expect(onError).toHaveBeenCalledWith(150);
  });

  it("stops onTick polling once an error fires", async () => {
    const onTick = vi.fn();
    render(<YouTubePlayer videoId="abc123" onTick={onTick} tickIntervalMs={100} />);
    await waitFor(() => expect(yt.players).toHaveLength(1));
    const player = yt.players[0]!;

    vi.useFakeTimers();
    try {
      act(() => player.triggerStateChange(YT_PLAYER_STATE.PLAYING));
      act(() => player.triggerError(150));
      onTick.mockClear();
      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(onTick).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("destroys the underlying player on unmount", async () => {
    const { unmount } = render(<YouTubePlayer videoId="abc123" />);
    await waitFor(() => expect(yt.players).toHaveLength(1));
    const player = yt.players[0]!;

    unmount();
    expect(player.isDestroyedForTest()).toBe(true);
  });
});
