"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "@/lib/i18n";
import { bankOrder } from "@/lib/dictation/shuffle";
import { cn } from "@/lib/utils";

type SlotResult = { correct: boolean; hinted: boolean };
const CHIP = "inline-flex min-h-control-sm items-center gap-xs rounded-md border px-sm py-2xs font-jp text-body text-foreground disabled:cursor-default";
const RESULT_TONE = {
  correct: "border-success bg-success/10 text-success-strong",
  wrong: "border-danger bg-danger/10 text-danger-strong",
  hinted: "border-accent bg-accent/10 text-accent-strong",
} as const;

/**
 * Word Bank (spec §5.5, §5.7): the line's chunks, shuffled by `bankOrder(n, lineId)`, go into numbered slots.
 * Only the raw `display` strings are shown (P13); the arrangement sent to Check is chunk indices. A hinted chunk
 * is locked in its own slot and whatever sat there goes back to the bank, derived on every render so a chunk is
 * never lost or shown twice (Review Focus 3). Mounted with a key per line + format + attempt (P11), so a new
 * attempt starts with empty slots.
 */
export function WordBankPanel({ lineId, display, hinted, results, revealed, submitting, onCheck, onProgress }: {
  lineId: string;
  display: string[];
  hinted: number[];
  /** Per-slot verdicts after a successful Check. */
  results: SlotResult[] | null;
  /** Show answer: the slots show the reference order. */
  revealed: boolean;
  submitting: boolean;
  onCheck(chunkOrder: number[]): void;
  onProgress(placed: boolean): void;
}) {
  const t = useTranslations("shadowing.workspace.practice.listening");
  const n = display.length;
  const [placed, setPlaced] = useState<(number | null)[]>(() => Array.from({ length: n }, () => null));
  const order = useMemo(() => bankOrder(n, lineId), [n, lineId]);
  const hintedSet = new Set(hinted);
  const slots = revealed ? order.map((_, i) => i)
    : placed.map((chunk, i) => hintedSet.has(i) ? i : chunk !== null && hintedSet.has(chunk) ? null : chunk);
  const bank = order.filter((chunk) => !slots.includes(chunk));
  const locked = revealed || results !== null || submitting;
  const complete = slots.every((chunk) => chunk !== null);

  const update = (next: (number | null)[]) => {
    setPlaced(next);
    onProgress(next.some((chunk, i) => chunk !== null && !hintedSet.has(i)));
  };
  const place = (chunk: number) => {
    const empty = slots.indexOf(null);
    if (empty === -1) return;
    update(slots.map((current, i) => i === empty ? chunk : current));
  };
  const remove = (slot: number) => update(slots.map((current, i) => i === slot ? null : current));

  return <div className="flex flex-col gap-sm">
    <ol aria-label={t("answerSlots")} className="flex flex-wrap gap-xs">
      {slots.map((chunk, i) => {
        const isHinted = hintedSet.has(i) && !revealed;
        const verdict = results?.[i];
        const tone = verdict ? verdict.hinted ? "hinted" : verdict.correct ? "correct" : "wrong" : isHinted ? "hinted" : null;
        const label = (text: string) => t("slot", { n: i + 1, total: n, text: tone ? `${text}, ${t(`slotState.${tone}`)}` : text });
        return <li key={i} data-slot={i} data-result={verdict ? tone : undefined}>
          {chunk === null
            ? <span className="inline-flex min-h-control-sm min-w-16 items-center justify-center rounded-md border border-dashed border-border px-sm text-caption text-muted-foreground">
              <span aria-hidden="true">{i + 1}</span><span className="sr-only">{t("slotEmpty", { n: i + 1, total: n })}</span>
            </span>
            : <button type="button" aria-label={label(display[chunk] ?? "")} disabled={locked || isHinted} onClick={() => remove(i)}
              className={cn(CHIP, tone ? RESULT_TONE[tone] : "border-primary/40 bg-primary/5 hover:bg-primary/10")}>
              <span lang="ja">{display[chunk]}</span>
              {isHinted && <span aria-hidden="true" className="rounded-full bg-accent/20 px-xs text-caption text-accent-strong">{t("hint")}</span>}
            </button>}
        </li>;
      })}
    </ol>
    {bank.length > 0 && <ul aria-label={t("bank")} className="flex flex-wrap gap-xs">
      {bank.map((chunk) => <li key={chunk}>
        <button type="button" lang="ja" disabled={locked} onClick={() => place(chunk)} className={cn(CHIP, "border-border bg-card hover:bg-muted")}>{display[chunk]}</button>
      </li>)}
    </ul>}
    {!revealed && results === null && <button type="button" disabled={!complete || submitting} onClick={() => onCheck(slots as number[])}
      className="inline-flex min-h-control-sm items-center justify-center self-start rounded-full bg-primary px-md py-xs text-caption font-semibold text-primary-foreground disabled:opacity-50">
      {t(submitting ? "checking" : "check")}
    </button>}
  </div>;
}
