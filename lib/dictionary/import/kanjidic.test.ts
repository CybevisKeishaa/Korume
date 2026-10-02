import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import { readKanjidic, type KanjidicRow } from "./kanjidic";

const KANJIDIC = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE kanjidic2 [
<!ELEMENT kanjidic2 (header,character*)>
]>
<kanjidic2>
<header><file_version>4</file_version><database_version>2026-225</database_version></header>
<character>
<literal>緑</literal>
<codepoint><cp_value cp_type="ucs">7dd1</cp_value></codepoint>
<misc><grade>3</grade><stroke_count>14</stroke_count><stroke_count>15</stroke_count><freq>1082</freq><jlpt>2</jlpt></misc>
<reading_meaning><rmgroup>
<reading r_type="pinyin">lu:4</reading>
<reading r_type="ja_on">リョク</reading>
<reading r_type="ja_on">ロク</reading>
<reading r_type="ja_kun">みどり</reading>
<meaning>green</meaning>
<meaning m_lang="fr">vert</meaning>
</rmgroup><nanori>つか</nanori></reading_meaning>
</character>
<character>
<literal>𠮟</literal>
<misc><stroke_count>5</stroke_count></misc>
</character>
</kanjidic2>`;

async function collect(xml: string): Promise<KanjidicRow[]> {
  const rows: KanjidicRow[] = [];
  for await (const row of readKanjidic(Readable.from([Buffer.from(xml, "utf8")]))) rows.push(row);
  return rows;
}

describe("readKanjidic", () => {
  it("reads readings, English meanings and the first stroke count", async () => {
    const [green, shikaru] = await collect(KANJIDIC);
    expect(green).toEqual({
      literal: "緑",
      on: ["リョク", "ロク"],
      kun: ["みどり"],
      meaningsEn: ["green"],
      strokeCount: 14,
      grade: 3,
      freq: 1082,
      jlptOld: 2,
    });
    expect(shikaru).toEqual({
      literal: "𠮟",
      on: [],
      kun: [],
      meaningsEn: [],
      strokeCount: 5,
      grade: null,
      freq: null,
      jlptOld: null,
    });
  });
});
