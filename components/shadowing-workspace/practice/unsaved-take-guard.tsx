"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useTranslations } from "@/lib/i18n";
import { useRouter } from "@/lib/i18n/navigation";
import { routing } from "@/lib/i18n/routing";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { hasUnsaved, UNSAVED_PHASES } from "@/lib/pronunciation/attempts";
import { usePronunciationAttempts } from "./pronunciation-attempts-context";

const LOCALE_PREFIX = new RegExp(`^/(${routing.locales.join("|")})(?=/|$)`);

/** A next-intl `Link` renders the locale into `href`; the locale-aware router wants the path without it. */
export function localeLessPath(href: string): string {
  return href.replace(LOCALE_PREFIX, "") || "/";
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
  const blocking = hasUnsaved(attempts);
  const blockingRef = useRef(blocking);
  blockingRef.current = blocking;
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    if (!blocking) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [blocking]);

  useEffect(() => {
    if (!blocking) return;
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank") return;
      // Only a client navigation to another page can lose the take silently: another origin unloads the page
      // (beforeunload), and a hash or the page already open goes nowhere.
      const href = anchor.getAttribute("href") ?? "";
      const url = new URL(href, window.location.href);
      if (url.origin !== window.location.origin || href.startsWith("#")) return;
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
    for (const attempt of Object.values(attempts)) if (UNSAVED_PHASES.has(attempt.phase)) dispatch({ type: "discard", lineId: attempt.lineId });
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
