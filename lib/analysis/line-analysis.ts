import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/data/videos";
import { fetchAllPages, fetchByIdChunks } from "@/lib/data/query-pagination";
import { rateLimit } from "@/lib/rate-limit";
import { getActiveSnapshotId } from "@/lib/dictionary/snapshot";
import { tokenize } from "@/lib/japanese/tokenizer";
import { matchGrammar, type GrammarPattern } from "./grammar-matcher";
import { LEXICAL_RESOLVER_VERSION, isAutomaticLookupEligible, resolveLexeme, type EntryRow, type VocabRow } from "./lexical-resolver";
import { readMastery } from "./learning-state";
import { tokenSpans } from "./spans";
import type { AnalysisScope, AnalysisToken, LexicalLineAnalysis, LexicalLineAnalysisDto, LineAnalysisDto, StaticLineAnalysis } from "./types";

// Spec §1.1: Ask Korume's tools still import these from here; the one ranking and the one EntryRow live in the resolver.
export { entriesFor, type EntryRow } from "./lexical-resolver";

type Supabase = ReturnType<typeof createClient>;

const ANALYSIS_LIMIT = { limit: 120, windowMs: 60_000 };
const GRAMMAR_TTL_MS = 60_000;
// ponytail: an in-process memo bounded by insertion order; a shared cache when the app runs on many instances.
const MEMO_LIMIT = 5_000;

export interface LineText {
  id: string;
  textJp: string;
}

const memo = new Map<string, StaticLineAnalysis | LexicalLineAnalysis>();
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
  const rows = await fetchAllPages<{
    id: string; title: string; structure_pattern: string | null; explanation: string | null;
    example_sentences: { jp?: string; en?: string }[] | null; created_at: string;
  }>((from, to) => supabase
    .from("grammar_points")
    .select("id, title, structure_pattern, explanation, example_sentences, created_at")
    .order("id", { ascending: true })
    .range(from, to));
  const revision = `${rows.length}:${rows.reduce((max, row) => (row.created_at > max ? row.created_at : max), "")}`;
  grammarCache = {
    at: now,
    revision,
    patterns: rows.map((row) => ({
      id: row.id,
      title: row.title,
      structurePattern: row.structure_pattern,
      explanation: row.explanation,
      examples: (row.example_sentences ?? []).flatMap((example) => (example.jp ? [{ jp: example.jp, en: example.en ?? "" }] : [])),
    })),
  };
  return grammarCache;
}

/** Every entry of the snapshot whose kanji or kana forms include one of `forms`, in batched, paged queries. */
export async function lookupForms(supabase: Supabase, snapshotId: string, forms: string[]): Promise<EntryRow[]> {
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

/**
 * Shared, learner-free analyses for many lines at once: memo hits are returned as they are, and every miss is
 * tokenized and looked up in ONE batched dictionary pass. Never holds mastery or any learner state.
 */
export function staticAnalyses(supabase: Supabase, lines: LineText[], now?: number, scope?: "full"): Promise<Map<string, StaticLineAnalysis>>;
export function staticAnalyses(supabase: Supabase, lines: LineText[], now: number | undefined, scope: "lexical"): Promise<Map<string, LexicalLineAnalysis>>;
export function staticAnalyses(supabase: Supabase, lines: LineText[], now: number | undefined, scope: AnalysisScope): Promise<Map<string, StaticLineAnalysis | LexicalLineAnalysis>>;
export async function staticAnalyses(
  supabase: Supabase, lines: LineText[], now = Date.now(), scope: AnalysisScope = "full",
): Promise<Map<string, StaticLineAnalysis | LexicalLineAnalysis>> {
  const [snapshotId, grammar] = await Promise.all([
    getActiveSnapshotId(),
    scope === "full" ? grammarPatterns(supabase, now) : Promise.resolve(null),
  ]);
  // Spec §1.10: a resolver change must not serve analyses ranked by the old one.
  const keyOf = (line: LineText) =>
    `${scope}|r${LEXICAL_RESOLVER_VERSION}|${line.id}|${snapshotId ?? "none"}|${grammar?.revision ?? ""}|${line.textJp}`;
  const result = new Map<string, StaticLineAnalysis | LexicalLineAnalysis>();
  const misses: LineText[] = [];
  for (const line of lines) {
    const hit = memo.get(keyOf(line));
    if (hit) result.set(line.id, hit);
    else misses.push(line);
  }
  if (misses.length === 0) return result;

  const tokenized = await Promise.all(misses.map(async (line) => {
    const tokens = await tokenize(line.textJp);
    const spans = tokenSpans(line.textJp, tokens.map((token) => token.surface));
    return { line, tokens: tokens.map((token, index) => ({ ...token, span: spans[index] ?? { start: 0, end: 0 } })) };
  }));
  const content = tokenized.flatMap(({ tokens }) => tokens).filter(isAutomaticLookupEligible);
  const forms = [...new Set(content.flatMap((token) => [token.base, token.surface]))];
  const entries = snapshotId && forms.length > 0 ? await lookupForms(supabase, snapshotId, forms) : [];
  const headwords = [...new Set([...forms, ...entries.flatMap((entry) => entry.kanji_forms)])];
  // Spec §1.7: the (word, reading) join happens in the resolver, so every candidate headword's rows come back.
  const vocab = await fetchByIdChunks(headwords, async (chunk) => {
    const { data, error } = await supabase.from("vocab").select("id, word, reading, meaning_vi").in("word", chunk);
    if (error) throw error;
    return (data ?? []) as VocabRow[];
  });

  for (const { line, tokens } of tokenized) {
    const analysisTokens: AnalysisToken[] = tokens.map((token, index) => {
      const resolved = isAutomaticLookupEligible(token) ? resolveLexeme(token, entries, vocab) : null;
      return {
        index,
        surface: token.surface,
        base: token.base,
        reading: token.reading,
        pos: token.pos,
        posDetail1: token.posDetail1,
        span: token.span,
        entries: resolved?.matches ?? [],
        vocabId: resolved?.vocabId ?? null,
        curatedVi: resolved?.curatedVi ?? null,
      };
    });
    const analysis = grammar
      ? { lineId: line.id, snapshotId, tokens: analysisTokens, grammar: matchGrammar(analysisTokens, grammar.patterns) }
      : { lineId: line.id, snapshotId, tokens: analysisTokens };
    if (memo.size >= MEMO_LIMIT) memo.delete(memo.keys().next().value ?? "");
    memo.set(keyOf(line), analysis);
    result.set(line.id, analysis);
  }
  return result;
}

export type LineAnalysisResult<TAnalysis extends LineAnalysisDto | LexicalLineAnalysisDto = LineAnalysisDto> =
  | { kind: "unauthorized" }
  | { kind: "rate_limited"; retryAfter: number }
  | { kind: "not_found" }
  | { kind: "ok"; analysis: TAnalysis };

/** GET /api/lines/[lineId]/analysis: the line under the learner's RLS, its shared analysis, their mastery. */
export function getLineAnalysisForLearner(lineId: string, scope?: "full"): Promise<LineAnalysisResult>;
export function getLineAnalysisForLearner(lineId: string, scope: "lexical"): Promise<LineAnalysisResult<LexicalLineAnalysisDto>>;
export function getLineAnalysisForLearner(lineId: string, scope: AnalysisScope): Promise<LineAnalysisResult<LineAnalysisDto | LexicalLineAnalysisDto>>;
export async function getLineAnalysisForLearner(
  lineId: string, scope: AnalysisScope = "full",
): Promise<LineAnalysisResult<LineAnalysisDto | LexicalLineAnalysisDto>> {
  const supabase = createClient();
  const user = await requireUser(supabase);
  if (!user) return { kind: "unauthorized" };
  const limit = rateLimit(`analysis:line:${user.id}`, ANALYSIS_LIMIT);
  if (!limit.ok) return { kind: "rate_limited", retryAfter: limit.retryAfter };
  const { data, error } = await supabase.from("transcript_lines").select("id, text_jp").eq("id", lineId).maybeSingle();
  if (error) throw error;
  const row = data as { id: string; text_jp: string | null } | null;
  if (!row?.text_jp) return { kind: "not_found" };

  const shared = (await staticAnalyses(supabase, [{ id: row.id, textJp: row.text_jp }], undefined, scope)).get(row.id);
  if (!shared) return { kind: "not_found" };
  const vocabIds = shared.tokens.flatMap((token) => (token.vocabId ? [token.vocabId] : []));
  // A fresh object: the memoised analysis is shared by every learner and must never carry anyone's mastery.
  return { kind: "ok", analysis: { ...shared, mastery: await readMastery(supabase, user.id, vocabIds) } };
}
