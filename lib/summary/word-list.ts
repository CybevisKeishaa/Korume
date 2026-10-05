import type { LessonVocabularyItem } from "@/lib/analysis/types";
import type { WordView } from "./analysis/view";
import { normalizeRef } from "./refs";

/** Owner 2026-10-05: the list view of "Words worth remembering" shows the AI's picks and then "a fair share" of the
 *  lesson's own words, most frequent first, never all of them; 8 per page. */
export const WORD_LIST_MAX = 24;
export const WORD_LIST_PAGE_SIZE = 8;
/** One request covers the cap even when every AI pick is also near the top of the lesson list. */
export const LESSON_WORDS_FETCH = 30;

export interface WordRow {
  key: string;
  written: string;
  reading: string;
  meaning: string;
  /** The line a save attaches to, and the word saved. */
  lineId: string;
  targetWord: string;
}

export function wordRows(aiWords: WordView[], lessonWords: LessonVocabularyItem[] | null, max = WORD_LIST_MAX): WordRow[] {
  const rows: WordRow[] = aiWords.map((word) => ({
    key: `ai-${word.entSeq}-${word.source.lineId}`,
    written: word.written,
    reading: word.reading,
    meaning: word.meaning,
    lineId: word.source.lineId,
    targetWord: word.surface,
  }));
  const picked = new Set(aiWords.map((word) => word.entSeq));
  // A save is identified by line + normalized word (SaveToggle), so two rows with one identity would be one card.
  const saveIdentity = (row: WordRow) => `${row.lineId}|${normalizeRef(row.targetWord)}`;
  const seen = new Set(rows.map(saveIdentity));
  for (const item of lessonWords ?? []) {
    const lineId = item.exampleLineIds[0];
    if (picked.has(item.entSeq) || !lineId) continue;
    // Saved as the form in that line, not the headword: review cards highlight the target inside the sentence.
    const row = { key: `lesson-${item.entSeq}`, written: item.headword, reading: item.reading, meaning: item.glossEn, lineId, targetWord: item.exampleSurface };
    if (seen.has(saveIdentity(row))) continue;
    seen.add(saveIdentity(row));
    rows.push(row);
  }
  return rows.slice(0, max);
}

export function pageOf<T>(items: T[], requested: number): { items: T[]; page: number; pageCount: number } {
  const pageCount = Math.max(1, Math.ceil(items.length / WORD_LIST_PAGE_SIZE));
  const page = Math.min(Math.max(requested, 0), pageCount - 1);
  return { items: items.slice(page * WORD_LIST_PAGE_SIZE, (page + 1) * WORD_LIST_PAGE_SIZE), page, pageCount };
}
