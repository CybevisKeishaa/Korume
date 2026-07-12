import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  installYouTubeStub,
  YT_PLAYER_STATE,
  type YouTubeStubHandle,
} from "@/test/youtube-stub";
import { MiningClipPlayer } from "./mining-clip-player";

describe("MiningClipPlayer", () => {
  let yt: YouTubeStubHandle;

  beforeEach(() => {
    yt = installYouTubeStub({ duration: 90 });
  });

  afterEach(() => {
    yt.restore();
  });

  it("renders nothing playable when the card has no timestamps", () => {
    render(<MiningClipPlayer videoId="abc123" startTime={null} endTime={null} />);
    expect(screen.queryByRole("button", { name: /play clip/i })).not.toBeInTheDocument();
  });

  it("shows a Play clip button before the player is mounted", () => {
    render(<MiningClipPlayer videoId="abc123" startTime={10} endTime={15} />);
    expect(screen.getByRole("button", { name: /play clip/i })).toBeInTheDocument();
    expect(yt.players).toHaveLength(0);
  });

  it("mounts the player and seeks to startTime, then plays, on click", async () => {
    render(<MiningClipPlayer videoId="abc123" startTime={10} endTime={15} />);

    await userEvent.click(screen.getByRole("button", { name: /play clip/i }));
    await waitFor(() => expect(yt.players).toHaveLength(1));

    const player = yt.players[0]!;
    expect(player.getCurrentTime()).toBe(10);
    expect(player.getPlayerState()).toBe(YT_PLAYER_STATE.PLAYING);
  });

  it("pauses once playback reaches endTime", async () => {
    render(<MiningClipPlayer videoId="abc123" startTime={10} endTime={15} />);
    await userEvent.click(screen.getByRole("button", { name: /play clip/i }));
    await waitFor(() => expect(yt.players).toHaveLength(1));
    const player = yt.players[0]!;
    expect(player.getPlayerState()).toBe(YT_PLAYER_STATE.PLAYING);

    player.setCurrentTimeForTest(15);

    await waitFor(() => expect(player.getPlayerState()).toBe(YT_PLAYER_STATE.PAUSED));
  });

  it("offers a Replay clip control once mounted", async () => {
    render(<MiningClipPlayer videoId="abc123" startTime={10} endTime={15} />);
    await userEvent.click(screen.getByRole("button", { name: /play clip/i }));
    await waitFor(() => expect(yt.players).toHaveLength(1));

    expect(screen.getByRole("button", { name: /replay clip/i })).toBeInTheDocument();
  });
});
