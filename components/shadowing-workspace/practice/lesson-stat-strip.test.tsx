import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@/test/render";
import type { PracticeStats } from "@/lib/data/practice-stats";
import type { WorkspaceLine } from "@/lib/shadowing-workspace/types";
import { LessonStatStrip } from "./lesson-stat-strip";
import en from "@/messages/en/shadowing.json";
import viMessages from "@/messages/vi/shadowing.json";

const state = vi.hoisted(() => ({ stats: null as PracticeStats | null, index: 50 as number | null, duration: 1200 as number | null }));
// One line every 6 s: sentence 51 starts at 300 s.
const lines = Array.from({ length: 194 }, (_, index) => ({ id: `line-${index}`, startTime: index * 6, endTime: index * 6 + 5 })) as WorkspaceLine[];
vi.mock("../workspace-context", () => ({ useLesson: () => ({ video: { title: "Ep.729", durationSeconds: state.duration }, lines }), useCurrentSentence: () => ({ index: state.index }) }));
vi.mock("./practice-stats-context", () => ({ usePracticeStats: () => ({ stats: state.stats, refresh: vi.fn() }) }));

const stat = (name: "sentence" | "completed" | "accuracy" | "videoLeft") => {
  const cell = screen.getByTestId("lesson-stat-strip").querySelector<HTMLElement>(`[data-stat="${name}"]`);
  if (!cell) throw new Error(`no ${name} stat`);
  return cell;
};

describe("LessonStatStrip", () => {
  beforeEach(() => {
    state.stats = { lineCount: 194, scoredLines: 12, mean: 83.6, helpedLines: null, lines: {} };
    state.index = 50;
    state.duration = 1200;
  });

  it("pins the English and Vietnamese strip copy (WP spec §3.7: the frame's bar, four stats)", () => {
    expect(en.workspace.practice.strip).toEqual({
      label: "Lesson progress", position: "Position: sentence {n} of {total}", sentence: "Sentence", completed: "Completed", accuracy: "Accuracy",
      videoLeft: "Video left", minutes: "{count} min", underMinute: "<1 min", noScore: "No score yet",
    });
    expect(viMessages.workspace.practice.strip).toEqual({
      label: "Tiến độ bài học", position: "Vị trí: câu {n}/{total}", sentence: "Câu", completed: "Đã hoàn thành", accuracy: "Độ chính xác",
      videoLeft: "Video còn lại", minutes: "{count} phút", underMinute: "<1 phút", noScore: "Chưa có điểm",
    });
  });

  it("shows the sentence, completed lines, rounded accuracy and video left, without the lesson title", () => {
    render(<LessonStatStrip mode="pronunciation" />);
    const strip = screen.getByTestId("lesson-stat-strip");
    expect(within(strip).queryByText("Ep.729")).not.toBeInTheDocument();
    expect(within(stat("sentence")).getByRole("term")).toHaveTextContent("Sentence");
    expect(within(stat("sentence")).getByRole("definition")).toHaveTextContent("51/194");
    expect(within(stat("completed")).getByRole("term")).toHaveTextContent("Completed");
    expect(within(stat("completed")).getByRole("definition")).toHaveTextContent("12/194");
    expect(within(stat("accuracy")).getByRole("definition")).toHaveTextContent(/^84$/);
    expect(within(stat("videoLeft")).getByRole("term")).toHaveTextContent("Video left");
    expect(within(stat("videoLeft")).getByRole("definition")).toHaveTextContent("15 min");
  });

  it("the position line is a marker at the sentence, never a filled bar", () => {
    render(<LessonStatStrip mode="pronunciation" />);
    const position = screen.getByRole("img", { name: "Position: sentence 51 of 194" });
    const marker = required(position.querySelector<HTMLElement>("[data-position-marker]"));
    expect(marker.style.left).toMatch(/%$/);
    expect(parseFloat(marker.style.left)).toBeCloseTo((100 * 50) / 193, 3);
    expect(marker.style.width).toBe("");
  });

  it("video left reads <1 min under a minute and a dash when nothing says where the video ends", () => {
    state.index = 193; // starts at 1158 s: 42 s left
    const view = render(<LessonStatStrip mode="pronunciation" />);
    expect(within(stat("videoLeft")).getByRole("definition")).toHaveTextContent("<1 min");
    view.unmount();
    state.index = null;
    render(<LessonStatStrip mode="pronunciation" />);
    expect(within(stat("videoLeft")).getByRole("definition")).toHaveTextContent("—");
  });

  it("says there is no score yet instead of fabricating one", () => {
    state.stats = { lineCount: 194, lines: {}, mean: null, scoredLines: 0, helpedLines: null };
    render(<LessonStatStrip mode="pronunciation" />);
    expect(within(stat("accuracy")).getByRole("definition")).toHaveTextContent("—");
    expect(within(stat("accuracy")).getByText("No score yet")).toHaveClass("sr-only");
    expect(within(stat("completed")).getByRole("definition")).toHaveTextContent("0/194");
  });

  it("shows dashes, not zeros, while stats are unavailable", () => {
    state.stats = null;
    render(<LessonStatStrip mode="pronunciation" />);
    expect(within(stat("sentence")).getByRole("definition")).toHaveTextContent("51/194");
    expect(within(stat("completed")).getByRole("definition")).toHaveTextContent("—");
    expect(within(stat("accuracy")).getByRole("definition")).toHaveTextContent("—");
  });

  it("uses an em dash when no sentence is current, and no marker", () => {
    state.index = null;
    render(<LessonStatStrip mode="pronunciation" />);
    expect(within(stat("sentence")).getByRole("definition")).toHaveTextContent("—/194");
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("pins the Listening exercise names and the dock's Show video copy in English and Vietnamese", () => {
    const pinned = ({ format, cover }: typeof en.workspace.practice.listening) => ({ format, cover });
    expect(pinned(en.workspace.practice.listening)).toEqual({ format: { dictation: "Dictation", cloze: "Fill in the blanks" }, cover: { show: "Show video" } });
    expect(pinned(viMessages.workspace.practice.listening)).toEqual({ format: { dictation: "Chép chính tả", cloze: "Điền từ" }, cover: { show: "Hiện video" } });
    expect("strip" in en.workspace.practice.listening).toBe(false);
  });

  it.each(["dictation", "cloze"] as const)("a Listening %s strip shows that exercise's stats, accuracy as a percentage (exercises never averaged)", (mode) => {
    render(<LessonStatStrip mode={mode} />);
    expect(screen.getByTestId("lesson-stat-strip")).toHaveAttribute("data-mode", mode);
    expect(within(stat("completed")).getByRole("definition")).toHaveTextContent("12/194");
    expect(within(stat("accuracy")).getByRole("definition")).toHaveTextContent("84%");
    expect(within(stat("sentence")).getByRole("definition")).toHaveTextContent("51/194");
  });
});

function required<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error("expected a value");
  return value;
}
