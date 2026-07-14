import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PublicPlaylistList } from "./public-playlist-list";
import type { PublicPlaylistsPage } from "@/lib/playlist-types";

function mockFetchOnce(response: { ok: boolean; status: number; json?: () => Promise<unknown> }): ReturnType<typeof vi.fn> {
  const fn = vi.fn().mockResolvedValue({ ok: response.ok, status: response.status, headers: new Headers(), json: response.json ?? (async () => ({})) } as Response);
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const initialPage: PublicPlaylistsPage = {
  playlists: [
    {
      id: "p1",
      name: "Slow Japanese",
      description: "Beginner friendly",
      createdAt: "2026-07-14T00:00:00.000Z",
      owner: { id: "user-1", name: "Alice", avatarUrl: null },
      itemCount: 5,
    },
  ],
  nextCursor: "2026-07-13T00:00:00.000Z",
};

describe("PublicPlaylistList", () => {
  it("renders public playlists with owner name and item count, linking to detail", () => {
    render(<PublicPlaylistList initialPage={initialPage} />);
    expect(screen.getByRole("link", { name: /Slow Japanese/i })).toHaveAttribute("href", "/playlists/p1");
    expect(screen.getByText(/alice/i)).toBeInTheDocument();
    expect(screen.getByText(/5 videos/i)).toBeInTheDocument();
  });

  it("shows an empty state with no public playlists", () => {
    render(<PublicPlaylistList initialPage={{ playlists: [], nextCursor: null }} />);
    expect(screen.getByText(/no public playlists/i)).toBeInTheDocument();
  });

  it("loads more via cursor", async () => {
    const fetchSpy = mockFetchOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: { playlists: [{ ...initialPage.playlists[0], id: "p2", name: "More videos" }], nextCursor: null } }),
    });
    render(<PublicPlaylistList initialPage={initialPage} />);

    await userEvent.click(screen.getByRole("button", { name: /load more/i }));

    expect(fetchSpy).toHaveBeenCalledWith("/api/playlists/public?cursor=2026-07-13T00%3A00%3A00.000Z");
    expect(await screen.findByText("More videos")).toBeInTheDocument();
  });
});
