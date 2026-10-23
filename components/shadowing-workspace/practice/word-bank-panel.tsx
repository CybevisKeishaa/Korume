"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
import { useTranslations } from "@/lib/i18n";
import { bankOrder } from "@/lib/dictation/shuffle";
import { cn } from "@/lib/utils";
import { BOX, CheckButton, EYEBROW, PuzzleHeader } from "./listening-puzzle";
import { PracticeGlyph } from "./practice-glyph";

type SlotResult = { correct: boolean; hinted: boolean };
const CHIP = "inline-flex items-center gap-xs border font-jp disabled:cursor-default";
const PLACED = `${CHIP} h-control-md min-w-[var(--control-md)] justify-center rounded-full px-xs text-body font-medium`;
const RESULT_TONE = {
  correct: "border-success bg-success/10 text-success-strong",
  wrong: "border-danger bg-danger/10 text-danger-strong",
  hinted: "border-accent bg-accent/10 text-accent-strong",
} as const;

/**
 * Word Bank (spec 5.5, 5.7): the line's chunks, shuffled by `bankOrder(n, lineId)`, go into numbered slots.
 * Only the raw `display` strings are shown (P13); the arrangement sent to Check is chunk indices. A hinted chunk
 * is locked in its own slot and whatever sat there goes back to the bank, derived on every render so a chunk is
 * never lost or shown twice (Review Focus 3). A tap on a placed chunk selects it; Remove Selected Word sends it
 * back. Mounted with a key per line + format + attempt (P11), so a new attempt starts with empty slots.
 */
export function WordBankPanel({ lineId, display, hinted, results, revealed, submitting, hint, onCheck, onProgress }: {
  lineId: string;
  display: string[];
  hinted: number[];
  /** Per-slot verdicts after a successful Check. */
  results: SlotResult[] | null;
  /** Show answer: the slots show the reference order. */
  revealed: boolean;
  submitting: boolean;
  /** The Show Hint pill, or null once the attempt is answered. */
  hint?: ReactNode;
  onCheck(chunkOrder: number[]): void;
  onProgress(placed: boolean): void;
}) {
  const t = useTranslations("shadowing.workspace.practice.listening");
  const bankLabel = useId();
  const n = display.length;
  const [placed, setPlaced] = useState<(number | null)[]>(() => Array.from({ length: n }, () => null));
  const [selected, setSelected] = useState<number | null>(null);
  const order = useMemo(() => bankOrder(n, lineId), [n, lineId]);
  const hintedSet = new Set(hinted);
  const slots = revealed ? order.map((_, i) => i)
    : placed.map((chunk, i) => hintedSet.has(i) ? i : chunk !== null && hintedSet.has(chunk) ? null : chunk);
  const bank = order.filter((chunk) => !slots.includes(chunk));
  const locked = revealed || results !== null || submitting;
  const complete = slots.every((chunk) => chunk !== null);
  // A selection survives only while its slot still holds a removable chunk.
  const picked = !locked && selected !== null && slots[selected] !== null && !hintedSet.has(selected) ? selected : null;

  const update = (next: (number | null)[]) => {
    setPlaced(next);
    onProgress(next.some((chunk, i) => chunk !== null && !hintedSet.has(i)));
  };
  const place = (chunk: number) => {
    const empty = slots.indexOf(null);
    if (empty === -1) return;
    update(slots.map((current, i) => i === empty ? chunk : current));
  };
  const removePicked = () => {
    if (picked === null) return;
    update(slots.map((current, i) => i === picked ? null : current));
    setSelected(null);
  };

  return <div className="flex flex-col gap-sm">
    <PuzzleHeader eyebrow={t("puzzle.wordBank")} status={t("puzzle.remaining", { count: bank.length })} hint={hint} />
    <ol aria-label={t("answerSlots")} className={cn(BOX, "flex flex-wrap justify-center gap-xs")}>
      {slots.map((chunk, i) => {
        const isHinted = hintedSet.has(i) && !revealed;
        const verdict = results?.[i];
        const tone = verdict ? verdict.hinted ? "hinted" : verdict.correct ? "correct" : "wrong" : isHinted ? "hinted" : null;
        const state = tone ?? (picked === i ? "selected" : null);
        const label = (text: string) => t("slot", { n: i + 1, total: n, text: state ? `${text}, ${t(`slotState.${state}`)}` : text });
        return <li key={i} data-slot={i} data-result={verdict ? tone : undefined}>
          {chunk === null
            ? <span className="inline-flex h-control-md min-w-[var(--control-md)] items-center justify-center rounded-full border border-dashed border-border px-xs">
              <span className="sr-only">{t("slotEmpty", { n: i + 1, total: n })}</span>
            </span>
            : <button type="button" aria-label={label(display[chunk] ?? "")} aria-pressed={locked || isHinted ? undefined : picked === i}
              disabled={locked || isHinted} onClick={() => setSelected(picked === i ? null : i)}
              className={cn(PLACED, tone ? RESULT_TONE[tone] : picked === i ? "border-primary bg-primary/10 text-primary-strong ring-2 ring-primary/40" : "border-primary/40 border-b-2 bg-primary/5 text-primary-strong hover:bg-primary/10")}>
              <span lang="ja">{display[chunk]}</span>
              {isHinted && <span aria-hidden="true" className="rounded-full bg-accent/20 px-xs text-caption text-accent-strong">{t("hint")}</span>}
            </button>}
        </li>;
      })}
    </ol>
    {!revealed && results === null && <button type="button" aria-disabled={picked === null} onClick={removePicked}
      className="inline-flex h-control-sm items-center justify-center gap-xs rounded-full border border-border text-caption font-semibold text-muted-foreground hover:bg-muted aria-disabled:opacity-50">
      <PracticeGlyph name="listening-remove-word" />{t("removeSelected")}
    </button>}
    <div className={BOX}>
      <p id={bankLabel} className={cn(EYEBROW, "mb-xs")}>{t("bank")}</p>
      {bank.length > 0 && <ul aria-labelledby={bankLabel} className="flex flex-wrap gap-xs">
        {bank.map((chunk) => <li key={chunk}>
          <button type="button" lang="ja" disabled={locked} onClick={() => place(chunk)}
            className={cn(CHIP, "h-control-sm rounded-full border-border bg-card px-sm text-body font-semibold text-foreground hover:bg-muted")}>{display[chunk]}</button>
        </li>)}
      </ul>}
    </div>
    {!revealed && results === null && <CheckButton label={t(submitting ? "checking" : "check")} disabled={!complete || submitting} onClick={() => onCheck(slots as number[])} />}
  </div>;
}
