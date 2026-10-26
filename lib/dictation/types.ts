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
}
