import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { JlptQuestionPublic } from "@/lib/jlpt-ui";
import { JlptQuestionCard } from "./jlpt-question-card";

function question(overrides: Partial<JlptQuestionPublic> = {}): JlptQuestionPublic {
  return {
    id: "q-1",
    section: "vocab",
    question_type: "kanji-reading",
    order_index: 0,
    question_data: {
      stem: "「学校」の読み方はどれですか。",
      choices: ["がっこう", "がくこう", "がっこ", "かっこう"],
    },
    ...overrides,
  };
}

describe("JlptQuestionCard", () => {
  it("renders the stem and four choices as a radiogroup", () => {
    render(<JlptQuestionCard question={question()} index={0} total={5} selected={undefined} onSelect={vi.fn()} />);
    expect(screen.getByText("「学校」の読み方はどれですか。")).toBeInTheDocument();
    expect(screen.getByRole("radiogroup")).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(4);
  });

  it("marks the selected choice as checked", () => {
    render(<JlptQuestionCard question={question()} index={0} total={5} selected="1" onSelect={vi.fn()} />);
    const radios = screen.getAllByRole("radio");
    expect(radios[1]).toHaveAttribute("aria-checked", "true");
    expect(radios[0]).toHaveAttribute("aria-checked", "false");
  });

  it("selects a choice on click", async () => {
    const onSelect = vi.fn();
    render(<JlptQuestionCard question={question()} index={0} total={5} selected={undefined} onSelect={onSelect} />);
    await userEvent.click(screen.getByText("がくこう"));
    expect(onSelect).toHaveBeenCalledWith("1");
  });

  it("moves selection with ArrowDown/ArrowUp from within the radiogroup", async () => {
    const onSelect = vi.fn();
    // This is a controlled component and the test doesn't re-render with an
    // updated `selected` between key presses, so each key press computes its
    // target relative to the same fixed `selected="0"` prop (as a real
    // parent would re-render with the new value after the first `onSelect`,
    // making the second key press relative to the newly-selected choice).
    render(<JlptQuestionCard question={question()} index={0} total={5} selected="0" onSelect={onSelect} />);
    // Roving tabindex: the selected radio (index 0) is the one in tab order.
    screen.getAllByRole("radio")[0]!.focus();
    await userEvent.keyboard("{ArrowDown}");
    expect(onSelect).toHaveBeenCalledWith("1");

    onSelect.mockClear();
    await userEvent.keyboard("{ArrowUp}");
    // Previous of index 0, wrapping, is the last choice (index 3).
    expect(onSelect).toHaveBeenCalledWith("3");
  });

  it("wraps from the last choice back to the first on ArrowDown", async () => {
    const onSelect = vi.fn();
    render(<JlptQuestionCard question={question()} index={0} total={5} selected="3" onSelect={onSelect} />);
    screen.getAllByRole("radio")[3]!.focus();
    await userEvent.keyboard("{ArrowDown}");
    expect(onSelect).toHaveBeenCalledWith("0");
  });

  it("selects a choice directly via number-key shortcuts 1-4", async () => {
    const onSelect = vi.fn();
    render(<JlptQuestionCard question={question()} index={0} total={5} selected={undefined} onSelect={onSelect} />);
    // Nothing selected yet: the first radio is the one in tab order.
    screen.getAllByRole("radio")[0]!.focus();
    await userEvent.keyboard("3");
    expect(onSelect).toHaveBeenCalledWith("2");
  });

  it("shows a collapsible passage when it is long, and inline otherwise", () => {
    const shortPassage = question({ question_data: { ...question().question_data, passage: "短い文章。" } });
    render(<JlptQuestionCard question={shortPassage} index={0} total={5} selected={undefined} onSelect={vi.fn()} />);
    expect(screen.getByText("短い文章。")).toBeInTheDocument();
    expect(screen.queryByText(/reading passage/i)).not.toBeInTheDocument();

    const longPassage = question({
      question_data: { ...question().question_data, passage: "長い。".repeat(150) },
    });
    render(<JlptQuestionCard question={longPassage} index={0} total={5} selected={undefined} onSelect={vi.fn()} />);
    expect(screen.getByText(/reading passage/i)).toBeInTheDocument();
  });

  it("shows a listening play button when the question has audio_text", () => {
    const listening = question({ question_data: { ...question().question_data, audio_text: "こんにちは" } });
    render(<JlptQuestionCard question={listening} index={0} total={5} selected={undefined} onSelect={vi.fn()} />);
    expect(screen.getByRole("button", { name: /play audio/i })).toBeInTheDocument();
  });

  it("has no listening play button when audio_text is absent", () => {
    render(<JlptQuestionCard question={question()} index={0} total={5} selected={undefined} onSelect={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /play audio/i })).not.toBeInTheDocument();
  });
});
