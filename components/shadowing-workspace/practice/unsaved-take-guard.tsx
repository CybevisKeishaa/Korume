"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useTranslations } from "@/lib/i18n";
import { useRouter } from "@/lib/i18n/navigation";
import { routing } from "@/lib/i18n/routing";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { hasUnsaved, UNSAVED_PHASES, type AttemptsState } from "@/lib/pronunciation/attempts";
import { usePronunciationAttempts } from "./pronunciation-attempts-context";

const LOCALE_PREFIX = new RegExp(`^/(${routing.locales.join("|")})(?=/|$)`);

/** A next-intl `Link` renders the locale into `href`; the locale-aware router wants the path without it. */
export function localeLessPath(href: string): string {
  return href.replace(LOCALE_PREFIX, "") || "/";
}

/**
 * A take that would be lost by a client navigation. A `saving` take is not: its request finishes after the mode
 * unmounts and lands on the shell's store. Discarding it would let that 201 attach to a newer take on the same line.
 */
function discardable(attempts: AttemptsState): string[] {
  return Object.values(attempts).filter((attempt) => attempt.phase !== "saving" && UNSAVED_PHASES.has(attempt.phase)).map((attempt) => attempt.lineId);
}

type Navigate = (href: string) => void;
const GuardedNavigationContext = createContext<Navigate | null>(null);

/** A programmatic navigation inside the workspace (e.g. Korume's "Open full chat"): confirmed while a take is unsaved. */
export function useGuardedNavigation(): Navigate {
  const navigate = useContext(GuardedNavigationContext);
  const router = useRouter();
  return navigate ?? router.push;
}

/**
 * Spec §4.6: every state before the server's 201 warns on reload/close and confirms a client navigation, which
 * `beforeunload` cannot see. Links are caught on the document, so the app nav rail (rendered outside the workspace
 * root by the focus layout) is covered too; code that navigates itself goes through `useGuardedNavigation`.
 */
export function UnsavedTakeGuard({ children }: { children: React.ReactNode }) {
  const t = useTranslations("shadowing.workspace.practice.leave");
  const router = useRouter();
  const { attempts, dispatch } = usePronunciationAttempts();
  // Unload aborts any request, so every unsaved phase warns; a client navigation loses only the discardable ones.
  const unloading = hasUnsaved(attempts);
  const blocking = discardable(attempts).length > 0;
  const blockingRef = useRef(blocking);
  blockingRef.current = blocking;
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    if (!unloading) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [unloading]);

  useEffect(() => {
    if (!blocking) return;
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      // A download (the transcript export's blob link on <body>) or another scheme is not a navigation.
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      // Only a client navigation to another page can lose the take silently: another origin unloads the page
      // (beforeunload), and a hash or the page already open goes nowhere.
      const href = anchor.getAttribute("href") ?? "";
      const url = new URL(href, window.location.href);
      if (!/^https?:$/.test(url.protocol) || url.origin !== window.location.origin || href.startsWith("#")) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      // Capture phase, before next-intl's Link starts its client navigation.
      event.preventDefault();
      event.stopPropagation();
      setPending(url.pathname + url.search + url.hash);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [blocking]);

  const navigate = useCallback<Navigate>((href) => {
    if (blockingRef.current) setPending(href);
    else router.push(href);
  }, [router]);

  const leave = () => {
    for (const lineId of discardable(attempts)) dispatch({ type: "discard", lineId });
    const href = pending;
    setPending(null);
    if (href) router.push(localeLessPath(href));
  };
  return (
    <GuardedNavigationContext.Provider value={navigate}>
      {children}
      <Dialog open={pending !== null} onClose={() => setPending(null)} title={t("title")} description={t("body")} closeLabel={t("stay")}>
        <div className="flex justify-end gap-sm">
          <Button variant="ghost" onClick={() => setPending(null)}>{t("stay")}</Button>
          <Button onClick={leave}>{t("discard")}</Button>
        </div>
      </Dialog>
    </GuardedNavigationContext.Provider>
  );
}
