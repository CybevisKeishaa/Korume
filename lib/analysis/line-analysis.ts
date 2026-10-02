import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/data/videos";
import { fetchAllPages, fetchByIdChunks } from "@/lib/data/query-pagination";
import { rateLimit } from "@/lib/rate-limit";
import { getActiveSnapshotId } from "@/lib/dictionary/snapshot";
import { tokenize } from "@/lib/japanese/tokenizer";
import { matchGrammar, type GrammarPattern } from "./grammar-matcher";
import { readMastery } from "./learning-state";
import { tokenSpans } from "./spans";
import type { AnalysisToken, DictionaryMatch, LineAnalysisDto, StaticLineAnalysis } from "./types";

type Supabase = ReturnType<typeof createClient>;

const ANALYSIS_LIMIT = { limit: 120, windowMs: 60_000 };
/** Words worth a dictionary card. Particles, auxiliaries, symbols, fillers and prefixes are not looked up. */
const CONTENT_POS = new Set(["名詞", "動詞", "形容詞", "副詞", "連体詞", "感動詞", "接続詞"]);
const ENTRIES_PER_TOKEN = 3;
const GRAMMAR_TTL_MS = 60_000;
// ponytail: an in-process memo bounded by insertion order; a shared cache when the app runs on many instances.
const MEMO_LIMIT = 5_000;

interface EntryRow {
  ent_seq: number;
  kanji_forms: string[];
  kana_forms: string[];
  senses: { gloss?: string[] }[];
  common: boolean;
  jlpt: number | null;
}

export interface LineText {
  id: string;
  textJp: string;
}

const memo = new Map<string, StaticLineAnalysis>();
let grammarCache: { at: number; revision: string; patterns: GrammarPattern[] } | null = null;

/** Test seam: forget every memoised analysis and the grammar pattern cache. */
export function resetLineAnalysisCache(): void {
  memo.clear();
  grammarCache = null;
}

/**
 * `grammar_points` has no revision column, so its revision is the newest `created_at`, re-read at most once
 * a minute (spec §5.1). An edited pattern shows up when the cached analysis key changes or the process restarts.
 */
async function grammarPatterns(supabase: Supabase, now: number): Promise<{ revision: string; patterns: GrammarPattern[] }> {
  if (grammarCache && now - grammarCache.at < GRAMMAR_TTL_MS) return grammarCache;
  const rows = await fetchAllPages<{ id: string; title: string; structure_pattern: string | null; created_at: string }>((from, to) => supabase
    .from("grammar_points")
    .select("id, title, structure_pattern, created_at")
    .order("id", { ascending: true })
    .range(from, to));
  const revision = `${rows.length}:${rows.reduce((max, row) => (row.created_at > max ? row.created_at : max), "")}`;
  grammarCache = { at: now, revision, patterns: rows.map((row) => ({ id: row.id, title: row.title, structurePattern: row.structure_pattern })) };
  return grammarCache;
}

/** Every entry of the snapshot whose kanji or kana forms include one of `forms`, in batched, paged queries. */
async function lookupForms(supabase: Supabase, snapshotId: string, forms: string[]): Promise<EntryRow[]> {
  const byEntSeq = new Map<number, EntryRow>();
  await fetchByIdChunks(forms, async (chunk) => {
    for (const column of ["kanji_forms", "kana_forms"]) {
      const rows = await fetchAllPages<EntryRow>((from, to) => supabase
        .from("dict_entries")
        .select("ent_seq, kanji_forms, kana_forms, senses, common, jlpt")
        .eq("snapshot_id", snapshotId)
        .overlaps(column, chunk)
        .order("ent_seq", { ascending: true })
        .range(from, to));
      for (const row of rows) byEntSeq.set(row.ent_seq, row);
    }
    return [];
  });
  return [...byEntSeq.values()];
}

function toMatch(entry: EntryRow, form: string): DictionaryMatch {
  return {
    entSeq: entry.ent_seq,
    headword: entry.kanji_forms.includes(form) ? form : entry.kanji_forms[0] ?? entry.kana_forms[0] ?? form,
    reading: entry.kana_forms[0] ?? "",
    glossEn: (entry.senses[0]?.gloss ?? []).slice(0, 3).join("; "),
    jlpt: entry.jlpt,
  };
}

/** Base form first, then surface; a written (kanji) match beats a kana one, then common words, then ent_seq. */
function entriesFor(base: string, surface: string, entries: EntryRow[]): DictionaryMatch[] {
  for (const form of [base, surface]) {
    const hits = entries
      .filter((entry) => entry.kanji_forms.includes(form) || entry.kana_forms.includes(form))
      .sort((a, b) =>
        Number(b.kanji_forms.includes(form)) - Number(a.kanji_forms.includes(form)) ||
        Number(b.common) - Number(a.common) ||
        a.ent_seq - b.ent_seq);
    if (hits.length > 0) return hits.slice(0, ENTRIES_PER_TOKEN).map((entry) => toMatch(entry, form));
  }
  return [];
}

/**
 * Shared, learner-free analyses for many lines at once: memo hits are returned as they are, and every miss is
 * tokenized and looked up in ONE batched dictionary pass. Never holds mastery or any learner state.
 */
export async function staticAnalyses(supabase: Supabase, lines: LineText[], now = Date.now()): Promise<Map<string, StaticLineAnalysis>> {
  const [snapshotId, grammar] = await Promise.all([getActiveSnapshotId(), grammarPatterns(supabase, now)]);
  const keyOf = (lineId: string) => `${lineId}|${snapshotId ?? "none"}|${grammar.revision}`;
  const result = new Map<string, StaticLineAnalysis>();
  const misses: LineText[] = [];
  for (const line of lines) {
    const hit = memo.get(keyOf(line.id));
    if (hit) result.set(line.id, hit);
    else misses.push(line);
  }
  if (misses.length === 0) return result;

  const tokenized = await Promise.all(misses.map(async (line) => {
    const tokens = await tokenize(line.textJp);
    const spans = tokenSpans(line.textJp, tokens.map((token) => token.surface));
    return { line, tokens: tokens.map((token, index) => ({ ...token, span: spans[index] ?? { start: 0, end: 0 } })) };
  }));
  const content = tokenized.flatMap(({ tokens }) => tokens).filter((token) => CONTENT_POS.has(token.pos));
  const forms = [...new Set(content.flatMap((token) => [token.base, token.surface]))];
  const entries = snapshotId && forms.length > 0 ? await lookupForms(supabase, snapshotId, forms) : [];
  const vocab = await fetchByIdChunks(forms, async (chunk) => {
    const { data, error } = await supabase.from("vocab").select("id, word").in("word", chunk);
    if (error) throw error;
    return (data ?? []) as { id: string; word: string }[];
  });
  const vocabByWord = new Map(vocab.map((row) => [row.word, row.id]));

  for (const { line, tokens } of tokenized) {
    const analysisTokens: AnalysisToken[] = tokens.map((token, index) => {
      const lookedUp = CONTENT_POS.has(token.pos);
      const matches = lookedUp ? entriesFor(token.base, token.surface, entries) : [];
      return {
        index,
        surface: token.surface,
        base: token.base,
        reading: token.reading,
        pos: token.pos,
        span: token.span,
        entries: matches,
        vocabId: lookedUp ? vocabByWord.get(token.base) ?? vocabByWord.get(matches[0]?.headword ?? "") ?? null : null,
      };
    });
    const analysis: StaticLineAnalysis = {
      lineId: line.id,
      snapshotId,
      tokens: analysisTokens,
      grammar: matchGrammar(analysisTokens, grammar.patterns),
    };
    if (memo.size >= MEMO_LIMIT) memo.delete(memo.keys().next().value ?? "");
    memo.set(keyOf(line.id), analysis);
    result.set(line.id, analysis);
  }
  return result;
}

export type LineAnalysisResult =
  | { kind: "unauthorized" }
  | { kind: "rate_limited"; retryAfter: number }
  | { kind: "not_found" }
  | { kind: "ok"; analysis: LineAnalysisDto };

/** GET /api/lines/[lineId]/analysis: the line under the learner's RLS, its shared analysis, their mastery. */
export async function getLineAnalysisForLearner(lineId: string): Promise<LineAnalysisResult> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { kind: "unauthorized" };
  const limit = rateLimit(`analysis:line:${user.id}`, ANALYSIS_LIMIT);
  if (!limit.ok) return { kind: "rate_limited", retryAfter: limit.retryAfter };
  const { data, error } = await supabase.from("transcript_lines").select("id, text_jp").eq("id", lineId).maybeSingle();
  if (error) throw error;
  const row = data as { id: string; text_jp: string | null } | null;
  if (!row?.text_jp) return { kind: "not_found" };

  const shared = (await staticAnalyses(supabase, [{ id: row.id, textJp: row.text_jp }])).get(row.id);
  if (!shared) return { kind: "not_found" };
  const vocabIds = shared.tokens.flatMap((token) => (token.vocabId ? [token.vocabId] : []));
  // A fresh object: the memoised analysis is shared by every learner and must never carry anyone's mastery.
  return { kind: "ok", analysis: { ...shared, mastery: await readMastery(supabase, user.id, vocabIds) } };
}
