import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@/test/render";
import userEvent from "@testing-library/user-event";
import { ContentManager } from "./content-manager";

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

const vocabItem = {
  id: "w1",
  word: "犬",
  reading: "いぬ",
  meaning_en: "dog",
  meaning_vi: "con chó",
  jlpt_level: "N5",
  part_of_speech: "noun",
  created_at: "2026-07-01T00:00:00.000Z",
};

function listPage(overrides: Record<string, unknown> = {}) {
  return { items: [vocabItem], page: 1, pageSize: 20, hasMore: false, ...overrides };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ContentManager", () => {
  it("loads and renders the list for a type", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { data: listPage() })));
    render(<ContentManager type="vocab" />);

    expect(await screen.findByText("犬")).toBeInTheDocument();
    expect(screen.getByText("いぬ")).toBeInTheDocument();
  });

  it("shows an error state on load failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(401, { error: "Unauthorized" })));
    render(<ContentManager type="vocab" />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not load/i);
  });

  it("shows an empty state when there are no rows", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { data: listPage({ items: [] }) })));
    render(<ContentManager type="vocab" />);
    expect(await screen.findByText(/no vocabulary/i)).toBeInTheDocument();
  });

  it("searches and refetches with the search query", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { data: listPage() }));
    vi.stubGlobal("fetch", fetchMock);

    render(<ContentManager type="vocab" />);
    await screen.findByText("犬");

    await userEvent.type(screen.getByLabelText(/search/i), "犬");
    await userEvent.click(screen.getByRole("button", { name: /search/i }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith("/api/admin/content/vocab?page=1&pageSize=20&search=%E7%8A%AC"),
    );
  });

  it("paginates with next/previous", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { data: listPage({ hasMore: true }) }))
      .mockResolvedValueOnce(jsonResponse(200, { data: listPage({ page: 2, hasMore: false }) }));
    vi.stubGlobal("fetch", fetchMock);

    render(<ContentManager type="vocab" />);
    await screen.findByText("犬");

    await userEvent.click(screen.getByRole("button", { name: /^next$/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith("/api/admin/content/vocab?page=2&pageSize=20"));
    expect(await screen.findByText(/page 2/i)).toBeInTheDocument();
  });

  it("creates a new row via the form dialog", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { data: listPage({ items: [] }) })) // initial load
      .mockResolvedValueOnce(jsonResponse(201, { data: { ...vocabItem, id: "w2", word: "猫" } })) // create
      .mockResolvedValueOnce(jsonResponse(200, { data: listPage({ items: [{ ...vocabItem, id: "w2", word: "猫" }] }) })); // refetch
    vi.stubGlobal("fetch", fetchMock);

    render(<ContentManager type="vocab" />);
    await screen.findByText(/no vocabulary/i);

    await userEvent.click(screen.getByRole("button", { name: /add vocabulary/i }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText(/word/i), "猫");
    await userEvent.click(within(dialog).getByRole("button", { name: /^save$/i }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        "/api/admin/content/vocab",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    expect(await screen.findByText("猫")).toBeInTheDocument();
  });

  it("edits an existing row, pre-filling known fields", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { data: listPage() }))
      .mockResolvedValueOnce(jsonResponse(200, { data: { ...vocabItem, id: "w1", meaning_en: "canine" } }))
      .mockResolvedValueOnce(jsonResponse(200, { data: listPage({ items: [{ ...vocabItem, meaning_en: "canine" }] }) }));
    vi.stubGlobal("fetch", fetchMock);

    render(<ContentManager type="vocab" />);
    await screen.findByText("犬");

    await userEvent.click(screen.getByRole("button", { name: /edit 犬/i }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText(/^word/i)).toHaveValue("犬");

    const meaningField = within(dialog).getByLabelText(/meaning \(en\)/i);
    await userEvent.clear(meaningField);
    await userEvent.type(meaningField, "canine");
    await userEvent.click(within(dialog).getByRole("button", { name: /^save$/i }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        "/api/admin/content/vocab/w1",
        expect.objectContaining({ method: "PATCH" }),
      ),
    );
  });

  it("deletes a row after confirming", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { data: listPage() }))
      .mockResolvedValueOnce({ ok: true, status: 204, headers: new Headers(), json: async () => ({}) } as Response);
    vi.stubGlobal("fetch", fetchMock);

    render(<ContentManager type="vocab" />);
    await screen.findByText("犬");

    await userEvent.click(screen.getByRole("button", { name: /delete 犬/i }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: /delete/i }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith("/api/admin/content/vocab/w1", expect.objectContaining({ method: "DELETE" })),
    );
    await waitFor(() => expect(screen.queryByText("犬")).not.toBeInTheDocument());
  });

  it("imports CSV text and renders per-row results", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { data: listPage() }))
      .mockResolvedValueOnce(
        jsonResponse(200, { data: { inserted: 1, failed: [{ row: 2, errors: ["word: Required"] }] } }),
      );
    vi.stubGlobal("fetch", fetchMock);

    render(<ContentManager type="vocab" />);
    await screen.findByText("犬");

    await userEvent.click(screen.getByRole("button", { name: /import csv/i }));
    await userEvent.type(screen.getByLabelText(/csv/i), "word,reading\n猫,ねこ");
    await userEvent.click(screen.getByRole("button", { name: /upload/i }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith(
        "/api/admin/content/vocab/import",
        expect.objectContaining({ method: "POST", body: "word,reading\n猫,ねこ" }),
      ),
    );
    expect(await screen.findByText(/1 inserted/i)).toBeInTheDocument();
    expect(screen.getByText(/word: Required/i)).toBeInTheDocument();
  });

  it("shows a 429 message on import without an alarming error tone", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { data: listPage() }))
      .mockResolvedValueOnce(jsonResponse(429, { error: "slow down" }, { "Retry-After": "60" }));
    vi.stubGlobal("fetch", fetchMock);

    render(<ContentManager type="vocab" />);
    await screen.findByText("犬");
    await userEvent.click(screen.getByRole("button", { name: /import csv/i }));
    await userEvent.type(screen.getByLabelText(/csv/i), "word\n猫");
    await userEvent.click(screen.getByRole("button", { name: /upload/i }));

    expect(await screen.findByText(/too many import/i)).toBeInTheDocument();
  });
});
