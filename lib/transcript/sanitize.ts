/**
 * Defense-in-depth sanitizer for user-submitted transcript text (CLAUDE.md
 * §2/§6, spec §8). Transcript lines are ALWAYS plain text — the UI must never
 * render them via `dangerouslySetInnerHTML`, and this strips any markup that
 * could be mistaken for HTML before it ever reaches storage.
 */

/** Matches `<...>` markup, including malformed/unclosed tags like `<img onerror=...`. */
const TAG_RE = /<[^>]*>?/g;

/**
 * True for C0 controls (0x00-0x1F) and C1 controls (0x7F-0x9F), i.e.
 * everything a well-formed transcript line has no business containing.
 * Written as numeric comparisons (not a regex escape class) so the file
 * never has to embed raw control bytes or ambiguous escape sequences.
 */
function isControlCharCode(code: number): boolean {
  return code <= 0x1f || (code >= 0x7f && code <= 0x9f);
}

function stripControlChars(input: string): string {
  let out = "";
  for (const ch of input) {
    const code = ch.codePointAt(0) ?? 0;
    out += isControlCharCode(code) ? " " : ch;
  }
  return out;
}

/** Strip HTML-ish markup and control characters, then collapse whitespace. */
export function sanitizeTranscriptText(s: string): string {
  return stripControlChars(s.replace(TAG_RE, ""))
    .replace(/\s+/g, " ")
    .trim();
}

/** Same as {@link isControlCharCode} but treats `\n` (0x0A) as legitimate
 * whitespace rather than a control character to strip. */
function isStrippableControlCharCode(code: number): boolean {
  return code !== 0x0a && isControlCharCode(code);
}

function stripControlCharsPreservingNewlines(input: string): string {
  let out = "";
  for (const ch of input) {
    const code = ch.codePointAt(0) ?? 0;
    out += isStrippableControlCharCode(code) ? " " : ch;
  }
  return out;
}

/**
 * Sanitizer for longer, admin-authored content bodies (kanji mnemonics,
 * grammar explanations, reading passages, JLPT question stems) that
 * legitimately contain internal newlines/paragraphs — unlike transcript
 * lines, which are always single-line. Strips HTML-ish markup and control
 * characters (same defense as `sanitizeTranscriptText`) but preserves
 * newlines/paragraph structure instead of collapsing all whitespace to a
 * single space, trimming only the outer edges. Used by
 * `lib/data/admin-content.ts`.
 */
export function sanitizeContentText(s: string): string {
  return stripControlCharsPreservingNewlines(s.replace(TAG_RE, "").replace(/\r\n/g, "\n")).trim();
}
