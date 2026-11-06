/** The current page with the kanji inspect modal open on `literal` (spec §5.1). `pathname` is locale-less. */
export function kanjiModalHref(pathname: string, search: string, literal: string, from?: string): string {
  const params = new URLSearchParams(search);
  params.set("kanji", literal);
  if (from) params.set("from", from);
  else params.delete("from");
  return `${pathname}?${params}`;
}

/** The kanji's own page. */
export function kanjiPageHref(literal: string): string {
  return `/kanji/${encodeURIComponent(literal)}`;
}
