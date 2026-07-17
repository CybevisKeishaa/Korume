import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import type { JlptAttemptRow, JlptLevel } from "@/lib/jlpt-ui";
import { JlptAttemptList } from "./jlpt-attempt-list";

const TESTS_BY_ID: Record<string, { title: string; level: JlptLevel }> = {
  "test-1": { title: "Đề luyện N5 #1", level: "N5" },
};

function fullAttempt(overrides: Partial<JlptAttemptRow> = {}): JlptAttemptRow {
  return {
    id: "attempt-1",
    test_id: "test-1",
    score: 100,
    section_scores: {},
    mode: "full",
    section: null,
    started_at: "2026-07-12T00:00:00.000Z",
    completed_at: "2026-07-12T00:20:00.000Z",
    ...overrides,
  };
}

describe("JlptAttemptList", () => {
  it("shows an empty state when there are no attempts", () => {
    render(<JlptAttemptList attempts={[]} testsById={TESTS_BY_ID} />);
    expect(screen.getByText(/no attempts yet/i)).toBeInTheDocument();
  });

  it("renders a full-mode attempt's test title, level, and scaled score", () => {
    render(<JlptAttemptList attempts={[fullAttempt()]} testsById={TESTS_BY_ID} />);
    expect(screen.getByText("Đề luyện N5 #1")).toBeInTheDocument();
    expect(screen.getByText("N5")).toBeInTheDocument();
    expect(screen.getByText(/full mock/i)).toBeInTheDocument();
    expect(screen.getByText("100 / 180")).toBeInTheDocument();
  });

  it("renders a section-mode attempt as a percent score", () => {
    render(
      <JlptAttemptList
        attempts={[fullAttempt({ mode: "section", section: "vocab", score: 75 })]}
        testsById={TESTS_BY_ID}
      />,
    );
    expect(screen.getByText(/section: vocabulary/i)).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument();
  });

  it("links each attempt back to its test", () => {
    render(<JlptAttemptList attempts={[fullAttempt()]} testsById={TESTS_BY_ID} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/en/jlpt/test-1");
  });
});
