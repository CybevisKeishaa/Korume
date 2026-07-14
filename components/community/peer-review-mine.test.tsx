import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PeerReviewMine } from "./peer-review-mine";
import type { MyShareWithReviews } from "@/lib/peer-review-types";

function mockFetchOnce(response: { ok: boolean; status: number }): ReturnType<typeof vi.fn> {
  const fn = vi.fn().mockResolvedValue({ ok: response.ok, status: response.status, headers: new Headers() } as Response);
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const shares: MyShareWithReviews[] = [
  {
    id: "share-1",
    sessionId: "session-1",
    lineText: "おはようございます",
    note: null,
    createdAt: "2026-07-14T00:00:00.000Z",
    reviews: [
      {
        id: "review-1",
        rating: 5,
        comment: "Great pitch!",
        createdAt: "2026-07-14T01:00:00.000Z",
        reviewer: { id: "user-2", name: "Bob", avatarUrl: null },
      },
    ],
  },
];

describe("PeerReviewMine", () => {
  it("renders my shares with reviews received", () => {
    render(<PeerReviewMine shares={shares} />);
    expect(screen.getByText("おはようございます")).toBeInTheDocument();
    expect(screen.getByText("Great pitch!")).toBeInTheDocument();
    expect(screen.getByText(/bob/i)).toBeInTheDocument();
  });

  it("shows an empty state with no shares", () => {
    render(<PeerReviewMine shares={[]} />);
    expect(screen.getByText(/haven't shared/i)).toBeInTheDocument();
  });

  it("revokes a share after confirming, removing it from the list", async () => {
    const fetchSpy = mockFetchOnce({ ok: true, status: 204 });
    render(<PeerReviewMine shares={shares} />);

    await userEvent.click(screen.getByRole("button", { name: /revoke/i }));
    await userEvent.click(screen.getByRole("button", { name: /yes/i }));

    expect(fetchSpy).toHaveBeenCalledWith("/api/peer-review/shares/share-1", expect.objectContaining({ method: "DELETE" }));
    expect(await screen.findByText(/haven't shared/i)).toBeInTheDocument();
  });

  it("shows an error and keeps the share if revoke fails", async () => {
    mockFetchOnce({ ok: false, status: 401 });
    render(<PeerReviewMine shares={shares} />);

    await userEvent.click(screen.getByRole("button", { name: /revoke/i }));
    await userEvent.click(screen.getByRole("button", { name: /yes/i }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("おはようございます")).toBeInTheDocument();
  });

  it("shows a message when a share has no reviews yet", () => {
    const firstShare = shares[0] as MyShareWithReviews;
    render(<PeerReviewMine shares={[{ ...firstShare, reviews: [] }]} />);
    expect(screen.getByText(/no reviews yet/i)).toBeInTheDocument();
  });
});
