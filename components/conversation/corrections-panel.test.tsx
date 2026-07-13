import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CorrectionsPanel } from "./corrections-panel";

describe("CorrectionsPanel", () => {
  it("renders each correction and the encouragement, labeled AI-generated", () => {
    render(
      <CorrectionsPanel
        result={{
          corrections: [
            { original: "私は学生です", corrected: "私は学生でした", explanation: "Past tense needed here." },
          ],
          encouragement: "Great effort today!",
          model: "claude-opus-4-8",
        }}
      />,
    );

    expect(screen.getByText("私は学生です")).toBeInTheDocument();
    expect(screen.getByText("私は学生でした")).toBeInTheDocument();
    expect(screen.getByText(/past tense needed here/i)).toBeInTheDocument();
    expect(screen.getByText(/great effort today/i)).toBeInTheDocument();
    expect(screen.getByText(/ai-generated/i)).toBeInTheDocument();
  });

  it("shows a message when there are no corrections", () => {
    render(<CorrectionsPanel result={{ corrections: [], encouragement: "Nicely done!", model: "m" }} />);
    expect(screen.getByText(/no corrections/i)).toBeInTheDocument();
  });
});
