import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@/test/render";
import userEvent from "@testing-library/user-event";
import { ReadingList } from "./reading-list";

function jsonResponse(status: number, body: unknown): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: () => null } as unknown as Headers,
    json: async () => body,
  } as unknown as Response;
}

const PASSAGES = [
  { id: "r1", title: "はじめての日本", jlpt_level: "N5", word_count: 120, created_at: "2026-01-01" },
  { id: "r2", title: "旅の思い出", jlpt_level: "N4", word_count: 250, created_at: "2026-01-02" },
];

describe("ReadingList", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads and renders passage cards with title, level badge, word count, and a read link", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, { data: PASSAGES }));
    vi.stubGlobal("fetch", fetchMock);

    render(<ReadingList />);

    expect(screen.getByText(/loading reading passages/i)).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText("はじめての日本")).toBeInTheDocument());

    expect(screen.getAllByText("N5").length).toBeGreaterThan(0);
    expect(screen.getByText("120 words")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /read passage/i })[0]).toHaveAttribute(
      "href",
      "/en/reading/r1",
    );
    expect(fetchMock).toHaveBeenCalledWith("/api/reading");
  });

  it("refetches with the level query param when a filter pill is clicked", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, { data: PASSAGES }));
    vi.stubGlobal("fetch", fetchMock);

    render(<ReadingList />);
    await waitFor(() => expect(screen.getByText("はじめての日本")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: "N4" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith("/api/reading?level=N4"),
    );
    expect(screen.getByRole("button", { name: "N4" })).toHaveAttribute("aria-pressed", "true");
  });

  it("shows the no-filter empty state when there are no passages and no level is selected", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(200, { data: [] })));

    render(<ReadingList />);

    await waitFor(() => expect(screen.getByText(/no reading passages/i)).toBeInTheDocument());
    // Swap-proof: with no level filter active, the copy must NOT claim "at
    // this level" — this is a distinct string (`list.emptyAll`) from the
    // level-scoped one (`list.emptyAtLevel`) below, not the same message
    // conditionally worded. A swap of the two keys would still satisfy the
    // loose `/no reading passages/i` match above, so this asserts the exact
    // text instead.
    expect(screen.getByText("No reading passages yet.")).toBeInTheDocument();
  });

  it("shows the level-scoped empty state when a level filter has no passages", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, { data: [] }));
    vi.stubGlobal("fetch", fetchMock);

    render(<ReadingList />);
    await waitFor(() => expect(screen.getByText(/no reading passages/i)).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: "N4" }));

    await waitFor(() =>
      expect(screen.getByText("No reading passages at this level yet.")).toBeInTheDocument(),
    );
    // Swap-proof: the generic no-filter message must not also be showing.
    expect(screen.queryByText("No reading passages yet.")).not.toBeInTheDocument();
  });

  it("shows a friendly error state when the request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(500, { error: "boom" })),
    );

    render(<ReadingList />);

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/could not load/i));
  });
});
