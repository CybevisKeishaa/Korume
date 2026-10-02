import { fireEvent, screen } from "@testing-library/react";
import { render } from "@/test/render";
import { describe, expect, it } from "vitest";
import { SectionContent } from "./section-renderers";

const XSS = "<img src=x onerror=alert(1)>";

describe("SectionContent", () => {
  it("renders model fields as text, never as HTML", () => {
    const { container } = render(<SectionContent view="summary" content={{ summary: XSS, literal: XSS, keyPoints: [XSS] }} preview={false} />);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getAllByText(XSS, { exact: false })).toHaveLength(3);
  });

  it("survives content of the wrong shape", () => {
    const { container } = render(<SectionContent view="patterns" content={{ items: "nope" }} preview={false} />);
    expect(container.querySelectorAll("li")).toHaveLength(0);
  });

  it("grades a quiz on click and shows the explanation", () => {
    render(<SectionContent view="quiz" content={{ questions: [{ prompt: "Which?", choices: ["a", "b", "c"], answerIndex: 1, explanation: "Because b." }] }} preview={false} />);
    fireEvent.click(screen.getByRole("button", { name: "c" }));
    expect(screen.getByRole("status")).toHaveTextContent("Not quite. Because b.");
    expect(screen.getByRole("button", { name: "a" })).toBeDisabled();
  });

  it("does not grade a question whose answer is outside its choices, or a preview", () => {
    render(<SectionContent view="quiz" content={{ questions: [
      { prompt: "Broken?", choices: ["a", "b"], answerIndex: 5, explanation: "x" },
      { prompt: "Half?", choices: ["a", "b"], answerIndex: 0.5, explanation: "x" },
    ] }} preview={false} />);
    for (const button of screen.getAllByRole("button")) expect(button).toBeDisabled();
  });

  it("renders a dialogue with one speak button per turn and no speaker for a bad role", () => {
    render(<SectionContent view="dialogue" content={{
      context: "At a café.", roles: ["Staff", "Guest"],
      turns: [
        { role: 0, jp: "いらっしゃいませ", reading: "いらっしゃいませ", translation: "Welcome." },
        { role: 7, jp: "どうも", reading: "どうも", translation: "Thanks." },
      ],
    }} preview={false} />);
    expect(screen.getByText("Staff")).toBeInTheDocument();
    expect(screen.queryByText("Guest")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Play line 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Play line 2" })).toBeInTheDocument();
  });
});
