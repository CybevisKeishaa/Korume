import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { KanjiExample, KanjiLessonCount } from "@/lib/kanji/learner-types";

const PAGE = 3;
const TOP_LESSONS = 4;

/** One page (3) of transcript lines containing the kanji, from the lessons the caller may open. */
export async function getKanjiExamples(literal: string, offset: number): Promise<KanjiExample[]> {
  const { data, error } = await createClient().rpc("kanji_lesson_lines", { p_literal: literal, p_limit: PAGE, p_offset: offset });
  if (error) throw error;
  return ((data ?? []) as { line_id: string; video_id: string; lesson_title: string; text_jp: string; translation: string | null }[]).map((row) => ({
    lineId: row.line_id,
    videoId: row.video_id,
    lessonTitle: row.lesson_title,
    textJp: row.text_jp,
    translation: row.translation,
  }));
}

/** The 4 lessons that use the kanji most. */
export async function getKanjiLessons(literal: string): Promise<KanjiLessonCount[]> {
  const { data, error } = await createClient().rpc("kanji_lesson_counts", { p_literal: literal, p_limit: TOP_LESSONS });
  if (error) throw error;
  return ((data ?? []) as { video_id: string; lesson_title: string; occurrences: number }[]).map((row) => ({
    videoId: row.video_id,
    title: row.lesson_title,
    count: row.occurrences,
  }));
}
