import type { Utf16Span } from "./types";

/**
 * Where each surface sits in the text, in UTF-16 code units. Surfaces must appear in order; anything the
 * tokenizer dropped between them (spaces) is skipped.
 */
export function tokenSpans(text: string, surfaces: string[]): Utf16Span[] {
  let cursor = 0;
  return surfaces.map((surface) => {
    const start = text.indexOf(surface, cursor);
    if (start < 0) throw new Error(`token ${JSON.stringify(surface)} not found after offset ${cursor}`);
    cursor = start + surface.length;
    return { start, end: cursor };
  });
}

/** The server never trusts a client span: it widens it to whole tokens, or refuses it (spec §5.1). */
export function snapSpanToTokens(text: string, tokens: { span: Utf16Span }[], span: Utf16Span): Utf16Span | null {
  if (span.start < 0 || span.end > text.length || span.start >= span.end) return null;
  const touched = tokens.filter((token) => token.span.start < span.end && token.span.end > span.start);
  const first = touched[0];
  const last = touched[touched.length - 1];
  return first && last ? { start: first.span.start, end: last.span.end } : null;
}
