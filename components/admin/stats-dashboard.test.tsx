import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/render";
import { StatsDashboard } from "./stats-dashboard";
import type { AdminStats } from "@/lib/admin-ui-types";

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

function stats(overrides: Partial<AdminStats> = {}): AdminStats {
  return {
    totalUsers: 120,
    newUsers7d: 8,
    newUsers30d: 30,
    activeUsers7d: 45,
    activeUsers30d: 80,
    retention: {
      cohortSize: 20,
      activeCount: 6,
      retentionPercent: 30,
      methodology: "Users whose account was created 30-60 days ago; percent with at least one xp_event in the last 7 days.",
    },
    contentCounts: {
      videosPending: 3,
      videosApproved: 50,
      kanji: 200,
      vocab: 800,
      grammar: 100,
      jlptTests: 5,
      readingPassages: 12,
    },
    topActivity: [
      { sourceType: "shadowing", count: 40 },
      { sourceType: "srs_review", count: 30 },
    ],
    generatedAt: "2026-07-14T00:00:00.000Z",
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("StatsDashboard", () => {
  it("shows a loading state, then renders stat cards", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { data: stats() })));
    render(<StatsDashboard />);

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    expect(await screen.findByText("120")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
    expect(screen.getByText("45")).toBeInTheDocument();
  });

  it("shows the retention percent and its methodology as fine print", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { data: stats() })));
    render(<StatsDashboard />);

    expect(await screen.findByText("30%")).toBeInTheDocument();
    expect(screen.getByText(/30-60 days ago/i)).toBeInTheDocument();
  });

  it("shows an em-dash (not 0% or an error) when the cohort is empty and retentionPercent is null", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(200, { data: stats({ retention: { cohortSize: 0, activeCount: 0, retentionPercent: null, methodology: "m" } }) }),
      ),
    );
    render(<StatsDashboard />);
    expect(await screen.findByText(/no cohort data yet/i)).toBeInTheDocument();
  });

  it("renders content counts and top activity", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { data: stats() })));
    render(<StatsDashboard />);

    expect(await screen.findByText("200")).toBeInTheDocument(); // kanji count
    expect(screen.getByText("shadowing")).toBeInTheDocument();
    expect(screen.getByText("srs_review")).toBeInTheDocument();
  });

  it("pairs each content-count label with ITS OWN value, not a swapped one (would still pass a bare presence check)", async () => {
    // CONTENT_COUNT_KEYS -> contentCountLabel is a label/value pair map (Kanji
    // 200, Vocabulary 800, Videos pending 3, Videos approved 50, ...) — every
    // pair is type-interchangeable, so a key swap between two entries would
    // still pass "the text exists somewhere on the page". Scoping each
    // label's own StatCard element and asserting ITS value catches that.
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { data: stats() })));
    render(<StatsDashboard />);

    const kanjiCard = (await screen.findByText("Kanji")).closest("div");
    expect(kanjiCard).toHaveTextContent("200");
    expect(kanjiCard).not.toHaveTextContent("800");

    const vocabCard = screen.getByText("Vocabulary").closest("div");
    expect(vocabCard).toHaveTextContent("800");
    expect(vocabCard).not.toHaveTextContent("200");

    const pendingCard = screen.getByText("Videos pending").closest("div");
    expect(pendingCard).toHaveTextContent("3");
    expect(pendingCard).not.toHaveTextContent("50");

    const approvedCard = screen.getByText("Videos approved").closest("div");
    expect(approvedCard).toHaveTextContent("50");
    expect(approvedCard).not.toHaveTextContent("3");
  });

  it("shows an error state when the fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(403, { error: "Forbidden" })));
    render(<StatsDashboard />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/could not load/i);
  });
});
