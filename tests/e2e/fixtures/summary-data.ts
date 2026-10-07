import type { SupabaseClient } from "@supabase/supabase-js";
import type { AnalysisResponse, LineRef } from "@/lib/summary/analysis/view";
import { lineStart, lineText } from "./workspace-data";

export async function seedSummaryEvidence(
  admin: SupabaseClient,
  { userId, videoId, lineIds }: { userId: string; videoId: string; lineIds: string[] },
): Promise<{ cleanup(): Promise<void> }> {
  if (lineIds.length < 4) throw new Error("summary evidence needs four transcript lines");
  const sessions = await admin.from("shadowing_sessions").insert([
    { user_id: userId, video_id: videoId, transcript_line_id: lineIds[0], pronunciation_score: 52, pitch_score: 48 },
    { user_id: userId, video_id: videoId, transcript_line_id: lineIds[1], pronunciation_score: 88 },
  ]).select("id");
  if (sessions.error) throw sessions.error;
  const dictation = await admin.from("dictation_attempts").insert({
    user_id: userId, video_id: videoId, transcript_line_id: lineIds[2],
    user_input: "今日は3番目の文を読みます", accuracy_score: 70,
  }).select("id").single();
  if (dictation.error) throw dictation.error;
  const mark = await admin.from("sentence_marks").insert({ user_id: userId, transcript_line_id: lineIds[3], kind: "difficult" });
  if (mark.error) throw mark.error;
  return {
    async cleanup() {
      const results = await Promise.all([
        admin.from("shadowing_sessions").delete().in("id", sessions.data.map((row) => row.id)),
        admin.from("dictation_attempts").delete().eq("id", dictation.data.id),
        admin.from("sentence_marks").delete().eq("user_id", userId).eq("transcript_line_id", lineIds[3]).eq("kind", "difficult"),
      ]);
      for (const result of results) if (result.error) throw result.error;
    },
  };
}

export function analysisFixture(lineIds: string[]): AnalysisResponse {
  if (lineIds.length < 4) throw new Error("analysis fixture needs four transcript lines");
  const source = (index: number): LineRef => ({
    lineId: lineIds[index]!, textJp: lineText(index), startTime: lineStart(index), endTime: lineStart(index) + 2.5,
  });
  return {
    status: "ready",
    data: {
      overview: "Everyday reading practice.",
      words: [
        { entSeq: 1, surface: "今日", written: "今日", reading: "きょう", meaning: "today", meaningLocale: "en", meaningSource: "jmdict", posKey: "noun", jlpt: "N5", common: true, whyItMatters: "Useful every day.", usageNote: "Use it to refer to today.", source: source(0) },
        { entSeq: 2, surface: "文", written: "文", reading: "ぶん", meaning: "sentence", meaningLocale: "en", meaningSource: "jmdict", posKey: "noun", jlpt: "N4", common: true, whyItMatters: "Names a written sentence.", usageNote: "Often used in study.", source: source(1) },
      ],
      expressions: [{ expression: "今日は", commonness: "very_common", meaningUse: "As for today", nuance: "Introduces today's topic.", source: source(2) }],
      grammar: [{ grammarId: "fixture-grammar", title: "〜ます", jlpt: "N5", meaningShort: "Polite present", explanation: "A polite verb ending.", tryIt: "文を読みます。", span: "読みます", source: source(3) }],
      culture: [],
    },
  };
}
