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
  /** From the hand-written `kanji` table when the character exists there. */
  meaningVi: string | null;
  mnemonic: string | null;
  strokeCount: number;
  grade: number | null;
  frequency: number | null;
  /** The curated `kanji.jlpt_level` (N5…N1); KANJIDIC2 only carries the pre-2010 levels. */
  jlpt: string | null;
  /** KANJIDIC2 `vietnam` readings (Han-Viet), as in the source. */
  hanViet: string[];
  /** Thieu Chuu mnemonic lines from `dict_kanji.tc_lines`; empty until the Thieu Chuu import fills them. */
  tcLines: string[];
  /** KANJIDIC2 pre-2010 JLPT level (4 easiest to 1 hardest); null when absent. */
  oldJlpt: number | null;
  strokePaths: string[];
  components: KanjiComponentNode;
  commonWords: KanjiCommonWord[];
  curatedKanjiId: string | null;
  attribution: DictionaryAttribution[];
}
