"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { usePathname } from "@/lib/i18n/navigation";
import { REVIEW_SUBMITTED_EVENT, type NavSummary } from "@/lib/nav/nav-state";

const RELOAD_KEY = "korume_nav_401_reload_at";
const RELOAD_WINDOW_MS = 10_000;

/** Indirection so tests can observe the reload — jsdom's window.location cannot be redefined. */
export const pageReload = { run: () => window.location.reload() };

/** A 401 means the session is gone. A full reload passes the middleware, which sends a signed-out request to
 * /<locale>/login?redirectTo=… — router.refresh() can be discarded by a concurrent navigation (app-footer T7).
 * One reload per 10s per tab, so a stubborn 401 cannot loop. An absent key means "never reloaded". */
export function reloadForSignIn(now: number = Date.now()): boolean {
  try {
    const raw = sessionStorage.getItem(RELOAD_KEY);
    if (raw !== null && now - Number(raw) < RELOAD_WINDOW_MS) return false;
    sessionStorage.setItem(RELOAD_KEY, String(now));
  } catch {
    // Storage blocked: reload anyway; the middleware redirect ends the loop.
  }
  pageReload.run();
  return true;
}

/** Server value first, then refreshed on mount, on every route change and after a saved review (spec §3.4). */
export function useNavSummary(initial: NavSummary | null): NavSummary | null {
  const pathname = usePathname();
  const [summary, setSummary] = useState(initial);
  const inFlight = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    let res: Response;
    try {
      res = await fetch("/api/nav/summary", { signal: controller.signal, cache: "no-store" });
    } catch {
      return; // network error or aborted: keep the last good value
    }
    if (controller.signal.aborted) return;
    if (res.status === 401) {
      // Commit the cleared nav before the reload starts: a plain setState is only scheduled, so the name and avatar
      // stayed on screen for as long as the reload took (final review I2b).
      flushSync(() => setSummary(null));
      reloadForSignIn();
      return;
    }
    if (!res.ok) return;
    try {
      const body = (await res.json()) as { data: NavSummary };
      if (!controller.signal.aborted) setSummary(body.data);
    } catch {
      // malformed body: keep the last good value
    }
  }, []);

  useEffect(() => { void refresh(); }, [pathname, refresh]);
  useEffect(() => {
    const onSaved = () => { void refresh(); };
    window.addEventListener(REVIEW_SUBMITTED_EVENT, onSaved);
    return () => window.removeEventListener(REVIEW_SUBMITTED_EVENT, onSaved);
  }, [refresh]);
  useEffect(() => () => inFlight.current?.abort(), []);

  return summary;
}
