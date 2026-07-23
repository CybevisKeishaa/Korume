/** Chapters of the relationship (spec §4.1). Never called "stage" — that
 * imports a game/levelling mindset P12 rejects. Names are working names;
 * the visible name/look is Character Identity (Spec 2). */
export type RelationshipPhase = 1 | 2 | 3 | 4;

export type MemoryKind = "discovered" | "gifted";

export type MemoryType =
  | "first_shadow"
  | "line_mastered"
  | "mining_saved"
  | "first_video_completed"
  | "jlpt_passed"
  | "companion_grew"
  | "pinned_line"
  | "first_meeting";

export interface CompanionMemory {
  id: string;
  kind: MemoryKind;
  memoryType: MemoryType;
  title: string | null;
  videoId: string | null;
  transcriptLineId: string | null;
  timestampSeconds: number | null;
  lineTextJp: string | null;
  note: string | null;
  isAnchor: boolean;
  occurredAt: string;
}
