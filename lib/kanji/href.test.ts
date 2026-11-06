import { describe, expect, it } from "vitest";
import { kanjiModalHref, kanjiPageHref } from "./href";

describe("kanjiModalHref", () => {
  it("adds kanji and from after the page's own params", () => {
    expect(kanjiModalHref("/kanji", "level=N5", "日", "level:N5")).toBe("/kanji?level=N5&kanji=%E6%97%A5&from=level%3AN5");
  });

  it("replaces an existing kanji and from", () => {
    expect(kanjiModalHref("/kanji", "level=N5&kanji=%E6%9C%88&from=favorites", "日", "level:N5")).toBe(
      "/kanji?level=N5&kanji=%E6%97%A5&from=level%3AN5",
    );
  });

  it("removes from when none is given", () => {
    expect(kanjiModalHref("/shadowing/v1", "kanji=%E6%9C%88&from=favorites&t=3", "日")).toBe("/shadowing/v1?kanji=%E6%97%A5&t=3");
  });
});

describe("kanjiPageHref", () => {
  it("encodes the literal, non-BMP included", () => {
    expect(kanjiPageHref("日")).toBe("/kanji/%E6%97%A5");
    expect(kanjiPageHref("𠮟")).toBe(`/kanji/${encodeURIComponent("𠮟")}`);
  });
});
