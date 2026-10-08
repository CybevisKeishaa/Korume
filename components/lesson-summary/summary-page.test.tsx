import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { render } from "@/test/render";
import type { SummaryPageProps } from "./props";
import { ReviewList } from "./review-list";
import { SummaryPage } from "./summary-page";
const presence = vi.hoisted(() => vi.fn());
vi.mock("@/components/study-time/study-presence", () => ({ StudyPresence: presence }));

vi.mock("@/lib/i18n/navigation", () => ({
  Link: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a>,
  usePathname: () => "/shadowing/v-1/summary",
}));
vi.mock("./summary-island", () => ({ SummaryIsland: () => <div data-summary-area="island" data-testid="island" /> }));

const PROPS: SummaryPageProps & { locale: "en" } = {
  locale: "en",
  videoId: "v-1",
  youtubeVideoId: "yt",
  title: "Ordering Coffee at a Cozy Café",
  thumbnailUrl: "https://i.ytimg.com/vi/yt/hqdefault.jpg",
  jlptLevel: "N5",
  sentenceCount: 18,
  durationMinutes: 6,
  completed: true,
  hasTranscript: true,
  status: {
    shadowing: { kind: "in_progress", percent: 30 },
    pronunciation: { kind: "scored", score: 0 },
    listening: { kind: "not_started" },
    retention: { kind: "not_enough_data" },
  },
  saved: { vocabulary: 12, expressions: 5, grammar: 3, retention: { kind: "count", value: 1 } },
  reviewTargets: [],
  reviewTargetTotal: 0,
  nextLesson: { videoId: "v-2", title: "Convenience Store in Tokyo", thumbnailUrl: null, jlptLevel: "N5", href: "/shadowing/v-2", reason: "path" },
  replayHref: "/shadowing/v-1?line=first",
  resumeHref: "/shadowing/v-1?line=resume",
  fallback: { kind: "state", state: "complete" },
  savedCards: [],
};

describe("SummaryPage", () => {
  it("tracks the summary with its video id", () => {
    render(<SummaryPage {...PROPS} />);
    expect(presence).toHaveBeenCalledWith(expect.objectContaining({ surface: "summary", contextId: "v-1" }), expect.anything());
  });
  it("has one h1 (the lesson title) and the deterministic h2s", () => {
    render(<SummaryPage {...PROPS} />);
    expect(screen.getAllByRole("heading", { level: 1 }).map((h) => h.textContent)).toEqual(["Ordering Coffee at a Cozy Café"]);
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "Lesson status", "Saved knowledge", "Where to go next",
    ]);
  });

  it("header: Back to Lesson returns to the resume line, SUMMARY eyebrow, mode bar with Summary current", () => {
    render(<SummaryPage {...PROPS} />);
    const header = screen.getByRole("banner");
    expect(within(header).getByRole("link", { name: "Back to Lesson" })).toHaveAttribute("href", "/shadowing/v-1?line=resume");
    expect(within(header).getByText("Summary", { selector: "p" })).toBeInTheDocument();
    expect(within(header).getByRole("link", { current: "page" })).toHaveAttribute("href", "/shadowing/v-1/summary");
  });

  it("hero: completed eyebrow, meta, and the two hrefs exactly as given", () => {
    const { rerender } = render(<SummaryPage {...PROPS} />);
    expect(screen.getByText("Lesson complete")).toBeInTheDocument();
    expect(screen.getByText("N5 · 18 sentences · 6 min")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Replay Lesson" })).toHaveAttribute("href", "/shadowing/v-1?line=first");
    expect(screen.getByRole("link", { name: "Return to Shadowing" })).toHaveAttribute("href", "/shadowing/v-1?line=resume");
    rerender(<SummaryPage {...PROPS} completed={false} jlptLevel={null} durationMinutes={null} />);
    expect(screen.getByText("Lesson summary")).toBeInTheDocument();
    expect(screen.getByText("18 sentences")).toBeInTheDocument();
  });

  it("lesson status: Not started, Not enough data, a percent, Complete, and a real 0", () => {
    const { rerender } = render(<SummaryPage {...PROPS} />);
    const status = () => screen.getByRole("region", { name: "Lesson status" });
    expect(within(status()).getByText("30%")).toBeInTheDocument();
    expect(within(status()).getByText("0")).toBeInTheDocument();
    expect(within(status()).getByText("Not started")).toBeInTheDocument();
    expect(within(status()).getByText("Not enough data")).toBeInTheDocument();
    rerender(<SummaryPage {...PROPS} status={{ ...PROPS.status, shadowing: { kind: "complete" } }} />);
    expect(within(status()).getByText("Complete")).toBeInTheDocument();
  });

  it("saved knowledge: real counts and a retention tile in words", () => {
    const { rerender } = render(<SummaryPage {...PROPS} />);
    const saved = () => screen.getByRole("region", { name: "Saved knowledge" });
    expect(within(saved()).getByText("12")).toBeInTheDocument();
    expect(within(saved()).getByText("1 remembered")).toBeInTheDocument();
    rerender(<SummaryPage {...PROPS} saved={{ ...PROPS.saved, retention: { kind: "not_enough_data" } }} />);
    expect(within(saved()).getByText("Not enough data")).toBeInTheDocument();
    expect(within(saved()).queryByText(/%/)).toBeNull();
  });

  it("next lesson: Start Next Lesson to its href, hidden when there is none", () => {
    const { rerender } = render(<SummaryPage {...PROPS} />);
    expect(screen.getByText("Next in this path")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Start Next Lesson" })).toHaveAttribute("href", "/shadowing/v-2");
    rerender(<SummaryPage {...PROPS} nextLesson={null} />);
    expect(screen.queryByRole("link", { name: "Start Next Lesson" })).toBeNull();
  });

  it("keeps reading order hero, island, status, saved, next, with the three rail cards in one rail area", () => {
    const { container } = render(<SummaryPage {...PROPS} />);
    const areas = [...container.querySelectorAll("main [data-summary-area]")].map((child) => child.getAttribute("data-summary-area"));
    expect(areas).toEqual(["hero", "island", "status", "saved", "next"]);
    const rail = container.querySelector("main > .lesson-summary-rail");
    expect([...(rail?.children ?? [])].map((child) => child.getAttribute("data-summary-area"))).toEqual(["status", "saved", "next"]);
  });
});

describe("ReviewList", () => {
  const target = (i: number) => ({ lineId: `line-${i}`, lineText: `文${i}です`, reasons: ["pronunciation" as const, "grammar" as const], focusSpan: null });

  it("shows reasons and the Japanese line, links Review Again to the line, and counts the rest", () => {
    render(<ReviewList videoId="v-1" targets={[target(1), target(2)]} total={4} />);
    const rows = screen.getAllByRole("listitem");
    expect(within(rows[0] as HTMLElement).getByText("Pronunciation")).toBeInTheDocument();
    expect(within(rows[0] as HTMLElement).getByText("Grammar in this line")).toBeInTheDocument();
    expect(within(rows[0] as HTMLElement).getByText("文1です")).toHaveAttribute("lang", "ja");
    expect(within(rows[1] as HTMLElement).getByRole("link", { name: "Review Again" })).toHaveAttribute("href", "/shadowing/v-1?line=line-2");
    expect(screen.getByText("+2 more lines")).toBeInTheDocument();
  });

  it("says so when there is nothing to review", () => {
    render(<ReviewList videoId="v-1" targets={[]} total={0} />);
    expect(screen.getByText("Nothing to review from this lesson yet.")).toBeInTheDocument();
    expect(screen.queryByRole("list")).toBeNull();
  });
});
