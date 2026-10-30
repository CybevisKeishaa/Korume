"use client";

import { useId, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, Lightbulb, X } from "lucide-react";
import { useTranslations } from "@/lib/i18n";
import { bankOrder } from "@/lib/dictation/shuffle";
import type { LineCloze } from "@/lib/dictation/types";
import { cn } from "@/lib/utils";
import { BOX, CheckButton, HINTED, PuzzleHeader } from "./listening-puzzle";
import { OP_TONE } from "./typing-panel";

const GRAPHEMES = new Intl.Segmenter("ja", { granularity: "grapheme" });
const CHIP = "inline-flex min-h-control-sm items-center rounded-full border px-sm font-jp text-body font-semibold";
/** Colour plus an icon and a text equivalent per verdict (WCAG 1.4.1), on the Typing diff's and the hint's tones. */
const VERDICT = { correct: { tone: OP_TONE.match, Icon: Check }, wrong: { tone: OP_TONE.wrong, Icon: X }, hinted: { tone: HINTED, Icon: Lightbulb } } as const;

/**
 * Spec §3.4 💡: the hints are flat indices over the blanks' readings laid end to end, each blank's share a prefix
 * (the server's `hintedPerBlank`). Gives each blank's read-only kana prefix, the next index to hint (the lowest
 * unfinished blank), or null when every reading is given, and the unit total.
 */
export function clozeHints(readings: readonly string[], hinted: readonly number[], open?: (blank: number, prefix: string) => boolean): { prefixes: string[]; next: number | null; total: number } {
  const prefixes: string[] = [];
  let next: number | null = null;
  let total = 0;
  for (const [b, reading] of readings.entries()) {
    const g = Array.from(GRAPHEMES.segment(reading), (s) => s.segment);
    const n = hinted.filter((h) => h >= total && h < total + g.length).length;
    if (next === null && n < g.length && (open?.(b, g.slice(0, n).join("")) ?? true)) next = total + n;
    prefixes.push(g.slice(0, n).join(""));
    total += g.length;
  }
  return { prefixes, next, total };
}

/**
 * Điền từ (spec §3.4): the sentence as written with an inline box per blank. A blank's word and reading reach the
 * DOM only after Check or Show answer (D4), except as Chế độ dễ's chips, which are those words. 💡 characters sit
 * read-only at the start of their box; `answers` carry them, so Check sends exactly what is shown. A chip fills the
 * focused (else the first) empty blank without hints; tapping the filled blank gives it back. Mounted with a key per
 * line + attempt (P11).
 */
export function ClozePanel({ cloze, easy, answers, hinted, results, revealed, submitting, hint, onChange, onUseChip, onCheck }: {
  cloze: LineCloze;
  easy: boolean;
  /** One per blank, the hinted prefix included. */
  answers: string[];
  /** 💡 characters, flat over the blanks' readings. */
  hinted: number[];
  /** Per-blank verdicts after a successful Check. */
  results: { correct: boolean; hinted: number }[] | null;
  revealed: boolean;
  submitting: boolean;
  /** The header's tools (💡, Show answer), or null once answered. */
  hint?: ReactNode;
  onChange(answers: string[]): void;
  onUseChip(): void;
  onCheck(): void;
}) {
  const t = useTranslations("shadowing.workspace.practice.listening");
  const id = useId();
  const words = cloze.segments.flatMap((s) => s.blank === null ? [] : [s.text]);
  const order = useMemo(() => bankOrder(words.length, cloze.textHash), [words.length, cloze.textHash]);
  const { prefixes } = clozeHints(cloze.readings, hinted);
  /** The chip each blank took; it stays there only while the blank still holds that chip's word. */
  const [held, setHeld] = useState<(number | undefined)[]>([]);
  const focused = useRef(0);
  const locked = submitting || results !== null || revealed;
  const chipIn = (b: number) => {
    const c = held[b];
    return easy && c !== undefined && answers[b] === words[c] ? c : undefined;
  };
  const bank = order.filter((c) => !words.some((_, b) => chipIn(b) === c));
  const complete = words.length > 0 && words.every((_, b) => (answers[b] ?? "").trim() !== "");
  const set = (b: number, value: string) => onChange(words.map((_, i) => i === b ? value : answers[i] ?? ""));
  const check = () => {
    if (!locked && complete) onCheck();
  };
  const takeChip = (c: number) => {
    const empty = (b: number) => (answers[b] ?? "") === "" && prefixes[b] === "";
    const b = empty(focused.current) ? focused.current : words.findIndex((_, i) => empty(i));
    if (locked || b < 0) return;
    setHeld((prev) => Object.assign([...prev], { [b]: c }));
    set(b, words[c] ?? "");
    onUseChip();
  };

  const blank = (b: number, word: string) => {
    if (results !== null || revealed) {
      const r = results?.[b];
      const v = !r ? null : !r.correct ? "wrong" : r.hinted > 0 ? "hinted" : "correct";
      const Icon = v ? VERDICT[v].Icon : null;
      return <span data-blank-answer={v ?? "revealed"} className={cn("inline-flex items-center gap-2xs px-2xs", v ? VERDICT[v].tone : "font-semibold underline")}>
        {Icon && <Icon aria-hidden className="size-icon-xs" />}
        <span>{word}</span>
        {v === "wrong" && answers[b] && <s className="text-caption text-muted-foreground">{answers[b]}</s>}
        {v && <span className="sr-only">{t(`slotState.${v}`)}</span>}
      </span>;
    }
    const c = chipIn(b);
    if (c !== undefined) {
      return <button type="button" disabled={locked} aria-label={`${t("cloze.blank", { n: b + 1 })}, ${words[c]}`} onClick={() => set(b, "")}
        className={cn(CHIP, "border-primary/40 bg-primary/5 text-primary-strong hover:bg-primary/10")}>{words[c]}</button>;
    }
    const prefix = prefixes[b] ?? "";
    const answer = answers[b] ?? "";
    return <span className="inline-flex items-baseline rounded-md border border-input bg-input-background px-xs focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/40">
      {prefix && <span id={`${id}-${b}`} className={HINTED}><span className="sr-only">{t("hint")}: </span>{prefix}</span>}
      <input type="text" lang="ja" aria-label={t("cloze.blank", { n: b + 1 })} aria-describedby={prefix ? `${id}-${b}` : undefined}
        value={answer.startsWith(prefix) ? answer.slice(prefix.length) : answer} readOnly={locked} maxLength={50 - prefix.length}
        autoComplete="off" spellCheck={false} onFocus={() => { focused.current = b; }} onChange={(event) => set(b, prefix + event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter" || event.nativeEvent.isComposing || event.keyCode === 229) return;
          event.preventDefault();
          check();
        }}
        className="min-w-[5ch] bg-transparent font-jp text-body-lg text-foreground outline-none [field-sizing:content]" />
    </span>;
  };

  return <div className="flex flex-col gap-sm">
    <PuzzleHeader eyebrow={t("cloze.eyebrow")} hint={hint} />
    <p lang="ja" data-testid="cloze-sentence" className={cn(BOX, "font-jp text-body-lg text-foreground")}>
      {cloze.segments.map((s, i) => s.blank === null ? <span key={i}>{s.text}</span> : <span key={i} className="mx-2xs inline-block py-2xs">{blank(s.blank, s.text)}</span>)}
    </p>
    {words.length === 0 && <p data-testid="cloze-no-blank" className="rounded-md border border-border bg-muted px-sm py-xs text-caption text-muted-foreground">{t("cloze.noBlank")}</p>}
    {easy && !locked && bank.length > 0 && <ul aria-label={t("bank")} className="flex flex-wrap justify-center gap-xs">
      {bank.map((c) => <li key={c}>
        <button type="button" lang="ja" onClick={() => takeChip(c)} className={cn(CHIP, "border-border bg-card text-foreground hover:bg-muted")}>{words[c]}</button>
      </li>)}
    </ul>}
    {words.length > 0 && !revealed && results === null && <CheckButton label={t(submitting ? "checking" : "cloze.check")} disabled={locked || !complete} onClick={check} />}
  </div>;
}
