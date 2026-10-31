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
    expect(screen.getByText("+50 XP earned")).toBeInTheDocument();
    expect(screen.getByText("2/3")).toBeInTheDocument();
    // The label and its count stay separate words in the row text (the E2E row filter reads /Review 3 cards/).
    expect(screen.getAllByRole("listitem")[0]).toHaveTextContent(/^Review 3 cards 2\/3$/);
    // The checkbox glyph marks only a met target.
    expect(screen.getAllByRole("listitem").map((item) => item.querySelector("[data-done]") !== null)).toEqual([false, true, false]);
    expect(screen.getByRole("progressbar", { name: "Finish Café" })).toHaveAttribute("value", "80");
    expect(screen.getByRole("link", { name: /Finish/ })).toHaveAttribute("href", "/en/shadowing/v1");
  });

  it("names the sentence mission as listening and opens Listening Practice (P9)", () => {
    render(<MissionCard state={{ kind: "ok", data: { rewarded: false, items: [
      { type: "dictation_lines", current: 1, target: 5, title: "Café", href: "/shadowing/v1/listening", playbackPercent: null },
    ] } }} />);
    expect(screen.getByRole("listitem")).toHaveTextContent(/^Practise listening to 5 sentences 1\/5$/);
    expect(screen.getByRole("link", { name: "Practise listening to 5 sentences" })).toHaveAttribute("href", "/en/shadowing/v1/listening");
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
    expect(screen.getByText("+50 XP")).toBeInTheDocument();
  });

  it("accepts a structured-cloneable mission view", () => {
    expect(() => structuredClone({ rewarded: false, items: [] })).not.toThrow();
  });
});
