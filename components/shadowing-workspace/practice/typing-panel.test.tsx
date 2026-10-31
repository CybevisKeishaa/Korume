import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { render } from "@/test/render";
import { displayMap } from "@/lib/dictation/display";
import { scoreTyping } from "@/lib/dictation/listening-score";
import { normalizeJa } from "@/lib/dictation/normalize";
import { TypingPanel } from "./typing-panel";

type Props = Parameters<typeof TypingPanel>[0];
const TEXT = "ﾃｽﾄはいいです？";
const panel = (props: Partial<Props> = {}) => {
  const onCheck = vi.fn();
  const onReveal = vi.fn();
  const base: Props = { text: TEXT, hinted: [], diff: null, revealed: false, submitting: false, onReveal, onCheck };
  const view = render(<TypingPanel {...base} {...props} />);
  return { ...view, onCheck, onReveal, rerenderWith: (next: Partial<Props>) => view.rerender(<TypingPanel {...base} {...props} {...next} />) };
};
const input = () => screen.getByRole("textbox", { name: "Type what you hear" });
/** The diff as the server builds it: the real scorer over the raw line, with its display map (P13). */
const diffFor = (text: string, typed: string) => scoreTyping(normalizeJa(text), typed, [], [], displayMap(text)).diff;

describe("TypingPanel", () => {
  it("submits on Enter, never during IME composition (Review Focus 4)", () => {
    const { onCheck } = panel();
    fireEvent.change(input(), { target: { value: "てすと" } });
    fireEvent.keyDown(input(), { key: "Enter", isComposing: true });
    fireEvent.keyDown(input(), { key: "Enter", keyCode: 229 });
    expect(onCheck).not.toHaveBeenCalled();
    fireEvent.keyDown(input(), { key: "Enter" });
    expect(onCheck).toHaveBeenCalledTimes(1);
    expect(onCheck).toHaveBeenCalledWith("てすと");
  });

  it("does not submit an empty input", () => {
    const { onCheck } = panel();
    expect(screen.getByRole("button", { name: "Check" })).toBeDisabled();
    fireEvent.keyDown(input(), { key: "Enter" });
    expect(onCheck).not.toHaveBeenCalled();
  });

  it("shows the star mask under the input; a star asks to reveal its unit and never edits the learner's text", () => {
    const { onReveal, rerenderWith } = panel();
    const stars = () => screen.getAllByRole("button", { name: /^Character \d+ of 8/ });
    expect(stars()).toHaveLength(8);
    expect(input().compareDocumentPosition(stars()[0]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(input()).toHaveAttribute("placeholder", "Type what you hear…");
    fireEvent.change(input(), { target: { value: "abc" } });
    fireEvent.click(stars()[4]!);
    expect(onReveal).toHaveBeenCalledWith(4);
    rerenderWith({ hinted: [4] });
    expect(stars()[4]).toHaveTextContent("い");
    expect(stars()[4]).toHaveAccessibleName("Character 5 of 8, い");
    expect(input()).toHaveValue("abc");
    expect(screen.queryByTestId("typing-hint")).toBeNull();
  });

  it("shows the sentence as plain text in place of the mask once revealed, and no mask after Check", () => {
    const { rerenderWith } = panel();
    rerenderWith({ revealed: true });
    expect(screen.queryAllByRole("button", { name: /^Character/ })).toHaveLength(0);
    expect(screen.getByTestId("dictation-sentence")).toHaveTextContent(TEXT);
    rerenderWith({ revealed: false, diff: diffFor(TEXT, "テストはいいです") });
    expect(screen.queryAllByRole("button", { name: /^Character/ })).toHaveLength(0);
    expect(screen.queryByTestId("dictation-sentence")).toBeNull();
  });

  it("draws the coloured diff from the raw display characters, never the normalised ones (P13)", () => {
    const diff = diffFor(TEXT, "テストはいいてす");
    panel({ diff });
    const shown = screen.getByTestId("typing-diff");
    expect(shown.textContent).toBe("ﾃｽﾄはいいです");
    expect([...shown.querySelectorAll("[data-op]")].map((op) => op.getAttribute("data-op"))).toEqual(
      ["match", "match", "match", "match", "match", "match", "wrong", "match"],
    );
    expect(input()).toHaveAttribute("readonly");
    expect(screen.queryByRole("button", { name: "Check" })).toBeNull();
  });

  it("shows a multi-character NFKC expansion once, and an extra character as typed", () => {
    panel({ text: "砂糖1㌘", diff: diffFor("砂糖1㌘", "砂糖1グラムx") });
    const shown = screen.getByTestId("typing-diff");
    expect(shown.textContent).toBe("砂糖1㌘x");
    expect(shown.querySelector("[data-op='extra']")).toHaveTextContent("x");
  });
});
