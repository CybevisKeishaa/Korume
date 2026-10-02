import type { JmdictEntryRow } from "./jmdict";

export type KanjiWordCandidate = Pick<JmdictEntryRow, "entSeq" | "kanjiForms" | "common">;

function headwordLength(literal: string, entry: KanjiWordCandidate): number {
  let shortest = Number.POSITIVE_INFINITY;
  for (const form of entry.kanjiForms) if (form.includes(literal)) shortest = Math.min(shortest, [...form].length);
  return shortest;
}

/** Entries whose kanji forms contain `literal`: common first, then shorter headword, then ent_seq. */
export function rankKanjiWords(literal: string, entries: Iterable<KanjiWordCandidate>, limit: number): number[] {
  const ranked: { entSeq: number; common: boolean; length: number }[] = [];
  for (const entry of entries) {
    const length = headwordLength(literal, entry);
    if (Number.isFinite(length)) ranked.push({ entSeq: entry.entSeq, common: entry.common, length });
  }
  ranked.sort((a, b) => Number(b.common) - Number(a.common) || a.length - b.length || a.entSeq - b.entSeq);
  return ranked.slice(0, limit).map((item) => item.entSeq);
}
