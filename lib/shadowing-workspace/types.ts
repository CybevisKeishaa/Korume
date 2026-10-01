import type { FuriganaSegment } from "@/lib/japanese/types";

export interface WorkspaceLine {
  id: string;
  index: number;
  startTime: number;
  endTime: number | null;
  textJp: string;
  textTranslation: string | null;
  furigana: FuriganaSegment[] | null;
}
