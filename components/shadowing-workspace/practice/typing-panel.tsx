"use client";

import { useState, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { useTranslations } from "@/lib/i18n";
import type { ListeningDiffOp } from "@/lib/dictation/listening-score";
import { BOX, CheckButton, HINTED, PuzzleHeader } from "./listening-puzzle";
import { DictationMask } from "./star-mask";

/** Colour plus a non-colour cue per op (WCAG 1.4.1); Điền từ's per-blank verdicts reuse it. */
export const OP_TONE: Record<ListeningDiffOp["type"], string> = {
  match: "text-success-strong",
  wrong: "rounded-sm bg-danger/10 text-danger-strong underline decoration-wavy",
  missing: "rounded-sm border border-dashed border-danger text-danger-strong",
  extra: "text-muted-foreground line-through",
  hinted: HINTED,
};

/**
 * Typing in Chép chính tả (spec §3.3): the learner types the line; the star mask under the input reveals one
 * character per tap (a `grapheme1` hint) and never edits what was typed. Enter checks, except during an IME
 * composition (§3.8); the workspace shortcuts already ignore keys aimed at an input, so arrows and Space stay
 * characters. After 💡 the sentence replaces the mask; after Check the diff does, drawn from each op's `display`
 * (raw `text_jp`), never the normalised `expected`. Mounted with a key per line + format + attempt (P11), so a new
 * attempt starts empty; a failed Check keeps the text (Review Focus 2).
 */
export function TypingPanel({ text, hinted, diff, revealed, submitting, hint, onReveal, onCheck }: {
  /** The line's raw `text_jp`. */
  text: string;
  /** Revealed star units (`grapheme1`). */
  hinted: number[];
  /** The scored diff after a successful Check. */
  diff: ListeningDiffOp[] | null;
  revealed: boolean;
  submitting: boolean;
  /** The header's tools (💡), or null once the attempt is answered. */
  hint?: ReactNode;
  onReveal(unit: number): void;
  onCheck(input: string): void;
}) {
  const t = useTranslations("shadowing.workspace.practice.listening");
  const [input, setInput] = useState("");
  const locked = submitting || diff !== null || revealed;
  const check = () => {
    if (!locked && input.trim() !== "") onCheck(input);
  };

  return <div className="flex flex-col gap-sm">
    <PuzzleHeader eyebrow={t("puzzle.typing")} hint={hint} />
    <div className={`${BOX} flex flex-col gap-sm`}>
      <Input lang="ja" aria-label={t("typingLabel")} placeholder={t("dictation.placeholder")} value={input} maxLength={2000} readOnly={locked}
        autoComplete="off" spellCheck={false} className="font-jp" onChange={(event) => setInput(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter" || event.nativeEvent.isComposing || event.keyCode === 229) return;
          event.preventDefault();
          check();
        }} />
      {/* The P14 feedback region says the same in words (counts and the missed characters); this is the visual view. */}
      {diff ? <p data-testid="typing-diff" lang="ja" aria-hidden="true" className="font-jp text-body-lg">
        {diff.map((op, i) => <span key={i} data-op={op.type} className={OP_TONE[op.type]}>{op.type === "extra" ? op.actual : op.display}</span>)}
      </p> : <DictationMask text={text} hinted={hinted} revealed={revealed} onReveal={onReveal} />}
    </div>
    {!revealed && diff === null && <CheckButton label={t(submitting ? "checking" : "check")} disabled={locked || input.trim() === ""} onClick={check} />}
  </div>;
}
