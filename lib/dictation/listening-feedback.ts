import type { ListeningDiffOp, ListeningMetrics } from "./listening-score";

/** Message ids under `shadowing.workspace.practice.listening.feedback` (P14). */
export const FEEDBACK_IDS = [
  "hint_used", "hint_all",
  "wb_perfect", "wb_partial", "wb_hinted", "wb_fixed", "wb_helped_all", "wb_helped_partial",
  "ty_errors", "ty_extra", "ty_perfect", "ty_hinted", "ty_kanji", "ty_grammar", "ty_fewer", "ty_helped_all", "ty_helped_partial",
  "cz_perfect", "cz_partial", "cz_hinted", "cz_helped_all", "cz_helped_partial",
  "retry", "retry_first", "revealed",
] as const;
export type FeedbackId = (typeof FEEDBACK_IDS)[number];
export interface FeedbackMessage { id: FeedbackId; values: Record<string, string | number> }
/** The help an attempt used (spec §3.6): star reveals (Typing), hints (pieces or cloze kana), Chế độ dễ. Null = none. */
export interface FeedbackHelp { stars: number; hints: number; easy: boolean }

export type FeedbackEvent =
  | { kind: "hint"; unit: "chunk" | "grapheme1"; hinted: number; total: number }
  /** `slots` per answer position (the piece placed there is `chunkIndex`); `display` is the line's raw piece text. */
  | { kind: "checked_word_bank"; slots: { chunkIndex: number; correct: boolean; hinted: boolean }[]; display: string[]; previous: { wrongPieces: number[] } | null; help?: FeedbackHelp | null }
  | { kind: "checked_typing"; diff: ListeningDiffOp[]; metrics: ListeningMetrics; previous: { errorCount: number } | null; help?: FeedbackHelp | null }
  /** Per blank, in blank order; `words` are the blanks' surfaces, on screen after Check only. */
  | { kind: "checked_cloze"; blanks: { correct: boolean; hinted: number }[]; words: string[]; help: FeedbackHelp | null }
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
 * diff's own `display` characters and the wrong pieces' `display` (both on screen after Check only), so a hint
 * message cannot leak an unhinted unit. A hinted part is never praised as the learner's work (D10); "fixed" and "fewer" compare two submitted
 * results and appear only when the number is above zero. A helped result (spec §3.7) is acknowledged with real
 * counts and an invitation to try without help; `*_perfect` is only ever said when nothing helped.
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
      const { slots, display, previous } = event;
      const help = event.help ?? null;
      const own = slots.filter((s) => s.correct && !s.hinted);
      // v2 marks the hinted prefix `correct: false`: a hinted piece is neither wrong nor named.
      const wrong = slots.filter((s) => !s.correct && !s.hinted);
      const hinted = slots.filter((s) => s.hinted).length;
      const fixed = previous ? own.filter((s) => previous.wrongPieces.includes(s.chunkIndex)).length : 0;
      const shown = Array.from(wrong.map((s) => display[s.chunkIndex] ?? "").join(" "));
      const pieces = shown.length > MAX_CHARS ? `${shown.slice(0, MAX_CHARS).join("").trimEnd()}…` : shown.join("");
      const out = own.length === slots.length
        ? [help ? msg("wb_helped_all", { total: slots.length }) : msg("wb_perfect")]
        : [help ? msg("wb_helped_partial", { correct: own.length, total: slots.length }) : msg("wb_partial", { correct: own.length, total: slots.length, wrong: wrong.length, pieces }),
          ...(hinted > 0 ? [msg("wb_hinted", { hinted })] : [])];
      if (fixed > 0) out.push(msg("wb_fixed", { fixed }));
      return out.slice(0, MAX_MESSAGES);
    }
    case "checked_typing": {
      const { diff, metrics, previous } = event;
      const help = event.help ?? null;
      const errors = typingErrorCount(diff);
      const hinted = count(diff, "hinted");
      const wrong = count(diff, "wrong");
      const missing = count(diff, "missing");
      const extra = count(diff, "extra");
      const shown = diff.flatMap((op) => (op.type === "wrong" || op.type === "missing") && op.display !== "" ? [op.display] : []);
      const chars = shown.slice(0, MAX_CHARS).join("") + (shown.length > MAX_CHARS ? "…" : "");
      const out: FeedbackMessage[] = [];
      // A helped line leads with what was right and the stars it took; the stars replace ty_hinted.
      if (help) out.push(errors === 0 ? msg("ty_helped_all", { stars: help.stars }) : msg("ty_helped_partial", { correct: count(diff, "match"), total: diff.length - extra, stars: help.stars }));
      if (wrong + missing > 0) out.push(msg("ty_errors", { wrong, missing, extra, chars }));
      else if (extra > 0) out.push(msg("ty_extra", { extra }));
      else if (hinted === 0 && !help) out.push(msg("ty_perfect"));
      if (previous && previous.errorCount > errors) out.push(msg("ty_fewer", { fewer: previous.errorCount - errors }));
      if (hinted > 0 && !help) out.push(msg("ty_hinted", { hinted }));
      if (metrics.kanji !== undefined && metrics.kanji < metrics.recall) out.push(msg("ty_kanji", { kanji: Math.round(metrics.kanji) }));
      if (metrics.grammar !== undefined && metrics.grammar < metrics.recall) out.push(msg("ty_grammar", { grammar: Math.round(metrics.grammar) }));
      return out.slice(0, MAX_MESSAGES);
    }
    case "checked_cloze": {
      const { blanks, words, help } = event;
      const correct = blanks.filter((b) => b.correct).length;
      const total = blanks.length;
      // Only the wrong blanks are named, and only here: this event exists once the result is on screen.
      const missed = blanks.flatMap((b, i) => b.correct ? [] : [words[i] ?? ""]).join("、");
      const out = correct === total
        ? [help ? msg("cz_helped_all", { total }) : msg("cz_perfect", { total })]
        : [help ? msg("cz_helped_partial", { correct, total, words: missed, easy: help.easy ? "yes" : "no" }) : msg("cz_partial", { correct, total, words: missed })];
      if (help && help.hints > 0) out.push(msg("cz_hinted", { hinted: help.hints }));
      return out;
    }
  }
}

const CHECKED: ReadonlySet<FeedbackId> = new Set(FEEDBACK_IDS.filter((id) => id.startsWith("wb_") || id.startsWith("ty_") || id.startsWith("cz_")));
export type FeedbackMood = "joy" | "encourage" | "review";

/**
 * P15: Korume's expression, from the P14 outcome ids only, never from a score. `*_perfect` is emitted only when no
 * help was used (spec §3.7), so a helped or hinted attempt can never reach joy. Hints and restarts while
 * answering, and a failed request, carry no checked id: no figure.
 */
export function feedbackMood(messages: FeedbackMessage[]): FeedbackMood | null {
  if (messages.some((m) => m.id === "wb_perfect" || m.id === "ty_perfect" || m.id === "cz_perfect")) return "joy";
  if (messages.some((m) => m.id === "revealed")) return "review";
  return messages.some((m) => CHECKED.has(m.id)) ? "encourage" : null;
}
