import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@/test/render";
import type { PracticeStats } from "@/lib/data/practice-stats";
import type { WorkspaceLine } from "@/lib/shadowing-workspace/types";
import { LessonStatStrip } from "./lesson-stat-strip";
import en from "@/messages/en/shadowing.json";
import viMessages from "@/messages/vi/shadowing.json";

const state = vi.hoisted(() => ({ stats: null as PracticeStats | null, index: 50 as number | null }));
const lines = Array.from({ length: 194 }, (_, index) => ({ id: `line-${index}` })) as WorkspaceLine[];
vi.mock("../workspace-context", () => ({ useLesson: () => ({ video: { title: "Ep.729" }, lines }), useCurrentSentence: () => ({ index: state.index }) }));
vi.mock("./practice-stats-context", () => ({ usePracticeStats: () => ({ stats: state.stats, refresh: vi.fn() }) }));

const stat = (name: "sentence" | "scored" | "average") => {
  const cell = screen.getByTestId("lesson-stat-strip").querySelector<HTMLElement>(`[data-stat="${name}"]`);
  if (!cell) throw new Error(`no ${name} stat`);
  return cell;
};

describe("LessonStatStrip", () => {
  beforeEach(() => {
    state.stats = { lineCount: 194, scoredLines: 12, mean: 83.6, lines: {} };
    state.index = 50;
  });

  it("pins the English and Vietnamese strip labels (owner 2026-10-19: no lesson title, three labelled stats)", () => {
    expect(en.workspace.practice.strip).toEqual({ label: "Lesson progress", sentence: "Sentence", scored: "Scored", average: "Average", noScore: "No score yet" });
    expect(viMessages.workspace.practice.strip).toEqual({ label: "Tiến độ bài học", sentence: "Câu", scored: "Đã chấm", average: "Điểm TB", noScore: "Chưa có điểm" });
  });

  it("shows the current sentence, scored lines and rounded mean as labelled values, without the lesson title", () => {
    render(<LessonStatStrip mode="pronunciation" />);
    const strip = screen.getByTestId("lesson-stat-strip");
    expect(within(strip).queryByText("Ep.729")).not.toBeInTheDocument();
    expect(within(stat("sentence")).getByRole("term")).toHaveTextContent("Sentence");
    expect(within(stat("sentence")).getByRole("definition")).toHaveTextContent("51/194");
    expect(within(stat("scored")).getByRole("definition")).toHaveTextContent("12/194");
    expect(within(stat("average")).getByRole("definition")).toHaveTextContent("84");
  });

  it("says there is no score yet instead of fabricating one", () => {
    state.stats = { lineCount: 194, lines: {}, mean: null, scoredLines: 0 };
    render(<LessonStatStrip mode="pronunciation" />);
    expect(within(stat("average")).getByRole("definition")).toHaveTextContent("—");
    expect(within(stat("average")).getByText("No score yet")).toHaveClass("sr-only");
    expect(within(stat("scored")).getByRole("definition")).toHaveTextContent("0/194");
  });

  it("shows dashes, not zeros, while stats are unavailable", () => {
    state.stats = null;
    render(<LessonStatStrip mode="pronunciation" />);
    expect(within(stat("sentence")).getByRole("definition")).toHaveTextContent("51/194");
    expect(within(stat("scored")).getByRole("definition")).toHaveTextContent("—");
    expect(within(stat("average")).getByRole("definition")).toHaveTextContent("—");
  });

  it("uses an em dash when no sentence is current", () => {
    state.index = null;
    render(<LessonStatStrip mode="pronunciation" />);
    expect(within(stat("sentence")).getByRole("definition")).toHaveTextContent("—/194");
  });

  it("pins the Listening strip, format and cover copy in English and Vietnamese", () => {
    const pinned = ({ format, strip, cover }: typeof en.workspace.practice.listening) => ({ format, strip, cover });
    expect(pinned(en.workspace.practice.listening)).toEqual({
      format: { word_bank: "Word Bank", typing: "Typing" },
      strip: { submitted: "{format} · Submitted" },
      cover: { title: "Listen only", show: "Show video" },
    });
    expect(pinned(viMessages.workspace.practice.listening)).toEqual({
      format: { word_bank: "Xếp cụm từ", typing: "Gõ chính tả" },
      strip: { submitted: "{format} · Đã nộp" },
      cover: { title: "Chỉ nghe", show: "Hiện video" },
    });
  });

  it.each([["typing", "Typing"], ["word_bank", "Word Bank"]] as const)("labels a Listening %s strip with its format only, as a percentage (formats never averaged)", (mode, label) => {
    render(<LessonStatStrip mode={mode} />);
    expect(screen.getByTestId("lesson-stat-strip")).toHaveAttribute("data-mode", mode);
    expect(within(stat("scored")).getByRole("term")).toHaveTextContent(`${label} · Submitted`);
    expect(within(stat("scored")).getByRole("definition")).toHaveTextContent("12/194");
    expect(within(stat("average")).getByRole("definition")).toHaveTextContent("84%");
    expect(within(stat("sentence")).getByRole("definition")).toHaveTextContent("51/194");
  });

  it("keeps Pronunciation's own label and a bare average", () => {
    render(<LessonStatStrip mode="pronunciation" />);
    expect(within(stat("scored")).getByRole("term")).toHaveTextContent(/^Scored$/);
    expect(within(stat("average")).getByRole("definition")).toHaveTextContent(/^84$/);
  });
});
