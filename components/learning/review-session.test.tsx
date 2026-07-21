import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@/test/render";
import userEvent from "@testing-library/user-event";
import { ReviewSession, type ReviewItem } from "./review-session";

const ITEMS: ReviewItem[] = [
  { id: "k-1", front: "水", sub: "みず", back: "water" },
  { id: "k-2", front: "火", sub: "ひ", back: "fire" },
];

interface FetchCall {
  url: string;
  method: string | undefined;
  body: unknown;
}

function mockFetch(ok = true): FetchCall[] {
  const calls: FetchCall[] = [];
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({
      url,
      method: init?.method,
      body: init?.body ? JSON.parse(init.body as string) : undefined,
    });
    return { ok, status: ok ? 200 : 500, json: async () => ({}) } as Response;
  });
  vi.stubGlobal("fetch", fn);
  return calls;
}

/**
 * Characterization test for the shared SRS review flow (CLAUDE.md TDD step 1):
 * written to pin the pre-extraction hardcoded English strings byte-for-byte,
 * so it stays green once those strings move to `common.srs.*` (binding
 * pattern 1). This is the SAME component `/kanji/review` and `/vocab/review`
 * both render (Task 8 will consume the same catalog keys), and the mirrored
 * `components/video-player/mining-review-session.tsx` (Task 12).
 */
describe("ReviewSession", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows an empty-queue message with a Back link when there is nothing to review", () => {
    mockFetch();
    render(<ReviewSession itemType="kanji" items={[]} backHref="/kanji" />);
    expect(screen.getByText("Nothing to review here yet.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back" })).toHaveAttribute("href", "/en/kanji");
  });

  it("shows progress and the front of the card, hiding the back until revealed", () => {
    mockFetch();
    render(<ReviewSession itemType="kanji" items={ITEMS} backHref="/kanji" />);

    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    expect(screen.getByText("水")).toBeInTheDocument();
    expect(screen.queryByText("water")).not.toBeInTheDocument();
  });

  it("reveals the back and the grade buttons after Show answer", async () => {
    mockFetch();
    render(<ReviewSession itemType="kanji" items={ITEMS} backHref="/kanji" />);

    // Pins the full accessible name, including the "(Space)" keyboard hint —
    // the /show answer/i regex used elsewhere in this file would pass even if
    // that hint were typo'd (review 2026-07-21 finding 3).
    const showAnswer = screen.getByRole("button", { name: "Show answer (Space)" });
    await userEvent.click(showAnswer);

    expect(screen.getByText("water")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^again/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^hard/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^good/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^easy/i })).toBeInTheDocument();
  });

  it("grading posts the item id and quality, then advances to the next card", async () => {
    const calls = mockFetch();
    render(<ReviewSession itemType="kanji" items={ITEMS} backHref="/kanji" />);

    await userEvent.click(screen.getByRole("button", { name: /show answer/i }));
    await userEvent.click(screen.getByRole("button", { name: /^good/i }));

    await waitFor(() => expect(calls.find((c) => c.url === "/api/srs/review")).toBeDefined());
    const call = calls.find((c) => c.url === "/api/srs/review");
    expect(call?.method).toBe("POST");
    expect(call?.body).toEqual({ itemType: "kanji", itemId: "k-1", quality: 4 });

    await waitFor(() => expect(screen.getByText("2 / 2")).toBeInTheDocument());
  });

  it("shows the translated generic error message when the review POST fails (never the raw status/exception text)", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mockFetch(false);
    render(<ReviewSession itemType="kanji" items={ITEMS} backHref="/kanji" />);

    await userEvent.click(screen.getByRole("button", { name: /show answer/i }));
    await userEvent.click(screen.getByRole("button", { name: /^good/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong.");
    spy.mockRestore();
  });

  it("shows a completion message (singular) and a Done link after the last card", async () => {
    const calls = mockFetch();
    render(<ReviewSession itemType="kanji" items={ITEMS.slice(0, 1)} backHref="/kanji" />);

    await userEvent.click(screen.getByRole("button", { name: /show answer/i }));
    await userEvent.click(screen.getByRole("button", { name: /^good/i }));
    await waitFor(() => expect(calls.length).toBe(1));

    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent("Session complete 🎉");
    expect(status).toHaveTextContent("You reviewed 1 item.");
    expect(screen.getByRole("link", { name: "Done" })).toHaveAttribute("href", "/en/kanji");
  });

  it("shows a completion message (plural) after reviewing more than one card", async () => {
    mockFetch();
    render(<ReviewSession itemType="kanji" items={ITEMS} backHref="/kanji" />);

    for (let i = 0; i < ITEMS.length; i++) {
      await userEvent.click(screen.getByRole("button", { name: /show answer/i }));
      await userEvent.click(screen.getByRole("button", { name: /^good/i }));
    }

    expect(await screen.findByRole("status")).toHaveTextContent("You reviewed 2 items.");
  });
});
