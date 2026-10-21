import type { ListeningDiffOp, ListeningMetrics } from "./listening-score";

/** Message ids under `shadowing.workspace.practice.listening.feedback` (P14). */
export const FEEDBACK_IDS = [
  "hint_used", "hint_all",
  "wb_perfect", "wb_partial", "wb_hinted", "wb_fixed",
  "ty_errors", "ty_extra", "ty_perfect", "ty_hinted", "ty_kanji", "ty_grammar", "ty_fewer",
  "retry", "retry_first", "revealed",
] as const;
export type FeedbackId = (typeof FEEDBACK_IDS)[number];
export interface FeedbackMessage { id: FeedbackId; values: Record<string, string | number> }

export type FeedbackEvent =
  | { kind: "hint"; unit: "chunk" | "grapheme4"; hinted: number; total: number }
  | { kind: "checked_word_bank"; slots: { correct: boolean; hinted: boolean }[]; previous: { wrongSlots: number[] } | null }
  | { kind: "checked_typing"; diff: ListeningDiffOp[]; metrics: ListeningMetrics; previous: { errorCount: number } | null }
  | { kind: "retry"; previousScore: number | null }
  | { kind: "revealed" };

const MAX_CHARS = 8;
const MAX_MESSAGES = 3;
const msg = (id: FeedbackId, values: FeedbackMessage["values"] = {}): FeedbackMessage => ({ id, values });
const count = (diff: ListeningDiffOp[], type: ListeningDiffOp["type"]) => diff.filter((op) => op.type === type).length;

/** Wrong + missing + extra characters; hinted characters are never errors. */
export function typingErrorCount(diff: ListeningDiffOp[]): number {
  return count(diff, "wrong") + count(diff, "missing") + count(diff, "extra");
}

/**
 * P14: what the learner's own action did, from the attempt's real data only. It reads no answer text but the
 * diff's own `display` characters (already on screen after Check), so a hint message cannot leak an unhinted
 * unit. A hinted part is never praised as the learner's work (D10); "fixed" and "fewer" compare two submitted
 * results and appear only when the number is above zero.
 */
export function listeningFeedback(event: FeedbackEvent): FeedbackMessage[] {
  switch (event.kind) {
    case "hint":
      return [msg("hint_used", { count: event.hinted, unit: event.unit }), ...(event.total > 0 && event.hinted >= event.total ? [msg("hint_all")] : [])];
    case "retry":
      return [event.previousScore === null ? msg("retry_first") : msg("retry", { score: Math.round(event.previousScore) })];
    case "revealed":
      return [msg("revealed")];
    case "checked_word_bank": {
      const { slots, previous } = event;
      const own = (i: number) => slots[i]?.correct === true && !slots[i]?.hinted;
      const correct = slots.filter((_, i) => own(i)).length;
      const hinted = slots.filter((s) => s.hinted).length;
      const fixed = previous ? previous.wrongSlots.filter(own).length : 0;
      const out = correct === slots.length
        ? [msg("wb_perfect")]
        : [msg("wb_partial", { correct, total: slots.length, wrong: slots.filter((s) => !s.correct).length }), ...(hinted > 0 ? [msg("wb_hinted", { hinted })] : [])];
      if (fixed > 0) out.push(msg("wb_fixed", { fixed }));
      return out.slice(0, MAX_MESSAGES);
    }
    case "checked_typing": {
      const { diff, metrics, previous } = event;
      const errors = typingErrorCount(diff);
      const hinted = count(diff, "hinted");
      const wrong = count(diff, "wrong");
      const missing = count(diff, "missing");
      const extra = count(diff, "extra");
      const shown = diff.flatMap((op) => (op.type === "wrong" || op.type === "missing") && op.display !== "" ? [op.display] : []);
      const chars = shown.slice(0, MAX_CHARS).join("") + (shown.length > MAX_CHARS ? "…" : "");
      const out: FeedbackMessage[] = [];
      if (wrong + missing > 0) out.push(msg("ty_errors", { wrong, missing, extra, chars }));
      else if (extra > 0) out.push(msg("ty_extra", { extra }));
      else if (hinted === 0) out.push(msg("ty_perfect"));
      if (previous && previous.errorCount > errors) out.push(msg("ty_fewer", { fewer: previous.errorCount - errors }));
      if (hinted > 0) out.push(msg("ty_hinted", { hinted }));
      if (metrics.kanji !== undefined && metrics.kanji < metrics.recall) out.push(msg("ty_kanji", { kanji: Math.round(metrics.kanji) }));
      if (metrics.grammar !== undefined && metrics.grammar < metrics.recall) out.push(msg("ty_grammar", { grammar: Math.round(metrics.grammar) }));
      return out.slice(0, MAX_MESSAGES);
    }
  }
}
