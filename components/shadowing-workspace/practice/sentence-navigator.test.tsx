import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@/test/render";
import type { PracticeStats } from "@/lib/data/practice-stats";
import type { WorkspaceLine } from "@/lib/shadowing-workspace/types";
import en from "@/messages/en/shadowing.json";
import viMessages from "@/messages/vi/shadowing.json";
import { SentenceNavigator } from "./sentence-navigator";

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

const scrollIntoView = vi.fn();
const rail = () => screen.getByTestId("sentence-rail");
function sizeRail(el: HTMLElement, size: { clientWidth: number; scrollWidth: number; scrollLeft: number }): void {
  Object.defineProperty(el, "clientWidth", { configurable: true, value: size.clientWidth });
  Object.defineProperty(el, "scrollWidth", { configurable: true, value: size.scrollWidth });
  el.scrollLeft = size.scrollLeft;
}

function chips(): HTMLElement[] {
  return within(screen.getByRole("list")).queryAllByRole("button");
}
function expectChips(numbers: number[]): void {
  const buttons = chips();
  expect(buttons).toHaveLength(numbers.length);
  if (numbers.length) expect(buttons.length).toBeGreaterThan(0);
  expect(buttons.map((button) => button.textContent)).toEqual(numbers.map(String));
}

describe("SentenceNavigator", () => {
  beforeEach(() => {
    state.index = 49;
    state.lines = Array.from({ length: 194 }, (_, index) => ({
      id: `line-${index}`, index, startTime: index, endTime: index + 1,
      textJp: "文", textTranslation: null, furigana: null,
    }));
    state.stats = null;
    vi.clearAllMocks();
    Element.prototype.scrollIntoView = scrollIntoView;
  });
  afterEach(() => { delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView; });

  it("pins the approved English and Vietnamese navigator copy", () => {
    expect(en.workspace.practice.navigator).toEqual({
      label: "Sentence navigator", earlier: "Earlier sentences", later: "Later sentences",
      chip: "Sentence {number}, {state}", draft: "in progress",
      state: { none: "not practised", scored: "scored {score}", needs_review: "needs review", unscored: "not scored yet", revealed: "answer shown", helped: "with help" },
    });
    expect(viMessages.workspace.practice.navigator).toEqual({
      label: "Điều hướng câu", earlier: "Các câu trước", later: "Các câu sau",
      chip: "Câu {number}, {state}", draft: "đang làm dở",
      state: { none: "chưa luyện", scored: "{score} điểm", needs_review: "cần ôn lại", unscored: "chưa chấm", revealed: "đã xem đáp án", helped: "có trợ giúp" },
    });
  });

  it("renders every sentence as a chip in one scroll rail, the shared current one marked", () => {
    render(<SentenceNavigator />);
    expectChips(Array.from({ length: 194 }, (_, i) => i + 1));
    expect(screen.getByRole("navigation", { name: "Sentence navigator" })).toBeInTheDocument();
    expect(screen.getByText("Sentence navigator")).toBeVisible();
    expect(screen.getByRole("button", { name: "Sentence 50, not practised" })).toHaveAttribute("aria-current", "true");
    expect(chips().filter((chip) => chip.hasAttribute("aria-current"))).toHaveLength(1);
    expect(rail()).toHaveClass("overflow-x-auto");
  });

  it("renders 431 chips", () => {
    state.lines = Array.from({ length: 431 }, (_, index) => ({ id: `line-${index}`, index, startTime: index, endTime: index + 1, textJp: "文", textTranslation: null, furigana: null }));
    render(<SentenceNavigator />);
    expect(chips()).toHaveLength(431);
  });

  it("seeks a chip without playing or replacing the shared current sentence", async () => {
    render(<SentenceNavigator />);
    await userEvent.click(screen.getByRole("button", { name: "Sentence 52, not practised" }));
    expect(state.seekToSentence).toHaveBeenCalledTimes(1);
    expect(state.seekToSentence).toHaveBeenCalledWith(51);
    expect(state.play).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Sentence 50, not practised" })).toHaveAttribute("aria-current", "true");
  });

  it("current chip in view: scrolled to the centre on mount and after the shared sentence moves", () => {
    const view = render(<SentenceNavigator />);
    const call = (n: number) => scrollIntoView.mock.contexts.findLast((el) => (el as HTMLElement).textContent === String(n));
    expect(call(50)).toBeDefined();
    expect(scrollIntoView).toHaveBeenLastCalledWith({ inline: "center", block: "nearest" });
    state.index = 100;
    view.rerender(<SentenceNavigator />);
    expect(call(101)).toBeDefined();
    expect(scrollIntoView.mock.contexts.at(-1)).toBe(screen.getByRole("button", { name: "Sentence 101, not practised" }));
  });

  it("‹ › page the rail by its visible width, without seeking", async () => {
    render(<SentenceNavigator />);
    const el = rail();
    sizeRail(el, { clientWidth: 300, scrollWidth: 3000, scrollLeft: 600 });
    fireEvent.scroll(el);
    const scrollBy = vi.fn();
    el.scrollBy = scrollBy as unknown as typeof el.scrollBy;
    await userEvent.click(screen.getByRole("button", { name: "Later sentences" }));
    expect(scrollBy).toHaveBeenLastCalledWith({ left: 300, behavior: "smooth" });
    await userEvent.click(screen.getByRole("button", { name: "Earlier sentences" }));
    expect(scrollBy).toHaveBeenLastCalledWith({ left: -300, behavior: "smooth" });
    expect(state.seekToSentence).not.toHaveBeenCalled();
  });

  it("‹ › are disabled at the rail's ends", () => {
    render(<SentenceNavigator />);
    const el = rail();
    sizeRail(el, { clientWidth: 300, scrollWidth: 3000, scrollLeft: 0 });
    fireEvent.scroll(el);
    expect(screen.getByRole("button", { name: "Earlier sentences" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: "Later sentences" })).toHaveAttribute("aria-disabled", "false");
    sizeRail(el, { clientWidth: 300, scrollWidth: 3000, scrollLeft: 2700 });
    fireEvent.scroll(el);
    expect(screen.getByRole("button", { name: "Earlier sentences" })).toHaveAttribute("aria-disabled", "false");
    expect(screen.getByRole("button", { name: "Later sentences" })).toHaveAttribute("aria-disabled", "true");
  });

  it("wheel scrolls horizontally when the rail overflows, and leaves the page alone otherwise", () => {
    render(<SentenceNavigator />);
    const el = rail();
    sizeRail(el, { clientWidth: 300, scrollWidth: 3000, scrollLeft: 100 });
    const event = new WheelEvent("wheel", { deltaY: 120, bubbles: true, cancelable: true });
    el.dispatchEvent(event);
    expect(el.scrollLeft).toBe(220);
    expect(event.defaultPrevented).toBe(true);
    sizeRail(el, { clientWidth: 300, scrollWidth: 300, scrollLeft: 0 });
    const still = new WheelEvent("wheel", { deltaY: 120, bubbles: true, cancelable: true });
    el.dispatchEvent(still);
    expect(el.scrollLeft).toBe(0);
    expect(still.defaultPrevented).toBe(false);
  });

  it("marks a sentence with a draft by a dot and its label", () => {
    render(<SentenceNavigator draftLineIds={new Set(["line-52"])} />);
    const chip = screen.getByRole("button", { name: "Sentence 53, not practised, in progress" });
    expect(chip.querySelector("[data-draft-dot]")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Sentence 52, not practised" }).querySelector("[data-draft-dot]")).toBeNull();
  });

  it("keeps disabled controls focusable, names their reason and blocks all actions", async () => {
    render(<SentenceNavigator disabled disabledHint="Finish recording first" />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(196);
    for (const button of [...buttons.slice(0, 3), ...buttons.slice(-3)]) {
      expect(button).toHaveAttribute("aria-disabled", "true");
      expect(button).toHaveAttribute("title", "Finish recording first");
      expect(button).not.toBeDisabled();
      await userEvent.click(button);
    }
    expect(state.seekToSentence).not.toHaveBeenCalled();
    expect(state.play).not.toHaveBeenCalled();
  });

  it("supports sequential keyboard navigation and Enter/Space activation", async () => {
    render(<SentenceNavigator />);
    const user = userEvent.setup();
    await user.tab();
    expect(screen.getByRole("button", { name: "Earlier sentences" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Sentence 1, not practised" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(state.seekToSentence).toHaveBeenLastCalledWith(0);
    await user.tab();
    await user.keyboard(" ");
    expect(state.seekToSentence).toHaveBeenLastCalledWith(1);
    expect(state.seekToSentence).toHaveBeenCalledTimes(2);
    expect(state.play).not.toHaveBeenCalled();
  });

  it.each([
    ["scored", 86, "scored 86", "text-success-strong"],
    ["needs_review", 86, "needs review", "text-accent-strong"],
    // P4: Show answer reads as review even when an older attempt scored high.
    ["revealed", 92, "answer shown", "text-accent-strong"],
    // §3.8: helped has its own tone, a dashed outline beside the scored ring.
    ["helped", 86, "with help", "outline-dashed"],
    ["unscored", null, "not scored yet", "ring-border"],
    ["none", null, "not practised", "text-muted-foreground"],
  ] as const)("uses the latest %s state and its token tone", (status, score, label, tone) => {
    state.stats = { lineCount: 194, scoredLines: 1, mean: score, helpedLines: null, lines: { "line-50": { state: status, score } } };
    render(<SentenceNavigator />);
    const chip = screen.getByRole("button", { name: `Sentence 51, ${label}` });
    expect(chip).toHaveAttribute("data-state", status);
    expect(chip).toHaveClass(tone);
  });

  it("updates labels and tones from refreshed stats without selecting another sentence", () => {
    const view = render(<SentenceNavigator />);
    expect(screen.getByRole("button", { name: "Sentence 51, not practised" })).toHaveAttribute("data-state", "none");
    state.stats = { lineCount: 194, scoredLines: 1, mean: 86, helpedLines: null, lines: { "line-50": { state: "scored", score: 86 } } };
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
