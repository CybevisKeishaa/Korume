import { streamXml } from "./xml-stream";

export interface KanjidicRow {
  literal: string;
  on: string[];
  kun: string[];
  meaningsEn: string[];
  strokeCount: number;
  grade: number | null;
  freq: number | null;
  jlptOld: number | null;
}

/** Streams `<character>` elements of KANJIDIC2. The first `<stroke_count>` is the accepted one. */
export async function* readKanjidic(input: AsyncIterable<Buffer | string>): AsyncGenerator<KanjidicRow> {
  let row: KanjidicRow | null = null;
  let readingType: string | undefined;
  let meaningIsEnglish = true;

  yield* streamXml<KanjidicRow>(input, {
    open(tag) {
      if (tag.name === "character") {
        row = { literal: "", on: [], kun: [], meaningsEn: [], strokeCount: 0, grade: null, freq: null, jlptOld: null };
      } else if (tag.name === "reading") {
        readingType = tag.attributes.r_type;
      } else if (tag.name === "meaning") {
        meaningIsEnglish = tag.attributes.m_lang === undefined;
      }
    },
    close(name, text, emit) {
      if (!row) return;
      const value = text.trim();
      switch (name) {
        case "literal":
          row.literal = value;
          break;
        case "stroke_count":
          if (row.strokeCount === 0) row.strokeCount = Number(value);
          break;
        case "grade":
          row.grade = Number(value);
          break;
        case "freq":
          row.freq = Number(value);
          break;
        case "jlpt":
          row.jlptOld = Number(value);
          break;
        case "reading":
          if (readingType === "ja_on") row.on.push(value);
          else if (readingType === "ja_kun") row.kun.push(value);
          break;
        case "meaning":
          if (meaningIsEnglish) row.meaningsEn.push(value);
          break;
        case "character":
          if (!row.literal || !(row.strokeCount > 0)) throw new Error(`KANJIDIC2 character without literal or strokes`);
          emit(row);
          row = null;
          break;
      }
    },
  });
}
