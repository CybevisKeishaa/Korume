"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Protects unsaved Edit Profile changes (spec §8.4, R12 #4). In-app links and browser Back open the app's dialog;
 * tab close/reload can only use the browser's own prompt (`beforeunload`).
 */
export function useDirtyGuard(dirty: boolean) {
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.origin !== window.location.origin) return;
      if (anchor.dataset.guardSkip === "true") return;
      event.preventDefault();
      setPendingHref(anchor.pathname + anchor.search + anchor.hash);
    };
    const here = window.location.href;
    window.history.pushState({ korumeDirtyGuard: true }, "", here);
    const onPopState = () => {
      window.history.pushState({ korumeDirtyGuard: true }, "", here);
      setPendingHref("__back__");
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
    };
  }, [dirty]);

  const requestLeave = useCallback((href: string) => {
    if (dirtyRef.current) setPendingHref(href);
    else window.location.assign(href);
  }, []);

  return { pendingHref, setPendingHref, requestLeave };
}
