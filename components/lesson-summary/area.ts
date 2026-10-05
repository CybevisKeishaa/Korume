import type { CSSProperties } from "react";

export type SummaryArea =
  | "hero" | "reflection" | "words" | "expressions" | "grammar" | "culture" | "review" | "status" | "saved" | "next";

/** Places one block in `.lesson-summary-grid` (app/globals.css): one DOM, CSS decides the columns (spec §7.2). */
export function areaProps(area: SummaryArea): { "data-summary-area": SummaryArea; style: CSSProperties } {
  return { "data-summary-area": area, style: { "--summary-area": area } as CSSProperties };
}
