/** Spec §3.4: heights in CSS px from the measurement tree; capacities per page kind, all measured. */
export type PageCapacity = { firstPage: number; continuationPage: number };

export function pageCapacity(measured: { content: number; firstHeader: number; continuationHeader: number; footer: number }): PageCapacity {
  return {
    firstPage: measured.content - measured.firstHeader - measured.footer,
    continuationPage: measured.content - measured.continuationHeader - measured.footer,
  };
}

/** Greedy, one pass: each item is placed exactly once, so no input can loop. An item taller than its page is alone and reported. */
export function paginate(itemHeights: number[], capacity: PageCapacity): { pages: number[][]; oversized: number[] } {
  const pages: number[][] = [];
  const oversized: number[] = [];
  let page: number[] = [];
  let used = 0;
  const limit = () => (pages.length === 0 ? capacity.firstPage : capacity.continuationPage);
  itemHeights.forEach((height, index) => {
    if (page.length > 0 && used + height > limit()) {
      pages.push(page);
      page = [];
      used = 0;
    }
    if (height > limit()) oversized.push(index);
    page.push(index);
    used += height;
  });
  if (page.length > 0) pages.push(page);
  return { pages, oversized };
}
