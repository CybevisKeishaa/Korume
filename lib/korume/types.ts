import type { Utf16Span } from "@/lib/analysis/types";
import type { AnswerV1 } from "./answer";

export interface KorumeAnchorInput { videoId: string; lineId: string; span: Utf16Span | null }
export interface KorumeAnchorView {
  videoId: string; videoTitle: string; lineId: string; lineText: string;
  translation: string | null; startTime: number; span: Utf16Span | null;
}
export interface KorumeThreadView {
  id: string; title: string | null; anchor: KorumeAnchorView | null;
  originRoute: string | null; updatedAt: string;
}
export type GroundedEntityKind = "vocabulary" | "grammar" | "particle";
export interface GroundedEntity {
  id: string;
  label: string; reading?: string; kind: GroundedEntityKind;
  jlpt?: "N5" | "N4" | "N3" | "N2" | "N1"; gloss?: string;
  seenCount?: number; seenCapped?: boolean;
  lessonLink?: { videoId: string; lineId?: string };
}
export interface KorumeMessageView {
  id: string; turnId: string; role: "user" | "assistant"; text: string;
  answer: AnswerV1 | null;
  grounding: GroundedEntity[] | null;
  createdAt: string;
}
export interface PendingTurn { turnId: string; status: "running" | "retryable" }
export interface KorumeThreadDetail { thread: KorumeThreadView; messages: KorumeMessageView[]; pendingTurns: PendingTurn[] }
