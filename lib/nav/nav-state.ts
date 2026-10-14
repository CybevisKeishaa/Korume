/** Client-safe nav state: the summary shape, the expanded/rail cookie, active-route matching and menu placement
 * (spec docs/superpowers/specs/2026-10-14-app-chrome-refresh-design.md §3). No server-only imports. */
export type NavPlan = "free" | "plus";
export interface NavSummary { name: string; avatarUrl: string | null; plan: NavPlan | null; reviewDue: number | null; reviewHref: string }

export const NAV_COOKIE = "korume_nav";
export const REVIEW_SUBMITTED_EVENT = "korume:review-submitted";
export const REVIEW_ROUTES = ["/review", "/kanji/review", "/mining/review"] as const;
/** Where Ôn tập points when the review read failed: the library, never a possibly-empty session (plan P2). */
export const REVIEW_FALLBACK_HREF = "/kanji";

export function parseNavCookie(value: string | undefined): boolean | null {
  if (value === "collapsed") return true;
  if (value === "expanded") return false;
  return null;
}

const NAV_COOKIE_PATTERN = new RegExp(`(?:^|;\\s*)${NAV_COOKIE}=([^;]*)`);

export function readNavCookie(cookieHeader: string): boolean | null {
  const match = cookieHeader.match(NAV_COOKIE_PATTERN);
  return parseNavCookie(match?.[1]);
}

export function navCookieValue(collapsed: boolean): string {
  return `${NAV_COOKIE}=${collapsed ? "collapsed" : "expanded"}; path=/; max-age=31536000; samesite=lax`;
}

export function activeKey(pathname: string, candidates: readonly { key: string; prefixes: readonly string[] }[]): string | null {
  let best: { key: string; length: number } | null = null;
  for (const { key, prefixes } of candidates) {
    for (const prefix of prefixes) {
      const hit = pathname === prefix || pathname.startsWith(`${prefix}/`);
      if (hit && (!best || prefix.length > best.length)) best = { key, length: prefix.length };
    }
  }
  return best?.key ?? null;
}

export function dueLabel(due: number): string {
  return due > 99 ? "99+" : String(due);
}

export type Rect = { left: number; top: number; right: number; bottom: number };
const GAP = 8;
const EDGE = 8;
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max));

export function placeMenu(
  anchor: Rect, menu: { width: number; height: number }, viewport: { width: number; height: number }, side: "above" | "right",
): { left: number; top: number } {
  let left: number;
  let top: number;
  if (side === "right") {
    left = anchor.right + GAP;
    top = anchor.bottom - menu.height;
  } else {
    left = anchor.left;
    top = anchor.top - GAP - menu.height;
    if (top < EDGE) top = anchor.bottom + GAP;
  }
  return {
    left: clamp(left, EDGE, viewport.width - EDGE - menu.width),
    top: clamp(top, EDGE, viewport.height - EDGE - menu.height),
  };
}
