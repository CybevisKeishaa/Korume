// Pure geometry for Ask Korume's draggable sheet (prototype: specs/assets/2026-10-31-ask-korume-resizable-sheet-prototype.html).
export type Rect = { x: number; y: number; w: number; h: number };
export type Point = { x: number; y: number };
export type Edge = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
export interface SheetBounds { vw: number; vh: number; margin: number; minW: number; minH: number }

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

/** Size first (min .. viewport minus both margins), then position inside the margins. */
export function clampRect(r: Rect, b: SheetBounds): Rect {
  const w = clamp(r.w, b.minW, b.vw - 2 * b.margin);
  const h = clamp(r.h, b.minH, b.vh - 2 * b.margin);
  return { x: clamp(r.x, b.margin, b.vw - w - b.margin), y: clamp(r.y, b.margin, b.vh - h - b.margin), w, h };
}

/** W/N keep the opposite edge fixed; E/S grow towards the viewport margin. */
export function resizeRect(start: Rect, edge: Edge, dx: number, dy: number, b: SheetBounds): Rect {
  const r = { ...start };
  if (edge.includes("e")) r.w = clamp(start.w + dx, b.minW, b.vw - b.margin - start.x);
  if (edge.includes("s")) r.h = clamp(start.h + dy, b.minH, b.vh - b.margin - start.y);
  if (edge.includes("w")) {
    r.w = clamp(start.w - dx, b.minW, start.x + start.w - b.margin);
    r.x = start.x + start.w - r.w;
  }
  if (edge.includes("n")) {
    r.h = clamp(start.h - dy, b.minH, start.y + start.h - b.margin);
    r.y = start.y + start.h - r.h;
  }
  return clampRect(r, b);
}

/** Grows away from the screen corner the launcher's centre is in. */
export function besideLauncher(size: { w: number; h: number }, launcher: Rect, b: SheetBounds): Rect {
  const right = launcher.x + launcher.w / 2 > b.vw / 2;
  const bottom = launcher.y + launcher.h / 2 > b.vh / 2;
  const w = Math.min(size.w, b.vw - 2 * b.margin);
  const h = Math.min(size.h, b.vh - 2 * b.margin);
  return clampRect({ x: right ? launcher.x + launcher.w - w : launcher.x, y: bottom ? launcher.y + launcher.h - h : launcher.y, w, h }, b);
}

export function centred(size: { w: number; h: number }, b: SheetBounds): Rect {
  const w = Math.min(size.w, b.vw - 2 * b.margin);
  const h = Math.min(size.h, b.vh - 2 * b.margin);
  return clampRect({ x: (b.vw - w) / 2, y: (b.vh - h) / 2, w, h }, b);
}

export function clampRail(rail: number, sheetW: number, t: { railMin: number; railMax: number; chatMin: number }): number {
  return clamp(rail, t.railMin, Math.max(t.railMin, Math.min(t.railMax, sheetW - t.chatMin)));
}

export function clampPoint(p: Point, size: { w: number; h: number }, b: Pick<SheetBounds, "vw" | "vh" | "margin">): Point {
  return { x: clamp(p.x, b.margin, b.vw - size.w - b.margin), y: clamp(p.y, b.margin, b.vh - size.h - b.margin) };
}

export function parseStoredPoint(raw: string | null): Point | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Partial<Point> | null;
    return typeof p?.x === "number" && typeof p.y === "number" && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: p.x, y: p.y } : null;
  } catch {
    return null;
  }
}
