/** One parsed transcript cue, ready to persist as a `transcript_line` row. */
export interface ParsedLine {
  /** Cue start time in seconds. */
  startTime: number;
  /** Cue end time in seconds, or `null` when the source format has none (plain). */
  endTime: number | null;
  /** Sanitized Japanese line text (plain text — never HTML). */
  textJp: string;
  /** Optional translation, reserved for bilingual sources. */
  textTranslation?: string;
}

export type TranscriptFormat = "auto" | "srt" | "vtt" | "plain";
