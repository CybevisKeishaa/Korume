import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { render } from "@/test/render";
import { dropIndex, WordBankPanel } from "./word-bank-panel";

// jsdom has no DragEvent: fireEvent.drag* would fall back to a plain Event and drop clientX / clientY.
if (typeof globalThis.DragEvent === "undefined") globalThis.DragEvent = class extends MouseEvent {} as unknown as typeof DragEvent;

const DISPLAY = ["はい、", "そうです。", "はい、"];
type Props = Parameters<typeof WordBankPanel>[0];
const panel = (props: Partial<Props> = {}) => {
  const onCheck = vi.fn();
  const onProgress = vi.fn();
  const element = (next: Partial<Props>) => <WordBankPanel lineId="line-9" display={DISPLAY} hinted={[]} results={null} revealed={false}
    submitting={false} onCheck={onCheck} onProgress={onProgress} {...props} {...next} />;
  const view = render(element({}));
  return { ...view, rerender: (next: Partial<Props>) => view.rerender(element(next)), onCheck, onProgress };
};
const tray = () => screen.getByRole("list", { name: "Your sentence" });
const piece = (p: number) => {
  const chip = document.querySelector<HTMLButtonElement>(`[data-piece='${p}']`);
  if (!chip) throw new Error(`no chip for piece ${p}`);
  return chip;
};
const pieces = (list: HTMLElement | null) => [...(list?.querySelectorAll<HTMLElement>("[data-piece]") ?? [])].map((chip) => Number(chip.dataset.piece));
const placed = () => pieces(tray());
const banked = () => pieces(screen.queryByRole("list", { name: "Word bank" }));
const tap = (...ps: number[]) => ps.forEach((p) => fireEvent.click(piece(p)));
const dataTransfer = () => ({ setData: vi.fn(), getData: vi.fn(() => ""), effectAllowed: "all", dropEffect: "none" });
const rect = (left: number) => ({ left, right: left + 40, width: 40, top: 0, bottom: 30, height: 30, x: left, y: 0 }) as DOMRect;
/** Lays the placed chips out in one row, 40px wide with a 10px gap: chip i spans [50i, 50i + 40]. */
const layOut = () => [...tray().querySelectorAll<HTMLElement>("[data-piece]")]
  .forEach((chip, i) => vi.spyOn(chip, "getBoundingClientRect").mockReturnValue(rect(i * 50)));

describe("WordBankPanel", () => {
  it("tap in the bank appends", () => {
    const { onProgress } = panel();
    tap(2, 0);
    expect(placed()).toEqual([2, 0]);
    expect(banked()).toEqual([1]);
    expect(onProgress).toHaveBeenLastCalledWith(true);
  });

  it("tap on a placed piece returns exactly that piece", () => {
    const { onProgress } = panel();
    tap(0, 1, 2);
    tap(2); // the second "はい、", not the first
    expect(placed()).toEqual([0, 1]);
    expect(banked()).toEqual([2]);
    tap(0);
    expect(placed()).toEqual([1]);
    tap(1);
    expect(placed()).toEqual([]);
    expect(onProgress).toHaveBeenLastCalledWith(false);
  });

  it("no selection state", () => {
    panel();
    tap(0, 1);
    tap(0);
    tap(2);
    expect(document.querySelector("[aria-pressed]")).toBeNull();
    expect(screen.queryByRole("button", { name: "Remove Selected Word" })).toBeNull();
    expect(screen.queryByText(/selected/)).toBeNull();
  });

  it("a hint never makes another piece removable by proxy (closes 9c I1)", () => {
    const { rerender } = panel();
    tap(2, 0); // X = piece 2, then piece 0
    rerender({ hinted: [0] }); // Hint: piece 0 moves into the locked prefix
    expect(placed()).toEqual([0, 2]);
    tap(2);
    expect(placed()).toEqual([0]);
    expect(banked()).toContain(2);
    tap(2); // place X again
    expect(placed()).toEqual([0, 2]);
    tap(2);
    expect(placed()).toEqual([0]);
    expect(piece(0)).toBeDisabled();
    expect(document.querySelector("[aria-pressed]")).toBeNull();
  });

  it("Alt+ArrowLeft moves a placed piece one place and keeps focus on it", async () => {
    const user = userEvent.setup();
    panel({ hinted: [0] });
    tap(1, 2);
    expect(placed()).toEqual([0, 1, 2]);
    piece(2).focus();
    await user.keyboard("{Alt>}{ArrowLeft}{/Alt}");
    expect(placed()).toEqual([0, 2, 1]);
    expect(piece(2)).toHaveFocus();
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveTextContent("はい、, position 2 of 3");
    await user.keyboard("{Alt>}{ArrowLeft}{/Alt}"); // never into the hinted prefix
    expect(placed()).toEqual([0, 2, 1]);
    expect(piece(2)).toHaveFocus();
    await user.keyboard("{Alt>}{ArrowRight}{/Alt}");
    expect(placed()).toEqual([0, 1, 2]);
    expect(piece(2)).toHaveFocus();
    expect(status).toHaveTextContent("はい、, position 3 of 3");
    // Alt+ArrowLeft is the browser's Back: the chip keeps it.
    expect(fireEvent.keyDown(piece(2), { key: "ArrowLeft", altKey: true })).toBe(false);
  });

  it("Enter appends a bank piece and focus follows it into the answer; Enter again returns it, focus follows back", async () => {
    const user = userEvent.setup();
    panel();
    piece(1).focus();
    await user.keyboard("{Enter}");
    expect(placed()).toEqual([1]);
    expect(piece(1)).toHaveFocus(); // so "append, then Alt+Arrow" works without leaving the keyboard (spec §3.3)
    await user.keyboard("{Enter}");
    expect(banked()).toContain(1);
    expect(piece(1)).toHaveFocus();
  });

  it("hint moves a placed piece into the prefix", () => {
    const { rerender } = panel();
    tap(2, 1, 0);
    rerender({ hinted: [0] });
    expect(placed()).toEqual([0, 2, 1]);
    expect(piece(0)).toBeDisabled();
    expect(piece(0)).toHaveAccessibleName("Slot 1 of 3, はい、, hint");
    rerender({ hinted: [0, 1] });
    expect(placed()).toEqual([0, 1, 2]);
    expect(screen.getAllByText("そうです。")).toHaveLength(1);
  });

  it("locks the answer while submitting", () => {
    const { rerender } = panel();
    tap(0, 1);
    const dt = dataTransfer();
    fireEvent.dragStart(piece(1), { dataTransfer: dt }); // a drag in flight when Check is pressed
    rerender({ submitting: true });
    fireEvent.dragEnd(piece(1), { dataTransfer: dt });
    fireEvent.dragStart(piece(2), { dataTransfer: dt });
    fireEvent.dragOver(piece(0), { clientX: 45, clientY: 10, dataTransfer: dt });
    fireEvent.drop(piece(0), { clientX: 45, clientY: 10, dataTransfer: dt });
    fireEvent.click(piece(2));
    fireEvent.click(piece(0));
    fireEvent.keyDown(piece(1), { key: "ArrowLeft", altKey: true });
    expect(placed()).toEqual([0, 1]);
    expect(banked()).toEqual([2]);
    expect(screen.getByRole("button", { name: "Checking…" })).toBeDisabled();
  });

  it("drop inserts at the indicated index", () => {
    render(<WordBankPanel lineId="line-9" display={["A", "B", "C", "D"]} hinted={[]} results={null} revealed={false} submitting={false} onCheck={vi.fn()} onProgress={vi.fn()} />);
    tap(0, 1, 2);
    layOut();
    const dt = dataTransfer();
    fireEvent.dragStart(piece(3), { dataTransfer: dt });
    fireEvent.dragOver(piece(1), { clientX: 80, clientY: 10, dataTransfer: dt }); // chip 1's right half
    expect(tray().querySelectorAll("li")[2]?.querySelector("[data-drop-marker]")).not.toBeNull();
    fireEvent.drop(piece(1), { clientX: 80, clientY: 10, dataTransfer: dt });
    expect(placed()).toEqual([0, 1, 3, 2]);
    expect(document.querySelector("[data-drop-marker]")).toBeNull();
    // A placed piece dragged onto chip 0's left half moves to the front.
    layOut();
    fireEvent.dragStart(piece(2), { dataTransfer: dt });
    fireEvent.dragOver(piece(0), { clientX: 10, clientY: 10, dataTransfer: dt });
    fireEvent.drop(piece(0), { clientX: 10, clientY: 10, dataTransfer: dt });
    expect(placed()).toEqual([2, 0, 1, 3]);
  });

  it("the drop marker never sits inside the hinted prefix: over a hinted chip it shows at k", () => {
    render(<WordBankPanel lineId="line-9" display={["A", "B", "C", "D"]} hinted={[0, 1]} results={null} revealed={false} submitting={false} onCheck={vi.fn()} onProgress={vi.fn()} />);
    tap(2);
    layOut();
    const dt = dataTransfer();
    fireEvent.dragStart(piece(3), { dataTransfer: dt });
    fireEvent.dragOver(piece(0), { clientX: 10, clientY: 10, dataTransfer: dt }); // hinted chip 0's left half
    const items = tray().querySelectorAll("li");
    expect([...items].map((li) => li.querySelector("[data-drop-marker]") !== null)).toEqual([false, false, true]);
    fireEvent.drop(piece(0), { clientX: 10, clientY: 10, dataTransfer: dt });
    expect(placed()).toEqual([0, 1, 3, 2]);
  });

  it("drop reads the pointer's index from the drop event, even after a dragleave cleared the marker", () => {
    render(<WordBankPanel lineId="line-9" display={["A", "B", "C", "D"]} hinted={[]} results={null} revealed={false} submitting={false} onCheck={vi.fn()} onProgress={vi.fn()} />);
    tap(0, 1, 2);
    layOut();
    const dt = dataTransfer();
    fireEvent.dragStart(piece(3), { dataTransfer: dt });
    fireEvent.dragOver(piece(1), { clientX: 80, clientY: 10, dataTransfer: dt });
    fireEvent.dragLeave(tray().parentElement as HTMLElement, { relatedTarget: null, dataTransfer: dt }); // Chrome often sends null
    expect(document.querySelector("[data-drop-marker]")).toBeNull();
    fireEvent.drop(piece(1), { clientX: 80, clientY: 10, dataTransfer: dt });
    expect(placed()).toEqual([0, 1, 3, 2]);
  });

  it("Alt+Arrow on a bank chip keeps the browser from going Back; movable placed chips announce their shortcut", () => {
    panel({ hinted: [0] });
    tap(1);
    expect(fireEvent.keyDown(piece(2), { key: "ArrowLeft", altKey: true })).toBe(false);
    expect(fireEvent.keyDown(piece(2), { key: "ArrowRight", altKey: true })).toBe(false);
    expect(fireEvent.keyDown(piece(2), { key: "ArrowLeft" })).toBe(true); // a plain arrow is left alone
    expect(banked()).toEqual([2]);
    expect(piece(1)).toHaveAttribute("aria-keyshortcuts", "Alt+ArrowLeft Alt+ArrowRight");
    expect(piece(0)).not.toHaveAttribute("aria-keyshortcuts"); // the hinted piece cannot move
    expect(piece(2)).not.toHaveAttribute("aria-keyshortcuts");
  });

  it("dropIndex counts the pieces whose centre is left of the pointer", () => {
    const row = [rect(0), rect(50), rect(100)];
    expect(dropIndex(row, -5)).toBe(0);
    expect(dropIndex(row, 19)).toBe(0);
    expect(dropIndex(row, 21)).toBe(1);
    expect(dropIndex(row, 80)).toBe(2);
    expect(dropIndex(row, 200)).toBe(3);
    expect(dropIndex([], 10)).toBe(0);
  });

  it("a placed piece dropped outside the answer goes back to the bank; a bank piece dropped outside stays", () => {
    panel();
    tap(0, 1);
    const dt = dataTransfer();
    fireEvent.dragStart(piece(1), { dataTransfer: dt });
    fireEvent.dragEnd(piece(1), { dataTransfer: dt });
    expect(placed()).toEqual([0]);
    fireEvent.dragStart(piece(2), { dataTransfer: dt });
    fireEvent.dragEnd(piece(2), { dataTransfer: dt });
    expect(placed()).toEqual([0]);
    expect(banked()).toEqual(expect.arrayContaining([1, 2]));
  });

  it("a drag that started on another line's panel drops nothing (Review Focus 3)", () => {
    const view = render(<WordBankPanel key="a" lineId="line-9" display={DISPLAY} hinted={[]} results={null} revealed={false} submitting={false} onCheck={vi.fn()} onProgress={vi.fn()} />);
    const dt = dataTransfer();
    fireEvent.dragStart(piece(1), { dataTransfer: dt });
    view.rerender(<WordBankPanel key="b" lineId="line-10" display={DISPLAY} hinted={[]} results={null} revealed={false} submitting={false} onCheck={vi.fn()} onProgress={vi.fn()} />);
    const box = tray().parentElement as HTMLElement;
    fireEvent.dragOver(box, { clientX: 10, clientY: 10, dataTransfer: dt });
    fireEvent.drop(box, { clientX: 10, clientY: 10, dataTransfer: dt });
    expect(placed()).toEqual([]);
  });

  it("wraps", () => {
    panel();
    tap(0);
    expect(tray()).toHaveClass("flex-wrap");
    expect(screen.getByRole("list", { name: "Word bank" })).toHaveClass("flex-wrap");
    const chips = document.querySelectorAll("[data-piece]");
    expect(chips).toHaveLength(3);
    for (const chip of chips) expect(chip).toHaveClass("max-w-full", "break-all");
  });

  it("checks with piece indices in answer order, and two identical pieces are both placeable", () => {
    const { onCheck } = panel();
    const check = screen.getByRole("button", { name: "Check" });
    expect(check).toBeDisabled();
    tap(2, 1, 0);
    expect(check).toBeEnabled();
    fireEvent.click(check);
    expect(onCheck).toHaveBeenCalledWith([2, 1, 0]);
  });

  it("colours each answer position by its verdict and locks every chip after Check", () => {
    const { rerender } = panel({ hinted: [0] });
    tap(2, 1);
    rerender({ results: [{ correct: false, hinted: true }, { correct: false, hinted: false }, { correct: true, hinted: false }] });
    const positions = [...tray().querySelectorAll("li")];
    expect(positions.map((li) => li.getAttribute("data-result"))).toEqual(["hinted", "wrong", "correct"]);
    expect(piece(1)).toHaveAccessibleName("Slot 3 of 3, そうです。, correct");
    expect(screen.queryByRole("button", { name: "Check" })).toBeNull();
    for (const chip of document.querySelectorAll("[data-piece]")) expect(chip).toBeDisabled();
    for (const chip of document.querySelectorAll("[data-piece]")) expect(chip).not.toHaveAttribute("draggable", "true");
  });

  it("shows the reference order after Show answer", () => {
    panel({ revealed: true });
    expect(DISPLAY.map((text, i) => screen.getAllByRole("button", { name: `Slot ${i + 1} of 3, ${text}` })).flat()).toHaveLength(3);
    expect(placed()).toEqual([0, 1, 2]);
    expect(screen.queryByRole("list", { name: "Word bank" })).toBeNull();
  });

  it("counts the words still in the bank", () => {
    panel();
    expect(screen.getByText("3 words remaining")).toBeInTheDocument();
    tap(0);
    expect(screen.getByText("2 words remaining")).toBeInTheDocument();
  });
});
