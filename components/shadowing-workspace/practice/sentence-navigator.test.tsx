import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@/test/render";
import type { PracticeStats } from "@/lib/data/practice-stats";
import type { WorkspaceLine } from "@/lib/shadowing-workspace/types";
import en from "@/messages/en/shadowing.json";
import viMessages from "@/messages/vi/shadowing.json";
import { navigatorWindow, SentenceNavigator } from "./sentence-navigator";

const state = vi.hoisted(() => ({
  index: 49 as number | null, lines: [] as WorkspaceLine[], stats: null as PracticeStats | null,
  seekToSentence: vi.fn(), play: vi.fn(),
}));
vi.mock("../workspace-context", () => ({
  useLesson: () => ({ lines: state.lines }),
  useCurrentSentence: () => ({ index: state.index }),
  usePlaybackController: () => ({ seekToSentence: state.seekToSentence, play: state.play }),
}));
vi.mock("./practice-stats-context", () => ({ usePracticeStats: () => ({ stats: state.stats }) }));

function chips(): HTMLElement[] {
  return within(screen.getByRole("list")).queryAllByRole("button");
}
function expectChips(numbers: number[]): void {
  const buttons = chips();
  expect(buttons).toHaveLength(numbers.length);
  if (numbers.length) expect(buttons.length).toBeGreaterThan(0);
  expect(buttons.map((button) => button.textContent)).toEqual(numbers.map(String));
}

describe("navigatorWindow (zero-based indices)", () => {
  it.each([
    [49, 194, [46, 47, 48, 49, 50, 51, 52, 53]],
    [0, 194, [0, 1, 2, 3, 4, 5, 6, 7]],
    [193, 194, [186, 187, 188, 189, 190, 191, 192, 193]],
    [1, 3, [0, 1, 2]],
    [0, 1, [0]],
    [0, 0, []],
  ])("centres and clamps index %i of %i", (current, total, expected) => {
    const window = navigatorWindow(current, total);
    expect(window).toHaveLength(expected.length);
    expect(window).toEqual(expected);
  });
});

describe("SentenceNavigator", () => {
  beforeEach(() => {
    state.index = 49;
    state.lines = Array.from({ length: 194 }, (_, index) => ({
      id: `line-${index}`, index, startTime: index, endTime: index + 1,
      textJp: "文", textTranslation: null, furigana: null,
    }));
    state.stats = null;
    vi.clearAllMocks();
  });

  it("pins the approved English and Vietnamese navigator copy", () => {
    expect(en.workspace.practice.navigator).toEqual({
      label: "Sentence navigator", earlier: "Earlier sentences", later: "Later sentences",
      chip: "Sentence {number}, {state}",
      state: { none: "not practised", scored: "scored {score}", needs_review: "needs review", unscored: "not scored yet" },
    });
    expect(viMessages.workspace.practice.navigator).toEqual({
      label: "Điều hướng câu", earlier: "Các câu trước", later: "Các câu sau",
      chip: "Câu {number}, {state}",
      state: { none: "chưa luyện", scored: "{score} điểm", needs_review: "cần ôn lại", unscored: "chưa chấm" },
    });
  });

  it("shows eight chips around sentence 50 and the shared current sentence", () => {
    render(<SentenceNavigator />);
    expectChips([47, 48, 49, 50, 51, 52, 53, 54]);
    expect(screen.getByRole("navigation", { name: "Sentence navigator" })).toBeInTheDocument();
    expect(screen.getByText("Sentence navigator")).toBeVisible();
    expect(screen.getByRole("button", { name: "Sentence 50, not practised" })).toHaveAttribute("aria-current", "true");
    expect(chips().filter((chip) => chip.hasAttribute("aria-current"))).toHaveLength(1);
  });

  it("seeks a chip without playing or replacing the shared current sentence", async () => {
    render(<SentenceNavigator />);
    await userEvent.click(screen.getByRole("button", { name: "Sentence 52, not practised" }));
    expect(state.seekToSentence).toHaveBeenCalledTimes(1);
    expect(state.seekToSentence).toHaveBeenCalledWith(51);
    expect(state.play).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Sentence 50, not practised" })).toHaveAttribute("aria-current", "true");
  });

  it("moves the window by eight without seeking, then recentres on a shared sentence change", async () => {
    const view = render(<SentenceNavigator />);
    await userEvent.click(screen.getByRole("button", { name: "Later sentences" }));
    expectChips([55, 56, 57, 58, 59, 60, 61, 62]);
    expect(chips().filter((chip) => chip.hasAttribute("aria-current"))).toHaveLength(0);
    await userEvent.click(screen.getByRole("button", { name: "Earlier sentences" }));
    expectChips([47, 48, 49, 50, 51, 52, 53, 54]);
    expect(state.seekToSentence).not.toHaveBeenCalled();
    state.index = 100;
    view.rerender(<SentenceNavigator />);
    expectChips([98, 99, 100, 101, 102, 103, 104, 105]);
    expect(screen.getByRole("button", { name: "Sentence 101, not practised" })).toHaveAttribute("aria-current", "true");
  });

  it("guards the earlier boundary without drifting the next window", async () => {
    state.index = 3;
    render(<SentenceNavigator />);
    const earlier = screen.getByRole("button", { name: "Earlier sentences" });
    expect(earlier).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(earlier);
    expectChips([1, 2, 3, 4, 5, 6, 7, 8]);
    await userEvent.click(screen.getByRole("button", { name: "Later sentences" }));
    expectChips([9, 10, 11, 12, 13, 14, 15, 16]);
  });

  it.each([190, 193])("pages eight chips from a clamped end at index %i without selecting a sentence", async (index) => {
    state.index = index;
    render(<SentenceNavigator />);
    const later = screen.getByRole("button", { name: "Later sentences" });
    expect(later).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(later);
    expectChips([187, 188, 189, 190, 191, 192, 193, 194]);
    await userEvent.click(screen.getByRole("button", { name: "Earlier sentences" }));
    expectChips([179, 180, 181, 182, 183, 184, 185, 186]);
    await userEvent.click(later);
    expectChips([187, 188, 189, 190, 191, 192, 193, 194]);
    expect(state.seekToSentence).not.toHaveBeenCalled();
  });

  it("keeps disabled controls focusable, names their reason and blocks all actions", async () => {
    render(<SentenceNavigator disabled disabledHint="Finish recording first" />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(10);
    for (const button of buttons) {
      expect(button).toHaveAttribute("aria-disabled", "true");
      expect(button).toHaveAttribute("title", "Finish recording first");
      expect(button).not.toBeDisabled();
      await userEvent.click(button);
    }
    expectChips([47, 48, 49, 50, 51, 52, 53, 54]);
    expect(state.seekToSentence).not.toHaveBeenCalled();
    expect(state.play).not.toHaveBeenCalled();
  });

  it("supports sequential keyboard navigation and Enter/Space activation", async () => {
    render(<SentenceNavigator />);
    const user = userEvent.setup();
    await user.tab();
    expect(screen.getByRole("button", { name: "Earlier sentences" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Sentence 47, not practised" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(state.seekToSentence).toHaveBeenLastCalledWith(46);
    await user.tab();
    await user.keyboard(" ");
    expect(state.seekToSentence).toHaveBeenLastCalledWith(47);
    expect(state.seekToSentence).toHaveBeenCalledTimes(2);
    expect(state.play).not.toHaveBeenCalled();
  });

  it.each([
    ["scored", 86, "scored 86", "text-success-strong"],
    ["needs_review", 86, "needs review", "text-accent-strong"],
    ["unscored", null, "not scored yet", "ring-border"],
    ["none", null, "not practised", "text-muted-foreground"],
  ] as const)("uses the latest %s state and its token tone", (status, score, label, tone) => {
    state.stats = { lineCount: 194, scoredLines: 1, mean: score, lines: { "line-50": { state: status, score } } };
    render(<SentenceNavigator />);
    const chip = screen.getByRole("button", { name: `Sentence 51, ${label}` });
    expect(chip).toHaveAttribute("data-state", status);
    expect(chip).toHaveClass(tone);
  });

  it("updates labels and tones from refreshed stats without selecting another sentence", () => {
    const view = render(<SentenceNavigator />);
    expect(screen.getByRole("button", { name: "Sentence 51, not practised" })).toHaveAttribute("data-state", "none");
    state.stats = { lineCount: 194, scoredLines: 1, mean: 86, lines: { "line-50": { state: "scored", score: 86 } } };
    view.rerender(<SentenceNavigator />);
    expect(screen.getByRole("button", { name: "Sentence 51, scored 86" })).toHaveClass("text-success-strong");
    expect(screen.getByRole("button", { name: "Sentence 50, not practised" })).toHaveAttribute("aria-current", "true");
  });

  it.each([0, 1, 3])("handles a lesson with %i lines and no current sentence", (total) => {
    state.lines = state.lines.slice(0, total);
    state.index = null;
    render(<SentenceNavigator />);
    expectChips(Array.from({ length: total }, (_, index) => index + 1));
    expect(chips().filter((chip) => chip.hasAttribute("aria-current"))).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Earlier sentences" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: "Later sentences" })).toHaveAttribute("aria-disabled", "true");
  });
});
