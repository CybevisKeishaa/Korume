/** The attribute `themeInitScript` sets on <html> before paint. */
export const REDUCE_MOTION_ATTR = "data-reduce-motion";
export const REDUCE_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/**
 * May JS animate right now?
 *
 * ⚠️ This is an OR, and it mirrors `app/globals.css` rather than deciding
 * anything of its own. That file disables motion from two independent blocks —
 * `@media (prefers-reduced-motion: reduce)` and `:root[data-reduce-motion="true"]`
 * — so either input alone is enough. A gate that ANDed them, or read only the
 * attribute, would let JS keep animating an element CSS is holding static, and
 * nothing that tests one lane would see it.
 *
 * ⚠️ The attribute alone is not sufficient either: `themeInitScript` seeds it
 * once before paint and never updates it, so an OS setting changed mid-session
 * is visible only through the live media query.
 *
 * Server-side there is no document, and the safe answer is "no motion" — SSR
 * markup is then the static state, which is also what a reduce-motion reader
 * must receive.
 */
export function motionEnabled(): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  const osReduces = window.matchMedia(REDUCE_MOTION_QUERY).matches;
  const appReduces =
    document.documentElement.getAttribute(REDUCE_MOTION_ATTR) === "true";
  return !(osReduces || appReduces);
}

/**
 * Calls `onChange` whenever the answer changes. Watches both inputs: the media
 * query directly, and the attribute through a MutationObserver, because the app
 * toggle mutates `<html>` and fires no event.
 *
 * Returns an unsubscribe that removes both watchers. Consumers MUST call it —
 * React StrictMode double-mounts in dev.
 */
export function subscribeMotionEnabled(
  onChange: (enabled: boolean) => void,
): () => void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    // eslint-disable-next-line @typescript-eslint/no-empty-function -- SSR has nothing to subscribe to; a no-op unsubscribe keeps the contract uniform for callers.
    return () => {};
  }

  let last = motionEnabled();
  const emit = () => {
    const next = motionEnabled();
    if (next === last) return;
    last = next;
    onChange(next);
  };

  const query = window.matchMedia(REDUCE_MOTION_QUERY);
  query.addEventListener("change", emit);

  const observer = new MutationObserver(emit);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: [REDUCE_MOTION_ATTR],
  });

  return () => {
    query.removeEventListener("change", emit);
    observer.disconnect();
  };
}
