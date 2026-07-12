/**
 * Normalize Japanese text for dictation comparison:
 * - Unicode NFKC so full-width alphanumerics/punctuation collapse to their
 *   half-width forms and half-width katakana expands to full-width katakana.
 * - All whitespace removed. Japanese text has no meaningful inter-word
 *   spacing, so a user typing (or not typing) a space must never affect
 *   scoring.
 *
 * Pure and deterministic — same input always yields the same output.
 */
export function normalizeJa(s: string): string {
  return s.normalize("NFKC").replace(/\s+/g, "");
}
