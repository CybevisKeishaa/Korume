import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlaylistsPage } from "./playlists-page";

describe("PlaylistsPage", () => {
  it("shows My playlists by default and switches to Browse public on click", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 201, headers: new Headers(), json: async () => ({ data: { id: "p1", createdAt: "x" } }) }),
    );
    render(
      <PlaylistsPage
        initialMine={[]}
        initialPublic={{ playlists: [], nextCursor: null }}
      />,
    );

    expect(screen.getByText(/no playlists yet/i)).toBeVisible();

    await userEvent.click(screen.getByRole("tab", { name: /browse public/i }));

    expect(screen.getByText(/no public playlists/i)).toBeVisible();
    vi.unstubAllGlobals();
  });
});
