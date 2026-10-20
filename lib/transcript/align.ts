import { parseTranscript } from "./parse";
import type { ParsedLine, TranscriptFormat } from "./types";

interface Timed {
  startTime: number;
  /** `null` (a plain transcript) counts as a zero-length cue, which overlaps nothing. */
  endTime: number | null;
}

/**
 * Each translation cue joins the Japanese line it overlaps longest, so a track
 * split at different points still lands; a line no cue overlaps stays `null`.
 */
export function alignTranslations(lines: readonly Timed[], cues: readonly (Timed & { textJp: string })[]): (string | null)[] {
  const parts: string[][] = lines.map(() => []);
  for (const cue of cues) {
    let best = -1;
    let bestOverlap = 0;
    lines.forEach((line, index) => {
      const overlap = Math.min(line.endTime ?? line.startTime, cue.endTime ?? cue.startTime) - Math.max(line.startTime, cue.startTime);
      if (overlap > bestOverlap) {
        best = index;
        bestOverlap = overlap;
      }
    });
    parts[best]?.push(cue.textJp);
  }
  return parts.map((texts) => (texts.length > 0 ? texts.join(" ") : null));
}

/** A Japanese transcript with a separately timed translation file aligned onto it. Both are parsed (and sanitized) as `format`. */
export function parseBilingualTranscript(raw: string, translationRaw: string | null, format: TranscriptFormat): ParsedLine[] {
  const lines = parseTranscript(raw, format);
  if (translationRaw === null) return lines;
  const translations = alignTranslations(lines, parseTranscript(translationRaw, format));
  return lines.map((line, index) => {
    const textTranslation = translations[index];
    return textTranslation ? { ...line, textTranslation } : line;
  });
}
