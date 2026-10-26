/**
 * One character-level alignment op between a reference transcript line and a
 * user's typed input.
 * - match:   character present and correct in both
 * - wrong:   character present in both but differs (substitution)
 * - missing: character present in the reference but absent from the input (deletion)
 * - extra:   character present in the input but absent from the reference (insertion)
 */
export interface DictationDiff {
  type: "match" | "missing" | "extra" | "wrong";
  expected?: string;
  actual?: string;
}

export interface DictationResult {
  /** 0..100, one decimal place. matched characters / reference length * 100. */
  accuracy: number;
  diff: DictationDiff[];
}

/** Why a line cannot be cut for Word Bank (spec §5.2). */
export type ChunkReason = "mismatch" | "unknown_token" | "latin_or_digit" | "single_chunk" | "too_many_pieces";

/** Most Word Bank pieces a line may have; the submit schema and chunker v2 share it. */
export const MAX_WORD_PIECES = 64;

/** `GET /api/lines/[lineId]/chunks` payload; chunks are in reference order (P8). */
export interface LineChunks {
  version: number;
  /** sha256 hex of the raw `text_jp` the server just read; echoed back on submit (409 `line_changed`). */
  textHash: string;
  reliable: boolean;
  reason: ChunkReason | null;
  chunks: string[];
  /** The raw `text_jp` characters of each chunk, same length and order as `chunks`; this is what the client shows. */
  display: string[];
  typingHintUnit: "chunk" | "grapheme4";
  /** Hepburn romaji of the whole line (spec §3.5); in Chép chính tả an answer surface, shown only after Check. */
  romaji: string;
}

/** `GET /api/lines/[lineId]/cloze` payload (spec §3.4). */
export interface LineCloze {
  /** The cloze selector version; echoed back on submit as `version`. */
  version: number;
  textHash: string;
  /** Ascending token indices of the blanks; `[]` when the line has no candidate. */
  blanks: number[];
  /** Cover the raw `text_jp` in order (P13 display characters); `blank` indexes `blanks`; a blank's romaji is `___`. */
  segments: { text: string; blank: number | null; romaji: string }[];
  /** Hiragana reading of each blank, same order as `blanks` (the 💡 hint fills from it). */
  readings: string[];
}
