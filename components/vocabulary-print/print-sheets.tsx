/* eslint-disable @next/next/no-img-element -- print needs a plain, eagerly decoded <img> at a fixed mm box; next/image adds lazy loading and wrappers. */
import type { CSSProperties } from "react";
import { MASCOT_SRC } from "@/lib/vocabulary/print/mascot";
import { paperVars } from "@/lib/vocabulary/print/paper";
import type { PrintSettings } from "@/lib/vocabulary/print/settings";
import type { VocabularyPrintItem } from "@/lib/vocabulary/print/source";

/** Spec §4.1: presentational only — rendered twice (preview and print root), so no ids, controls or ARIA references. */
export interface SheetLabels {
  wordmark: string;
  documentName: string;
  title: string;
  footer: string;
  pageNumber: (page: number, count: number) => string;
  englishMeaning: string;
}

export function PrintItem({ item, settings, englishMeaning }: { item: VocabularyPrintItem; settings: PrintSettings; englishMeaning: string }) {
  const hide = settings.mode === "selfTest" ? settings.hide : null;
  return (
    <div className="vp-item">
      <div>
        <span lang="ja" className="vp-word">{item.surface}</span>
        {hide === "reading"
          ? <span className="vp-blank-inline" />
          : settings.showReading && item.reading && <span lang="ja" className="vp-reading">{item.reading}</span>}
      </div>
      {hide === "meaning"
        ? <div className="vp-blank" />
        : settings.showMeaning && item.meaning && (
          <div className="vp-meaning">
            {item.meaning}
            {item.meaningLocale === "en" && <span className="vp-chip">{englishMeaning}</span>}
          </div>
        )}
      {settings.showExample && item.example && <div lang="ja" className="vp-example">{item.example.text}</div>}
    </div>
  );
}

export function FirstHeader({ labels }: { labels: SheetLabels }) {
  return (
    <div className="vp-head-first">
      <img src={MASCOT_SRC} alt="" className="vp-mascot" />
      <div>
        <div className="vp-wordmark">{labels.wordmark}</div>
        <div className="vp-docname">{labels.documentName}</div>
        <div lang="ja" className="vp-title">{labels.title}</div>
      </div>
    </div>
  );
}

export function ContinuationHeader({ labels }: { labels: SheetLabels }) {
  return (
    <div className="vp-head-cont">
      <span className="vp-wordmark">{labels.wordmark}</span>
      <span lang="ja" className="vp-title">{labels.title}</span>
    </div>
  );
}

export function Footer({ labels, page, count }: { labels: SheetLabels; page: number; count: number }) {
  return (
    <div className="vp-foot">
      <span>{labels.footer}</span>
      <img src={MASCOT_SRC} alt="" className="vp-foot-mark" />
      <span>{labels.pageNumber(page, count)}</span>
    </div>
  );
}

export function PrintSheets({ pages, settings, labels }: { pages: VocabularyPrintItem[][]; settings: PrintSettings; labels: SheetLabels }) {
  return (
    <div className={`vp-paper${settings.density === "compact" ? " vp-compact" : ""}`} style={paperVars() as CSSProperties}>
      {pages.map((items, index) => (
        <section key={index} className="vp-sheet">
          {index === 0 ? <FirstHeader labels={labels} /> : <ContinuationHeader labels={labels} />}
          <div className="vp-body">
            {items.map((item) => <PrintItem key={item.id} item={item} settings={settings} englishMeaning={labels.englishMeaning} />)}
          </div>
          <Footer labels={labels} page={index + 1} count={pages.length} />
        </section>
      ))}
    </div>
  );
}
