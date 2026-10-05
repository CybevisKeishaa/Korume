/** A single tokenized morpheme. `reading` is katakana, `null` when kuromoji can't determine one. */
export interface Token {
  surface: string;
  reading: string | null;
  base: string;
  pos: string;
  /** kuromoji's pos_detail_1 (非自立, 接尾, 数, …); null for "*". */
  posDetail1: string | null;
}

/**
 * One furigana-annotated segment. `reading` (hiragana) is present only when
 * `text` contains kanji — kana/punctuation segments carry no reading. This is
 * the shape persisted as `furigana_json` and consumed by the adaptive
 * furigana UI (spec §5.4).
 */
export interface FuriganaSegment {
  text: string;
  reading?: string;
}
