import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { JlptListeningPlayButton } from "./jlpt-listening-play-button";

const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

describe("JlptListeningPlayButton", () => {
  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => "blob:mock-audio-url");
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });

  it("fetches and plays synthesized audio for the given text, caching the blob for replay", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => ({
      ok: true,
      status: 200,
      blob: async () => new Blob([new Uint8Array([1, 2, 3])], { type: "audio/mpeg" }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);

    render(<JlptListeningPlayButton text="何時に行きますか。" />);
    await userEvent.click(screen.getByRole("button", { name: /play audio/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/speech/tts");
    expect(JSON.parse(init.body as string)).toMatchObject({ text: "何時に行きますか。" });

    // Replay reuses the cached blob instead of re-fetching.
    await userEvent.click(screen.getByRole("button", { name: /replay audio/i }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("degrades to a disabled button with a tooltip when TTS isn't configured (503)", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 503,
      json: async () => ({ error: "Speech synthesis is not configured" }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    render(<JlptListeningPlayButton text="こんにちは" />);
    await userEvent.click(screen.getByRole("button", { name: /play audio/i }));

    await waitFor(() => expect(screen.getByRole("button", { name: /play audio/i })).toBeDisabled());
    expect(screen.getByRole("button", { name: /play audio/i })).toHaveAttribute(
      "title",
      expect.stringMatching(/isn't set up yet/i),
    );
  });

  it("shows a retryable message on 429 without disabling the button", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 429,
      json: async () => ({ error: "Too many speech requests, slow down" }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    render(<JlptListeningPlayButton text="こんにちは" />);
    await userEvent.click(screen.getByRole("button", { name: /play audio/i }));

    await waitFor(() => expect(screen.getByText(/too many audio requests/i)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /play audio/i })).toBeEnabled();
  });
});
