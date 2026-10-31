import { fireEvent, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "@/test/render";
import { bankOrder } from "@/lib/dictation/shuffle";
import type { LineCloze } from "@/lib/dictation/types";
import { ClozePanel, clozeHints } from "./cloze-panel";

/** 毎日日本語を勉強しました。 with blanks 日本語 (にほんご) and 勉強 (べんきょう), as `GET …/cloze` sends it. */
const CLOZE: LineCloze = {
  version: 1, textHash: "c".repeat(64), blanks: [1, 3], readings: ["にほんご", "べんきょう"],
  segments: [
    { text: "毎日", blank: null, romaji: "mainichi" }, { text: "日本語", blank: 0, romaji: "___" }, { text: "を", blank: null, romaji: "wo" },
    { text: "勉強", blank: 1, romaji: "___" }, { text: "しました。", blank: null, romaji: "shimashita." },
  ],
};
const ANSWER_TEXT = ["日本語", "勉強", "にほんご", "べんきょう", "___"];
type Props = Parameters<typeof ClozePanel>[0];
const base = (): Props => ({ cloze: CLOZE, easy: false, answers: ["", ""], hinted: [], results: null, revealed: false, submitting: false, onChange: vi.fn(), onUseChip: vi.fn(), onCheck: vi.fn() });
/** The panel with its answers held like the attempt hook holds them. */
function Harness(props: Partial<Props>) {
  const [answers, setAnswers] = useState(props.answers ?? ["", ""]);
  return <ClozePanel {...base()} {...props} answers={answers} onChange={(next) => { setAnswers(next); props.onChange?.(next); }} />;
}
const blank = (n: number) => screen.getByRole("textbox", { name: `Blank ${n}` });
const check = () => screen.getByRole("button", { name: "Check" });
const bank = () => screen.getByRole("list", { name: "Word bank" });

describe("clozeHints", () => {
  it("flat hint indices over the readings end to end: per-blank prefixes, the lowest unfinished blank's next index, the total", () => {
    expect(clozeHints(CLOZE.readings, [])).toEqual({ prefixes: ["", ""], next: 0, total: 9 });
    expect(clozeHints(CLOZE.readings, [4, 5])).toEqual({ prefixes: ["", "べん"], next: 0, total: 9 });
    expect(clozeHints(CLOZE.readings, [0, 1, 2, 3])).toEqual({ prefixes: ["にほんご", ""], next: 4, total: 9 });
    expect(clozeHints(CLOZE.readings, [0, 1, 2, 3, 4, 5, 6, 7, 8]).next).toBeNull();
  });
});

describe("ClozePanel", () => {
  it("renders the blanks as inputs in sentence order, and no blank's surface or reading anywhere in the DOM (D4)", () => {
    const { container } = render(<ClozePanel {...base()} />);
    const inputs = screen.getAllByRole("textbox");
    expect(inputs.map((input) => input.getAttribute("aria-label"))).toEqual(["Blank 1", "Blank 2"]);
    expect(container.textContent).toContain("毎日");
    expect(container.textContent).toContain("しました。");
    for (const text of ANSWER_TEXT) expect(container.innerHTML).not.toContain(text);
    expect(screen.queryByRole("list", { name: "Word bank" })).toBeNull();
  });

  it("enables Check only when every blank has text; Enter checks, never mid-composition", () => {
    const onCheck = vi.fn();
    render(<Harness onCheck={onCheck} />);
    expect(check()).toBeDisabled();
    fireEvent.change(blank(1), { target: { value: "にほんご" } });
    expect(check()).toBeDisabled();
    fireEvent.keyDown(blank(1), { key: "Enter" });
    expect(onCheck).not.toHaveBeenCalled();
    fireEvent.change(blank(2), { target: { value: "  " } });
    expect(check()).toBeDisabled();
    fireEvent.change(blank(2), { target: { value: "勉強" } });
    expect(check()).toBeEnabled();
    fireEvent.keyDown(blank(2), { key: "Enter", isComposing: true });
    fireEvent.keyDown(blank(2), { key: "Enter", keyCode: 229 });
    expect(onCheck).not.toHaveBeenCalled();
    fireEvent.keyDown(blank(2), { key: "Enter" });
    fireEvent.click(check());
    expect(onCheck).toHaveBeenCalledTimes(2);
  });

  it("a hinted prefix is read-only text at the start of its box, announced with the input; typing adds after it", () => {
    const onChange = vi.fn();
    render(<Harness hinted={[4, 5]} answers={["", "べん"]} onChange={onChange} />);
    expect(blank(2)).toHaveValue("");
    expect(blank(2)).toHaveAccessibleDescription("Hint: べん");
    const prefix = required(blank(2).previousElementSibling);
    expect(prefix).toHaveTextContent("べん");
    expect(prefix.tagName).not.toBe("INPUT");
    expect(prefix.closest("[contenteditable]")).toBeNull();
    fireEvent.change(blank(2), { target: { value: "きょう" } });
    expect(onChange).toHaveBeenLastCalledWith(["", "べんきょう"]);
    expect(blank(2)).toHaveValue("きょう");
    expect(blank(1)).not.toHaveAccessibleDescription();
  });

  it("easy mode: the blanks' words as shuffled chips; a chip fills the focused or first empty blank and is used once", () => {
    const onUseChip = vi.fn();
    const onChange = vi.fn();
    render(<Harness easy onUseChip={onUseChip} onChange={onChange} />);
    const words = ["日本語", "勉強"];
    expect(within(bank()).getAllByRole("button").map((chip) => chip.textContent)).toEqual(bankOrder(2, CLOZE.textHash).map((i) => words[i]));
    fireEvent.focus(blank(2));
    fireEvent.click(within(bank()).getByRole("button", { name: "日本語" }));
    expect(onChange).toHaveBeenLastCalledWith(["", "日本語"]);
    expect(onUseChip).toHaveBeenCalledTimes(1);
    expect(within(bank()).queryByRole("button", { name: "日本語" })).toBeNull();
    // The filled blank is now the chip; the first empty blank takes the next one.
    expect(screen.getByRole("button", { name: "Blank 2, 日本語" })).toBeInTheDocument();
    fireEvent.click(within(bank()).getByRole("button", { name: "勉強" }));
    expect(onChange).toHaveBeenLastCalledWith(["勉強", "日本語"]);
    expect(screen.queryByRole("list", { name: "Word bank" })).toBeNull();
    expect(check()).toBeEnabled();
  });

  it("easy mode: tapping a filled blank returns its chip and empties the blank", () => {
    const onChange = vi.fn();
    render(<Harness easy onChange={onChange} />);
    fireEvent.click(within(bank()).getByRole("button", { name: "勉強" }));
    fireEvent.click(screen.getByRole("button", { name: "Blank 1, 勉強" }));
    expect(onChange).toHaveBeenLastCalledWith(["", ""]);
    expect(blank(1)).toHaveValue("");
    expect(within(bank()).getAllByRole("button")).toHaveLength(2);
  });

  it("after Check each blank shows its answer with a correct / wrong / hinted tone, an icon and a text equivalent", () => {
    render(<ClozePanel {...base()} answers={["にほんご", "べんきよう"]} results={[{ correct: true, hinted: 0 }, { correct: false, hinted: 0 }]} />);
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    const [first, second] = [...document.querySelectorAll<HTMLElement>("[data-blank-answer]")];
    expect(required(first)).toHaveAttribute("data-blank-answer", "correct");
    expect(required(first)).toHaveTextContent(/^日本語.*correct$/);
    expect(required(first).querySelector("svg")).not.toBeNull();
    expect(required(second)).toHaveAttribute("data-blank-answer", "wrong");
    expect(required(second)).toHaveTextContent("勉強");
    expect(required(second)).toHaveTextContent("べんきよう");
    expect(required(second)).toHaveTextContent("wrong");
    expect(required(second).querySelector("svg")).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Check" })).toBeNull();
  });

  it("a correct blank finished from hints shows the hinted tone", () => {
    render(<ClozePanel {...base()} hinted={[0, 1]} answers={["にほんご", "勉強"]} results={[{ correct: true, hinted: 2 }, { correct: true, hinted: 0 }]} />);
    expect([...document.querySelectorAll("[data-blank-answer]")].map((el) => el.getAttribute("data-blank-answer"))).toEqual(["hinted", "correct"]);
    expect(required(document.querySelector("[data-blank-answer='hinted']"))).toHaveTextContent(/^日本語hint$/);
  });

  it("revealed: every blank shows its surface, no input and no Check", () => {
    render(<ClozePanel {...base()} revealed />);
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    expect([...document.querySelectorAll("[data-blank-answer]")].map((el) => el.textContent)).toEqual(["日本語", "勉強"]);
    expect(screen.queryByRole("button", { name: "Check" })).toBeNull();
  });

  it("a line with no candidate shows the notice, the sentence, no input and no Check", () => {
    const none: LineCloze = { ...CLOZE, blanks: [], readings: [], segments: [{ text: "ABCの歌です。", blank: null, romaji: "abc no uta desu." }] };
    render(<ClozePanel {...base()} cloze={none} answers={[]} />);
    expect(screen.getByText("This sentence has no word to fill")).toBeInTheDocument();
    expect(screen.getByText("ABCの歌です。")).toBeInTheDocument();
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "Check" })).toBeNull();
  });
});

function required<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error("missing");
  return value;
}
