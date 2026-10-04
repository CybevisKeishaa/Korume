import { act, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { YT_PLAYER_STATE, type YtPlayerConfig } from "@/components/video-player/load-youtube-api";
import { installYouTubeStub, type FakeYtPlayer, type YouTubeStubHandle } from "@/test/youtube-stub";
import { render } from "@/test/render";
import { ClipPlayerProvider, HearInLessonButton } from "./clip-player";

const first = { lineId: "a", textJp: "First", startTime: 12, endTime: 14 };
const second = { lineId: "b", textJp: "Second", startTime: 24, endTime: null };
let yt: YouTubeStubHandle;
let frames: Map<number, FrameRequestCallback>;
let nextFrame: number;

function frame() {
  const pending = [...frames.values()];
  frames.clear();
  act(() => pending.forEach((callback) => callback(0)));
}

function firstPlayer(): FakeYtPlayer {
  const player = yt.players[0];
  if (!player) throw new Error("Expected one YouTube player");
  return player;
}

function fixture() {
  return render(
    <ClipPlayerProvider youtubeVideoId="yt-1">
      <HearInLessonButton source={first} label="Hear in lesson" />
      <HearInLessonButton source={second} label="Hear in lesson" />
    </ClipPlayerProvider>,
  );
}

async function open(index = 0) {
  const button = screen.getAllByRole("button", { name: "Hear in lesson" })[index];
  if (!button) throw new Error("Expected Hear in lesson button");
  await act(async () => { fireEvent.click(button); });
  return button;
}

beforeEach(() => {
  yt = installYouTubeStub();
  frames = new Map();
  nextFrame = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(++nextFrame, callback);
    return nextFrame;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => { frames.delete(id); });
});
afterEach(() => {
  yt.restore();
  vi.unstubAllGlobals();
});

describe("ClipPlayerProvider", () => {
  it("mounts one dock and reuses its player for a second line", async () => {
    fixture();
    await open();
    expect(screen.getAllByRole("region", { name: "Lesson clip" })).toHaveLength(1);
    expect(yt.players).toHaveLength(1);
    expect(firstPlayer().getCurrentTime()).toBe(12);
    expect(firstPlayer().getPlayerState()).toBe(YT_PLAYER_STATE.PLAYING);
    await open(1);
    expect(yt.players).toHaveLength(1);
    expect(firstPlayer().getCurrentTime()).toBe(24);
  });

  it("pauses at the line end and uses six seconds when end is null", async () => {
    fixture();
    await open();
    const player = firstPlayer();
    const pause = vi.spyOn(player, "pauseVideo");
    player.setCurrentTimeForTest(13.9);
    frame();
    expect(player.getPlayerState()).toBe(YT_PLAYER_STATE.PLAYING);
    player.setCurrentTimeForTest(14);
    frame();
    expect(player.getPlayerState()).toBe(YT_PLAYER_STATE.PAUSED);
    expect(pause).toHaveBeenCalledTimes(1);
    await open(1);
    player.setCurrentTimeForTest(30);
    frame();
    expect(player.getPlayerState()).toBe(YT_PLAYER_STATE.PAUSED);
    expect(pause).toHaveBeenCalledTimes(2);
  });

  it("keeps focus on open and returns it to the opener after Close", async () => {
    fixture();
    const opener = screen.getAllByRole("button", { name: "Hear in lesson" })[0];
    if (!opener) throw new Error("Expected opener");
    opener.focus();
    await open();
    expect(document.activeElement).toBe(opener);
    const close = screen.getByRole("button", { name: "Close clip player" });
    close.focus();
    fireEvent.click(close);
    expect(screen.queryByRole("region", { name: "Lesson clip" })).toBeNull();
    expect(firstPlayer().getPlayerState()).toBe(YT_PLAYER_STATE.PAUSED);
    expect(document.activeElement).toBe(opener);
  });

  it("destroys the player and cancels its frame loop on unmount", async () => {
    const { unmount } = fixture();
    await open();
    const player = firstPlayer();
    const currentTime = vi.spyOn(player, "getCurrentTime");
    unmount();
    expect(player.isDestroyedForTest()).toBe(true);
    expect(frames.size).toBe(0);
    frame();
    expect(currentTime).not.toHaveBeenCalled();
  });

  it("announces playing and paused from player state changes", async () => {
    fixture();
    await open();
    expect(screen.getByText("Playing the line")).toBeInTheDocument();
    act(() => firstPlayer().triggerStateChange(YT_PLAYER_STATE.PAUSED));
    expect(screen.getByText("Paused")).toBeInTheDocument();
  });

  it("keeps the YouTube controls enabled for unmuted playback", async () => {
    fixture();
    await open();
    expect(firstPlayer().playerVars).not.toHaveProperty("controls", 0);
  });

  it("constrains the iframe host and requests the dock dimensions", async () => {
    const OriginalPlayer = window.YT!.Player;
    let config: YtPlayerConfig | undefined;
    window.YT!.Player = class extends OriginalPlayer {
      constructor(element: string | HTMLElement, options: YtPlayerConfig) {
        super(element, options);
        config = options;
      }
    };
    fixture();
    await open();
    expect(config).toMatchObject({ width: "100%", height: "100%" });
    const dock = screen.getByRole("region", { name: "Lesson clip" });
    const wrapper = dock.querySelector(".aspect-video");
    expect(wrapper).toHaveClass("relative", "overflow-hidden");
    expect(wrapper?.firstElementChild).toHaveClass("absolute", "inset-0");
  });
  it("restarts the stop check when a second line plays while the first is still playing (no state event)", async () => {
    fixture();
    await open();
    const player = firstPlayer();
    vi.spyOn(player, "playVideo").mockImplementation(() => undefined); // already PLAYING: YouTube fires no new state
    await open(1);
    player.setCurrentTimeForTest(30);
    frame();
    expect(player.getPlayerState()).toBe(YT_PLAYER_STATE.PAUSED);
  });

  it("does not drive the player before onReady; the last requested line plays once it is ready", async () => {
    yt.restore();
    yt = installYouTubeStub({ autoReady: false });
    fixture();
    await open();
    const player = firstPlayer();
    const seek = vi.spyOn(player, "seekTo");
    await open(1);
    expect(seek).not.toHaveBeenCalled();
    act(() => player.triggerReady());
    expect(seek).toHaveBeenCalledTimes(1);
    expect(player.getCurrentTime()).toBe(24);
    expect(player.getPlayerState()).toBe(YT_PLAYER_STATE.PLAYING);
  });
});
