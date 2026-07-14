import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlaylistList } from "./playlist-list";
import type { PlaylistListItem } from "@/lib/playlist-types";

function mockFetchOnce(response: { ok: boolean; status: number; headers?: Record<string, string>; json?: () => Promise<unknown> }): ReturnType<typeof vi.fn> {
  const fn = vi.fn().mockResolvedValue({
    ok: response.ok,
    status: response.status,
    headers: new Headers(response.headers ?? {}),
    json: response.json ?? (async () => ({})),
  } as Response);
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const playlists: PlaylistListItem[] = [
  { id: "p1", name: "N4 videos", description: "For beginners", isPublic: false, createdAt: "2026-07-14T00:00:00.000Z", itemCount: 3 },
];

describe("PlaylistList", () => {
  it("renders playlists with name, description, and item count", () => {
    render(<PlaylistList playlists={playlists} />);
    expect(screen.getByRole("link", { name: /N4 videos/i })).toHaveAttribute("href", "/playlists/p1");
    expect(screen.getByText("For beginners")).toBeInTheDocument();
    expect(screen.getByText(/3 videos/i)).toBeInTheDocument();
  });

  it("shows an empty state with no playlists", () => {
    render(<PlaylistList playlists={[]} />);
    expect(screen.getByText(/no playlists yet/i)).toBeInTheDocument();
  });

  it("toggles a playlist public with an explanation, via PATCH", async () => {
    const fetchSpy = mockFetchOnce({ ok: true, status: 200, json: async () => ({ data: { id: "p1" } }) });
    render(<PlaylistList playlists={playlists} />);

    const toggle = screen.getByRole("checkbox", { name: /make public/i });
    expect(screen.getByText(/visible to all signed-in users/i)).toBeInTheDocument();

    await userEvent.click(toggle);

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/playlists/p1",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ isPublic: true }) }),
    );
  });

  it("renames a playlist via PATCH", async () => {
    const fetchSpy = mockFetchOnce({ ok: true, status: 200, json: async () => ({ data: { id: "p1" } }) });
    render(<PlaylistList playlists={playlists} />);

    await userEvent.click(screen.getByRole("button", { name: /edit/i }));
    const nameBox = screen.getByRole("textbox", { name: /name/i });
    await userEvent.clear(nameBox);
    await userEvent.type(nameBox, "Renamed list");
    await userEvent.click(screen.getByRole("button", { name: /save/i }));

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/playlists/p1",
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(await screen.findByRole("link", { name: /Renamed list/i })).toBeInTheDocument();
  });

  it("deletes a playlist after confirming", async () => {
    mockFetchOnce({ ok: true, status: 204 });
    render(<PlaylistList playlists={playlists} />);

    await userEvent.click(screen.getByRole("button", { name: /^delete$/i }));
    await userEvent.click(screen.getByRole("button", { name: /yes/i }));

    expect(await screen.findByText(/no playlists yet/i)).toBeInTheDocument();
  });
});
