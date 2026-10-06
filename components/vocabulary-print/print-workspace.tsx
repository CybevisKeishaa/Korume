"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Switch } from "@/components/ui/switch";
import { useTranslations } from "@/lib/i18n";
import { Link } from "@/lib/i18n/navigation";
import { mascotReady } from "@/lib/vocabulary/print/mascot";
import { MM_TO_PX, PAPER, paperVars } from "@/lib/vocabulary/print/paper";
import { pageCapacity, paginate } from "@/lib/vocabulary/print/paginate";
import { DEFAULT_PRINT_SETTINGS, type PrintSettings } from "@/lib/vocabulary/print/settings";
import type { PrintDocument, VocabularyPrintItem } from "@/lib/vocabulary/print/source";
import { ContinuationHeader, FirstHeader, Footer, PrintItem, PrintSheets, type SheetLabels } from "./print-sheets";

const FONT_DEBOUNCE_MS = 150;
const SHEET_GAP_PX = 16;
const SHEET_PX = { width: PAPER.widthMm * MM_TO_PX, height: PAPER.heightMm * MM_TO_PX };

interface Committed { pages: VocabularyPrintItem[][]; settings: PrintSettings; oversized: VocabularyPrintItem[]; selected: number }

/** Spec §3: one print workspace — selection and settings on the left, the committed A4 page set on the right. */
export function PrintWorkspace({ doc, views }: { doc: PrintDocument; views: { label: string; href: string; current: boolean }[] }) {
  const t = useTranslations("vocab.print");
  const [settings, setSettings] = useState<PrintSettings>(DEFAULT_PRINT_SETTINGS);
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set(doc.items.map((item) => item.id)));
  const chosen = useMemo(() => doc.items.filter((item) => selected.has(item.id)), [doc.items, selected]);
  const [committed, setCommitted] = useState<Committed | null>(null);
  const [busy, setBusy] = useState(true);
  const [fontTick, setFontTick] = useState(0);
  const [scale, setScale] = useState(1);
  const [portal, setPortal] = useState<HTMLElement | null>(null);
  const generation = useRef(0);
  const measureRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const labelsFor = (mode: PrintSettings["mode"]): SheetLabels => ({
    wordmark: t("wordmark"),
    documentName: mode === "review" ? t("docReview") : t("docSelfTest"),
    title: doc.title,
    footer: t("footer", { document: mode === "review" ? t("docReview") : t("docSelfTest") }),
    pageNumber: (page, count) => t("pageNumber", { page, count }),
    englishMeaning: t("englishMeaning"),
  });
  const labels = labelsFor(settings.mode);
  // Spec §3.5: the committed page set is atomic, so its labels follow the settings it was measured with.
  const committedLabels = labelsFor(committed?.settings.mode ?? settings.mode);

  useEffect(() => setPortal(document.body), []);

  // Spec §3.3: a burst of font loads re-measures once.
  useEffect(() => {
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (!fonts?.addEventListener) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onDone = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setFontTick((tick) => tick + 1), FONT_DEBOUNCE_MS);
    };
    fonts.addEventListener("loadingdone", onDone);
    return () => {
      clearTimeout(timer);
      fonts.removeEventListener("loadingdone", onDone);
    };
  }, []);

  // Spec §3.5: render tree → fonts.ready → measure + paginate → mascot decode → commit; only the newest generation commits.
  useEffect(() => {
    const mine = ++generation.current;
    setBusy(true);
    void (async () => {
      await (document as Document & { fonts?: FontFaceSet }).fonts?.ready;
      const root = measureRef.current;
      if (mine !== generation.current || !root) return;
      const height = (role: string) => root.querySelector<HTMLElement>(`[data-measure="${role}"]`)?.getBoundingClientRect().height ?? 0;
      const nodes = [...root.querySelectorAll<HTMLElement>('[data-measure="item"]')];
      const itemHeights = nodes.map((el) => el.getBoundingClientRect().height);
      // Map back by id read off the measured DOM, never by a closure index.
      const byId = new Map(chosen.map((item) => [item.id, item]));
      const itemsAt = (indexes: number[]) => indexes.flatMap((index) => byId.get(nodes[index]?.dataset.itemId ?? "") ?? []);
      const capacity = pageCapacity({
        content: height("content"), firstHeader: height("first-header"), continuationHeader: height("continuation-header"), footer: height("footer"),
      });
      const { pages, oversized } = paginate(itemHeights, capacity);
      await mascotReady();
      if (mine !== generation.current) return;
      setCommitted({ pages: pages.map(itemsAt), settings, oversized: itemsAt(oversized), selected: chosen.length });
      setBusy(false);
    })();
  }, [chosen, settings, fontTick]);

  // Unmount: any in-flight generation becomes stale and commits nothing.
  useEffect(() => () => { generation.current += 1; }, []);

  // Spec §3.6: the paper never reflows with the viewport; only the preview's scale follows the column.
  useEffect(() => {
    const element = previewRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setScale(Math.min(1, entry.contentRect.width / SHEET_PX.width));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const update = useCallback(<K extends keyof PrintSettings>(key: K, value: PrintSettings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }));
  }, []);

  if (doc.items.length === 0) {
    return (
      <div className="space-y-md py-xl">
        <p className="text-body text-muted-foreground">{t("empty")}</p>
        <Link href={doc.backHref} className="text-body underline">{doc.backLabel}</Link>
      </div>
    );
  }

  const pageCount = committed?.pages.length ?? 0;
  const unresolved = doc.items.filter((item) => item.resolution === "saved_raw" && selected.has(item.id)).length;
  const blocked = busy || !committed || chosen.length === 0 || committed.oversized.length > 0;
  const previewHeight = pageCount * SHEET_PX.height + Math.max(0, pageCount - 1) * SHEET_GAP_PX;

  return (
    <div className="grid gap-lg py-lg lg:grid-cols-[20rem_minmax(0,1fr)]">
      <aside className="flex max-h-[calc(100dvh-var(--header-height,4rem))] flex-col gap-md overflow-y-auto lg:sticky lg:top-0">
        <h1 className="text-heading font-bold">{t("heading")}</h1>
        <nav aria-label={t("words")} className="flex gap-xs">
          {views.map((view) => (
            <Link key={view.href} href={view.href} aria-current={view.current ? "page" : undefined}
              className="rounded-md border border-border px-sm py-2xs text-caption aria-[current=page]:bg-muted aria-[current=page]:font-semibold">
              {view.label}
            </Link>
          ))}
        </nav>
        <SegmentedControl aria-label={t("mode")} value={settings.mode} onValueChange={(value) => update("mode", value)}
          options={[{ value: "review", label: t("modeReview") }, { value: "selfTest", label: t("modeSelfTest") }]} />
        <fieldset className="space-y-xs">
          <legend className="text-caption font-semibold text-muted-foreground">{t("show")}</legend>
          {(["showReading", "showMeaning", "showExample"] as const).map((key) => (
            <label key={key} className="flex items-center justify-between gap-sm text-body">
              {t(key)}
              <Switch checked={settings[key]} onCheckedChange={(checked) => update(key, checked)} />
            </label>
          ))}
        </fieldset>
        {settings.mode === "selfTest" && (
          <SegmentedControl aria-label={t("hide")} value={settings.hide} onValueChange={(value) => update("hide", value)}
            options={[{ value: "meaning", label: t("showMeaning") }, { value: "reading", label: t("showReading") }]} />
        )}
        <SegmentedControl aria-label={t("density")} value={settings.density} onValueChange={(value) => update("density", value)}
          options={[{ value: "airy", label: t("densityAiry") }, { value: "compact", label: t("densityCompact") }]} />
        <div className="space-y-xs">
          <div className="flex items-center justify-between gap-sm">
            <span className="text-caption font-semibold text-muted-foreground">{t("words")}</span>
            <span className="flex gap-xs">
              <Button variant="ghost" size="sm" onClick={() => setSelected(new Set(doc.items.map((item) => item.id)))}>{t("selectAll")}</Button>
              <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>{t("selectNone")}</Button>
            </span>
          </div>
          <ul className="space-y-2xs">
            {doc.items.map((item) => (
              <li key={item.id}>
                <label className="flex items-center gap-sm text-body">
                  <input type="checkbox" checked={selected.has(item.id)} onChange={(event) => setSelected((current) => {
                    const next = new Set(current);
                    if (event.target.checked) next.add(item.id); else next.delete(item.id);
                    return next;
                  })} />
                  <span lang="ja" className="font-semibold">{item.surface}</span>
                  {item.reading && <span lang="ja" className="text-caption text-muted-foreground">{item.reading}</span>}
                </label>
              </li>
            ))}
          </ul>
        </div>
        <p role="status" aria-live="polite" className="text-caption text-muted-foreground">
          {!committed ? t("preparing") : t("count", { selected: committed.selected, total: doc.items.length, pages: committed.selected === 0 ? 0 : pageCount })}
        </p>
        {unresolved > 0 && <p className="text-caption text-muted-foreground">{t("unresolved", { count: unresolved })}</p>}
        {committed?.oversized.map((item) => (
          <p key={item.id} role="alert" className="text-caption text-destructive">{t("oversized", { word: item.surface })}</p>
        ))}
        <Button className="sticky bottom-0 mt-auto aria-disabled:cursor-not-allowed aria-disabled:opacity-50" aria-disabled={blocked || undefined} onClick={() => { if (!blocked) window.print(); }}>
          {t("print")}
        </Button>
      </aside>

      <div ref={previewRef} data-preview="" className="min-w-0">
        {chosen.length === 0
          ? <p className="text-body text-muted-foreground">{t("empty")}</p>
          : committed && (
            <div style={{ height: previewHeight * scale }}>
              <div className="origin-top-left" style={{ width: SHEET_PX.width, transform: `scale(${scale})` }}>
                <PrintSheets pages={committed.pages} settings={committed.settings} labels={committedLabels} />
              </div>
            </div>
          )}
      </div>

      {/* Spec §3.3: the hidden measurement tree, same components and paper width, never scaled, never printed. */}
      <div ref={measureRef} aria-hidden className={`vp-paper vp-measure${settings.density === "compact" ? " vp-compact" : ""}`} style={paperVars() as CSSProperties}>
        <div data-measure="content" className="vp-measure-content" />
        <div data-measure="first-header"><FirstHeader labels={labels} /></div>
        <div data-measure="continuation-header"><ContinuationHeader labels={labels} /></div>
        <div data-measure="footer"><Footer labels={labels} page={88} count={88} /></div>
        {chosen.map((item) => (
          <div key={item.id} data-measure="item" data-item-id={item.id}><PrintItem item={item} settings={settings} englishMeaning={labels.englishMeaning} /></div>
        ))}
      </div>

      {portal && createPortal(
        <div data-print-root="">
          {committed && chosen.length > 0 && <PrintSheets pages={committed.pages} settings={committed.settings} labels={committedLabels} />}
        </div>,
        portal,
      )}
    </div>
  );
}
