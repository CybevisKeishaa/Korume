/** Spec W W10: curated Korume learning prompts (messages vocab.print.quotes.q1…q8), chosen by page index — never random, never AI. */
export const QUOTE_COUNT = 8;
export function quoteKey(pageIndex: number): string {
  return `quotes.q${(pageIndex % QUOTE_COUNT) + 1}`;
}
