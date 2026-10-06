import { PAPER } from "./paper";
import type { WorksheetSettings } from "./settings";

/** Spec W §3.1: the writing geometry in mm; the A4 measurement and the owner's paper review may tune these. */
export const WRITING = {
  cellMm: 12,
  minCellMm: 8,
  groupGapMm: 3,
  rowGapMm: 2,
  contentWidthMm: PAPER.widthMm - 2 * PAPER.marginMm,
} as const;

const DENSITY_ROWS = { airy: 2, compact: 1 } as const;
const MIN_REPETITIONS = { practice: 3, selfTest: 2 } as const;

export interface WritingLayout { cellMm: number; groupsPerRow: number; rows: number; repetitions: number; oversized: boolean }

/** A repetition is an atomic group of `cells` squares (W8): rows hold whole groups, never part of a word. */
export function writingLayout(cells: number, mode: WorksheetSettings["mode"], density: WorksheetSettings["density"]): WritingLayout {
  const n = Math.max(1, cells);
  const fit = Math.floor((WRITING.contentWidthMm / n) * 10) / 10; // 0.1mm steps, never wider than W
  const oversized = fit < WRITING.minCellMm;
  const cellMm = oversized ? WRITING.minCellMm : Math.min(WRITING.cellMm, fit);
  const groupsPerRow = Math.max(1, Math.floor((WRITING.contentWidthMm + WRITING.groupGapMm) / (n * cellMm + WRITING.groupGapMm)));
  const rows = Math.max(DENSITY_ROWS[density], Math.ceil(MIN_REPETITIONS[mode] / groupsPerRow));
  return { cellMm, groupsPerRow, rows, repetitions: rows * groupsPerRow, oversized };
}
