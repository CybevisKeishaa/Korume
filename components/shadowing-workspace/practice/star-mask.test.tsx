import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { render } from "@/test/render";
import { starMask } from "@/lib/dictation/star-mask";
import { DictationMask, StarMask } from "./star-mask";

const TEXT = "今は英語だけに集中しています";
const chars = Array.from(TEXT);
const mask = (props: Partial<Parameters<typeof StarMask>[0]> = {}) => {
  const onReveal = vi.fn();
  const view = render(<StarMask cells={starMask(TEXT)} revealed={new Set()} display={(unit) => chars[unit] ?? ""} onReveal={onReveal} {...props} />);
  return { onReveal, unmount: view.unmount };
};
const stars = () => screen.getAllByRole("button", { name: /^Character \d+ of 14/ });

describe("StarMask", () => {
  it("renders one star per scored character, each named, none showing its character", () => {
    mask();
    expect(stars()).toHaveLength(14);
    expect(stars()[4]).toHaveAccessibleName("Character 5 of 14, hidden");
    for (const char of chars) expect(document.body.textContent).not.toContain(char);
  });

  it("a click on star 5 asks to reveal unit 4; a revealed star shows only its character, in the hinted tone", () => {
    const { onReveal, unmount } = mask();
    fireEvent.click(stars()[4]!);
    expect(onReveal).toHaveBeenCalledWith(4);
    unmount();
    mask({ revealed: new Set([4]) });
    expect(stars()[4]).toHaveAccessibleName("Character 5 of 14, だ");
    expect(stars()[4]).toHaveTextContent("だ");
    expect(stars()[4]).toHaveClass("text-accent-strong");
    expect(document.body.textContent?.replace(/＊/g, "")).toBe("だ");
  });

  it("is a roving-tabindex row: one tab stop, arrows move, Enter reveals", async () => {
    const user = userEvent.setup();
    const { onReveal } = mask();
    expect(stars().filter((star) => star.tabIndex === 0)).toHaveLength(1);
    await user.tab();
    expect(stars()[0]).toHaveFocus();
    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(stars()[2]).toHaveFocus();
    expect(stars()[2]).toHaveAttribute("tabindex", "0");
    expect(stars()[0]).toHaveAttribute("tabindex", "-1");
    await user.keyboard("{ArrowLeft}{End}");
    expect(stars()[13]).toHaveFocus();
    await user.keyboard("{Home}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{Enter}");
    expect(onReveal).toHaveBeenCalledWith(4);
  });

  it("without onReveal (Chế độ dễ) the stars are not buttons and take no focus, but keep their names", () => {
    render(<StarMask cells={starMask(TEXT)} revealed={new Set()} display={(unit) => chars[unit] ?? ""} />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.getAllByRole("img", { name: /^Character \d+ of 14, hidden$/ })).toHaveLength(14);
    expect(document.querySelectorAll("[tabindex]")).toHaveLength(0);
  });
});

describe("DictationMask", () => {
  it("shows punctuation as written (P13) and a revealed character from the raw line", () => {
    render(<DictationMask text="ﾃｽﾄはいいです？" hinted={[0]} revealed={false} onReveal={() => undefined} />);
    const row = screen.getByRole("group", { name: "Hidden sentence" });
    expect(within(row).getAllByRole("button")).toHaveLength(8);
    expect(within(row).getAllByRole("button")[0]).toHaveTextContent("ﾃ");
    expect(row).toHaveTextContent("？");
    expect(row.textContent).not.toContain("?");
  });

  it("after 💡 the whole sentence replaces the mask as plain text", () => {
    render(<DictationMask text={TEXT} hinted={[]} revealed onReveal={() => undefined} />);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.getByTestId("dictation-sentence")).toHaveTextContent(TEXT);
  });
});
