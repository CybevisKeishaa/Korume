import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { WeeklyCard } from "./weekly-card";

describe("WeeklyCard", () => {
  it("renders ten bars, points deltas, and no report link", () => {
    render(<WeeklyCard fact={{ bars: [{ index: 0, seconds: 3600 }, ...Array.from({ length: 9 }, (_, index) => ({ index: index + 1, unavailable: true as const }))], hoursW0: 1, trackedSinceDate: null, vocabularyMastered: 2, listeningDelta: 8, pronunciationDelta: -3 }} />);
    expect(screen.getAllByLabelText("Not yet tracked")).toHaveLength(9);
    expect(screen.getAllByLabelText("Not yet tracked")[0]).toHaveAttribute("data-state", "unavailable");
    expect(screen.getByText("+8 points")).toBeInTheDocument();
    expect(screen.getByText("−3 points")).toBeInTheDocument();
    expect(screen.queryByText(/Weekly Report/)).not.toBeInTheDocument();
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
