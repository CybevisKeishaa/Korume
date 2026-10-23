import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { render } from "@/test/render";
import { WordBankPanel } from "./word-bank-panel";

const DISPLAY = ["はい、", "そうです。", "はい、"];
const panel = (props: Partial<Parameters<typeof WordBankPanel>[0]> = {}) => {
  const onCheck = vi.fn();
  const onProgress = vi.fn();
  const view = render(<WordBankPanel lineId="line-9" display={DISPLAY} hinted={[]} results={null} revealed={false} submitting={false}
    onCheck={onCheck} onProgress={onProgress} {...props} />);
  return { ...view, onCheck, onProgress };
};
const bank = () => within(screen.getByRole("list", { name: "Word bank" })).getAllByRole("button");

describe("WordBankPanel", () => {
  it("moves a hinted chunk out of the slot it was placed in, into its own slot, without duplicating it", () => {
    const { rerender, onCheck, onProgress } = panel();
    // Place the bank's chunks in bank order until "そうです。" (chunk 1) sits in slot 1 or later.
    for (const chip of bank()) fireEvent.click(chip);
    expect(onProgress).toHaveBeenLastCalledWith(true);
    rerender(<WordBankPanel lineId="line-9" display={DISPLAY} hinted={[1]} results={null} revealed={false} submitting={false} onCheck={onCheck} onProgress={onProgress} />);
    expect(screen.getByRole("button", { name: "Slot 2 of 3, そうです。, hint" })).toBeDisabled();
    const slotTexts = [...screen.getByRole("list", { name: "Your sentence" }).querySelectorAll("button")].map((chip) => chip.textContent?.replace("Hint", ""));
    expect(slotTexts.filter((text) => text === "そうです。")).toHaveLength(1);
    expect(screen.getAllByText("そうです。")).toHaveLength(1);
  });

  it("checks with chunk indices, and two identical chunks are both placeable", () => {
    const { onCheck } = panel();
    const check = screen.getByRole("button", { name: "Check" });
    expect(check).toBeDisabled();
    for (const chip of bank()) fireEvent.click(chip);
    expect(check).toBeEnabled();
    fireEvent.click(check);
    expect(onCheck).toHaveBeenCalledTimes(1);
    expect([...(onCheck.mock.calls[0]?.[0] as number[])].sort()).toEqual([0, 1, 2]);
  });

  it("colours each slot by its verdict and locks every chip after Check", () => {
    panel({ hinted: [0], results: [{ correct: true, hinted: true }, { correct: false, hinted: false }, { correct: false, hinted: false }] });
    const slots = [...screen.getByRole("list", { name: "Your sentence" }).querySelectorAll("li")];
    expect(slots[0]).toHaveAttribute("data-result", "hinted");
    expect(screen.queryByRole("button", { name: "Check" })).toBeNull();
    for (const chip of bank()) expect(chip).toBeDisabled();
  });

  it("shows the reference order after Show answer", () => {
    panel({ revealed: true });
    expect(DISPLAY.map((text, i) => screen.getAllByRole("button", { name: `Slot ${i + 1} of 3, ${text}` })).flat()).toHaveLength(3);
    expect(screen.queryByRole("list", { name: "Word bank" })).toBeNull();
  });
});

describe("WordBankPanel — select and remove (Task 9c)", () => {
  const remove = () => screen.getByRole("button", { name: "Remove Selected Word" });
  const slotBtn = (i: number, text: string, extra = "") => screen.getByRole("button", { name: `Slot ${i} of 3, ${text}${extra}` });
  const placeTwo = () => {
    const shown = bank().map((chip) => chip.textContent ?? "");
    fireEvent.click(bank()[0]!);
    fireEvent.click(bank()[0]!);
    return shown;
  };

  it("a tap on a placed chip selects it, a second tap deselects, another tap moves the selection; nothing leaves its slot", () => {
    panel();
    const [first, second] = placeTwo() as [string, string];
    fireEvent.click(slotBtn(1, first));
    expect(slotBtn(1, first, ", selected")).toHaveAttribute("aria-pressed", "true");
    expect(bank()).toHaveLength(1);
    fireEvent.click(slotBtn(1, first, ", selected"));
    expect(slotBtn(1, first)).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(slotBtn(1, first));
    fireEvent.click(slotBtn(2, second));
    expect(slotBtn(2, second, ", selected")).toHaveAttribute("aria-pressed", "true");
    expect(slotBtn(1, first)).toHaveAttribute("aria-pressed", "false");
    expect(bank()).toHaveLength(1);
  });

  it("Remove Selected Word sends the selected chip back to the bank, not another, and clears the selection", () => {
    const { onProgress } = panel();
    const [first, second] = placeTwo() as [string, string];
    fireEvent.click(slotBtn(1, first));
    fireEvent.click(remove());
    expect(screen.getByText("Slot 1 of 3, empty")).toBeInTheDocument();
    expect(slotBtn(2, second)).toBeInTheDocument();
    expect(bank().map((chip) => chip.textContent)).toContain(first);
    expect(remove()).toHaveAttribute("aria-disabled", "true");
    expect(onProgress).toHaveBeenLastCalledWith(true);
  });

  it("with nothing selected Remove is aria-disabled (still focusable) and does nothing", () => {
    panel();
    placeTwo();
    expect(remove()).toHaveAttribute("aria-disabled", "true");
    expect(remove()).not.toBeDisabled();
    fireEvent.click(remove());
    expect(bank()).toHaveLength(1);
  });

  it("a hinted chip cannot be selected", () => {
    panel({ hinted: [1] });
    expect(slotBtn(2, "そうです。", ", hint")).toBeDisabled();
  });

  it("counts the words still in the bank", () => {
    panel();
    expect(screen.getByText("3 words remaining")).toBeInTheDocument();
    fireEvent.click(bank()[0]!);
    expect(screen.getByText("2 words remaining")).toBeInTheDocument();
  });

  it("hides Remove after Check", () => {
    panel({ results: [{ correct: true, hinted: false }, { correct: true, hinted: false }, { correct: true, hinted: false }] });
    expect(screen.queryByRole("button", { name: "Remove Selected Word" })).toBeNull();
  });
});
