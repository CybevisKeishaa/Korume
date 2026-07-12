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
