import { describe, expect, it } from "vitest";
import userEvent from "@testing-library/user-event";
import { render, screen, within } from "@/test/render";
import en from "@/messages/en/profile.json";
import { QuickStats } from "./quick-stats";
import { makeView } from "./view-fixture";

const t = en.stats;

describe("QuickStats", () => {
  it("lists six rows in frame order", () => {
    render(<QuickStats stats={makeView().stats} />);
    const labels = screen.getAllByRole("term").map((n) => n.textContent);
    expect(labels).toEqual([t.streak, t.level, t.xp, t.videoLessons, t.words, t.hours]);
    expect(screen.getByText("12 days")).toBeInTheDocument();
    expect(screen.getByText("Lv. 4")).toBeInTheDocument();
    expect(screen.getByText("8,420")).toBeInTheDocument();
    expect(screen.getByText("1,286")).toBeInTheDocument();
    expect(screen.getByText("94h 20m")).toBeInTheDocument();
  });

  it("renders zeros, never hides them", () => {
    render(<QuickStats stats={{ ...makeView().stats, streakCurrent: 0, totalXp: 0, videoLessonsCompleted: 0, wordsLearned: 0, studySeconds: 0, trackedSince: null }} />);
    expect(screen.getByText("0 days")).toBeInTheDocument();
    expect(screen.getAllByText("0")).toHaveLength(3);
    expect(screen.getByText("0h 0m")).toBeInTheDocument();
  });

  it("describes the hours row by a focusable button with the tracked-since hint", () => {
    render(<QuickStats stats={makeView().stats} />);
    const button = screen.getByRole("button", { name: t.hoursInfo });
    const hint = document.getElementById(button.getAttribute("aria-describedby") ?? "");
    expect(hint).toHaveTextContent("Tracked by Korume since Apr 1, 2026");
    button.focus();
    expect(button).toHaveFocus();
  });

  it("says tracking starts with the next session when trackedSince is null", () => {
    render(<QuickStats stats={{ ...makeView().stats, trackedSince: null }} />);
    const button = screen.getByRole("button", { name: t.hoursInfo });
    const hint = document.getElementById(button.getAttribute("aria-describedby") ?? "");
    expect(within(hint as HTMLElement).getByText(t.trackingStarts)).toBeInTheDocument();
  });

  it("gives every stat row its decorative icon", () => {
    const { container } = render(<QuickStats stats={makeView().stats} />);
    const icons = Array.from(container.querySelectorAll("svg[data-profile-icon]")).map((n) => n.getAttribute("data-profile-icon"));
    expect(icons).toEqual(["streak", "level", "xp", "video", "words", "hours"]);
  });

  it("has a 24px info target and Escape dismisses the hint", async () => {
    const user = userEvent.setup();
    render(<QuickStats stats={makeView().stats} />);
    const button = screen.getByRole("button", { name: t.hoursInfo });
    expect(button.className).toContain("size-6");
    const hint = document.getElementById(button.getAttribute("aria-describedby") ?? "") as HTMLElement;
    await user.tab();
    while (document.activeElement !== button) await user.tab();
    expect(hint).not.toHaveAttribute("data-dismissed", "true");
    await user.keyboard("{Escape}");
    expect(hint).toHaveAttribute("data-dismissed", "true");
  });
});
