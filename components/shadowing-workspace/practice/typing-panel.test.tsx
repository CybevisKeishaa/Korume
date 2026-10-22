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
  const onProgress = vi.fn();
  const base: Props = { text: TEXT, display: ["ﾃｽﾄは", "いいです？"], hintUnit: "chunk", hinted: [], diff: null, revealed: false, submitting: false, onCheck, onProgress };
  const view = render(<TypingPanel {...base} {...props} />);
  return { ...view, onCheck, onProgress, rerenderWith: (next: Partial<Props>) => view.rerender(<TypingPanel {...base} {...props} {...next} />) };
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

  it("does not submit an empty input, and reports whether anything is typed", () => {
    const { onCheck, onProgress } = panel();
    expect(screen.getByRole("button", { name: "Check" })).toBeDisabled();
    fireEvent.keyDown(input(), { key: "Enter" });
    expect(onCheck).not.toHaveBeenCalled();
    fireEvent.change(input(), { target: { value: "て" } });
    expect(onProgress).toHaveBeenLastCalledWith(true);
    fireEvent.change(input(), { target: { value: "" } });
    expect(onProgress).toHaveBeenLastCalledWith(false);
  });

  it("shows each hinted chunk's raw text on the hint line and never edits the learner's text", () => {
    const { rerenderWith } = panel();
    // The live region exists, empty, before the first hint, so that hint is announced.
    expect(screen.getByTestId("typing-hint")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByTestId("typing-hint")).toBeEmptyDOMElement();
    fireEvent.change(input(), { target: { value: "abc" } });
    rerenderWith({ hinted: [0] });
    expect(screen.getByTestId("typing-hint")).toHaveTextContent("ﾃｽﾄは");
    expect(screen.getByTestId("typing-hint")).not.toHaveTextContent("いいです");
    expect(input()).toHaveValue("abc");
  });

  it("cuts grapheme4 hints from the raw line, never the normalised one (P13)", () => {
    // normalizeJa turns ﾃｽﾄ into テスト: the hint must show the half-width characters as written.
    panel({ text: "ﾃｽﾄ1番です", display: ["ﾃｽﾄ1番です"], hintUnit: "grapheme4", hinted: [0] });
    expect(screen.getByTestId("typing-hint").textContent).toBe("Hintﾃｽﾄ1");
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
