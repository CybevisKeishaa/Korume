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
  it("shows the honest overall-only remark without word detail", () => {
    const { container } = render(<ScoredSentence text="日本語。" spans={null} />);
    expect(container.querySelectorAll("mark")).toHaveLength(0);
    expect(screen.getByText("日本語。")).toBeVisible();
    expect(screen.getByText(/Overall score only:/)).toBeVisible();
  });
});
