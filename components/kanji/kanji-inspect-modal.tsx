"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Maximize2, X } from "lucide-react";
import { Link, useTranslations } from "@/lib/i18n";
import { kanjiPageHref } from "@/lib/kanji/href";
import type { KanjiInspectPayload } from "@/lib/kanji/learner-types";
import { Skeleton } from "@/components/ui/skeleton";
import { KanjiInspect } from "./kanji-inspect";
import { useKanjiModalHistory } from "./use-kanji-modal-history";

function focusAfterClose(opener: Element | null) {
  // No opener (the initial-URL case leaves focus on <body>) → the page's main heading.
  if (opener instanceof HTMLElement && opener !== document.body && opener.isConnected) return opener.focus();
  // The first RENDERED one: a protected page can carry a hidden <main> (the mobile app handoff) before its own.
  const shown = (selector: string) => [...document.querySelectorAll<HTMLElement>(selector)].find((el) => el.getClientRects().length > 0);
  const target = shown("main h1") ?? shown("main");
  if (!target) return;
  if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
  target.focus();
}

const navButton = "flex size-[var(--control-sm)] items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground active:bg-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-disabled:opacity-50 aria-disabled:hover:bg-transparent";
// Centred on KanjiInspect's header row: py-sm, then the glyph's 1.4 line box less the control, halved. z-10: the content's
// step-in animation makes it a stacking context that would otherwise paint over (and take the clicks of) these controls.
const overHeader = "absolute z-10 top-[calc(var(--space-sm)+(1.4*var(--kanji-inspect-glyph)-var(--control-sm))/2)] flex gap-2xs";

/**
 * The kanji inspect modal (spec §5.1): `?kanji=<literal>` over any protected page, mounted once in the
 * `(protected)` layout, holding the `KanjiInspect` content (Task 7). ‹ › and page link + ✕ sit over the content's
 * header row as the dialog's own children, so a literal change (loading → loaded) never remounts a focused button.
 */
export function KanjiInspectModal() {
  const t = useTranslations("kanji");
  const tCommon = useTranslations("common");
  const { literal, from, close, go } = useKanjiModalHistory();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const opener = useRef<Element | null>(null);
  const wantOpen = useRef(false);
  const [loaded, setLoaded] = useState<{ key: string; from: string | null; payload: KanjiInspectPayload | null } | null>(null);
  const [attempt, setAttempt] = useState(0);
  // What the dialog shows: the open literal, and the last one until the close has faded out (it is not emptied first).
  const [view, setView] = useState<{ literal: string; from: string | null } | null>(null);
  if (literal !== null && (view?.literal !== literal || view.from !== from)) setView({ literal, from });
  // ‹ › name the side the next kanji steps in from; any other literal change (a composition chip) just fades in.
  const [step, setStep] = useState<{ to: string; dir: "prev" | "next" } | null>(null);
  const open = literal !== null;
  const key = `${view?.literal}|${view?.from}`;

  useEffect(() => {
    const dialog = dialogRef.current;
    wantOpen.current = open;
    if (!dialog) return;
    if (open && !dialog.open) {
      opener.current = document.activeElement;
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
      focusAfterClose(opener.current);
      opener.current = null;
    }
    if (open) return;
    // A later open of the same kanji (list, chip, URL) settles in, not slides from the last ‹ › side.
    setStep(null);
    // transitionend releases the held content; this is the fallback where it never fires (no discrete transitions,
    // a hidden tab), so a reopen never reuses stale content. Cleared by a reopen.
    const release = setTimeout(() => setView(null), 400);
    return () => clearTimeout(release);
  }, [open]);

  useEffect(() => {
    if (literal === null) return;
    let live = true;
    const query = from ? `?from=${encodeURIComponent(from)}` : "";
    fetch(`/api/dictionary/kanji/${encodeURIComponent(literal)}${query}`)
      .then(async (response) => (response.ok ? ((await response.json()) as { data: KanjiInspectPayload }).data : null))
      .catch(() => null)
      .then((payload) => { if (live) setLoaded({ key, from, payload }); });
    return () => { live = false; };
  }, [literal, from, key, attempt]);

  const settled = loaded?.key === key;
  const payload = settled ? loaded.payload : null;
  // While the next literal loads, ‹ › keep the last list's neighbors (same `from`) so a focused button stays mounted;
  // they act only once settled. aria-disabled, not disabled: disabling the focused button would drop focus.
  const neighbors = loaded && loaded.from === view?.from ? loaded.payload?.neighbors ?? null : null;
  const stepTo = (dir: "prev" | "next") => {
    const to = settled && neighbors?.[dir];
    if (!to) return;
    setStep({ to, dir });
    go(to);
  };

  return (
    <dialog
      ref={dialogRef}
      // Explicit, though implicit on <dialog>: page-level key handlers (the lesson workspace's Esc and shortcuts,
      // `isInteractiveTarget`) skip events from inside `[role='dialog']`, so Esc here closes only this modal.
      role="dialog"
      aria-label={view ? t("quickInspect.label", { literal: view.literal }) : undefined}
      data-step={step && step.to === view?.literal ? step.dir : undefined}
      onCancel={(event) => { event.preventDefault(); close(); }}
      // A close the app did not ask for (the browser's own Esc fallback) still goes through the history rule.
      onClose={() => { if (wantOpen.current) close(); }}
      onClick={(event) => { if (event.target === event.currentTarget) close(); }}
      // The close has faded out: the held content goes, so a reopen mounts fresh content as before.
      onTransitionEnd={(event) => { if (event.target === event.currentTarget && !event.currentTarget.open) setView(null); }}
      className="kanji-dialog w-[76vw] max-w-none max-h-[calc(100dvh-2*var(--space-xs))] flex-col overflow-hidden rounded-lg border border-border bg-card p-0 text-foreground backdrop:bg-scrim/60 open:flex"
    >
      {view && (
        <>
          {neighbors ? (
            <div className={`${overHeader} start-lg`}>
              <button type="button" aria-label={t("inspect.prev")} aria-disabled={!settled || !neighbors.prev} onClick={() => stepTo("prev")} className={navButton}><ChevronLeft aria-hidden="true" className="size-icon-sm" /></button>
              <button type="button" aria-label={t("inspect.next")} aria-disabled={!settled || !neighbors.next} onClick={() => stepTo("next")} className={navButton}><ChevronRight aria-hidden="true" className="size-icon-sm" /></button>
            </div>
          ) : null}
          <div className={`${overHeader} end-lg`}>
            <Link href={kanjiPageHref(view.literal)} aria-label={t("inspect.openPage")} title={t("inspect.openPage")} className={navButton}><Maximize2 aria-hidden="true" className="size-icon-sm" /></Link>
            <button type="button" aria-label={t("inspect.close")} onClick={close} className={navButton}><X aria-hidden="true" className="size-icon-sm" /></button>
          </div>
          {payload ? (
            <KanjiInspect key={view.literal} payload={payload} variant="modal" />
          ) : settled ? (
            <div role="alert" className="flex flex-col items-center gap-sm px-lg pb-lg pt-[calc(72*var(--density-unit))] text-center">
              <p lang="ja" className="font-jp text-display font-bold">{view.literal}</p>
              <p className="text-body text-muted-foreground">{t("quickInspect.failed")}</p>
              <button type="button" onClick={() => setAttempt(attempt + 1)} className="inline-flex h-control-sm items-center rounded-full border border-border px-md text-body font-medium hover:bg-muted active:bg-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {tCommon("actions.retry")}
              </button>
            </div>
          ) : (
            <div role="status" aria-label={t("quickInspect.loading")} className="flex flex-col">
              <div className="flex items-center gap-md border-b border-border px-[calc(var(--space-lg)+2*var(--control-sm)+var(--space-2xs))] py-sm">
                <p lang="ja" className="font-jp text-display font-bold">{view.literal}</p>
                <Skeleton className="h-control-sm w-1/4" />
              </div>
              <div className="grid grid-cols-[0.8fr_1.15fr_0.95fr_1.1fr] gap-sm p-md">
                {[0, 1, 2, 3].map((column) => <Skeleton key={column} className="h-[calc(280*var(--density-unit))] rounded-lg" />)}
              </div>
            </div>
          )}
        </>
      )}
    </dialog>
  );
}
