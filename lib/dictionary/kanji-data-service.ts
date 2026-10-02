import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/data/videos";
import { rateLimit } from "@/lib/rate-limit";
import { parseKanjiLiteral } from "@/lib/dictionary/literal";
import { getActiveSnapshotId, getDictionaryAttribution } from "@/lib/dictionary/snapshot";
import type { KanjiCommonWord, KanjiComponentNode, KanjiData } from "@/lib/dictionary/types";

const EMPTY_COMPONENTS: KanjiComponentNode = { element: null, position: null, children: [] };

interface EntryRow {
  ent_seq: number;
  kanji_forms: string[];
  kana_forms: string[];
  senses: { gloss?: string[] }[];
}

function commonWord(literal: string, entry: EntryRow): KanjiCommonWord {
  return {
    entSeq: entry.ent_seq,
    headword: entry.kanji_forms.find((form) => form.includes(literal)) ?? entry.kanji_forms[0] ?? entry.kana_forms[0] ?? "",
    reading: entry.kana_forms[0] ?? "",
    glossEn: (entry.senses[0]?.gloss ?? []).slice(0, 3).join("; "),
  };
}

/**
 * Everything the app knows about one kanji, from the active dictionary snapshot plus the hand-written
 * `kanji` table's Vietnamese meaning and mnemonic (spec §5.2). Shared by KanjiQuickInspect and
 * `/kanji/[literal]`, so the later full Kanji-inspect port reuses it.
 */
export async function getKanjiData(literal: string, opts: { commonWords?: number } = {}): Promise<KanjiData | null> {
  const snapshotId = await getActiveSnapshotId();
  if (!snapshotId) return null;
  const supabase = createClient();
  const wordLimit = opts.commonWords ?? 5;

  const [kanji, strokes, words, curated] = await Promise.all([
    supabase
      .from("dict_kanji")
      .select("literal, on_readings, kun_readings, meanings_en, stroke_count, grade, freq")
      .eq("snapshot_id", snapshotId)
      .eq("literal", literal)
      .maybeSingle(),
    supabase
      .from("dict_kanji_strokes")
      .select("paths, components")
      .eq("snapshot_id", snapshotId)
      .eq("literal", literal)
      .maybeSingle(),
    supabase
      .from("dict_kanji_words")
      .select("ent_seq, rank")
      .eq("snapshot_id", snapshotId)
      .eq("literal", literal)
      .order("rank", { ascending: true })
      .limit(wordLimit),
    supabase.from("kanji").select("id, meaning_vi, mnemonic_text, jlpt_level").eq("character", literal).maybeSingle(),
  ]);
  for (const result of [kanji, strokes, words, curated]) if (result.error) throw result.error;
  if (!kanji.data) return null;

  const ranked = ((words.data ?? []) as { ent_seq: number; rank: number }[]).map((row) => row.ent_seq);
  let commonWords: KanjiCommonWord[] = [];
  if (ranked.length > 0) {
    const { data: entries, error } = await supabase
      .from("dict_entries")
      .select("ent_seq, kanji_forms, kana_forms, senses")
      .eq("snapshot_id", snapshotId)
      .in("ent_seq", ranked);
    if (error) throw error;
    const bySeq = new Map(((entries ?? []) as EntryRow[]).map((entry) => [entry.ent_seq, entry]));
    commonWords = ranked.flatMap((seq) => {
      const entry = bySeq.get(seq);
      return entry ? [commonWord(literal, entry)] : [];
    });
  }

  const row = kanji.data as {
    literal: string;
    on_readings: string[];
    kun_readings: string[];
    meanings_en: string[];
    stroke_count: number;
    grade: number | null;
    freq: number | null;
  };
  const stroke = strokes.data as { paths: string[]; components: KanjiComponentNode } | null;
  const curatedRow = curated.data as { id: string; meaning_vi: string | null; mnemonic_text: string | null; jlpt_level: string | null } | null;

  return {
    literal: row.literal,
    onReadings: row.on_readings,
    kunReadings: row.kun_readings,
    meaningsEn: row.meanings_en,
    meaningVi: curatedRow?.meaning_vi ?? null,
    mnemonic: curatedRow?.mnemonic_text ?? null,
    strokeCount: row.stroke_count,
    grade: row.grade,
    frequency: row.freq,
    jlpt: curatedRow?.jlpt_level ?? null,
    strokePaths: stroke?.paths ?? [],
    components: stroke?.components ?? EMPTY_COMPONENTS,
    commonWords,
    curatedKanjiId: curatedRow?.id ?? null,
    attribution: await getDictionaryAttribution(snapshotId),
  };
}

export type KanjiLookupResult =
  | { ok: true; data: KanjiData }
  | { ok: false; status: 400 | 401 | 404 }
  | { ok: false; status: 429; retryAfter: number };

const LOOKUP_LIMIT = { limit: 60, windowMs: 60_000 };

/** `GET /api/dictionary/kanji/[literal]` for a signed-in learner (QuickInspect). */
export async function getKanjiForLearner(rawLiteral: string): Promise<KanjiLookupResult> {
  const user = await requireUser(createClient());
  if (!user) return { ok: false, status: 401 };
  const literal = parseKanjiLiteral(rawLiteral);
  if (!literal) return { ok: false, status: 400 };
  const limited = rateLimit(`dictionary-kanji:${user.id}`, LOOKUP_LIMIT);
  if (!limited.ok) return { ok: false, status: 429, retryAfter: limited.retryAfter };
  const data = await getKanjiData(literal);
  return data ? { ok: true, data } : { ok: false, status: 404 };
}
