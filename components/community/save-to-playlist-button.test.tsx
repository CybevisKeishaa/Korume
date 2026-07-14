import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SaveToPlaylistButton } from "./save-to-playlist-button";

function mockFetchSequence(responses: Array<{ ok: boolean; status: number; json?: unknown; headers?: Record<string, string> }>): ReturnType<typeof vi.fn> {
  const fn = vi.fn();
  for (const r of responses) {
    fn.mockResolvedValueOnce({
      ok: r.ok,
      status: r.status,
      headers: new Headers(r.headers ?? {}),
      json: async () => r.json ?? {},
    } as Response);
  }
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SaveToPlaylistButton", () => {
  it("lazily fetches the caller's playlists when opened", async () => {
    const fetchSpy = mockFetchSequence([
      { ok: true, status: 200, json: { data: [{ id: "p1", name: "N4 videos", description: null, isPublic: false, createdAt: "x", itemCount: 2 }] } },
    ]);
    render(<SaveToPlaylistButton videoId="video-1" />);

    expect(fetchSpy).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: /save to playlist/i }));

    expect(await screen.findByRole("button", { name: "N4 videos" })).toBeInTheDocument();
    expect(fetchSpy).toHaveBeenCalledWith("/api/playlists");
  });

  it("adds the video to an existing playlist", async () => {
    const fetchSpy = mockFetchSequence([
      { ok: true, status: 200, json: { data: [{ id: "p1", name: "N4 videos", description: null, isPublic: false, createdAt: "x", itemCount: 2 }] } },
      { ok: true, status: 201, json: { data: { videoId: "video-1", orderIndex: 2 } } },
    ]);
    render(<SaveToPlaylistButton videoId="video-1" />);

    await userEvent.click(screen.getByRole("button", { name: /save to playlist/i }));
    await userEvent.click(await screen.findByRole("button", { name: "N4 videos" }));

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/playlists/p1/items",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ videoId: "video-1" }) }),
    );
    expect(await screen.findByText(/added/i)).toBeInTheDocument();
  });

  it("treats a 409 (already in playlist) as success", async () => {
    mockFetchSequence([
      { ok: true, status: 200, json: { data: [{ id: "p1", name: "N4 videos", description: null, isPublic: false, createdAt: "x", itemCount: 2 }] } },
      { ok: false, status: 409 },
    ]);
    render(<SaveToPlaylistButton videoId="video-1" />);

    await userEvent.click(screen.getByRole("button", { name: /save to playlist/i }));
    await userEvent.click(await screen.findByRole("button", { name: "N4 videos" }));

    expect(await screen.findByText(/already in that playlist/i)).toBeInTheDocument();
  });

  it("creates a new playlist and adds the video to it", async () => {
    const fetchSpy = mockFetchSequence([
      { ok: true, status: 200, json: { data: [] } },
      { ok: true, status: 201, json: { data: { id: "p2", createdAt: "2026-07-14T00:00:00.000Z" } } },
      { ok: true, status: 201, json: { data: { videoId: "video-1", orderIndex: 0 } } },
    ]);
    render(<SaveToPlaylistButton videoId="video-1" />);

    await userEvent.click(screen.getByRole("button", { name: /save to playlist/i }));
    await userEvent.type(await screen.findByRole("textbox", { name: /new playlist name/i }), "Fresh list");
    await userEvent.click(screen.getByRole("button", { name: /create.*add/i }));

    expect(fetchSpy).toHaveBeenCalledWith("/api/playlists", expect.objectContaining({ method: "POST", body: JSON.stringify({ name: "Fresh list" }) }));
    expect(fetchSpy).toHaveBeenCalledWith("/api/playlists/p2/items", expect.objectContaining({ method: "POST" }));
    expect(await screen.findByText(/added/i)).toBeInTheDocument();
  });

  it("is keyboard operable: Escape closes the popover and returns focus to the trigger", async () => {
    mockFetchSequence([{ ok: true, status: 200, json: { data: [] } }]);
    render(<SaveToPlaylistButton videoId="video-1" />);

    const trigger = screen.getByRole("button", { name: /save to playlist/i });
    await userEvent.click(trigger);
    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("textbox", { name: /new playlist name/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save to playlist/i })).toHaveFocus();
  });
});
