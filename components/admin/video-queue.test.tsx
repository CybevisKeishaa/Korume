import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@/test/render";
import userEvent from "@testing-library/user-event";
import { VideoQueue } from "./video-queue";
import type { PendingVideoListItem, PendingVideosPage } from "@/lib/admin-ui-types";

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    json: async () => body,
  } as Response;
}

function video(overrides: Partial<PendingVideoListItem> = {}): PendingVideoListItem {
  return {
    id: "v1",
    youtube_video_id: "yt1",
    title: "Learn Japanese Ep. 1",
    duration_seconds: 300,
    thumbnail_url: "https://img.example/yt1.jpg",
    jlpt_level_estimate: "N4",
    added_by_user_id: "u1",
    created_at: "2026-07-10T00:00:00.000Z",
    importerName: "Alice",
    hasTranscript: false,
    transcriptLineCount: 0,
    ...overrides,
  };
}

function page(overrides: Partial<PendingVideosPage> = {}): PendingVideosPage {
  return { items: [video()], nextCursor: null, ...overrides };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("VideoQueue", () => {
  it("fetches and renders the pending queue with importer + transcript badge", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { data: page() })));
    render(<VideoQueue />);

    expect(await screen.findByText("Learn Japanese Ep. 1")).toBeInTheDocument();
    expect(screen.getByText(/Alice/)).toBeInTheDocument();
    expect(screen.getByText(/no transcript/i)).toBeInTheDocument();
  });

  it("shows a transcript line count badge when a transcript exists", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(200, { data: page({ items: [video({ hasTranscript: true, transcriptLineCount: 42 })] }) })),
    );
    render(<VideoQueue />);
    expect(await screen.findByText(/42 lines/i)).toBeInTheDocument();
  });

  it("shows an error state when the list fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(403, { error: "Forbidden" })));
    render(<VideoQueue />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not load/i);
  });

  it("shows a calm empty state when there is nothing pending", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { data: page({ items: [] }) })));
    render(<VideoQueue />);
    expect(await screen.findByText(/no videos.*waiting/i)).toBeInTheDocument();
  });

  it("approves a video and removes it from the queue", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { data: page() }))
      .mockResolvedValueOnce(jsonResponse(200, { data: { id: "v1", status: "approved" } }));
    vi.stubGlobal("fetch", fetchMock);

    render(<VideoQueue />);
    await screen.findByText("Learn Japanese Ep. 1");

    await userEvent.click(screen.getByRole("button", { name: /approve/i }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith("/api/admin/videos/v1/approve", expect.objectContaining({ method: "POST" })),
    );
    await waitFor(() => expect(screen.queryByText("Learn Japanese Ep. 1")).not.toBeInTheDocument());
  });

  it("rejecting opens a destructive confirm dialog naming permanent removal, and only calls the API on confirm", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { data: page() }));
    vi.stubGlobal("fetch", fetchMock);

    render(<VideoQueue />);
    await screen.findByText("Learn Japanese Ep. 1");

    await userEvent.click(screen.getByRole("button", { name: /reject/i }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/permanently removed/i)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1); // no reject call yet

    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: { id: "v1" } }));
    await userEvent.click(within(dialog).getByRole("button", { name: /reject/i }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith(
        "/api/admin/videos/v1/reject",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    await waitFor(() => expect(screen.queryByText("Learn Japanese Ep. 1")).not.toBeInTheDocument());
  });

  it("sends an optional reason with the reject request", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { data: page() }))
      .mockResolvedValueOnce(jsonResponse(200, { data: { id: "v1" } }));
    vi.stubGlobal("fetch", fetchMock);

    render(<VideoQueue />);
    await screen.findByText("Learn Japanese Ep. 1");
    await userEvent.click(screen.getByRole("button", { name: /reject/i }));
    const dialog = await screen.findByRole("dialog");

    await userEvent.type(within(dialog).getByLabelText(/reason/i), "Low quality audio");
    await userEvent.click(within(dialog).getByRole("button", { name: /reject/i }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith(
        "/api/admin/videos/v1/reject",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ reason: "Low quality audio" }),
        }),
      ),
    );
  });

  it("attaches a transcript via the dialog and shows the resulting line count", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { data: page() }))
      .mockResolvedValueOnce(jsonResponse(200, { data: { transcriptId: "t1", lineCount: 12 } }));
    vi.stubGlobal("fetch", fetchMock);

    render(<VideoQueue />);
    await screen.findByText("Learn Japanese Ep. 1");

    await userEvent.click(screen.getByRole("button", { name: /attach transcript/i }));
    const dialog = await screen.findByRole("dialog");

    await userEvent.selectOptions(within(dialog).getByLabelText(/format/i), "srt");
    await userEvent.type(
      within(dialog).getByLabelText(/content/i),
      "1\n00:00:01,000 --> 00:00:02,000\nこんにちは",
    );
    await userEvent.click(within(dialog).getByRole("button", { name: /save transcript/i }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith(
        "/api/admin/videos/v1/transcript",
        expect.objectContaining({ method: "PUT" }),
      ),
    );
    await waitFor(() => expect(screen.getByText(/12 lines/i)).toBeInTheDocument());
  });

  it("loads more pages via the cursor and appends results", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { data: page({ items: [video({ id: "v1", title: "First" })], nextCursor: "2026-07-10T00:00:00.000Z" }) }))
      .mockResolvedValueOnce(jsonResponse(200, { data: page({ items: [video({ id: "v2", title: "Second" })], nextCursor: null }) }));
    vi.stubGlobal("fetch", fetchMock);

    render(<VideoQueue />);
    await screen.findByText("First");
    expect(screen.getByRole("button", { name: /load more/i })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /load more/i }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith("/api/admin/videos/pending?cursor=2026-07-10T00%3A00%3A00.000Z"),
    );
    expect(await screen.findByText("Second")).toBeInTheDocument();
    expect(screen.getByText("First")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /load more/i })).not.toBeInTheDocument();
  });

  it("shows a 429 message without an alarming tone and re-enables after cooldown", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { data: page() }))
      .mockResolvedValueOnce(jsonResponse(429, { error: "slow down" }, { "Retry-After": "30" }));
    vi.stubGlobal("fetch", fetchMock);

    render(<VideoQueue />);
    await screen.findByText("Learn Japanese Ep. 1");
    await userEvent.click(screen.getByRole("button", { name: /approve/i }));

    await waitFor(() => expect(screen.getByText(/please wait/i)).toBeInTheDocument());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
