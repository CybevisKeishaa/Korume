import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { MissionCard } from "./mission-card";

describe("MissionCard", () => {
  it("uses the three-item heading and rewarded authority", () => {
    render(<MissionCard state={{ kind: "ok", data: { rewarded: true, items: [
      { type: "review", current: 2, target: 3, title: null, href: "/kanji/review", playbackPercent: null },
      { type: "finish_lesson", current: 1, target: 1, title: "Café", href: "/shadowing/v1", playbackPercent: 80 },
      { type: "shadow_lines", current: 0, target: 3, title: null, href: "/shadowing/v1", playbackPercent: null },
    ] } }} />);
    expect(screen.getByRole("heading", { name: "Three small promises" })).toBeInTheDocument();
    expect(screen.getByText(/Reward: \+50 XP earned/)).toBeInTheDocument();
    expect(screen.getByText("2/3")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Finish Café" })).toHaveAttribute("value", "80");
    expect(screen.getByRole("link", { name: /Finish/ })).toHaveAttribute("href", "/en/shadowing/v1");
  });

  it("renders onboarding and error states locally", () => {
    const { rerender } = render(<MissionCard state={{ kind: "unavailable" }} />);
    expect(screen.getByText("Your first missions appear once you start learning.")).toBeInTheDocument();
    rerender(<MissionCard state={{ kind: "error" }} />);
    expect(screen.getByText("Today's missions couldn't load.")).toBeInTheDocument();
  });

  it("uses the general mission heading for fewer than three items", () => {
    render(<MissionCard state={{ kind: "ok", data: { rewarded: false, items: [
      { type: "review", current: 0, target: 3, title: null, href: "/kanji/review", playbackPercent: null },
      { type: "shadow_lines", current: 1, target: 3, title: "Cafe", href: "/shadowing/v1", playbackPercent: null },
    ] } }} />);
    expect(screen.getByRole("heading", { name: "Today's missions" })).toBeInTheDocument();
    expect(screen.getByText(/Reward: \+50 XP$/)).toBeInTheDocument();
  });

  it("accepts a structured-cloneable mission view", () => {
    expect(() => structuredClone({ rewarded: false, items: [] })).not.toThrow();
  });
});
