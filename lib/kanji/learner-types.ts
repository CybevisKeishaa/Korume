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

/** What the kanji inspect surfaces receive: the dictionary data, this learner's state, and the first lesson examples. */
export interface KanjiInspectPayload {
  data: KanjiData;
  learner: KanjiLearnerState;
  examples: KanjiExample[];
  lessons: KanjiLessonCount[];
}
