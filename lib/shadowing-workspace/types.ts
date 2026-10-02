import type { FuriganaSegment } from "@/lib/japanese/types";
import type { TranscriptLineRow } from "@/lib/video-types";

export interface WorkspaceLine {
  id: string;
  index: number;
  startTime: number;
  endTime: number | null;
  textJp: string;
  textTranslation: string | null;
  furigana: FuriganaSegment[] | null;
}

/** The row shape `MineLineControl` / `PinLineControl` take (`lib/video-types`), rebuilt from a workspace line. */
export function toTranscriptLineRow(line: WorkspaceLine): TranscriptLineRow {
  return {
    id: line.id, start_time: line.startTime, end_time: line.endTime,
    text_jp: line.textJp, text_translation: line.textTranslation, furigana_json: line.furigana,
  };
}
