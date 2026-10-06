/* eslint-disable @next/next/no-img-element -- print needs plain, eagerly decoded <img> in fixed mm boxes. */
import type { CSSProperties } from "react";
import { MASCOT_SRC, WATERMARK_SRC } from "@/lib/vocabulary/print/mascot";
import { paperVars } from "@/lib/vocabulary/print/paper";
import type { AnswerRow, PreparedItem, PreparedPage } from "@/lib/vocabulary/print/prepare";
import type { WorksheetSettings } from "@/lib/vocabulary/print/settings";
import type { PrintResources } from "@/lib/vocabulary/print/source";
import type { SheetLabels } from "./labels";
import { StrokeGuideRow } from "./stroke-guide";
import { WritingRows } from "./writing-cells";

/** Presentational only (spec §4.1): rendered in the preview, the print root, the measurement tree and the PDF page. */

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

export function QuoteBand({ text }: { text: string }) {
  return <div className="vp-quote">{`“${text}”`}</div>;
}

export function FooterBlock({ labels, page, count, credit }: { labels: SheetLabels; page: number; count: number; credit: string }) {
  return (
    <div className="vp-foot-block">
      <div className="vp-foot">
        <span>{labels.footer}</span>
        <span>{labels.pageNumber(page, count)}</span>
      </div>
      <div className="vp-credit">{credit}</div>
    </div>
  );
}

function Meaning({ item, labels }: { item: PreparedItem; labels: SheetLabels }) {
  if (!item.meaning) return null;
  return (
    <span className="vp-meaning">
      {item.meaningLocale === "en" && <span className="vp-chip">{labels.englishMeaning}</span>}
      {item.meaning}
    </span>
  );
}

export function PracticeItem({ item, settings, labels, resources }: { item: PreparedItem; settings: WorksheetSettings; labels: SheetLabels; resources: PrintResources }) {
  return (
    <div className="vp-item" data-item-id={item.id}>
      <div className="vp-meta">
        <span lang="ja" className="vp-word">{item.target}</span>
        {item.reading && <span lang="ja" className="vp-reading">{item.reading}</span>}
        <Meaning item={item} labels={labels} />
      </div>
      <StrokeGuideRow glyphs={item.glyphs ?? []} guides={resources.strokeGuides} label={labels.strokeOrder} />
      <WritingRows cells={item.cells} model={item.glyphs ?? null} mode="practice" density={settings.density} />
      {item.example && <div lang="ja" className="vp-example">{item.example}</div>}
    </div>
  );
}

export function SelfTestItem({ item, settings, labels }: { item: PreparedItem; settings: WorksheetSettings; labels: SheetLabels }) {
  return (
    <div className="vp-item" data-item-id={item.id}>
      <div className="vp-meta">
        <span className="vp-number">{`${item.number}.`}</span>
        {item.reading && <span lang="ja" className="vp-reading vp-prompt">{item.reading}</span>}
        <Meaning item={item} labels={labels} />
      </div>
      <WritingRows cells={item.cells} model={null} mode="selfTest" density={settings.density} />
      {item.example && <div lang="ja" className="vp-example">{item.example}</div>}
    </div>
  );
}

export function AnswersHeading({ labels }: { labels: SheetLabels }) {
  return <div className="vp-answers-title">{labels.answers}</div>;
}

export function AnswerLine({ answer }: { answer: AnswerRow }) {
  return (
    <div className="vp-answer" data-item-id={answer.id}>
      <span className="vp-number">{`${answer.number}.`}</span>
      <span lang="ja" className="vp-answer-target">{answer.target}</span>
      {answer.reading && <span lang="ja" className="vp-reading">{answer.reading}</span>}
    </div>
  );
}

function creditFor(page: PreparedPage, settings: WorksheetSettings, resources: PrintResources, labels: SheetLabels): string {
  const strokes = page.kind === "items" && settings.mode === "practice";
  const sources = [resources.credits.jmdict, strokes ? resources.credits.kanjivg : null].filter(Boolean);
  return sources.length > 0 ? labels.credit(sources.join(" · ")) : "";
}

export function Worksheet({ pages, settings, labels, resources }: { pages: PreparedPage[]; settings: WorksheetSettings; labels: SheetLabels; resources: PrintResources }) {
  return (
    <div className={`vp-paper${settings.density === "compact" ? " vp-compact" : ""}`} style={paperVars() as CSSProperties}>
      {pages.map((page, index) => (
        <section key={index} className="vp-sheet">
          <div className="vp-watermark" aria-hidden="true">
            <img src={WATERMARK_SRC} alt="" />
            <span>{labels.wordmark}</span>
          </div>
          {index === 0 ? <FirstHeader labels={labels} /> : <ContinuationHeader labels={labels} />}
          <div className="vp-body">
            {page.kind === "items"
              ? page.items.map((item) => settings.mode === "practice"
                ? <PracticeItem key={item.id} item={item} settings={settings} labels={labels} resources={resources} />
                : <SelfTestItem key={item.id} item={item} settings={settings} labels={labels} />)
              : <><AnswersHeading labels={labels} />{page.answers.map((answer) => <AnswerLine key={answer.id} answer={answer} />)}</>}
          </div>
          <QuoteBand text={labels.quote(index)} />
          <FooterBlock labels={labels} page={index + 1} count={pages.length} credit={creditFor(page, settings, resources, labels)} />
        </section>
      ))}
    </div>
  );
}
