import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlaylistDetail } from "./playlist-detail";
import type { PlaylistDetail as PlaylistDetailType } from "@/lib/playlist-types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

function mockFetchOnce(response: { ok: boolean; status: number; json?: () => Promise<unknown> }): ReturnType<typeof vi.fn> {
  const fn = vi.fn().mockResolvedValue({ ok: response.ok, status: response.status, headers: new Headers(), json: response.json ?? (async () => ({})) } as Response);
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const playlist: PlaylistDetailType = {
  id: "p1",
  name: "N4 videos",
  description: "For beginners",
  isPublic: false,
  createdAt: "2026-07-14T00:00:00.000Z",
  owner: { id: "user-1", name: "Alice", avatarUrl: null },
  items: [
    { videoId: "v1", orderIndex: 0, title: "Video A", thumbnailUrl: null },
    { videoId: "v2", orderIndex: 1, title: "Video B", thumbnailUrl: null },
  ],
};

describe("PlaylistDetail", () => {
  it("renders items in order with title", () => {
    render(<PlaylistDetail playlist={playlist} isOwner />);
    const titles = screen.getAllByText(/Video [AB]/);
    expect(titles.map((t) => t.textContent)).toEqual(["Video A", "Video B"]);
  });

  it("hides owner-only controls (remove, reorder, edit) for non-owners", () => {
    render(<PlaylistDetail playlist={playlist} isOwner={false} />);
    expect(screen.queryByRole("button", { name: /remove/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /move down/i })).not.toBeInTheDocument();
  });

  it("removes an item via DELETE", async () => {
    const fetchSpy = mockFetchOnce({ ok: true, status: 204 });
    render(<PlaylistDetail playlist={playlist} isOwner />);

    const removeButtons = screen.getAllByRole("button", { name: /remove/i });
    await userEvent.click(removeButtons[0]!);

    expect(fetchSpy).toHaveBeenCalledWith("/api/playlists/p1/items/v1", expect.objectContaining({ method: "DELETE" }));
    expect(await screen.findByText("Video B")).toBeInTheDocument();
    expect(screen.queryByText("Video A")).not.toBeInTheDocument();
  });

  it("moves an item down via PATCH, swapping order", async () => {
    const fetchSpy = mockFetchOnce({ ok: true, status: 200, json: async () => ({ data: { videoId: "v1", orderIndex: 1 } }) });
    render(<PlaylistDetail playlist={playlist} isOwner />);

    await userEvent.click(screen.getAllByRole("button", { name: /move down/i })[0]!);

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/playlists/p1/items",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ videoId: "v1", orderIndex: 1 }) }),
    );
  });

  it("disables moving the first item up and the last item down", () => {
    render(<PlaylistDetail playlist={playlist} isOwner />);
    const upButtons = screen.getAllByRole("button", { name: /move up/i });
    const downButtons = screen.getAllByRole("button", { name: /move down/i });
    expect(upButtons[0]).toBeDisabled();
    expect(downButtons[1]).toBeDisabled();
  });

  it("shows an empty state when the playlist has no items", () => {
    render(<PlaylistDetail playlist={{ ...playlist, items: [] }} isOwner />);
    expect(screen.getByText(/no videos in this playlist/i)).toBeInTheDocument();
  });
});
