"use client";

import { useState, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { useTranslations } from "@/lib/i18n";
import { displayMap, displayRange } from "@/lib/dictation/display";
import { grapheme4Units, type ListeningDiffOp } from "@/lib/dictation/listening-score";
import { normalizeJa } from "@/lib/dictation/normalize";
import { BOX, CheckButton, PuzzleHeader } from "./listening-puzzle";

/** Colour plus a non-colour cue per op (WCAG 1.4.1). */
const OP_TONE: Record<ListeningDiffOp["type"], string> = {
  match: "text-success-strong",
  wrong: "rounded-sm bg-danger/10 text-danger-strong underline decoration-wavy",
  missing: "rounded-sm border border-dashed border-danger text-danger-strong",
  extra: "text-muted-foreground line-through",
  hinted: "rounded-sm bg-accent/10 text-accent-strong underline decoration-dotted",
};

/**
 * Typing (spec §5.5, §5.7): the learner types the line; a hint shows the next unit's raw text (P13) on a hint line
 * above the input and never edits what was typed. Enter checks, except during an IME composition (§3.8); the
 * workspace shortcuts already ignore keys aimed at an input, so arrows and Space stay characters. After Check the
 * diff is drawn from each op's `display` (raw `text_jp`), never the normalised `expected`. Mounted with a key per
 * line + format + attempt (P11), so a new attempt starts empty; a failed Check keeps the text (Review Focus 2).
 */
export function TypingPanel({ text, display, hintUnit, hinted, diff, revealed, submitting, hint, onCheck, onProgress }: {
  /** The line's raw `text_jp`. */
  text: string;
  /** The raw text of each chunk (`LineChunks.display`). */
  display: string[];
  hintUnit: "chunk" | "grapheme4";
  hinted: number[];
  /** The scored diff after a successful Check. */
  diff: ListeningDiffOp[] | null;
  revealed: boolean;
  submitting: boolean;
  /** The Show Hint pill, or null once the attempt is answered. */
  hint?: ReactNode;
  onCheck(input: string): void;
  onProgress(typed: boolean): void;
}) {
  const t = useTranslations("shadowing.workspace.practice.listening");
  const [input, setInput] = useState("");
  const locked = submitting || diff !== null || revealed;
  const base = normalizeJa(text);
  const map = displayMap(text);
  const units = hintUnit === "chunk" ? display : grapheme4Units(base).map((range) => displayRange(map, base, range));
  const check = () => {
    if (!locked && input.trim() !== "") onCheck(input);
  };

  return <div className="flex flex-col gap-sm">
    <PuzzleHeader eyebrow={t("puzzle.typing")} hint={hint} />
    <div className={`${BOX} flex flex-col gap-sm`}>
      {/* Always mounted, so the first hint is announced too (a live region must exist before its content). */}
      <p data-testid="typing-hint" aria-live="polite" className="flex flex-wrap items-baseline gap-xs">
        {hinted.length > 0 && <>
          <span className="rounded-full bg-accent/20 px-xs text-caption text-accent-strong">{t("hint")}</span>
          <span lang="ja" className="font-jp text-body text-foreground">{hinted.map((i) => units[i]).join(" ")}</span>
        </>}
      </p>
      <Input lang="ja" aria-label={t("typingLabel")} value={input} maxLength={2000} readOnly={locked} autoComplete="off" spellCheck={false}
        className="font-jp" onChange={(event) => { setInput(event.target.value); onProgress(event.target.value !== ""); }}
        onKeyDown={(event) => {
          if (event.key !== "Enter" || event.nativeEvent.isComposing || event.keyCode === 229) return;
          event.preventDefault();
          check();
        }} />
      {/* The P14 feedback region says the same in words (counts and the missed characters); this is the visual view. */}
      {diff && <p data-testid="typing-diff" lang="ja" aria-hidden="true" className="font-jp text-body-lg">
        {diff.map((op, i) => <span key={i} data-op={op.type} className={OP_TONE[op.type]}>{op.type === "extra" ? op.actual : op.display}</span>)}
      </p>}
    </div>
    {!revealed && diff === null && <CheckButton label={t(submitting ? "checking" : "check")} disabled={locked || input.trim() === ""} onClick={check} />}
  </div>;
}
