import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@/test/render";
import { installYouTubeStub, YT_PLAYER_STATE, type YouTubeStubHandle } from "@/test/youtube-stub";
import { DEFAULT_PREFERENCES } from "@/lib/preferences/options";
import type { WorkspaceBootstrap } from "@/lib/shadowing-workspace/bootstrap";
import { PlaybackRoot } from "./playback-root";
import { WorkspacePlayer } from "./workspace-player";
import { usePlaybackController, usePositionStore, useSession, WorkspaceProviders } from "./workspace-context";

vi.mock("@/lib/i18n/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const lines = [
  { id: "a", index: 0, startTime: 0, endTime: 3, textJp: "一つ目", textTranslation: null, furigana: null },
  { id: "b", index: 1, startTime: 3, endTime: 6, textJp: "二つ目", textTranslation: null, furigana: null },
  { id: "c", index: 2, startTime: 6, endTime: 9, textJp: "三つ目", textTranslation: null, furigana: null },
];
const bootstrap: WorkspaceBootstrap = {
  userId: "user-1",
  video: { id: "video-1", youtubeVideoId: "yt-1", title: "Episode", channelTitle: null, durationSeconds: 9, jlptLevel: "N3" },
  transcript: { id: "t-1", lines },
  masteryMap: {}, preferences: { ...DEFAULT_PREFERENCES }, resume: null, lessonBookmarked: false, marks: [],
};

let store: ReturnType<typeof usePositionStore> | undefined;
let sessionView: ReturnType<typeof useSession>[0] | undefined;
let controllerView: ReturnType<typeof usePlaybackController> | undefined;
function Probe(): null {
  store = usePositionStore();
  sessionView = useSession()[0];
  controllerView = usePlaybackController();
  return null;
}

function renderPlayer(onFullscreen = vi.fn(), workspaceBootstrap = bootstrap) {
  return render(
    <WorkspaceProviders bootstrap={workspaceBootstrap}>
      <PlaybackRoot userId="user-1" initialSyncedServerAt={null}>
        <WorkspacePlayer onFullscreen={onFullscreen} fullscreenAvailable />
        <Probe />
      </PlaybackRoot>
    </WorkspaceProviders>,
  );
}

describe("WorkspacePlayer", () => {
  let yt: YouTubeStubHandle;
  beforeEach(() => {
    yt = installYouTubeStub({ duration: 9, availablePlaybackRates: [0.25, 0.5, 0.75, 1, 1.5] });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 200 })));
  });
  afterEach(() => { yt.restore(); vi.unstubAllGlobals(); });

  it("draws every sentence start in one non-interactive svg", async () => {
    renderPlayer();
    const svg = screen.getByTestId("beat-markers");
    expect(document.querySelectorAll("svg[data-testid='beat-markers']")).toHaveLength(1);
    expect(svg.querySelectorAll("line")).toHaveLength(lines.length);
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg.querySelectorAll("[tabindex],button,a,input")).toHaveLength(0);
    await waitFor(() => expect(yt.players).toHaveLength(1));
  });

  it("overlays the current line and hides it with the subtitle toggle, whose name follows its state", async () => {
    renderPlayer();
    await waitFor(() => expect(yt.players).toHaveLength(1));
    act(() => store?.set(4));
    expect(screen.getByTestId("workspace-subtitle")).toHaveTextContent("二つ目");
    const toggle = screen.getByRole("button", { name: "Hide subtitles" });
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(toggle);
    expect(screen.queryByTestId("workspace-subtitle")).toBeNull();
    expect(screen.getByRole("button", { name: "Show subtitles" })).toHaveAttribute("aria-pressed", "false");
  });

  it("seeks with the progress bar, the only seek control", async () => {
    renderPlayer();
    await waitFor(() => expect(yt.players).toHaveLength(1));
    fireEvent.change(screen.getByRole("slider", { name: "Seek" }), { target: { value: "6.5" } });
    expect(yt.players[0]!.getCurrentTime()).toBe(6.5);
    expect(store?.get()).toBe(6.5);
  });

  it("learns a missing duration for every consumer and persists it only once", async () => {
    yt.restore();
    yt = installYouTubeStub({ autoReady: false, duration: 120, availablePlaybackRates: [0.25, 0.5, 0.75, 1, 1.5] });
    const missingDuration = { ...bootstrap, video: { ...bootstrap.video, durationSeconds: null } };
    const missing = renderPlayer(vi.fn(), missingDuration);
    await waitFor(() => expect(yt.players).toHaveLength(1));
    act(() => {
      yt.players[0]!.triggerReady();
      yt.players[0]!.triggerReady();
    });
    await waitFor(() => expect(screen.getByRole("slider", { name: "Seek" })).toHaveAttribute("max", "120"));
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith("/api/videos/video-1", expect.objectContaining({
      method: "PATCH", body: JSON.stringify({ durationSeconds: 120 }),
    }));
    missing.unmount();

    vi.mocked(fetch).mockClear();
    yt.restore();
    yt = installYouTubeStub({ duration: 9, availablePlaybackRates: [0.25, 0.5, 0.75, 1, 1.5] });
    renderPlayer();
    await waitFor(() => expect(yt.players).toHaveLength(1));
    expect(fetch).not.toHaveBeenCalled();
  });

  it("shows the centre play button only while paused", async () => {
    renderPlayer();
    await waitFor(() => expect(yt.players).toHaveLength(1));
    const player = yt.players[0]!;
    expect(screen.getAllByRole("button", { name: "Play" })).toHaveLength(2);
    act(() => player.triggerStateChange(YT_PLAYER_STATE.PLAYING));
    expect(screen.queryAllByRole("button", { name: "Play" })).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
    act(() => player.triggerStateChange(YT_PLAYER_STATE.PAUSED));
    const play = vi.spyOn(player, "playVideo");
    fireEvent.click(screen.getAllByRole("button", { name: "Play" })[0]!);
    expect(play).toHaveBeenCalledOnce();
  });

  it("replaces the centre button with an alert when the embed fails", async () => {
    renderPlayer();
    await waitFor(() => expect(yt.players).toHaveLength(1));
    act(() => yt.players[0]!.triggerError(150));
    expect(screen.getByRole("alert")).toHaveTextContent("This video can't be played here.");
    expect(screen.getAllByRole("button", { name: "Play" })).toHaveLength(1);
  });

  it("labels mute from the state before toggling, not the iframe's lagging cache", async () => {
    renderPlayer();
    await waitFor(() => expect(yt.players).toHaveLength(1));
    const player = yt.players[0]!;
    // The real IFrame API answers isMuted() from a cache the iframe updates asynchronously.
    vi.spyOn(player, "mute").mockImplementation(() => undefined);
    fireEvent.click(screen.getByRole("button", { name: "Mute" }));
    expect(screen.getByRole("button", { name: "Unmute" })).toHaveAttribute("aria-pressed", "true");
  });

  it("sets the session loop count from the Sentence popover and reflects it on the pill", async () => {
    renderPlayer();
    await waitFor(() => expect(yt.players).toHaveLength(1));
    const pill = () => screen.getByRole("button", { name: "Sentence loop" });
    const choose = (label: string) => {
      fireEvent.click(pill());
      fireEvent.click(within(screen.getByRole("radiogroup", { name: "Plays per sentence" })).getByRole("radio", { name: label }));
    };
    expect(pill()).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(pill());
    expect(sessionView?.openPopover).toBe("sentence-loop");
    fireEvent.click(pill());
    choose("3×");
    expect(pill()).toHaveAttribute("aria-pressed", "true");
    expect(controllerView?.loopConfig()).toMatchObject({ enabled: true, count: 3 });
    expect(sessionView?.openPopover).toBeNull();
    choose("∞");
    expect(controllerView?.loopConfig()).toMatchObject({ enabled: true, count: 0 });
    choose("1×");
    expect(pill()).toHaveAttribute("aria-pressed", "false");
    expect(controllerView?.loopConfig()).toMatchObject({ enabled: false, count: 1 });
    expect(fetch).not.toHaveBeenCalledWith("/api/user/preferences", expect.anything());
  });

  it("lists only the rates this player offers and that the app supports, and sets the chosen one", async () => {
    renderPlayer();
    await waitFor(() => expect(yt.players).toHaveLength(1));
    fireEvent.click(screen.getByRole("button", { name: "Playback speed 1×" }));
    const group = screen.getByRole("radiogroup", { name: "Playback speed" });
    expect(within(group).getAllByRole("radio").map((radio) => radio.textContent)).toEqual(["0.5×", "0.75×", "1×", "1.5×"]);
    fireEvent.click(within(group).getByRole("radio", { name: "0.75×" }));
    expect(yt.players[0]!.getPlaybackRate()).toBe(0.75);
    expect(screen.getByRole("button", { name: "Playback speed 0.75×" })).toBeInTheDocument();
  });

  it("drives the transport buttons through the controller", async () => {
    const onFullscreen = vi.fn();
    renderPlayer(onFullscreen);
    await waitFor(() => expect(yt.players).toHaveLength(1));
    act(() => store?.set(4));
    fireEvent.click(screen.getByRole("button", { name: "Next sentence" }));
    expect(yt.players[0]!.getCurrentTime()).toBe(6);
    fireEvent.click(screen.getByRole("button", { name: "Back 5 seconds" }));
    expect(yt.players[0]!.getCurrentTime()).toBe(1);
    fireEvent.click(screen.getByRole("button", { name: "Mute" }));
    expect(yt.players[0]!.isMuted()).toBe(true);
    expect(screen.getByRole("button", { name: "Unmute" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Player fullscreen" }));
    expect(onFullscreen).toHaveBeenCalledOnce();
  });

  it("lays its own bar over the video with YouTube's bar off; a click on the video toggles play; the bar idles out", async () => {
    renderPlayer();
    await waitFor(() => expect(yt.players).toHaveLength(1));
    const player = yt.players[0]!;
    expect(player.playerVars).toMatchObject({ controls: 0 });
    const video = document.querySelector<HTMLElement>("[data-workspace-player-video]")!;
    const bar = document.querySelector<HTMLElement>("[data-workspace-player-controls]")!.parentElement!;
    expect(video).toContainElement(bar);
    expect(bar).toHaveAttribute("data-shown");
    const surface = screen.getByTestId("workspace-player-surface");
    fireEvent.click(surface);
    expect(player.getPlayerState()).toBe(YT_PLAYER_STATE.PLAYING);
    expect(bar).not.toHaveAttribute("data-shown");
    fireEvent.pointerMove(video);
    expect(bar).toHaveAttribute("data-shown");
    fireEvent.pointerLeave(video);
    expect(bar).not.toHaveAttribute("data-shown");
    vi.useFakeTimers();
    try {
      fireEvent.pointerMove(video);
      act(() => { vi.advanceTimersByTime(2499); });
      expect(bar).toHaveAttribute("data-shown");
      act(() => { vi.advanceTimersByTime(1); });
      expect(bar).not.toHaveAttribute("data-shown");
    } finally {
      vi.useRealTimers();
    }
    fireEvent.click(surface);
    expect(player.getPlayerState()).toBe(YT_PLAYER_STATE.PAUSED);
    expect(bar).toHaveAttribute("data-shown");
  });
});
