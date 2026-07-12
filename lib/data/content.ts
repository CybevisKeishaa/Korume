import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { JlptLevel } from "@/lib/validation/content";

export interface KanjiListItem {
  id: string;
  character: string;
  jlpt_level: JlptLevel | null;
  stroke_count: number | null;
  meaning_en: string | null;
  meaning_vi: string | null;
}

export interface KanjiReading {
  reading: string;
  reading_type: "on" | "kun";
}

export interface KanjiDetail extends KanjiListItem {
  stroke_order_svg: string | null;
  mnemonic_text: string | null;
  kanji_readings: KanjiReading[];
}

export interface VocabItem {
  id: string;
  word: string;
  reading: string | null;
  meaning_en: string | null;
  meaning_vi: string | null;
  jlpt_level: JlptLevel | null;
  part_of_speech: string | null;
}

export interface GrammarItem {
  id: string;
  title: string;
  jlpt_level: JlptLevel | null;
  structure_pattern: string | null;
  explanation: string | null;
  example_sentences: { jp: string; en: string }[];
}

export async function getKanjiList(level?: JlptLevel): Promise<KanjiListItem[]> {
  const supabase = createClient();
  let query = supabase
    .from("kanji")
    .select("id, character, jlpt_level, stroke_count, meaning_en, meaning_vi")
    .order("stroke_count", { ascending: true });
  if (level) query = query.eq("jlpt_level", level);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getKanjiById(id: string): Promise<KanjiDetail | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("kanji")
    .select(
      "id, character, jlpt_level, stroke_count, meaning_en, meaning_vi, stroke_order_svg, mnemonic_text, kanji_readings(reading, reading_type)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as KanjiDetail | null) ?? null;
}

export async function getVocabList(level?: JlptLevel): Promise<VocabItem[]> {
  const supabase = createClient();
  let query = supabase
    .from("vocab")
    .select(
      "id, word, reading, meaning_en, meaning_vi, jlpt_level, part_of_speech",
    )
    .order("word", { ascending: true });
  if (level) query = query.eq("jlpt_level", level);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getGrammarList(level?: JlptLevel): Promise<GrammarItem[]> {
  const supabase = createClient();
  let query = supabase
    .from("grammar_points")
    .select("id, title, jlpt_level, structure_pattern, explanation, example_sentences")
    .order("title", { ascending: true });
  if (level) query = query.eq("jlpt_level", level);

  const { data, error } = await query;
  if (error) throw error;
  return (data as GrammarItem[]) ?? [];
}
