import { describe, expect, it } from "vitest";
import { pageCapacity, paginate } from "./paginate";

const capacity = { firstPage: 300, continuationPage: 400 };

describe("paginate (spec §3.4)", () => {
  it("returns no pages for no items", () => {
    expect(paginate([], capacity)).toEqual({ pages: [], oversized: [] });
  });

  it("fills the first page to its own capacity, then continuation pages to theirs", () => {
    expect(paginate([100, 100, 100, 100, 100, 100, 100, 100], capacity).pages).toEqual([[0, 1, 2], [3, 4, 5, 6], [7]]);
  });

  it("keeps an exact fit on the page", () => {
    expect(paginate([150, 150, 400], capacity).pages).toEqual([[0, 1], [2]]);
  });

  it("puts an oversized item alone on its page and reports it, placing every item exactly once", () => {
    const result = paginate([100, 500, 100], capacity);
    expect(result.pages).toEqual([[0], [1], [2]]);
    expect(result.oversized).toEqual([1]);
    expect(result.pages.flat()).toEqual([0, 1, 2]);
  });

  it("reports an item that fits a continuation page but not the first page as oversized only if it starts the first page", () => {
    expect(paginate([350], capacity)).toEqual({ pages: [[0]], oversized: [0] });
    expect(paginate([100, 350], capacity)).toEqual({ pages: [[0], [1]], oversized: [] });
  });

  it("is deterministic, and a two-line title (smaller first page) moves only the first break", () => {
    const heights = Array.from({ length: 12 }, () => 100);
    expect(paginate(heights, capacity)).toEqual(paginate(heights, capacity));
    expect(paginate(heights, { ...capacity, firstPage: 200 }).pages[0]).toEqual([0, 1]);
  });

  it("does not change the layout when the page count reaches two digits (the footer height is fixed)", () => {
    const nine = paginate(Array.from({ length: 36 }, () => 100), { firstPage: 400, continuationPage: 400 });
    const ten = paginate(Array.from({ length: 40 }, () => 100), { firstPage: 400, continuationPage: 400 });
    expect(nine.pages).toHaveLength(9);
    expect(ten.pages.slice(0, 9)).toEqual(nine.pages);
  });
});

describe("pageCapacity", () => {
  it("subtracts each page kind's own measured header and the footer", () => {
    expect(pageCapacity({ content: 1000, firstHeader: 120, continuationHeader: 40, footer: 30 })).toEqual({ firstPage: 850, continuationPage: 930 });
  });
});
