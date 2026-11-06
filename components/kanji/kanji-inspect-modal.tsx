"use client";

import { useEffect, useRef, useState } from "react";
import { Link, useTranslations } from "@/lib/i18n";
import { kanjiPageHref } from "@/lib/kanji/href";
import type { KanjiInspectPayload } from "@/lib/kanji/learner-types";
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

const navButton = "flex h-control-sm px-sm items-center justify-center rounded-md border border-border text-body text-foreground hover:bg-muted";

/**
 * The kanji inspect modal (spec §5.1): `?kanji=<literal>` over any protected page, mounted once in the
 * `(protected)` layout. Task 6 proves the routing with glyph + Hán Việt + the page link + ‹ ›; Task 7 brings the content.
 */
export function KanjiInspectModal() {
  const t = useTranslations("kanji");
  const { literal, from, close, go } = useKanjiModalHistory();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const opener = useRef<Element | null>(null);
  const wantOpen = useRef(false);
  const [loaded, setLoaded] = useState<{ key: string; payload: KanjiInspectPayload | null } | null>(null);
  const open = literal !== null;
  const key = `${literal}|${from}`;

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
  }, [open]);

  useEffect(() => {
    if (literal === null) return;
    let live = true;
    const query = from ? `?from=${encodeURIComponent(from)}` : "";
    fetch(`/api/dictionary/kanji/${encodeURIComponent(literal)}${query}`)
      .then(async (response) => (response.ok ? ((await response.json()) as { data: KanjiInspectPayload }).data : null))
      .catch(() => null)
      .then((payload) => { if (live) setLoaded({ key, payload }); });
    return () => { live = false; };
  }, [literal, from, key]);

  const payload = loaded?.key === key ? loaded.payload : null;
  const neighbors = payload?.neighbors ?? null;

  return (
    <dialog
      ref={dialogRef}
      // Explicit, though implicit on <dialog>: page-level key handlers (the lesson workspace's Esc and shortcuts,
      // `isInteractiveTarget`) skip events from inside `[role='dialog']`, so Esc here closes only this modal.
      role="dialog"
      aria-label={literal ? t("quickInspect.label", { literal }) : undefined}
      onCancel={(event) => { event.preventDefault(); close(); }}
      // A close the app did not ask for (the browser's own Esc fallback) still goes through the history rule.
      onClose={() => { if (wantOpen.current) close(); }}
      onClick={(event) => { if (event.target === event.currentTarget) close(); }}
      className="w-full max-w-md rounded-lg border border-border bg-card p-0 text-foreground backdrop:bg-black/50"
    >
      {literal && (
        <div className="space-y-sm p-lg">
          <div className="flex items-center justify-between gap-sm">
            {neighbors ? (
              <div className="flex gap-2xs">
                <button type="button" aria-label={t("inspect.prev")} disabled={!neighbors.prev} onClick={() => neighbors.prev && go(neighbors.prev)} className={navButton}>‹</button>
                <button type="button" aria-label={t("inspect.next")} disabled={!neighbors.next} onClick={() => neighbors.next && go(neighbors.next)} className={navButton}>›</button>
              </div>
            ) : <span />}
            <button type="button" aria-label={t("inspect.close")} onClick={close} className={navButton}>✕</button>
          </div>
          <p lang="ja" className="text-center font-jp text-display">{literal}</p>
          {payload && payload.data.hanViet.length > 0 && <p className="text-center text-body">{payload.data.hanViet.join(", ")}</p>}
          <Link href={kanjiPageHref(literal)} className="inline-flex text-caption font-medium text-primary-strong underline-offset-2 hover:underline">
            {t("inspect.openPage")}
          </Link>
        </div>
      )}
    </dialog>
  );
}
