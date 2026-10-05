/** Spec §1.8: client-safe — no kuromoji, no database. Line analysis stays locale-free; each consumer calls this. */
export type MeaningLocale = "vi" | "en";
/** No `ai-cache` member (P6): an AI gloss never reaches a list or a printout. `canonical-vocab` is reserved. */
export type MeaningSource = "curated" | "canonical-vocab" | "jmdict";

export interface Meaning {
  meaning: string;
  meaningLocale: MeaningLocale;
  meaningSource: MeaningSource;
}

export function meaningFor(lexeme: { glossEn: string; curatedVi: string | null }, locale: string): Meaning {
  if (locale === "vi" && lexeme.curatedVi) return { meaning: lexeme.curatedVi, meaningLocale: "vi", meaningSource: "curated" };
  return { meaning: lexeme.glossEn, meaningLocale: "en", meaningSource: "jmdict" };
}
