import "server-only";
import { readLineForAnswer, type LineAnswerAccess } from "@/lib/data/line-chunks";
import { getKnownVocabLemmas } from "@/lib/data/difficulty";
import { lineTextHash, lineTokens } from "@/lib/dictation/chunk";
import { CURRENT_CLOZE_SELECTOR, clozeBlank, pickDistractors, selectBlanks, tokenRanges } from "@/lib/dictation/cloze";
import type { Token } from "@/lib/japanese/types";
import { displayMap, displayRange, normalizeJa, type LineCloze } from "@/lib/dictation";
import { lineRomaji } from "@/lib/japanese/romaji";

/** Lines read on each side of the current one for Chế độ dễ's distractors. */
export const DISTRACTOR_NEIGHBOURS = 8;

/**
 * Tokens of the lines around `start` in the transcript, nearest first (alternating before / after), read under the
 * learner's RLS after `readLineForAnswer`; tokens come from the shared memo.
 */
async function nearbyTokens(supabase: Extract<LineAnswerAccess, { kind: "ok" }>["supabase"], transcriptId: string, start: number): Promise<Token[][]> {
  const side = (before: boolean) => {
    const query = supabase.from("transcript_lines").select("text_jp").eq("transcript_id", transcriptId);
    return (before ? query.lt("start_time", start) : query.gt("start_time", start))
      .order("start_time", { ascending: !before }).limit(DISTRACTOR_NEIGHBOURS);
  };
  const [earlier, later] = await Promise.all([side(true), side(false)]);
  if (earlier.error) throw earlier.error;
  if (later.error) throw later.error;
  const rows = (r: { data: unknown }) => (Array.isArray(r.data) ? r.data : []) as { text_jp: string }[];
  const [a, b] = [rows(earlier), rows(later)];
  const texts = Array.from({ length: Math.max(a.length, b.length) }, (_, i) => [a[i], b[i]])
    .flat().flatMap((r) => (r?.text_jp ? [r.text_jp] : []));
  return Promise.all(texts.map(lineTokens));
}

export type LineClozeResult = { kind: "ok"; data: LineCloze } | { kind: "unauthorized" } | { kind: "not_found" }
  | { kind: "rate_limited"; retryAfter: number };

/**
 * Spec §3.4: the learner's blanks for a line (known words are blanked last), with the raw sentence cut around them.
 * Auth and the RLS read come first, through the same `readLineForAnswer` as the chunks (P12).
 */
export async function loadLineCloze(lineId: string): Promise<LineClozeResult> {
  const line = await readLineForAnswer(lineId);
  if (line.kind !== "ok") return line;
  const { supabase, userId, text, transcriptId, start } = line;

  const base = normalizeJa(text);
  const tokens = await lineTokens(text);
  const ranges = tokenRanges(tokens, base);
  const blanks = ranges ? selectBlanks(tokens, await getKnownVocabLemmas(supabase, userId)) : [];
  const map = displayMap(text);
  const all = { start: 0, end: Array.from(base).length };

  const segments: LineCloze["segments"] = [];
  let run: number[] = [];
  const flush = () => {
    if (run.length === 0) return;
    const range = ranges ? { start: ranges[run[0]!]!.start, end: ranges[run.at(-1)!]!.end } : all;
    segments.push({ text: displayRange(map, base, range), blank: null, romaji: lineRomaji(run.map((i) => tokens[i]!)) });
    run = [];
  };
  tokens.forEach((_, i) => {
    const blank = blanks.indexOf(i);
    if (blank < 0) return void run.push(i);
    flush();
    segments.push({ text: displayRange(map, base, ranges![i]!), blank, romaji: "___" });
  });
  flush();

  return { kind: "ok", data: {
    version: CURRENT_CLOZE_SELECTOR,
    textHash: lineTextHash(text),
    blanks,
    segments,
    readings: blanks.map((i) => clozeBlank(tokens, i).reading),
    distractors: blanks.length > 0 && transcriptId !== null && start !== null
      ? pickDistractors(tokens, blanks, await nearbyTokens(supabase, transcriptId, start))
      : [],
  } };
}
