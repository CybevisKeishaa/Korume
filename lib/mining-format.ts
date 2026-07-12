/** One chunk of a sentence, marked whether it is the mined target word. */
export interface SentenceSegment {
  text: string;
  emphasized: boolean;
}

/**
 * Splits a mined sentence around every occurrence of its target word, so the
 * UI can render the target emphasized (bold + underline — never color alone,
 * CLAUDE.md §5) inside the surrounding sentence. Pure string splitting, never
 * `dangerouslySetInnerHTML`. Falls back to the whole sentence unemphasized
 * when the target word is empty or not found in the sentence.
 */
export function splitSentenceForEmphasis(sentence: string, targetWord: string): SentenceSegment[] {
  if (!targetWord) return [{ text: sentence, emphasized: false }];

  const pieces = sentence.split(targetWord);
  if (pieces.length === 1) return [{ text: sentence, emphasized: false }];

  const segments: SentenceSegment[] = [];
  pieces.forEach((piece, index) => {
    if (piece) segments.push({ text: piece, emphasized: false });
    if (index < pieces.length - 1) segments.push({ text: targetWord, emphasized: true });
  });
  return segments;
}
