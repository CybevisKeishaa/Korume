"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { useTranslations } from "@/lib/i18n";
import { displayMap, displayRange } from "@/lib/dictation/display";
import { grapheme1Units } from "@/lib/dictation/listening-score";
import { normalizeJa } from "@/lib/dictation/normalize";
import { starMask, type MaskCell } from "@/lib/dictation/star-mask";
import { cn } from "@/lib/utils";
import { HINTED } from "./listening-puzzle";

const CELL = "inline-flex h-control-sm items-center justify-center px-2xs font-jp text-body-lg";
const HIDDEN = "border-b-2 border-dashed border-border text-muted-foreground";
const MOVE: Record<string, (unit: number, last: number) => number> = {
  ArrowLeft: (unit) => unit - 1, ArrowRight: (unit) => unit + 1, Home: () => 0, End: (_, last) => last,
};

/**
 * The Chép chính tả mask (spec §3.3): a star per scored character, punctuation shown in place. A hidden star's
 * character is never in the DOM; `display(unit)` is read only for a revealed one. With `onReveal` the stars are one
 * roving-tabindex row of buttons (arrows, Home/End move, Enter or a click reveals); without it (Chế độ dễ) they are a
 * length cue only: named images, never focusable.
 */
export function StarMask({ cells, revealed, display, onReveal }: {
  cells: MaskCell[];
  revealed: ReadonlySet<number>;
  display(unit: number): string;
  onReveal?(unit: number): void;
}) {
  const t = useTranslations("shadowing.workspace.practice.listening");
  const row = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const total = cells.filter((cell) => cell.kind === "star").length;
  const move = (event: KeyboardEvent, unit: number) => {
    const to = MOVE[event.key];
    if (!to || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    row.current?.querySelector<HTMLElement>(`[data-unit='${Math.min(total - 1, Math.max(0, to(unit, total - 1)))}']`)?.focus();
  };

  return <div ref={row} role="group" aria-label={t("star.mask")} lang="ja" className="flex flex-wrap items-end gap-2xs">
    {cells.map((cell, i) => {
      if (cell.kind === "shown") return cell.text === "" ? null : <span key={i} aria-hidden="true" className={CELL}>{cell.text}</span>;
      const { unit } = cell;
      const open = revealed.has(unit);
      const text = open ? display(unit) : "";
      const name = open ? t("star.shown", { n: unit + 1, total, text }) : t("star.hidden", { n: unit + 1, total });
      const className = cn(CELL, open ? HINTED : HIDDEN);
      const face = <span aria-hidden="true">{open ? text : "＊"}</span>;
      if (!onReveal) return <span key={i} role="img" aria-label={name} className={className}>{face}</span>;
      return <button key={i} type="button" data-unit={unit} tabIndex={unit === active ? 0 : -1} aria-label={name} className={className}
        onFocus={() => setActive(unit)} onKeyDown={(event) => move(event, unit)} onClick={() => { if (!open) onReveal(unit); }}>{face}</button>;
    })}
  </div>;
}

/**
 * The mask for a line's raw `text_jp`: units and punctuation from the normalised base (what Typing scores), every
 * character shown from the raw line (P13). After 💡 the whole sentence replaces it as plain text.
 */
export function DictationMask({ text, hinted, revealed, onReveal }: {
  text: string;
  hinted: readonly number[];
  revealed: boolean;
  onReveal?(unit: number): void;
}) {
  if (revealed) return <p data-testid="dictation-sentence" lang="ja" className="font-jp text-body-lg text-foreground">{text}</p>;
  const base = normalizeJa(text);
  const map = displayMap(text);
  const units = grapheme1Units(base);
  // A shown cell is one code point of the base: walk the offsets to print it from the raw line.
  let at = 0;
  const cells = starMask(base).map((cell): MaskCell => {
    if (cell.kind === "star") {
      at = units[cell.unit]!.end;
      return cell;
    }
    return { kind: "shown", text: displayRange(map, base, { start: at, end: ++at }) };
  });
  return <StarMask cells={cells} revealed={new Set(hinted)} display={(unit) => displayRange(map, base, units[unit]!)} onReveal={onReveal} />;
}
