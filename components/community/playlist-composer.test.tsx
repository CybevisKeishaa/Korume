import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/render";
import userEvent from "@testing-library/user-event";
import { PlaylistComposer } from "./playlist-composer";

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

describe("PlaylistComposer", () => {
  it("posts name + description to /api/playlists and calls onCreated", async () => {
    const fetchSpy = mockFetchOnce({
      ok: true,
      status: 201,
      json: async () => ({ data: { id: "playlist-1", createdAt: "2026-07-14T00:00:00.000Z" } }),
    });
    const onCreated = vi.fn();
    render(<PlaylistComposer onCreated={onCreated} />);

    await userEvent.type(screen.getByRole("textbox", { name: /name/i }), "N4 vocab videos");
    await userEvent.type(screen.getByRole("textbox", { name: /description/i }), "Slow speech, N4 words.");
    await userEvent.click(screen.getByRole("button", { name: /create/i }));

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/playlists",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "N4 vocab videos", description: "Slow speech, N4 words." }),
      }),
    );
    expect(onCreated).toHaveBeenCalledTimes(1);
  });

  it("omits description when left blank", async () => {
    const fetchSpy = mockFetchOnce({ ok: true, status: 201, json: async () => ({ data: { id: "p1", createdAt: "x" } }) });
    render(<PlaylistComposer onCreated={vi.fn()} />);

    await userEvent.type(screen.getByRole("textbox", { name: /name/i }), "My list");
    await userEvent.click(screen.getByRole("button", { name: /create/i }));

    expect(fetchSpy).toHaveBeenCalledWith("/api/playlists", expect.objectContaining({ body: JSON.stringify({ name: "My list" }) }));
  });

  it("disables Create while name is empty", () => {
    render(<PlaylistComposer onCreated={vi.fn()} />);
    expect(screen.getByRole("button", { name: /create/i })).toBeDisabled();
  });

  it("shows a friendly error on failure", async () => {
    mockFetchOnce({ ok: false, status: 400 });
    render(<PlaylistComposer onCreated={vi.fn()} />);

    await userEvent.type(screen.getByRole("textbox", { name: /name/i }), "My list");
    await userEvent.click(screen.getByRole("button", { name: /create/i }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });
});
