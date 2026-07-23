import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/render";
import userEvent from "@testing-library/user-event";
import { PeerReviewQueue } from "./peer-review-queue";
import type { PeerReviewQueuePage, PeerReviewShareListItem } from "@/lib/peer-review-types";

function share(overrides: Partial<PeerReviewShareListItem> = {}): PeerReviewShareListItem {
  return {
    id: "share-1",
    sessionId: "session-1",
    lineText: "私は学校に行きます",
    note: "Please check my pitch",
    createdAt: "2026-07-14T00:00:00.000Z",
    sharedBy: { id: "user-2", name: "Bob", avatarUrl: null },
    reviewCount: 0,
    alreadyReviewed: false,
    ...overrides,
  };
}

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

const initialPage: PeerReviewQueuePage = { shares: [share()], nextCursor: null };

describe("PeerReviewQueue", () => {
  it("renders the queue's line text, note, and review count", () => {
    render(<PeerReviewQueue initialPage={initialPage} />);
    expect(screen.getByText("私は学校に行きます")).toBeInTheDocument();
    expect(screen.getByText("Please check my pitch")).toBeInTheDocument();
    expect(screen.getByText(/0 reviews/i)).toBeInTheDocument();
  });

  it("fetches a signed URL and renders an audio player on Listen", async () => {
    mockFetchSequence([
      { ok: true, status: 200, json: { data: { signedUrl: "https://example.com/a.webm", expiresInSeconds: 300 } } },
    ]);
    render(<PeerReviewQueue initialPage={initialPage} />);

    await userEvent.click(screen.getByRole("button", { name: /listen/i }));

    const audio = await screen.findByLabelText(/recording/i);
    expect(audio).toHaveAttribute("src", "https://example.com/a.webm");
  });

  it("shows a rate-limit message when minting the signed URL is throttled", async () => {
    mockFetchSequence([{ ok: false, status: 429, headers: { "Retry-After": "10" } }]);
    render(<PeerReviewQueue initialPage={initialPage} />);

    await userEvent.click(screen.getByRole("button", { name: /listen/i }));

    expect(await screen.findByText(/10s/)).toBeInTheDocument();
  });

  it("submits a rating + comment and marks the share as reviewed", async () => {
    const fetchSpy = mockFetchSequence([{ ok: true, status: 201, json: { data: { id: "review-1", createdAt: "2026-07-14T01:00:00.000Z" } } }]);
    render(<PeerReviewQueue initialPage={initialPage} />);

    await userEvent.click(screen.getByRole("radio", { name: "4" }));
    await userEvent.type(screen.getByRole("textbox", { name: /comment/i }), "Good rhythm!");
    await userEvent.click(screen.getByRole("button", { name: /submit review/i }));

    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/peer-review/shares/share-1/reviews",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ rating: 4, comment: "Good rhythm!" }) }),
    );
    expect(await screen.findByText(/reviewed/i)).toBeInTheDocument();
  });

  it("requires a rating before submit is enabled", () => {
    render(<PeerReviewQueue initialPage={initialPage} />);
    expect(screen.getByRole("button", { name: /submit review/i })).toBeDisabled();
  });

  it("shows an empty state when the queue is empty", () => {
    render(<PeerReviewQueue initialPage={{ shares: [], nextCursor: null }} />);
    expect(screen.getByText(/nothing to review/i)).toBeInTheDocument();
  });

  it("loads more shares via cursor", async () => {
    const page: PeerReviewQueuePage = { shares: [share()], nextCursor: "2026-07-13T00:00:00.000Z" };
    const fetchSpy = mockFetchSequence([
      { ok: true, status: 200, json: { data: { shares: [share({ id: "share-2", lineText: "おはよう" })], nextCursor: null } } },
    ]);
    render(<PeerReviewQueue initialPage={page} />);

    await userEvent.click(screen.getByRole("button", { name: /load more/i }));

    expect(fetchSpy).toHaveBeenCalledWith("/api/peer-review/queue?cursor=2026-07-13T00%3A00%3A00.000Z");
    expect(await screen.findByText("おはよう")).toBeInTheDocument();
  });
});
