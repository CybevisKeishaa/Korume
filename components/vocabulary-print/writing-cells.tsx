import type { CSSProperties } from "react";
import { writingLayout } from "@/lib/vocabulary/print/layout";
import type { WorksheetSettings } from "@/lib/vocabulary/print/settings";

/** Spec W §3.1–§3.2: explicit rows of whole groups (W8). `model` is null in self-test: every cell blank (W6). */
export function WritingRows({ cells, model, mode, density }: {
  cells: number; model: string[] | null; mode: WorksheetSettings["mode"]; density: WorksheetSettings["density"];
}) {
  const layout = writingLayout(cells, mode, density);
  const rows = Array.from({ length: layout.rows }, (_, row) =>
    Array.from({ length: layout.groupsPerRow }, (_, group) => row * layout.groupsPerRow + group));
  return (
    <div className="vp-rows" style={{ "--vp-cell": `${layout.cellMm}mm` } as CSSProperties}>
      {rows.map((repetitions, row) => (
        <div key={row} className="vp-row">
          {repetitions.map((repetition) => (
            <div key={repetition} className="vp-group">
              {Array.from({ length: cells }, (_, index) => (
                <span key={index} className="vp-cell">
                  {model && repetition < 2 && (
                    <span lang="ja" className={repetition === 0 ? "vp-model" : "vp-trace"}>{model[index]}</span>
                  )}
                </span>
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
