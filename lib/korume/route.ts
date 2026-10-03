/**
 * The only route a thread can point back to (spec §4.2). Built on the server from ids it has already
 * validated; no locale prefix — the i18n `Link` adds it at navigation time.
 */
export function originRouteFor(videoId: string, lineId: string): string {
  return `/shadowing/${encodeURIComponent(videoId)}?line=${encodeURIComponent(lineId)}`;
}
