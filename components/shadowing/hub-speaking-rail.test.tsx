import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { HubSpeakingRail } from "./hub-speaking-rail";

const props = {
  today: { title: "Today's Speaking", minutes: 0, minutesUnit: "min", minutesLabel: "0 of your 15-minute goal spoken today", goalPercent: 0, lessons: "0 lessons completed", scoreLabel: "Average Score", score: null, scoreMissing: "No score yet", continue: null },
  weekly: { title: "Weekly Improvement", heading: "Your Progress", metrics: [{ label: "Accuracy", value: null }, { label: "Pitch Accent", value: null }, { label: "Rhythm", value: null }], notEnoughData: "Not enough data", trend: { label: "Daily average score, last two weeks", points: [], empty: "Not enough data to show your trend." } },
  sensei: { title: "AI Sensei Recommendation", heading: "Today's Recommendation", body: null, empty: "Review a few words and Sensei will match a lesson to your level.", pick: null },
  recent: { title: "Recently Practiced", empty: "Practice a lesson and it will appear here.", scoreMissing: "No score yet", scoreLabel: "Score", rows: [] },
};

describe("HubSpeakingRail", () => {
  it("renders the four cards in order with honest empty values", () => {
    const { container } = render(<HubSpeakingRail {...props} />);
    expect(screen.getAllByRole("region").map((region) => region.getAttribute("aria-label"))).toEqual(["Today's Speaking", "Weekly Improvement", "AI Sensei Recommendation", "Recently Practiced"]);
    expect(screen.getAllByText("No score yet", { selector: ".sr-only" })).toHaveLength(1);
    expect(screen.getAllByText("Not enough data", { selector: ".sr-only" })).toHaveLength(3);
    expect(screen.queryByRole("img", { name: props.weekly.trend.label })).not.toBeInTheDocument();
    expect(container.querySelectorAll("circle.stroke-primary")).toHaveLength(0);
    expect(screen.queryByRole("link", { name: "Continue Practice" })).not.toBeInTheDocument();
    expect(screen.getByText(props.sensei.empty)).toBeInTheDocument();
  });

  it("renders a semantic time for recent practice", () => {
    render(<HubSpeakingRail {...props} recent={{ ...props.recent, rows: [{ id: "lesson", title: "Meeting introductions", href: "/shadowing/lesson", when: "Yesterday", dateTime: "2026-09-29T10:00:00.000Z", score: "94" }] }} />);
    expect(screen.getByText("Yesterday").closest("time")).toHaveAttribute("dateTime", "2026-09-29T10:00:00.000Z");
    // The bare number at the row's end is named for assistive technology.
    expect(screen.getByRole("link", { name: /Meeting introductions.*Score 94/ })).toHaveAttribute("href", "/en/shadowing/lesson");
  });

  it("draws the trend only from two points, each with its own tooltip and list entry, left to right by x", () => {
    const trend = (points: { x: number; score: number; label: string }[]) => ({ ...props.weekly, trend: { ...props.weekly.trend, points } });
    const { rerender, container } = render(<HubSpeakingRail {...props} weekly={trend([{ x: 1, score: 80, label: "Sep 29: 80" }])} />);
    expect(screen.queryByRole("img", { name: props.weekly.trend.label })).not.toBeInTheDocument();
    expect(screen.getByText(props.weekly.trend.empty)).toBeInTheDocument();

    rerender(<HubSpeakingRail {...props} weekly={trend([{ x: 0, score: 50, label: "Sep 16: 50" }, { x: 1, score: 100, label: "Sep 29: 100" }])} />);
    const chart = screen.getByRole("img", { name: props.weekly.trend.label });
    expect([...chart.querySelectorAll("title")].map((title) => title.textContent)).toEqual(["Sep 16: 50", "Sep 29: 100"]);
    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual(["Sep 16: 50", "Sep 29: 100"]);
    // x spans the 240-wide plot; a higher score sits higher (smaller y).
    expect(container.querySelector("polyline")).toHaveAttribute("points", "0,34 240,8");
  });
});
