"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { useLocale, useTranslations } from "@/lib/i18n";
import { Link } from "@/lib/i18n/navigation";
import { pdfFilename } from "@/lib/vocabulary/print/filename";
import { hasKanji } from "@/lib/vocabulary/print/japanese";
import { writingLayout } from "@/lib/vocabulary/print/layout";
import { mascotReady } from "@/lib/vocabulary/print/mascot";
import { pageCapacity, paginate } from "@/lib/vocabulary/print/paginate";
import { MM_TO_PX, PAPER, paperVars } from "@/lib/vocabulary/print/paper";
import { prepareDocument, type PreparedItem, type PreparedPage } from "@/lib/vocabulary/print/prepare";
import { DEFAULT_WORKSHEET_SETTINGS, PROMPT_KEYS, type WorksheetSettings } from "@/lib/vocabulary/print/settings";
import type { PrintDocument, PrintResources, PrintSet } from "@/lib/vocabulary/print/source";
import { useSheetLabels } from "./labels";
import {
  AnswerLine, AnswersHeading, ContinuationHeader, FirstHeader, FooterBlock, PracticeItem, QuoteBand, SelfTestItem, Worksheet,
} from "./worksheet";

const FONT_DEBOUNCE_MS = 150;
const SHEET_GAP_PX = 16;
const SHEET_PX = { width: PAPER.widthMm * MM_TO_PX, height: PAPER.heightMm * MM_TO_PX };

export interface Committed {
  pages: PreparedPage[];
  settings: WorksheetSettings;
  oversized: PreparedItem[];
  printed: number;
  excluded: number;
  missingStrokes: number;
}

function missingStrokes(items: PreparedItem[], resources: PrintResources): number {
  return new Set(items.flatMap((item) => item.glyphs ?? []).filter((glyph) => !resources.strokeGuides[glyph])).size;
}

/** Spec §3 + W §5–§6: selection and settings on the left, the committed A4 worksheet on the right. */
export function PrintWorkspace({ doc, views, source, resources }: {
  doc: PrintDocument;
  views: { label: string; href: string; current: boolean }[];
  source: { lessonId: string; set: PrintSet };
  resources: PrintResources;
}) {
  const t = useTranslations("vocab.print");
  const locale = useLocale();
  const { toast } = useToast();
  const [downloading, setDownloading] = useState(false);
  const [settings, setSettings] = useState<WorksheetSettings>(DEFAULT_WORKSHEET_SETTINGS);
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set(doc.items.map((item) => item.id)));
  const visible = useMemo(
    () => (settings.includeKanaOnly ? doc.items : doc.items.filter((item) => hasKanji(item.surface))),
    [doc.items, settings.includeKanaOnly],
  );
  const prepared = useMemo(() => prepareDocument(doc.items, selected, settings), [doc.items, selected, settings]);
  const [committed, setCommitted] = useState<Committed | null>(null);
  const [busy, setBusy] = useState(true);
  const [fontTick, setFontTick] = useState(0);
  const [layoutTick, setLayoutTick] = useState(0);
  const [scale, setScale] = useState(1);
  const [portal, setPortal] = useState<HTMLElement | null>(null);
  const generation = useRef(0);
  const measureRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const labels = useSheetLabels(settings.mode, doc.title);
  // Spec §3.5: the committed page set is atomic, so its labels follow the settings it was measured with.
  const committedLabels = useSheetLabels(committed?.settings.mode ?? settings.mode, doc.title);

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

  // Spec §3.5 + W §5: render tree → fonts.ready → measure + paginate → mascot + watermark decode → commit.
  useEffect(() => {
    const mine = ++generation.current;
    setBusy(true);
    void (async () => {
      await (document as Document & { fonts?: FontFaceSet }).fonts?.ready;
      const root = measureRef.current;
      if (mine !== generation.current || !root) return;
      const height = (role: string) => root.querySelector<HTMLElement>(`[data-measure="${role}"]`)?.getBoundingClientRect().height ?? 0;
      // A tree with no layout (print media, the mobile handoff) reads zeros; commit nothing until the observer sees layout.
      if (height("content") === 0) return;
      const capacity = pageCapacity({
        content: height("content"), firstHeader: height("first-header"), continuationHeader: height("continuation-header"),
        quote: height("quote"), footer: height("footer"),
      });
      // Map back by id read off the measured DOM, never by a closure index.
      const nodes = (role: string) => [...root.querySelectorAll<HTMLElement>(`[data-measure="${role}"]`)];
      const itemNodes = nodes("item");
      const itemById = new Map(prepared.items.map((item) => [item.id, item]));
      const itemAt = (index: number) => itemById.get(itemNodes[index]?.dataset.itemId ?? "");
      const items = paginate(itemNodes.map((el) => el.getBoundingClientRect().height), capacity);
      const pages: PreparedPage[] = items.pages.map((indexes) => ({ kind: "items", items: indexes.flatMap((index) => itemAt(index) ?? []) }));
      if (settings.mode === "selfTest" && prepared.answers.length > 0) {
        const answerNodes = nodes("answer");
        const answerById = new Map(prepared.answers.map((answer) => [answer.id, answer]));
        const room = capacity.continuationPage - height("answers-heading");
        const answers = paginate(answerNodes.map((el) => el.getBoundingClientRect().height), { firstPage: room, continuationPage: room });
        pages.push(...answers.pages.map((indexes): PreparedPage => ({
          kind: "answers", answers: indexes.flatMap((index) => answerById.get(answerNodes[index]?.dataset.itemId ?? "") ?? []),
        })));
      }
      const tooWide = prepared.items.filter((item) => writingLayout(item.cells, settings.mode, settings.density).oversized);
      const oversized = [...new Set([...items.oversized.flatMap((index) => itemAt(index) ?? []), ...tooWide])];
      await mascotReady();
      if (mine !== generation.current) return;
      setCommitted({
        pages, settings, oversized, printed: prepared.items.length, excluded: prepared.excluded.length,
        missingStrokes: settings.mode === "practice" ? missingStrokes(prepared.items, resources) : 0,
      });
      setBusy(false);
    })();
  }, [prepared, settings, resources, fontTick, layoutTick]);

  // Unmount: any in-flight generation becomes stale and commits nothing.
  useEffect(() => () => { generation.current += 1; }, []);

  // Spec §3.5: the content node has a fixed mm height, so its observed height changes only when layout appears or disappears.
  useEffect(() => {
    const content = measureRef.current?.querySelector<HTMLElement>('[data-measure="content"]');
    if (!content || typeof ResizeObserver === "undefined") return;
    let last = content.getBoundingClientRect().height;
    const observer = new ResizeObserver(([entry]) => {
      const next = entry?.contentRect.height ?? last;
      if (next === last) return;
      last = next;
      setLayoutTick((tick) => tick + 1);
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

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

  const update = useCallback(<K extends keyof WorksheetSettings>(key: K, value: WorksheetSettings[K]) => {
    setSettings((current) => {
      const next = { ...current, [key]: value };
      // Spec W §2: self-test always has a prompt; meaning is rule 2's first fallback, so its switch states what prints.
      if (next.mode === "selfTest" && !PROMPT_KEYS.some((prompt) => next[prompt])) next.showMeaning = true;
      return next;
    });
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
  const unresolved = visible.filter((item) => item.resolution === "saved_raw" && selected.has(item.id)).length;
  const blocked = busy || !committed || committed.printed === 0 || committed.oversized.length > 0;
  const download = async () => {
    if (blocked || downloading || !committed) return;
    setDownloading(true);
    // Read at click time from the committed set, never the live selection (spec W §6.3 step 1).
    const pages = committed.pages.map((page) => (page.kind === "items"
      ? { kind: "items" as const, ids: page.items.map((item) => item.id) }
      : { kind: "answers" as const, ids: page.answers.map((answer) => answer.id) }));
    try {
      const response = await fetch("/api/vocab/print/pdf", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId: source.lessonId, set: source.set, locale, settings: committed.settings, pages }),
      });
      if (!response.ok) {
        const key = response.status === 409 ? "pdfChanged" : response.status === 429 || response.status === 503 ? "pdfBusy" : "pdfFailed";
        toast({ title: t(key), variant: "danger" });
        return;
      }
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = pdfFilename(committedLabels.documentName, doc.title);
      anchor.click();
      // revoking synchronously after click() cancels the download in Safari / older Firefox
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      toast({ title: t("pdfFailed"), variant: "danger" });
    } finally {
      setDownloading(false);
    }
  };

  const previewHeight = pageCount * SHEET_PX.height + Math.max(0, pageCount - 1) * SHEET_GAP_PX;
  const enabledPrompts = PROMPT_KEYS.filter((key) => settings[key]);
  const locked = (key: (typeof PROMPT_KEYS)[number]) => settings.mode === "selfTest" && settings[key] && enabledPrompts.length === 1;
  const measureCredit = labels.credit("JMdict · KanjiVG"); // fixed-height line; its text never changes the height

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
          options={[{ value: "practice", label: t("modePractice") }, { value: "selfTest", label: t("modeSelfTest") }]} />
        <fieldset className="space-y-xs">
          <legend className="text-caption font-semibold text-muted-foreground">{settings.mode === "selfTest" ? t("prompts") : t("metadata")}</legend>
          {PROMPT_KEYS.map((key) => (
            <label key={key} className="flex items-center justify-between gap-sm text-body">
              {t(key)}
              <Switch checked={settings[key]} disabled={locked(key)} aria-describedby={locked(key) ? "vp-last-prompt" : undefined}
                onCheckedChange={(checked) => update(key, checked)} />
            </label>
          ))}
          {enabledPrompts.length === 1 && settings.mode === "selfTest" && (
            <p id="vp-last-prompt" className="text-caption text-muted-foreground">{t("lastPrompt")}</p>
          )}
        </fieldset>
        <SegmentedControl aria-label={t("density")} value={settings.density} onValueChange={(value) => update("density", value)}
          options={[{ value: "airy", label: t("densityAiry") }, { value: "compact", label: t("densityCompact") }]} />
        <label className="flex items-center justify-between gap-sm text-body">
          {t("includeKanaOnly")}
          <Switch checked={settings.includeKanaOnly} onCheckedChange={(checked) => update("includeKanaOnly", checked)} />
        </label>
        <div className="space-y-xs">
          <div className="flex items-center justify-between gap-sm">
            <span className="text-caption font-semibold text-muted-foreground">{t("words")}</span>
            <span className="flex gap-xs">
              <Button variant="ghost" size="sm" onClick={() => setSelected(new Set(doc.items.map((item) => item.id)))}>{t("selectAll")}</Button>
              <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>{t("selectNone")}</Button>
            </span>
          </div>
          <ul className="space-y-2xs">
            {visible.map((item) => (
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
          {!committed ? t("preparing") : t("count", { selected: committed.printed, total: visible.length, pages: committed.printed === 0 ? 0 : pageCount })}
        </p>
        {unresolved > 0 && <p className="text-caption text-muted-foreground">{t("unresolved", { count: unresolved })}</p>}
        {committed && committed.missingStrokes > 0 && <p className="text-caption text-muted-foreground">{t("missingStrokes", { count: committed.missingStrokes })}</p>}
        {committed && committed.excluded > 0 && <p className="text-caption text-muted-foreground">{t("noPrompt", { count: committed.excluded })}</p>}
        {committed?.oversized.map((item) => (
          <p key={item.id} role="alert" className="text-caption text-destructive">
            {t("oversized", { word: doc.items.find((candidate) => candidate.id === item.id)?.surface ?? "" })}
          </p>
        ))}
        <div className="sticky bottom-0 mt-auto flex gap-sm bg-background pt-sm">
          <Button className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
            aria-disabled={blocked || downloading || undefined} onClick={() => void download()}>
            {downloading ? t("downloading") : t("download")}
          </Button>
          <Button variant="outline" className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
            aria-disabled={blocked || undefined} onClick={() => { if (!blocked) window.print(); }}>
            {t("print")}
          </Button>
        </div>
      </aside>

      <div ref={previewRef} data-preview="" className="min-w-0">
        {prepared.items.length === 0
          ? <p className="text-body text-muted-foreground">{t("empty")}</p>
          : committed && (
            <div style={{ height: previewHeight * scale }}>
              <div className="origin-top-left" style={{ width: SHEET_PX.width, transform: `scale(${scale})` }}>
                <Worksheet pages={committed.pages} settings={committed.settings} labels={committedLabels} resources={resources} />
              </div>
            </div>
          )}
      </div>

      {/* Spec §3.3: the hidden measurement tree, same components and paper width, never scaled, never printed. */}
      <div ref={measureRef} aria-hidden className={`vp-paper vp-measure${settings.density === "compact" ? " vp-compact" : ""}`} style={paperVars() as CSSProperties}>
        <div data-measure="content" className="vp-measure-content" />
        <div data-measure="first-header"><FirstHeader labels={labels} /></div>
        <div data-measure="continuation-header"><ContinuationHeader labels={labels} /></div>
        <div data-measure="quote"><QuoteBand text={labels.quote(0)} /></div>
        <div data-measure="footer"><FooterBlock labels={labels} page={88} count={88} credit={measureCredit} /></div>
        {prepared.items.map((item) => (
          <div key={item.id} data-measure="item" data-item-id={item.id}>
            {settings.mode === "practice"
              ? <PracticeItem item={item} settings={settings} labels={labels} resources={resources} />
              : <SelfTestItem item={item} settings={settings} labels={labels} />}
          </div>
        ))}
        {settings.mode === "selfTest" && <div data-measure="answers-heading"><AnswersHeading labels={labels} /></div>}
        {settings.mode === "selfTest" && prepared.answers.map((answer) => (
          <div key={answer.id} data-measure="answer" data-item-id={answer.id}><AnswerLine answer={answer} /></div>
        ))}
      </div>

      {portal && createPortal(
        <div data-print-root="">
          {committed && committed.printed > 0 && <Worksheet pages={committed.pages} settings={committed.settings} labels={committedLabels} resources={resources} />}
        </div>,
        portal,
      )}
    </div>
  );
}
