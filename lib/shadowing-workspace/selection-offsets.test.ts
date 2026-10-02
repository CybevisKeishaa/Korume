// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { caretToOffset, selectionToSpan } from "./selection-offsets";

/**
 * Real Ranges over the markup RubySentence/FuriganaText render: base text in spans and <ruby>, readings in
 * <rt>. Line A: 𠮷野家[よしのや]に行[い]く — base text "𠮷野家に行く" (𠮷 is two UTF-16 units).
 */
let container: HTMLElement;
beforeEach(() => {
  container = document.createElement("div");
  container.innerHTML = [
    '<div data-line-id="line-a"><p lang="ja"><span lang="ja">',
    "<ruby>𠮷野家<rt>よしのや</rt></ruby><span>に</span><ruby>行<rt>い</rt></ruby><span>く</span>",
    "</span></p></div>",
    '<div data-line-id="line-b"><p lang="ja">明日も雨です。</p></div>',
    '<p class="translation">I go to Yoshinoya.</p>',
  ].join("");
  document.body.append(container);
});
afterEach(() => {
  container.remove();
  document.getSelection()?.removeAllRanges();
});

function select(start: [Node, number], end: [Node, number]): Selection {
  const selection = document.getSelection();
  if (!selection) throw new Error("no selection API");
  const range = document.createRange();
  range.setStart(...start);
  range.setEnd(...end);
  selection.removeAllRanges();
  selection.addRange(range);
  return selection;
}

const text = (selector: string) => {
  const node = container.querySelector(selector)?.firstChild;
  if (!node) throw new Error(selector);
  return node;
};

describe("selectionToSpan", () => {
  it("maps a selection over base text to UTF-16 offsets, counting 𠮷 as two", () => {
    // "野家に" — from after 𠮷 (offset 2 inside the ruby text) to after に.
    expect(selectionToSpan(select([text("ruby"), 2], [text("span > span"), 1]), container))
      .toEqual({ lineId: "line-a", span: { start: 2, end: 5 } });
    expect(selectionToSpan(select([text("ruby"), 0], [text("ruby:nth-of-type(2)"), 1]), container))
      .toEqual({ lineId: "line-a", span: { start: 0, end: 6 } });
  });

  it("maps a boundary inside a reading to the base offset after that ruby", () => {
    // Start inside よしのや → the base text after 𠮷野家 (offset 4); end after 行.
    expect(selectionToSpan(select([text("rt"), 1], [text("ruby:nth-of-type(2)"), 1]), container))
      .toEqual({ lineId: "line-a", span: { start: 4, end: 6 } });
  });

  it("returns null for a selection across two lines, outside the line, collapsed, or only in a reading", () => {
    expect(selectionToSpan(select([text("ruby"), 0], [text("[data-line-id='line-b'] p"), 2]), container)).toBeNull();
    expect(selectionToSpan(select([text("span > span"), 0], [text(".translation"), 3]), container)).toBeNull();
    expect(selectionToSpan(select([text("ruby"), 1], [text("ruby"), 1]), container)).toBeNull();
    expect(selectionToSpan(select([text("rt"), 0], [text("rt"), 3]), container)).toBeNull();
    expect(selectionToSpan(null, container)).toBeNull();
  });

  it("ignores lines outside the container it was given", () => {
    const other = document.createElement("div");
    document.body.append(other);
    expect(selectionToSpan(select([text("ruby"), 0], [text("ruby"), 2]), other)).toBeNull();
    other.remove();
  });
});

describe("caretToOffset", () => {
  it("turns a click caret into an offset into its line", () => {
    expect(caretToOffset(select([text("ruby:nth-of-type(2)"), 0], [text("ruby:nth-of-type(2)"), 0]), container))
      .toEqual({ lineId: "line-a", offset: 5 });
    expect(caretToOffset(select([text("ruby"), 0], [text("ruby"), 2]), container)).toBeNull();
  });
});
