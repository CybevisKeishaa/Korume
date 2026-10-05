import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { meaningFor } from "@/lib/analysis/meaning";
import type { AnalysisToken } from "@/lib/analysis/types";
import type { KnowledgeLocale } from "@/lib/knowledge/types";
import { getActiveSnapshotId } from "@/lib/dictionary/snapshot";
import type { SummaryLine } from "../snapshot";
import type { StoredAnalysis } from "./schema";
import { posKey, type LessonAnalysisView, type LineRef } from "./view";

interface EntryRow { ent_seq: number; kanji_forms: string[]; kana_forms: string[]; senses: { pos?: string[]; gloss?: string[] }[]; common: boolean; jlpt: number | null }

export async function hydrateAnalysis(
  supabase: ReturnType<typeof createClient>,
  stored: StoredAnalysis,
  lines: SummaryLine[],
  analyses: Map<string, { tokens: AnalysisToken[] }>,
  locale: KnowledgeLocale,
): Promise<LessonAnalysisView> {
  const lineOf = new Map(lines.map((line) => [line.id, line]));
  const ref = (lineId: string): LineRef | null => {
    const line = lineOf.get(lineId);
    return line ? { lineId: line.id, textJp: line.textJp, startTime: line.startTime, endTime: line.endTime } : null;
  };
  const snapshotId = stored.words.length > 0 ? await getActiveSnapshotId() : null;
  const entries = new Map<number, EntryRow>();
  if (snapshotId) {
    const { data, error } = await supabase.from("dict_entries").select("ent_seq, kanji_forms, kana_forms, senses, common, jlpt")
      .eq("snapshot_id", snapshotId).in("ent_seq", stored.words.map((word) => word.entSeq));
    if (error) throw error;
    for (const row of (data ?? []) as EntryRow[]) entries.set(row.ent_seq, row);
  }
  const grammarIds = stored.grammar.map((item) => item.grammarId);
  const points = new Map<string, { title: string; jlpt_level: string | null }>();
  if (grammarIds.length > 0) {
    const { data, error } = await supabase.from("grammar_points").select("id, title, jlpt_level").in("id", grammarIds);
    if (error) throw error;
    for (const row of (data ?? []) as { id: string; title: string; jlpt_level: string | null }[]) points.set(row.id, row);
  }
  return {
    overview: stored.overview,
    words: stored.words.flatMap((word) => {
      const entry = entries.get(word.entSeq);
      const source = ref(word.sourceLineId);
      // Spec §1.9: the resolved token on the source line, never kanji_forms[0] / kana_forms[0].
      const token = analyses.get(word.sourceLineId)?.tokens
        .find((candidate) => candidate.surface === word.surface && candidate.entries[0]?.entSeq === word.entSeq);
      const lexeme = token?.entries[0];
      if (!entry || !source || !token || !lexeme) return [];
      const sense = entry.senses[0];
      return [{
        entSeq: word.entSeq, surface: word.surface, written: lexeme.headword, reading: lexeme.reading,
        ...meaningFor({ glossEn: lexeme.glossEn, curatedVi: token.curatedVi }, locale),
        posKey: posKey(sense?.pos?.[0]),
        jlpt: entry.jlpt === null ? null : `N${entry.jlpt}`, common: entry.common,
        whyItMatters: word.whyItMatters, usageNote: word.usageNote, source,
      }];
    }),
    expressions: stored.expressions.flatMap((item) => {
      const source = ref(item.sourceLineId);
      return source ? [{ expression: item.span, commonness: item.commonness, meaningUse: item.meaningUse, nuance: item.nuance, source }] : [];
    }),
    grammar: stored.grammar.flatMap((item) => {
      const point = points.get(item.grammarId);
      const source = ref(item.sourceLineId);
      return point && source ? [{ grammarId: item.grammarId, title: point.title, jlpt: point.jlpt_level, meaningShort: item.meaningShort, explanation: item.explanation, tryIt: item.tryIt, span: item.span, source }] : [];
    }),
    culture: stored.culture.flatMap((item) => {
      const source = ref(item.sourceLineId);
      return source ? [{ title: item.title, body: item.body, source }] : [];
    }),
  };
}
