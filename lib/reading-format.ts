/**
 * Splits Japanese passage text into sentence-sized chunks, keeping the
 * closing punctuation (。！？) attached to the sentence it ends and newlines
 * as their own chunk. Pure string splitting — no `dangerouslySetInnerHTML`.
 *
 * Used as the tap-to-lookup fallback granularity when a passage has no
 * `furigana_json` (word boundaries unknown): `components/reading/reading-body.tsx`
 * makes each sentence its own lookup target instead of leaving the passage
 * fully inert.
 */
export function splitIntoSentences(text: string): string[] {
  const matches = text.match(/[^。！？\n]+[。！？]?|\n/g);
  return matches ?? (text ? [text] : []);
}
