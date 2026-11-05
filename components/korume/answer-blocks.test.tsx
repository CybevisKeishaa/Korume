import { describe, expect, it } from "vitest";
import { render } from "@/test/render";
import type { Answer } from "@/lib/korume/answer";
import { AnswerBlocks } from "./answer-blocks";

const show = (answer: Answer) => render(<AnswerBlocks answer={answer} grounding={[]} />);

describe("AnswerBlocks", () => {
  it("renders a v1 answer exactly as before", () => {
    const { container } = show({
      blocks: [
        { type: "paragraph", runs: [{ text: "Use " }, { jp: "は" }, { text: "bold", strong: true }] },
        { type: "example", jp: "私は学生です", ruby: [], translation: "I am a student" },
        { type: "followups", chips: ["Why?"] },
      ],
    });
    expect(container.innerHTML).toMatchSnapshot();
  });

  it("renders headings, wrapping a leading numeral at level 1", () => {
    const { getAllByRole } = show({ blocks: [
      { type: "heading", level: 1, runs: [{ text: "1. Meaning" }] },
      { type: "heading", level: 2, runs: [{ text: "Details" }] },
    ] });
    const h1 = getAllByRole("heading")[0] as HTMLElement, h2 = getAllByRole("heading")[1] as HTMLElement;
    expect(h1.textContent).toBe("1. Meaning");
    expect(h1.querySelector(".text-primary-strong")?.textContent).toBe("1.");
    expect(h2.className).toContain("text-body");
    expect(h2.querySelector(".text-primary-strong")).toBeNull();
  });

  it("wraps a circled numeral too", () => {
    const { getByRole } = show({ blocks: [{ type: "heading", level: 1, runs: [{ text: "① Start" }] }] });
    expect(getByRole("heading").querySelector(".text-primary-strong")?.textContent).toBe("①");
  });

  it("renders number, bullet and check lists", () => {
    const { container, getByText } = show({ blocks: [
      { type: "list", style: "number", items: [{ runs: [{ text: "a" }] }] },
      { type: "list", style: "bullet", items: [{ runs: [{ text: "b" }] }] },
      { type: "list", style: "check", items: [{ mark: "bad", runs: [{ text: "c" }] }, { mark: "good", runs: [{ text: "d" }] }] },
    ] });
    expect(container.querySelectorAll("ol")).toHaveLength(1);
    expect(container.querySelectorAll("ul")).toHaveLength(2);
    expect(getByText("Wrong")).toBeTruthy();
    expect(getByText("Correct")).toBeTruthy();
  });

  it("renders a table with column headers, jp cells, ragged rows and a scroll wrapper", () => {
    const { container, getAllByRole } = show({ blocks: [{ type: "table",
      header: [[{ text: "Form" }], [{ text: "Use" }]],
      rows: [[[{ jp: "食べる" }], [{ text: "eat" }]], [[{ text: "short" }]]],
    }] });
    const heads = getAllByRole("columnheader");
    expect(heads.map((h) => h.textContent)).toEqual(["Form", "Use"]);
    heads.forEach((h) => expect(h.getAttribute("scope")).toBe("col"));
    expect(container.querySelector("td [lang='ja']")?.textContent).toBe("食べる");
    expect(container.querySelector("table")?.parentElement?.className).toContain("overflow-x-auto");
  });

  it("shows markup in a table cell as text", () => {
    const { container } = show({ blocks: [{ type: "table", header: [[{ text: "a" }], [{ text: "b" }]], rows: [[[{ text: "<script>x</script>" }]]] }] });
    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toContain("<script>x</script>");
  });
});
