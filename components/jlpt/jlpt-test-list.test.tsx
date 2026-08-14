import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import type { JlptTestListItem } from "@/lib/jlpt-ui";
import { JlptTestList } from "./jlpt-test-list";

const TEST: JlptTestListItem = {
  id: "11111111-1111-1111-1111-111111111111",
  level: "N5",
  title: "Đề luyện N5 #1",
  section_config: {
    sections: [
      { section: "vocab", question_count: 12, time_limit_minutes: 20 },
      { section: "listening", question_count: 6, time_limit_minutes: 15 },
    ],
  },
};

describe("JlptTestList", () => {
  it("shows an empty state when there are no tests", () => {
    render(<JlptTestList tests={[]} />);
    expect(screen.getByText(/no jlpt tests at this level yet/i)).toBeInTheDocument();
  });

  it("renders a card per test with level, title, and section summary", () => {
    render(<JlptTestList tests={[TEST]} />);

    expect(screen.getByText("N5")).toBeInTheDocument();
    expect(screen.getByText("Đề luyện N5 #1")).toBeInTheDocument();
    expect(screen.getByText(/12 questions · 20 min/i)).toBeInTheDocument();
    expect(screen.getByText(/6 questions · 15 min/i)).toBeInTheDocument();
  });

  it("links to the full mock and to each section's practice route", () => {
    render(<JlptTestList tests={[TEST]} />);

    expect(screen.getByRole("link", { name: /take full mock/i })).toHaveAttribute(
      "href",
      "/en/certification/11111111-1111-1111-1111-111111111111",
    );
    expect(screen.getByRole("link", { name: /practice vocabulary/i })).toHaveAttribute(
      "href",
      "/en/certification/11111111-1111-1111-1111-111111111111?section=vocab",
    );
    expect(screen.getByRole("link", { name: /practice listening/i })).toHaveAttribute(
      "href",
      "/en/certification/11111111-1111-1111-1111-111111111111?section=listening",
    );
  });

  it("renders one card per test", () => {
    render(<JlptTestList tests={[TEST, { ...TEST, id: "2", title: "Đề luyện N5 #2" }]} />);
    // Scoped to a per-test link (not "listitem": each card's own section
    // summary is itself a nested <ul>/<li>, so a bare listitem count would
    // also pick those up).
    expect(screen.getAllByRole("link", { name: /take full mock/i })).toHaveLength(2);
  });
});
