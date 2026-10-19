"use client";

import { useEffect, useState } from "react";
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

/** Spec §4.6: every state before the server's 201 warns on reload/close and confirms any in-workspace link. */
export function UnsavedTakeGuard({ rootRef }: { rootRef: React.RefObject<HTMLElement> }) {
  const t = useTranslations("shadowing.workspace.practice.leave");
  const router = useRouter();
  const { attempts, dispatch } = usePronunciationAttempts();
  const blocking = hasUnsaved(attempts);
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    if (!blocking) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [blocking]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !blocking) return;
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || !root.contains(anchor)) return;
      // Capture phase, before next-intl's Link starts its client navigation.
      event.preventDefault();
      event.stopPropagation();
      setPending(anchor.getAttribute("href"));
    };
    root.addEventListener("click", onClick, true);
    return () => root.removeEventListener("click", onClick, true);
  }, [blocking, rootRef]);

  const leave = () => {
    for (const attempt of Object.values(attempts)) if (UNSAVED_PHASES.has(attempt.phase)) dispatch({ type: "discard", lineId: attempt.lineId });
    const href = pending;
    setPending(null);
    if (href) router.push(localeLessPath(href));
  };
  return (
    <Dialog open={pending !== null} onClose={() => setPending(null)} title={t("title")} description={t("body")} closeLabel={t("stay")}>
      <div className="flex justify-end gap-sm">
        <Button variant="ghost" onClick={() => setPending(null)}>{t("stay")}</Button>
        <Button onClick={leave}>{t("discard")}</Button>
      </div>
    </Dialog>
  );
}
