import { REVIEW_PRONUNCIATION_BELOW, STRONG_PRONUNCIATION_AT } from "@/lib/summary/thresholds";
import type { WordSpan } from "./align-words";
import type { AssessmentWord } from "./assessment";

export type Grade = "needsWork" | "good" | "strong";
export const GRADES: readonly Grade[] = ["needsWork", "good", "strong"];

/** One cut for every practice score: the Summary thresholds (spec §4.6), so a word and a sentence grade alike. */
export function scoreGrade(score: number): Grade {
  if (score < REVIEW_PRONUNCIATION_BELOW) return "needsWork";
  return score >= STRONG_PRONUNCIATION_AT ? "strong" : "good";
}

/** A word Azure flagged (mispronounced, omitted, inserted) needs work whatever its number; no number, no grade. */
export function wordGrade(word: Pick<WordSpan | AssessmentWord, "accuracy" | "errorType">): Grade | null {
  if (word.errorType !== "None") return "needsWork";
  return word.accuracy === null ? null : scoreGrade(word.accuracy);
}

/** Text colour per grade, on the theme's text tokens. */
export const GRADE_TEXT: Record<Grade, string> = {
  needsWork: "text-danger-strong",
  good: "text-accent-strong",
  strong: "text-success-strong",
};
