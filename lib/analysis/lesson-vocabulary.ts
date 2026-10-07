import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/data/videos";
import { getTranscript } from "@/lib/data/transcripts";
import { rateLimit } from "@/lib/rate-limit";
import { isLessonVocabularyEligible } from "./lexical-resolver";
import { readMastery } from "./learning-state";
import { staticAnalyses } from "./line-analysis";
import type { AnalysisToken, LessonVocabularyItem, LessonVocabularyPage } from "./types";

const VOCABULARY_LIMIT = { limit: 30, windowMs: 60_000 };
const EXAMPLE_LINES = 3;
export const VOCABULARY_PAGE_DEFAULT = 50;
export const VOCABULARY_PAGE_MAX = 100;

export type LessonVocabularyResult =
  | { kind: "unauthorized" }
  | { kind: "rate_limited"; retryAfter: number }
  | { kind: "not_found" }
  | { kind: "invalid_cursor" }
  | { kind: "ok"; page: LessonVocabularyPage };

type StaticItem = Omit<LessonVocabularyItem, "mastery">;

/**
 * Every list-eligible content word of the lesson (spec §1.6), aggregated by its resolved JMdict entry (spec §5.1): most
 * frequent first, then by ent_seq, so the order — and an offset cursor over it — is stable for a lesson.
 */
export function aggregateVocabulary(lines: { id: string; tokens: AnalysisToken[] }[]): StaticItem[] {
  const byEntry = new Map<number, StaticItem>();
  for (const line of lines) {
    for (const token of line.tokens) {
      if (!isLessonVocabularyEligible(token)) continue;
      const entry = token.entries[0];
      if (!entry) continue;
      const item = byEntry.get(entry.entSeq) ?? {
        entSeq: entry.entSeq, headword: entry.headword, reading: entry.reading, glossEn: entry.glossEn,
        occurrences: 0, jlpt: entry.jlpt, vocabId: token.vocabId, curatedVi: token.curatedVi, exampleLineIds: [], exampleSurface: token.surface,
      };
      item.occurrences += 1;
      // Spec P6/§1.7: a curated meaning and a mastery row belong to one reading; a later token read differently must not lend them.
      if (entry.reading === item.reading) {
        item.vocabId ??= token.vocabId;
        item.curatedVi ??= token.curatedVi;
      }
      if (item.exampleLineIds.length < EXAMPLE_LINES && !item.exampleLineIds.includes(line.id)) item.exampleLineIds.push(line.id);
      byEntry.set(entry.entSeq, item);
    }
  }
  return [...byEntry.values()].sort((a, b) => b.occurrences - a.occurrences || a.entSeq - b.entSeq);
}

/** GET /api/videos/[id]/vocabulary. The cursor is the offset of the next item, as a string. */
export async function getLessonVocabulary(videoId: string, query: { cursor?: string | null; limit?: number }): Promise<LessonVocabularyResult> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { kind: "unauthorized" };
  const limited = rateLimit(`analysis:vocabulary:${user.id}`, VOCABULARY_LIMIT);
  if (!limited.ok) return { kind: "rate_limited", retryAfter: limited.retryAfter };
  const offset = query.cursor ? Number(query.cursor) : 0;
  if (!Number.isSafeInteger(offset) || offset < 0) return { kind: "invalid_cursor" };
  const pageSize = Math.min(Math.max(query.limit ?? VOCABULARY_PAGE_DEFAULT, 1), VOCABULARY_PAGE_MAX);

  // Reads the lesson under RLS and pages every line (getTranscript uses fetchAllPages): no max_rows truncation.
  const transcript = await getTranscript(videoId);
  if (!transcript.ok) return transcript.status === 401 ? { kind: "unauthorized" } : { kind: "not_found" };
  const lines = (transcript.data?.lines ?? []).flatMap((line) => (line.text_jp ? [{ id: line.id, textJp: line.text_jp }] : []));
  const analyses = await staticAnalyses(supabase, lines, undefined, "lexical");
  const all = aggregateVocabulary(lines.flatMap((line) => {
    const analysis = analyses.get(line.id);
    return analysis ? [{ id: line.id, tokens: analysis.tokens }] : [];
  }));

  const slice = all.slice(offset, offset + pageSize);
  const mastery = await readMastery(supabase, user.id, slice.flatMap((item) => (item.vocabId ? [item.vocabId] : [])));
  return {
    kind: "ok",
    page: {
      items: slice.map((item) => ({ ...item, exampleLineIds: [...item.exampleLineIds], mastery: item.vocabId ? mastery[item.vocabId] ?? null : null })),
      nextCursor: offset + pageSize < all.length ? String(offset + pageSize) : null,
      total: all.length,
    },
  };
}
