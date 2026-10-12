import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { WeeklyCard } from "./weekly-card";

describe("WeeklyCard", () => {
  it("renders ten bars, points deltas as value-over-label stats, and the report link", () => {
    render(<WeeklyCard fact={{ bars: [{ index: 0, seconds: 3600 }, ...Array.from({ length: 9 }, (_, index) => ({ index: index + 1, unavailable: true as const }))], hoursW0: 1, trackedSinceDate: null, vocabularyMastered: 2, listeningDelta: 8, pronunciationDelta: -3 }} />);
    expect(screen.getAllByLabelText("Not yet tracked")).toHaveLength(9);
    expect(screen.getAllByLabelText("Not yet tracked")[0]).toHaveAttribute("data-state", "unavailable");
    expect(screen.getByText("+8 pts").closest("div")).toHaveTextContent(/^Listening\s*\+8 pts$/);
    expect(screen.getByText("−3 pts").closest("div")).toHaveTextContent(/^Pronunciation\s*−3 pts$/);
    expect(screen.getByText("+8 pts").tagName).toBe("DD");
    expect(screen.getByText("Listening", { selector: "dt" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open weekly report" })).toHaveAttribute("href", "/en/weekly-report");
  });

  it("puts the current window on the right, scales to the busiest window, and labels hours", () => {
    render(<WeeklyCard fact={{ bars: [{ index: 0, seconds: 4620 }, { index: 1, seconds: 0 }, { index: 2, seconds: 9240 }, ...Array.from({ length: 7 }, (_, index) => ({ index: index + 3, unavailable: true as const }))], hoursW0: 1.3, trackedSinceDate: "2026-09-20", vocabularyMastered: 1, listeningDelta: null, pronunciationDelta: null }} />);
    const tracked = screen.getAllByRole("img").filter((bar) => bar.dataset.state === "tracked");
    expect(tracked.map((bar) => bar.getAttribute("aria-label"))).toEqual(["2.6 hours studied", "0 hours studied", "1.3 hours studied"]);
    expect(tracked.map((bar) => bar.style.height)).toEqual(["100%", "", "50%"]);
    expect(tracked.every((bar) => bar.textContent === "")).toBe(true);
    expect(screen.getByText("1.3 hours", { selector: "dd" }).closest("div")).toHaveTextContent(/^studied\s*1\.3 hours$/);
    expect(screen.getByText("+1", { selector: "dd" }).closest("div")).toHaveTextContent(/^vocabulary item\s*\+1$/);
  });

  it("prints the tracking start as a localized date", () => {
    render(<WeeklyCard fact={{ bars: [], hoursW0: 0, trackedSinceDate: "2026-10-05", vocabularyMastered: 0, listeningDelta: null, pronunciationDelta: null }} />);
    expect(screen.getByText("Study time recorded from Oct 5, 2026")).toBeInTheDocument();
  });

  it("keeps ten muted bars when its loader supplies no history", () => {
    render(<WeeklyCard fact={{ bars: [], hoursW0: 0, trackedSinceDate: null, vocabularyMastered: 0, listeningDelta: null, pronunciationDelta: null }} />);
    expect(screen.getAllByLabelText("Not yet tracked")).toHaveLength(10);
  });

  it("renders a local error instead of unavailable history", () => {
    render(<WeeklyCard error fact={{ bars: [], hoursW0: 0, trackedSinceDate: null, vocabularyMastered: 0, listeningDelta: null, pronunciationDelta: null }} />);
    expect(screen.getByText("This part couldn't load right now.")).toBeInTheDocument();
  });
});
