import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/render";
import userEvent from "@testing-library/user-event";
import { LeaderboardBoard } from "./leaderboard-board";
import type { LeaderboardPage } from "@/lib/leaderboard-types";

function mockFetchOnce(response: { ok: boolean; status: number; json?: () => Promise<unknown> }): ReturnType<typeof vi.fn> {
  const fn = vi.fn().mockResolvedValue({ ok: response.ok, status: response.status, headers: new Headers(), json: response.json ?? (async () => ({})) } as Response);
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const optedInPage: LeaderboardPage = {
  leaderboard: [
    { rank: 1, name: "Alice", avatarUrl: null, weeklyXp: 500, isMe: false },
    { rank: 2, name: "Me", avatarUrl: null, weeklyXp: 300, isMe: true },
  ],
  callerWeeklyXp: 300,
  callerRank: 2,
};

describe("LeaderboardBoard", () => {
  it("leads with the caller's own weekly XP and rank", () => {
    render(<LeaderboardBoard initialPage={optedInPage} initialOptIn />);
    expect(screen.getByText(/your week/i)).toBeInTheDocument();
    expect(screen.getByText("300")).toBeInTheDocument();
    expect(screen.getByText(/rank 2/i)).toBeInTheDocument();
  });

  it("highlights the caller's row in the community list", () => {
    render(<LeaderboardBoard initialPage={optedInPage} initialOptIn />);
    const meRow = screen.getByText("Me").closest("li");
    expect(meRow).toHaveAttribute("aria-current", "true");
  });

  it("shows a not-opted-in message instead of a rank when the caller hasn't opted in", () => {
    render(<LeaderboardBoard initialPage={{ leaderboard: [], callerWeeklyXp: 0, callerRank: null }} initialOptIn={false} />);
    expect(screen.getByText(/opt in to see your rank/i)).toBeInTheDocument();
  });

  it("shows an empty state when nobody has opted in", () => {
    render(<LeaderboardBoard initialPage={{ leaderboard: [], callerWeeklyXp: 0, callerRank: null }} initialOptIn={false} />);
    expect(screen.getByText(/no one has opted in yet/i)).toBeInTheDocument();
  });

  it("shows a zero-XP message when the caller has no weekly XP yet", () => {
    render(<LeaderboardBoard initialPage={{ leaderboard: [], callerWeeklyXp: 0, callerRank: null }} initialOptIn={false} />);
    expect(screen.getByText(/study something this week/i)).toBeInTheDocument();
  });

  // G2 (docs/product/business-model.md §1.1): "Your week" must render before
  // the community list in DOM order — a progress screen first, a ranking
  // second — not merely be present somewhere on the page.
  it("renders 'Your week' before the community heading (G2 order)", () => {
    render(<LeaderboardBoard initialPage={optedInPage} initialOptIn />);
    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(["Your week", "This week's top learners"]);
  });

  it("refreshes the board after opting in", async () => {
    const fetchSpy = mockFetchOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: optedInPage }),
    });
    render(<LeaderboardBoard initialPage={{ leaderboard: [], callerWeeklyXp: 0, callerRank: null }} initialOptIn={false} />);

    await userEvent.click(screen.getByRole("checkbox", { name: /appear on the leaderboard/i }));

    expect(fetchSpy).toHaveBeenCalledWith("/api/user/leaderboard-opt-in", expect.objectContaining({ method: "PATCH" }));
  });
});
