import type { TranscriptLineRow } from "@/lib/data/transcripts";
import type { WorkspaceLine } from "./types";

type TranscriptLineInput = Pick<TranscriptLineRow, "id" | "start_time" | "end_time" | "text_jp" | "text_translation" | "furigana_json">;

export function canonicalLines(rows: readonly TranscriptLineInput[]): WorkspaceLine[] {
  return [...rows]
    .sort((a, b) => a.start_time - b.start_time || a.id.localeCompare(b.id))
    .map((row, index) => ({
      id: row.id,
      index,
      startTime: row.start_time,
      endTime: row.end_time,
      textJp: row.text_jp,
      textTranslation: row.text_translation,
      furigana: Array.isArray(row.furigana_json) ? row.furigana_json : null,
    }));
}
