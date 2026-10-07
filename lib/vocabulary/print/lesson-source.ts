import "server-only";
import { aggregateVocabulary } from "@/lib/analysis/lesson-vocabulary";
import { meaningFor } from "@/lib/analysis/meaning";
import type { StaticLineAnalysis } from "@/lib/analysis/types";
import { getTranslations } from "@/lib/i18n/server";
import type { KnowledgeLocale } from "@/lib/knowledge/types";
import { analysisStatusForReflection } from "@/lib/summary/analysis/service";
import { loadLessonSummary, type SummaryAuth } from "@/lib/summary/load-snapshot";
import { normalizeRef } from "@/lib/summary/refs";
import type { SavedCard, SummaryLine } from "@/lib/summary/snapshot";
import { LESSON_WORDS_FETCH, wordRows } from "@/lib/summary/word-list";
import type { PrintSource, PrintSourceResult, VocabularyPrintItem } from "./source";

interface Args { source: PrintSource; locale: KnowledgeLocale; userId: string; db: SummaryAuth["supabase"] }

/** Spec §2: a lesson as printable vocabulary. Reads only; never generates an analysis (P8) nor reads an AI gloss (P6). */
export async function resolveLessonSource({ source, locale, userId, db }: Args): Promise<PrintSourceResult> {
  const loaded = await loadLessonSummary(source.lessonId, { supabase: db, userId });
  if (!loaded.ok) return loaded.status === 401 ? { kind: "unauthorized" } : { kind: "not_found" };
  const { video, lines, analyses, saved } = loaded.data;
  const t = await getTranslations({ locale, namespace: "vocab.print" });
  const items = source.set === "all"
    ? await allItems(source.lessonId, locale, db, lines, analyses)
    : savedItems(saved, lines, analyses, locale);
  return { kind: "ok", doc: { title: video.title, backHref: `/shadowing/${video.id}/summary`, backLabel: t("backToSummary"), items } };
}

function example(line: { textJp: string } | undefined, analysis: StaticLineAnalysis | undefined): Pick<VocabularyPrintItem, "example"> {
  if (!line?.textJp) return {};
  const spans = (analysis?.tokens ?? []).flatMap((token) => {
    const entry = token.entries[0];
    return entry ? [{ surface: token.surface, entSeq: entry.entSeq }] : [];
  });
  return { example: { text: line.textJp, spans } };
}

/** Spec §2.3: exactly Summary's Words list — the same `wordRows`, cap and order. */
async function allItems(
  lessonId: string, locale: KnowledgeLocale, db: SummaryAuth["supabase"], lines: SummaryLine[], analyses: Map<string, StaticLineAnalysis>,
): Promise<VocabularyPrintItem[]> {
  const status = await analysisStatusForReflection(lessonId, locale, { supabase: db, lines, analyses });
  const aiWords = status.kind === "ready" ? status.view.words : [];
  const lessonWords = aggregateVocabulary(lines.flatMap((line) => {
    const analysis = analyses.get(line.id);
    return analysis ? [{ id: line.id, tokens: analysis.tokens }] : [];
  })).slice(0, LESSON_WORDS_FETCH);
  const lineOf = new Map(lines.map((line) => [line.id, line]));
  return wordRows(aiWords, lessonWords, locale).map((row) => ({
    id: row.key, surface: row.written, entSeq: row.entSeq, ...(row.reading ? { reading: row.reading } : {}),
    meaning: row.meaning, meaningLocale: row.meaningLocale, meaningSource: row.meaningSource,
    resolution: "resolved", ...example(lineOf.get(row.lineId), analyses.get(row.lineId)),
  }));
}

/** Spec §2.4: vocabulary cards only, one item per lexeme, the earliest line as its example, in transcript order. */
function savedItems(saved: SavedCard[], lines: SummaryLine[], analyses: Map<string, StaticLineAnalysis>, locale: KnowledgeLocale): VocabularyPrintItem[] {
  const lineOf = new Map(lines.map((line) => [line.id, line]));
  const kept = new Map<string, { order: number; item: VocabularyPrintItem }>();
  for (const card of saved) {
    if (card.kind !== "vocabulary") continue;
    const line = lineOf.get(card.lineId);
    const order = line?.index ?? Number.MAX_SAFE_INTEGER;
    const token = analyses.get(card.lineId)?.tokens
      .find((candidate) => normalizeRef(candidate.surface) === normalizeRef(card.ref) && candidate.entries.length > 0);
    const lexeme = token?.entries[0];
    const [key, item]: [string, VocabularyPrintItem] = token && lexeme
      ? [`lex-${lexeme.entSeq}:${lexeme.reading}`, {
        id: `lex-${lexeme.entSeq}:${lexeme.reading}`, surface: lexeme.headword, entSeq: lexeme.entSeq, reading: lexeme.reading,
        ...meaningFor({ glossEn: lexeme.glossEn, curatedVi: token.curatedVi }, locale), resolution: "resolved", ...example(line, analyses.get(card.lineId)),
      }]
      // Never a first-JMdict-entry guess: the learner saved it, so it prints as saved.
      : [`raw-${normalizeRef(card.ref)}`, { id: `raw-${normalizeRef(card.ref)}`, surface: card.ref, resolution: "saved_raw", ...example(line, analyses.get(card.lineId)) }];
    const previous = kept.get(key);
    if (!previous || order < previous.order) kept.set(key, { order, item });
  }
  return [...kept.values()].sort((a, b) => a.order - b.order).map(({ item }) => item);
}
