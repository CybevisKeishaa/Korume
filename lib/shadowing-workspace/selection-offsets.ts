import type { Utf16Span } from "@/lib/analysis/types";

/**
 * A DOM boundary's offset into its line's base text, in UTF-16 code units: everything from the line's start
 * up to the boundary, minus the readings (`<rt>`, `<rp>`). A boundary inside a reading therefore lands right
 * after that ruby's base text — the characters the learner actually selected.
 */
function boundaryOffset(lineElement: HTMLElement, node: Node, offset: number): number {
  const range = document.createRange();
  range.setStart(lineElement, 0);
  range.setEnd(node, offset);
  const prefix = range.cloneContents();
  prefix.querySelectorAll("rt, rp").forEach((reading) => reading.remove());
  return prefix.textContent?.length ?? 0;
}

function lineOf(node: Node): HTMLElement | null {
  const element = node instanceof Element ? node : node.parentElement;
  return element?.closest<HTMLElement>("[data-line-id]") ?? null;
}

/**
 * The selection as a span of one transcript line (spec §6.3), or null: a collapsed selection, one crossing
 * two lines, one outside `container`, or one that covers only readings. The server snaps it to tokens.
 */
export function selectionToSpan(selection: Selection | null, container: HTMLElement): { lineId: string; span: Utf16Span } | null {
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;
  const range = selection.getRangeAt(0);
  const line = lineOf(range.startContainer);
  if (!line || line !== lineOf(range.endContainer) || !container.contains(line) || !line.dataset.lineId) return null;
  const start = boundaryOffset(line, range.startContainer, range.startOffset);
  const end = boundaryOffset(line, range.endContainer, range.endOffset);
  return end > start ? { lineId: line.dataset.lineId, span: { start, end } } : null;
}

/** Where a click put the caret (a collapsed selection), as an offset into its line — Live Sentence's word click. */
export function caretToOffset(selection: Selection | null, container: HTMLElement): { lineId: string; offset: number } | null {
  if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) return null;
  const range = selection.getRangeAt(0);
  const line = lineOf(range.startContainer);
  if (!line || !container.contains(line) || !line.dataset.lineId) return null;
  return { lineId: line.dataset.lineId, offset: boundaryOffset(line, range.startContainer, range.startOffset) };
}
