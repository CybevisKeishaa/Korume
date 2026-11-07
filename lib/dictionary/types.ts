import type { KanjiComponentNode } from "@/lib/dictionary/import/sanitize-kanjivg";

export type { KanjiComponentNode };

/** Rendered from `dict_imports` of the active snapshot — never hard-coded (spec §4.1). */
export interface DictionaryAttribution {
  source: "jmdict" | "kanjidic2" | "kanjivg";
  version: string;
  url: string;
  license: string;
}

export interface KanjiCommonWord {
  entSeq: number;
  headword: string;
  reading: string;
  glossEn: string;
}

export interface KanjiData {
  literal: string;
  onReadings: string[];
  kunReadings: string[];
  meaningsEn: string[];
  /** Curated `kanji.meaning_vi`, else `dict_kanji.vi_meanings` (owner ruling K16, `viMeaning`). */
  meaningVi: string | null;
  /** `meaningVi` came from the import, so the hvdic credit shows with it. */
  viFromHvdic: boolean;
  mnemonic: string | null;
  strokeCount: number;
  grade: number | null;
  frequency: number | null;
  /** The curated `kanji.jlpt_level` (N5…N1); KANJIDIC2 only carries the pre-2010 levels. */
  jlpt: string | null;
  /** KANJIDIC2 `vietnam` readings (Han-Viet), as in the source. */
  hanViet: string[];
  /** KANJIDIC2 pre-2010 JLPT level (4 easiest to 1 hardest); null when absent. */
  oldJlpt: number | null;
  strokePaths: string[];
  components: KanjiComponentNode;
  /** Hán Việt + first English meaning of each composition element that is itself a kanji in the snapshot. */
  componentGlosses: Record<string, { hanViet: string[]; meaningEn: string | null }>;
  commonWords: KanjiCommonWord[];
  curatedKanjiId: string | null;
  attribution: DictionaryAttribution[];
}
