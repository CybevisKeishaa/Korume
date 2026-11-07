import { describe, expect, it } from "vitest";
import { parseHvdicPage, resolveViMeaning, type HvdicIndex } from "./hvdic";

// Readings as in KANJIDIC2 / hvdic; glosses are neutral tokens.
const hvdic: HvdicIndex = {
  会: [{ reading: "cối", glosses: ["c-1"] }, { reading: "hội", glosses: ["h-1", "h-2", "h-3"] }],
  讀: [{ reading: "đậu", glosses: ["d-1"] }, { reading: "độc", glosses: ["vi-1", "vi-2"] }],
  驛: [{ reading: "dịch", glosses: ["vi-3"] }],
  和: [{ reading: "hoà", glosses: ["w-1"] }, { reading: "hoạ", glosses: ["w-2"] }],
  寄: [{ reading: "ký", glosses: ["k-1"] }],
  中: [{ reading: "trúng", glosses: ["z-1"] }, { reading: "trung", glosses: ["z-2"] }],
  伝: [{ reading: "truyền", glosses: ["t-1"] }, { reading: "truyện", glosses: ["t-2"] }],
};
const old = { 読: ["讀"], 駅: ["驛"], 込: ["X"] };
const r = (literal: string, vi: string[], overrides?: Record<string, string[]>) => resolveViMeaning(literal, vi, hvdic, old, overrides);

describe("resolveViMeaning", () => {
  it("several readings match: the block with the most glosses", () => expect(r("会", ["Cối", "Hội", "Hụi"])).toEqual(["h-1", "h-2", "h-3"]));
  it("kyūjitai fallback, reading-matched", () => expect(r("読", ["Đậu", "Độc"])).toEqual(["vi-1", "vi-2"]));
  it("kyūjitai fallback, single block", () => expect(r("駅", ["Dịch"])).toEqual(["vi-3"]));
  it("old tone placement and final y match the new orthography", () => {
    expect(r("和", ["Họa"])).toEqual(["w-2"]);
    expect(r("寄", ["Kí"])).toEqual(["k-1"]);
  });
  it("a tie keeps KANJIDIC2 order", () => expect(r("中", ["Trung", "Trúng"])).toEqual(["z-2"]));
  it("no reading matches: the first block", () => expect(r("伝", ["Vân"])).toEqual(["t-1"]));
  it("gap: no block for the literal or its old form", () => {
    expect(r("込", [])).toEqual([]);
    expect(r("閲", ["Duyệt"])).toEqual([]);
  });
  it("an override wins, an empty override hides the gloss", () => {
    expect(r("会", ["Hội"], { 会: ["o-1"] })).toEqual(["o-1"]);
    expect(r("駅", ["Dịch"], { 駅: [] })).toEqual([]);
  });
});

describe("parseHvdicPage", () => {
  it("keeps the phổ thông list of each reading block, strips numbering, markup and entities", () => {
    const block = (reading: string, body: string) =>
      `<div class="hvres" name="x" data-hvres-idx="1"><div class="hvres-header"><p class="hvres-spell"><a href="/hv/${reading}">${reading}</a></p></div>` +
      `<div class="hvres-details">${body}</div></div>`;
    const html =
      `<div class="hvres-goto-link"></div><div class="hvres"><p class="hvres-source">Từ điển phổ thông</p><div class="hvres-meaning">top</div></div>` +
      block("a", `<p data-duid="1" class="hvres-source">Từ điển phổ thông</p>\n<div class="hvres-meaning han-clickable">1. g-1<br>\n2. <b>g-2</b> &amp; g-3</div><p class="hvres-source">Từ điển trích dẫn</p><div class="hvres-meaning">other</div>`) +
      block("b", `<p class="hvres-source">Từ điển Trần Văn Chánh</p><div class="hvres-meaning">other</div>`) +
      block("c", `<p class="hvres-source">Từ điển phổ thông</p><div class="hvres-meaning">g-4, g-5</div>`);
    expect(parseHvdicPage(html)).toEqual([
      { reading: "a", glosses: ["g-1", "g-2 & g-3"] },
      { reading: "c", glosses: ["g-4, g-5"] },
    ]);
  });
});
