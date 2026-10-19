import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { render } from "@/test/render";
import type { Assessment } from "@/lib/pronunciation/assessment";
import { PronunciationAnalysis } from "./pronunciation-analysis";

const assessment = (overrides: Partial<Assessment> = {}): Assessment => ({
  v: 1, accuracy: 88, completeness: 100, recognizedText: "今日は雨です。",
  words: [
    { word: "今日", accuracy: 92, errorType: "None" },
    { word: "は", accuracy: 70, errorType: "None" },
    { word: "雨", accuracy: 40, errorType: "Mispronunciation" },
    { word: "です", accuracy: 0, errorType: "Omission" },
  ],
  ...overrides,
});
const result = (overrides: Partial<Assessment> = {}, pronunciationScore = 86, rhythmScore = 80) => ({ pronunciationScore, rhythmScore, assessment: assessment(overrides) });

describe("PronunciationAnalysis (owner sample 2026-10-19)", () => {
  it("leads with the whole-sentence score and its grade", () => {
    render(<PronunciationAnalysis result={result()} lineText="今日は雨です。" onPlayTake={vi.fn()} canPlayTake />);
    const overall = screen.getByRole("region", { name: "Pronunciation score" });
    expect(overall).toHaveTextContent("For the whole sentence");
    expect(within(overall).getByText("86")).toHaveClass("text-success-strong");
    expect(overall).toHaveTextContent("Excellent");
  });

  it("shows Accuracy, Fluency and Completeness, each coloured by its own grade, and no invented average", () => {
    render(<PronunciationAnalysis result={result({ completeness: 55 })} lineText="今日は雨です。" onPlayTake={vi.fn()} canPlayTake />);
    const metric = (name: string) => screen.getByText(name).closest("div") as HTMLElement;
    expect(within(metric("Accuracy")).getByText("88")).toHaveClass("text-success-strong");
    expect(within(metric("Fluency")).getByText("80")).toHaveClass("text-success-strong");
    expect(within(metric("Completeness")).getByText("55")).toHaveClass("text-danger-strong");
    expect(screen.queryByText(/average/i)).not.toBeInTheDocument();
  });

  it("hides a metric Azure did not report instead of showing 0", () => {
    render(<PronunciationAnalysis result={result({ accuracy: null })} lineText="今日は雨です。" onPlayTake={vi.fn()} canPlayTake />);
    expect(screen.queryByText("Accuracy")).not.toBeInTheDocument();
  });

  it("plays the take beside what the scorer heard", async () => {
    const onPlayTake = vi.fn();
    render(<PronunciationAnalysis result={result()} lineText="今日は雨です。" onPlayTake={onPlayTake} canPlayTake />);
    expect(screen.getByText("今日は雨です。")).toHaveAttribute("lang", "ja");
    await userEvent.click(screen.getByRole("button", { name: "Play my take" }));
    expect(onPlayTake).toHaveBeenCalledTimes(1);
  });

  it("lists every word with its score and grade; a word that was not heard is struck through and said so", async () => {
    render(<PronunciationAnalysis result={result()} lineText="今日は雨です。" onPlayTake={vi.fn()} canPlayTake />);
    const words = within(screen.getByRole("list", { name: "Word by word" })).getAllByRole("listitem");
    expect(words.map((word) => word.textContent)).toEqual(["今日92", "は70", "雨40", "ですnot heard0"]);
    expect(words[0]).toHaveAttribute("data-grade", "strong");
    expect(words[1]).toHaveAttribute("data-grade", "good");
    expect(words[2]).toHaveAttribute("data-grade", "needsWork");
    expect(within(words[3] as HTMLElement).getByText("です")).toHaveClass("line-through");
    const help = screen.getByRole("button", { name: "How to read the colours" });
    expect(help).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(help);
    expect(help).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/red needs practice/)).toBeVisible();
  });

  it("warns when what was read does not match the sentence: low completeness or words that cannot be aligned", () => {
    const view = render(<PronunciationAnalysis result={result({ completeness: 30 })} lineText="今日は雨です。" onPlayTake={vi.fn()} canPlayTake />);
    expect(screen.getByRole("note")).toHaveTextContent("doesn't match this sentence");
    view.rerender(<PronunciationAnalysis result={result({ words: [{ word: "はい", accuracy: 36, errorType: "None" }] })} lineText="皆さん、こんにちは。" onPlayTake={vi.fn()} canPlayTake />);
    expect(screen.getByRole("note")).toBeInTheDocument();
    view.rerender(<PronunciationAnalysis result={result()} lineText="今日は雨です。" onPlayTake={vi.fn()} canPlayTake />);
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });

  it("says plainly when the take carries no detail", () => {
    render(<PronunciationAnalysis result={{ pronunciationScore: 70, rhythmScore: 60, assessment: null }} lineText="今日は雨です。" onPlayTake={vi.fn()} canPlayTake />);
    expect(screen.getByText("No detail recorded for this attempt")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Word by word" })).not.toBeInTheDocument();
  });
});
