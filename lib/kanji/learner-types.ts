import type { KanjiData } from "@/lib/dictionary/types";

export interface KanjiProgress {
  stage: number;
  reviews: number;
  lapses: number;
  nextReviewAt: string | null;
}

export interface KanjiLearnerState {
  favorite: boolean;
  progress: KanjiProgress | null;
}

export interface KanjiFavorite {
  literal: string;
  hanViet: string[];
}

/** What the kanji inspect surfaces receive: the dictionary data plus this learner's state (Tasks 5-6 add fields). */
export interface KanjiInspectPayload {
  data: KanjiData;
  learner: KanjiLearnerState;
}
