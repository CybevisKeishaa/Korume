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

export interface KanjiExample {
  lineId: string;
  videoId: string;
  lessonTitle: string;
  textJp: string;
  translation: string | null;
}

export interface KanjiLessonCount {
  videoId: string;
  title: string;
  count: number;
}

/** The previous and next literal of the context list the modal was opened from (`?from=`). */
export interface KanjiNeighbors {
  prev: string | null;
  next: string | null;
}

/** What the kanji inspect surfaces receive: the dictionary data, this learner's state, and the first lesson examples. */
export interface KanjiInspectPayload {
  data: KanjiData;
  learner: KanjiLearnerState;
  examples: KanjiExample[];
  lessons: KanjiLessonCount[];
  /** Null without a valid `from`, or when the kanji is not in that list. */
  neighbors: KanjiNeighbors | null;
}
