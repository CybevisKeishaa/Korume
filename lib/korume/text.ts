const TITLE_CODE_POINTS = 40;

/** One canonical form for a question: the idempotency check compares this, never the raw body. */
export function normalizeTurnText(text: string): string {
  return text.normalize("NFC").replace(/\s+/g, " ").trim();
}

/** A thread's title is its first question, cut by code points so a surrogate pair is never split. */
export function threadTitle(firstQuestion: string): string {
  const points = Array.from(normalizeTurnText(firstQuestion));
  return points.length > TITLE_CODE_POINTS ? points.slice(0, TITLE_CODE_POINTS).join("") + "…" : points.join("");
}
