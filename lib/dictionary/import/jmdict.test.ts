import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import { readJmdict, type JmdictEntryRow } from "./jmdict";

const JMDICT = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE JMdict [
<!ELEMENT JMdict (entry*)>
<!ENTITY n "noun (common) (futsuumeishi)">
<!ENTITY adj-na "adjectival nouns or quasi-adjectives (keiyodoshi)">
<!ENTITY uk "word usually written using kana alone">
]>
<!-- JMdict created: 2026-10-02 -->
<JMdict>
<entry>
<ent_seq>1000001</ent_seq>
<k_ele><keb>緑</keb><ke_pri>news1</ke_pri></k_ele>
<r_ele><reb>みどり</reb></r_ele>
<sense><pos>&n;</pos><gloss>green</gloss><gloss>greenery</gloss></sense>
<sense><gloss>verdure</gloss><misc>&uk;</misc></sense>
</entry>
<entry>
<ent_seq>1000002</ent_seq>
<r_ele><reb>にがて</reb></r_ele>
<k_ele><keb>苦手</keb></k_ele>
<sense><pos>&adj-na;</pos><pos>&n;</pos><gloss>weak point</gloss></sense>
</entry>
</JMdict>`;

async function collect(xml: string, chunkSize = 7): Promise<JmdictEntryRow[]> {
  const chunks: Buffer[] = [];
  const bytes = Buffer.from(xml, "utf8");
  for (let i = 0; i < bytes.length; i += chunkSize) chunks.push(bytes.subarray(i, i + chunkSize));
  const rows: JmdictEntryRow[] = [];
  for await (const row of readJmdict(Readable.from(chunks))) rows.push(row);
  return rows;
}

describe("readJmdict", () => {
  it("streams entries with forms, senses and the common flag", async () => {
    const rows = await collect(JMDICT);
    expect(rows).toEqual([
      {
        entSeq: 1000001,
        kanjiForms: ["緑"],
        kanaForms: ["みどり"],
        senses: [
          { pos: ["n"], gloss: ["green", "greenery"], misc: [] },
          { pos: ["n"], gloss: ["verdure"], misc: ["uk"] },
        ],
        common: true,
      },
      {
        entSeq: 1000002,
        kanjiForms: ["苦手"],
        kanaForms: ["にがて"],
        senses: [{ pos: ["adj-na", "n"], gloss: ["weak point"], misc: [] }],
        common: false,
      },
    ]);
  });

  it("survives multi-byte characters split across chunks", async () => {
    const rows = await collect(JMDICT, 1);
    expect(rows.map((row) => row.kanjiForms[0])).toEqual(["緑", "苦手"]);
  });

  it("rejects malformed XML", async () => {
    await expect(collect("<JMdict><entry><ent_seq>1</entry></JMdict>")).rejects.toThrow();
  });
});
