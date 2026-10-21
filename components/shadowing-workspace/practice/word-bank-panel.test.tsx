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
