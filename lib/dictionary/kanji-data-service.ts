import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/data/videos";
import { rateLimit } from "@/lib/rate-limit";
import { parseKanjiLiteral } from "@/lib/dictionary/literal";
import { getActiveSnapshotId, getDictionaryAttribution } from "@/lib/dictionary/snapshot";
import { getKanjiLearnerState, listKanjiFavorites } from "@/lib/data/kanji-learner";
import { getKanjiExamples, getKanjiLessons } from "@/lib/data/kanji-lessons";
import { getKanjiList } from "@/lib/data/content";
import { parseKanjiContext } from "@/lib/kanji/context";
import { compositionElements } from "@/lib/kanji/composition";
import type { KanjiInspectPayload, KanjiNeighbors } from "@/lib/kanji/learner-types";
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
      .select("literal, on_readings, kun_readings, meanings_en, stroke_count, grade, freq, vi_readings, tc_lines, jlpt_old")
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

  const components = (strokes.data as { components: KanjiComponentNode } | null)?.components ?? EMPTY_COMPONENTS;
  const elements = compositionElements(components);
  const componentGlosses: KanjiData["componentGlosses"] = {};
  if (elements.length > 0) {
    const { data: glossRows, error } = await supabase
      .from("dict_kanji")
      .select("literal, vi_readings, meanings_en")
      .eq("snapshot_id", snapshotId)
      .in("literal", elements);
    if (error) throw error;
    for (const gloss of (glossRows ?? []) as { literal: string; vi_readings: string[]; meanings_en: string[] }[]) {
      componentGlosses[gloss.literal] = { hanViet: gloss.vi_readings, meaningEn: gloss.meanings_en[0] ?? null };
    }
  }

  const row = kanji.data as {
    literal: string;
    on_readings: string[];
    kun_readings: string[];
    meanings_en: string[];
    stroke_count: number;
    grade: number | null;
    freq: number | null;
    vi_readings: string[];
    tc_lines: string[];
    jlpt_old: number | null;
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
    hanViet: row.vi_readings,
    tcLines: row.tc_lines,
    oldJlpt: row.jlpt_old,
    strokePaths: stroke?.paths ?? [],
    components,
    componentGlosses,
    commonWords,
    curatedKanjiId: curatedRow?.id ?? null,
    attribution: await getDictionaryAttribution(snapshotId),
  };
}

export type KanjiLookupResult =
  | { ok: true; data: KanjiInspectPayload }
  | { ok: false; status: 400 | 401 | 404 }
  | { ok: false; status: 429; retryAfter: number };

const LOOKUP_LIMIT = { limit: 60, windowMs: 60_000 };

/** `GET /api/dictionary/kanji/[literal]` for a signed-in learner (QuickInspect). */
export async function getKanjiForLearner(rawLiteral: string, from: string | null = null): Promise<KanjiLookupResult> {
  const user = await requireUser(createClient());
  if (!user) return { ok: false, status: 401 };
  const literal = parseKanjiLiteral(rawLiteral);
  if (!literal) return { ok: false, status: 400 };
  const limited = rateLimit(`dictionary-kanji:${user.id}`, LOOKUP_LIMIT);
  if (!limited.ok) return { ok: false, status: 429, retryAfter: limited.retryAfter };
  const payload = await getKanjiInspectPayload(literal, { from });
  return payload ? { ok: true, data: payload } : { ok: false, status: 404 };
}

/** ‹ › for the modal: the literal's neighbors in the `from` list (level order = `/kanji`'s, favorites newest first). */
async function getKanjiNeighbors(literal: string, from: string | null): Promise<KanjiNeighbors | null> {
  const context = parseKanjiContext(from);
  if (!context) return null;
  const list =
    context.kind === "level"
      ? (await getKanjiList(context.level)).map((item) => item.character)
      : (await listKanjiFavorites()).map((item) => item.literal);
  const index = list.indexOf(literal);
  return index < 0 ? null : { prev: list[index - 1] ?? null, next: list[index + 1] ?? null };
}

function lessonIndexFailed(error: unknown): [] {
  // eslint-disable-next-line no-console -- server-side diagnostics never reach the client.
  console.error("[kanji-inspect] lesson index failed:", error);
  return [];
}

/** The dictionary data for one kanji plus this learner's favorite and review state (null for an unknown kanji). */
export async function getKanjiInspectPayload(
  literal: string,
  opts: { from?: string | null } = {},
): Promise<KanjiInspectPayload | null> {
  const [data, learner, examples, lessons, neighbors] = await Promise.all([
    getKanjiData(literal),
    getKanjiLearnerState(literal),
    // The lesson index is a garnish: when it fails, its blocks hide and the kanji still opens.
    getKanjiExamples(literal, 0).catch(lessonIndexFailed),
    getKanjiLessons(literal).catch(lessonIndexFailed),
    getKanjiNeighbors(literal, opts.from ?? null),
  ]);
  return data ? { data, learner, examples, lessons, neighbors } : null;
}
