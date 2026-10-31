"use client";

import { useEffect, useId, useMemo, useRef, useState, type DragEvent, type KeyboardEvent, type ReactNode } from "react";
import { useTranslations } from "@/lib/i18n";
import { bankOrder } from "@/lib/dictation/shuffle";
import { starFill } from "@/lib/dictation/star-mask";
import { insertPiece, movePiece, removePiece, withHints } from "@/lib/dictation/word-bank-answer";
import { cn } from "@/lib/utils";
import { DictationMask } from "./star-mask";
import { BOX, CheckButton, EYEBROW, PuzzleHeader } from "./listening-puzzle";

type SlotResult = { correct: boolean; hinted: boolean };
const CHIP = "inline-flex max-w-full items-center gap-xs break-all border font-jp disabled:cursor-default";
const PLACED = `${CHIP} min-h-control-md min-w-[var(--control-md)] justify-center rounded-full px-xs text-body font-medium`;
const MARKER = "pointer-events-none absolute inset-y-0 w-0.5 rounded-full bg-primary";
const RESULT_TONE = {
  correct: "border-success bg-success/10 text-success-strong",
  wrong: "border-danger bg-danger/10 text-danger-strong",
  hinted: "border-accent bg-accent/10 text-accent-strong",
} as const;

/** Insertion index for a pointer at `x` over one row of placed pieces: the pieces whose centre lies left of it. */
export function dropIndex(rects: DOMRect[], x: number): number {
  return rects.filter((r) => r.left + r.width / 2 < x).length;
}

/**
 * Word Bank (WP spec §3.2-§3.3): the answer is an ordered list of piece indices, never slots. The hinted pieces
 * form a locked prefix, re-derived from `hinted` on every render (`withHints`), so a hint moves a placed piece to
 * the front and nothing is lost or shown twice. A piece is identified by its index everywhere: keys, `data-piece`,
 * drag payloads, `chunkOrder`. Tap or Enter appends a bank piece and returns a placed one; drag inserts at the
 * marker; Alt+Arrow moves a placed piece one place. Mounted with a key per line + format + attempt (P11), so a
 * drag from an older line drops nothing here.
 */
export function WordBankPanel({ lineId, text, chunks, display, hinted, results, revealed, submitting, hint, card, onCheck }: {
  lineId: string;
  /** The raw line, for the star row the placed pieces fill. */
  text: string;
  /** The normalised pieces, parallel to `display`. */
  chunks: string[];
  display: string[];
  hinted: number[];
  /** Per answer position verdicts after a successful Check. */
  results: SlotResult[] | null;
  /** Show answer: the answer shows the reference order. */
  revealed: boolean;
  submitting: boolean;
  /** The Show Hint pill, or null once the attempt is answered. */
  hint?: ReactNode;
  /** The card toggles, under the answer (spec §3.5). */
  card?: ReactNode;
  onCheck(chunkOrder: number[]): void;
}) {
  const t = useTranslations("shadowing.workspace.practice.listening");
  const bankLabel = useId();
  const n = display.length;
  const [answer, setAnswer] = useState<number[]>([]);
  const [dropAt, setDropAt] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState("");
  /** The piece this panel's own drag carries: a drag that began on another panel finds null here. */
  const dragged = useRef<number | null>(null);
  /** A chip that had focus and moved (tray <-> bank, or one place): focus follows it after the commit. */
  const refocus = useRef<number | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const order = useMemo(() => bankOrder(n, lineId), [n, lineId]);
  const placed = revealed ? order.map((_, i) => i) : withHints(answer, hinted);
  const k = revealed ? n : hinted.length;
  const bank = order.filter((p) => !placed.includes(p));
  const locked = revealed || results !== null || submitting;

  useEffect(() => {
    if (refocus.current === null) return;
    root.current?.querySelector<HTMLElement>(`[data-piece='${refocus.current}']`)?.focus();
    refocus.current = null;
  });

  const update = (next: number[], focused: number | null = null) => {
    if (locked) return;
    refocus.current = focused;
    setAnswer(next);
  };
  const focusedPiece = (target: EventTarget, p: number) => target === document.activeElement ? p : null;
  /** Alt+ArrowLeft is also the browser's Back: on any chip it must never leave the page and the answer. */
  const altArrow = (event: KeyboardEvent) => {
    const hit = event.altKey && (event.key === "ArrowLeft" || event.key === "ArrowRight");
    if (hit) event.preventDefault();
    return hit;
  };
  const move = (event: KeyboardEvent, p: number) => {
    if (!altArrow(event)) return;
    if (locked) return;
    const next = movePiece(placed, p, event.key === "ArrowLeft" ? -1 : 1, k);
    update(next, p);
    setAnnouncement(t("moved", { text: display[p] ?? "", n: next.indexOf(p) + 1, total: n }));
  };
  const dragStart = (event: DragEvent, p: number) => {
    dragged.current = p;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", display[p] ?? "");
  };
  /** A placed piece dropped anywhere but the answer goes back to the bank; a bank piece stays (spec §3.3). */
  const dragEnd = (p: number) => {
    if (dragged.current === p && placed.includes(p)) update(removePiece(placed, p, k));
    dragged.current = null;
    setDropAt(null);
  };
  /** The insertion index under the pointer, never inside the hinted prefix; null off every row of chips. */
  const pointerIndex = (event: DragEvent<HTMLElement>) => {
    // Flex-wrap rows: only the chips on the pointer's row decide the index.
    const rects = [...event.currentTarget.querySelectorAll("[data-piece]")].map((chip) => chip.getBoundingClientRect());
    const inRow = (r: DOMRect) => event.clientY >= r.top && event.clientY <= r.bottom;
    const first = rects.findIndex(inRow);
    return first < 0 ? null : Math.max(k, first + dropIndex(rects.filter(inRow), event.clientX));
  };
  const dragOver = (event: DragEvent<HTMLElement>) => {
    if (locked || dragged.current === null) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropAt(pointerIndex(event) ?? dropAt ?? placed.length);
  };
  const drop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    const p = dragged.current;
    dragged.current = null;
    setDropAt(null);
    // From the drop event itself: a dragleave between chips may have cleared the marker since the last dragover.
    if (p !== null) update(insertPiece(placed, p, pointerIndex(event) ?? dropAt ?? placed.length, k));
  };

  return <div ref={root} className="flex flex-col gap-sm">
    <PuzzleHeader eyebrow={t("puzzle.wordBank")} status={t("puzzle.remaining", { count: bank.length })} hint={<div className="flex flex-1 flex-wrap items-center justify-end gap-xs">
      <DictationMask text={text} hinted={[]} revealed={revealed} filled={starFill(placed.map((p) => ({ chunk: chunks[p] ?? "", display: display[p] ?? "" })))} />{hint}
    </div>} />
    <div className={cn(BOX, dropAt !== null && "ring-2 ring-primary/40")} onDragOver={dragOver} onDrop={drop}
      onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropAt(null); }}>
      <ol aria-label={t("answerSlots")} className="flex min-h-control-md flex-wrap justify-center gap-xs">
        {placed.map((p, i) => {
          const isHinted = i < k && !revealed;
          const verdict = results?.[i];
          const tone = verdict ? verdict.hinted ? "hinted" : verdict.correct ? "correct" : "wrong" : isHinted ? "hinted" : null;
          const text = display[p] ?? "";
          return <li key={p} data-slot={i} data-result={verdict ? tone : undefined} className="relative flex max-w-full">
            {dropAt === i && <span data-drop-marker aria-hidden="true" className={cn(MARKER, "-start-2xs")} />}
            <button type="button" data-piece={p} aria-label={t("slot", { n: i + 1, total: n, text: tone ? `${text}, ${t(`slotState.${tone}`)}` : text })}
              disabled={locked || isHinted} draggable={!locked && !isHinted}
              aria-keyshortcuts={locked || isHinted ? undefined : "Alt+ArrowLeft Alt+ArrowRight"}
              onClick={(event) => update(removePiece(placed, p, k), focusedPiece(event.currentTarget, p))}
              onKeyDown={(event) => move(event, p)} onDragStart={(event) => dragStart(event, p)} onDragEnd={() => dragEnd(p)}
              className={cn(PLACED, tone ? RESULT_TONE[tone] : "cursor-grab border-primary/40 border-b-2 bg-primary/5 text-primary-strong hover:bg-primary/10")}>
              <span lang="ja">{text}</span>
              {isHinted && <span aria-hidden="true" className="rounded-full bg-accent/20 px-xs text-caption text-accent-strong">{t("hint")}</span>}
            </button>
            {dropAt === placed.length && i === placed.length - 1 && <span data-drop-marker aria-hidden="true" className={cn(MARKER, "-end-2xs")} />}
          </li>;
        })}
      </ol>
    </div>
    {card}
    <p role="status" aria-live="polite" className="sr-only">{announcement}</p>
    <div className={BOX}>
      <p id={bankLabel} className={cn(EYEBROW, "mb-xs")}>{t("bank")}</p>
      {bank.length > 0 && <ul aria-labelledby={bankLabel} className="flex flex-wrap gap-xs">
        {bank.map((p) => <li key={p} className="flex max-w-full">
          <button type="button" lang="ja" data-piece={p} disabled={locked} draggable={!locked}
            onClick={(event) => update(insertPiece(placed, p, placed.length, k), focusedPiece(event.currentTarget, p))}
            onKeyDown={altArrow} onDragStart={(event) => dragStart(event, p)} onDragEnd={() => dragEnd(p)}
            className={cn(CHIP, "min-h-control-sm cursor-grab rounded-full border-border bg-card px-sm text-body font-semibold text-foreground hover:bg-muted")}>{display[p]}</button>
        </li>)}
      </ul>}
    </div>
    {!revealed && results === null && <CheckButton label={t(submitting ? "checking" : "check")} disabled={placed.length < n || submitting} onClick={() => onCheck(placed)} />}
  </div>;
}
