import "server-only";
import { readLineForAnswer } from "@/lib/data/line-chunks";
import { getKnownVocabLemmas } from "@/lib/data/difficulty";
import { lineTextHash, lineTokens } from "@/lib/dictation/chunk";
import { CURRENT_CLOZE_SELECTOR, clozeBlank, selectBlanks, tokenRanges } from "@/lib/dictation/cloze";
import { displayMap, displayRange, normalizeJa, type LineCloze } from "@/lib/dictation";
import { lineRomaji } from "@/lib/japanese/romaji";

export type LineClozeResult = { kind: "ok"; data: LineCloze } | { kind: "unauthorized" } | { kind: "not_found" }
  | { kind: "rate_limited"; retryAfter: number };

/**
 * Spec §3.4: the learner's blanks for a line (known words are blanked last), with the raw sentence cut around them.
 * Auth and the RLS read come first, through the same `readLineForAnswer` as the chunks (P12).
 */
export async function loadLineCloze(lineId: string): Promise<LineClozeResult> {
  const line = await readLineForAnswer(lineId);
  if (line.kind !== "ok") return line;
  const { supabase, userId, text } = line;

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
  } };
}
