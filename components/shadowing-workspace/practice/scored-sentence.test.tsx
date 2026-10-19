import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { ScoredSentence } from "./scored-sentence";

describe("ScoredSentence", () => {
  it("marks exactly the scored Unicode characters, leaving punctuation plain", () => {
    const { container } = render(<ScoredSentence text="𠮷野、です。" spans={[
      { start: 0, end: 2, accuracy: 90, errorType: "None" },
      { start: 3, end: 5, accuracy: 40, errorType: "Mispronunciation" },
    ]} />);
    const marks = container.querySelectorAll("mark[data-error-type]");
    expect(marks).toHaveLength(2);
    expect(Array.from(marks, (mark) => mark.textContent)).toEqual(["𠮷野", "です"]);
    expect(marks[1]).toHaveAttribute("data-error-type", "Mispronunciation");
    expect(container.querySelector("p[lang=ja]")).toHaveTextContent("𠮷野、です。");
  });
  it("colours each word from the theme's text tokens; a <mark> otherwise keeps the browser's black", () => {
    const { container } = render(<ScoredSentence text="今日は雨です" spans={[
      { start: 0, end: 2, accuracy: 90, errorType: "None" },
      { start: 2, end: 3, accuracy: 70, errorType: "None" },
      { start: 3, end: 4, accuracy: 40, errorType: "Mispronunciation" },
      { start: 4, end: 6, accuracy: null, errorType: "None" },
    ]} />);
    const marks = Array.from(container.querySelectorAll("mark"));
    expect(marks[0]).toHaveClass("text-success-strong");
    expect(marks[1]).toHaveClass("text-accent-strong");
    expect(marks[2]).toHaveClass("text-danger-strong");
    expect(marks[3]).toHaveClass("text-inherit");
  });
  it("says each word's grade in words too, outside the sentence so selection offsets stay base text (review R-3)", () => {
    const { container } = render(<ScoredSentence text="今日は雨です" spans={[
      { start: 0, end: 2, accuracy: 90, errorType: "None" },
      { start: 2, end: 3, accuracy: 70, errorType: "None" },
      { start: 3, end: 4, accuracy: 40, errorType: "Mispronunciation" },
    ]} />);
    expect(container.querySelector("p[lang=ja]")).toHaveTextContent(/^今日は雨です$/);
    const summary = screen.getByTestId("word-grades");
    expect(summary).toHaveClass("sr-only");
    expect(summary).toHaveTextContent("Needs practice: 雨");
    expect(summary).toHaveTextContent("Good: は");
    expect(summary).toHaveTextContent("Strong: 今日");
  });
  it("shows the honest overall-only remark without word detail", () => {
    const { container } = render(<ScoredSentence text="日本語。" spans={null} />);
    expect(container.querySelectorAll("mark")).toHaveLength(0);
    expect(screen.getByText("日本語。")).toBeVisible();
    expect(screen.getByText(/Overall score only:/)).toBeVisible();
  });
});
