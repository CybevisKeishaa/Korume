"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslations } from "@/lib/i18n";
import type { AnalysisResponse, CultureView, ExpressionView, GrammarView, WordView } from "@/lib/summary/analysis/view";
import type { SavedCard } from "@/lib/summary/snapshot";
import { areaProps } from "./area";
import { SaveToggle } from "./save-toggle";
import { SectionHeading } from "./section-heading";

type Kind = "words" | "expressions" | "grammar" | "culture";

/** Skeleton per block, sized like the frame's cards so the page does not jump when content lands. */
const SKELETON: Record<Kind, { count: number; grid: string; height: string }> = {
  words: { count: 3, grid: "grid gap-md sm:grid-cols-3", height: "h-44" },
  expressions: { count: 3, grid: "space-y-sm", height: "h-20" },
  grammar: { count: 2, grid: "grid gap-md sm:grid-cols-2", height: "h-48" },
  culture: { count: 2, grid: "grid gap-md sm:grid-cols-2", height: "h-36" },
};

/** Spec §7.2/§7.4: the four AI blocks and their pending, unavailable, retryable, empty and no-transcript states. */
export function AnalysisBlocks({ response, onRetry, savedCards }: {
  response: AnalysisResponse | null;
  onRetry: () => void;
  savedCards: SavedCard[];
}) {
  const t = useTranslations("shadowing.lessonSummary");
  const data = response?.status === "ready" ? response.data : null;

  const state = (kind: Kind): ReactNode => {
    switch (response?.status) {
      case "unavailable": return <p className="text-body text-muted-foreground">{t("ai.unavailable")}</p>;
      case "no_transcript": return <p className="text-body text-muted-foreground">{t("ai.noTranscript")}</p>;
      case "retryable_error":
        return (
          <div className="flex flex-wrap items-center gap-sm">
            <p className="text-body text-muted-foreground">{t("ai.retryableError")}</p>
            <RetryButton retryAfter={response.retryAfter} onRetry={onRetry} />
          </div>
        );
      default: {
        const skeleton = SKELETON[kind];
        return (
          <div aria-busy="true" className={skeleton.grid}>
            <span className="sr-only">{t("ai.generating")}</span>
            {Array.from({ length: skeleton.count }, (_, index) => <Skeleton key={index} className={`${skeleton.height} rounded-lg`} />)}
          </div>
        );
      }
    }
  };

  const block = (kind: Kind, content: ReactNode, subtitle = false) => (
    <section {...areaProps(kind)} aria-labelledby={`summary-${kind}-title`} className="space-y-md">
      <SectionHeading
        id={`summary-${kind}-title`}
        eyebrow={t(`${kind}.eyebrow`)}
        title={t(`${kind}.title`)}
        subtitle={subtitle ? t(`${kind}.subtitle` as "words.subtitle") : undefined}
      />
      {content}
    </section>
  );

  return (
    <>
      {block("words", data ? <Words words={data.words} savedCards={savedCards} /> : state("words"), true)}
      {block("expressions", data ? <Expressions items={data.expressions} savedCards={savedCards} /> : state("expressions"), true)}
      {block("grammar", data ? <Grammar items={data.grammar} /> : state("grammar"))}
      {block("culture", data
        ? data.culture.length > 0 ? <Culture items={data.culture} /> : <p className="text-body text-muted-foreground">{t("ai.empty")}</p>
        : state("culture"))}
    </>
  );
}

/** `aria-disabled` + a no-op handler until `retryAfter` passes, so focus is never lost (never `disabled`). */
function RetryButton({ retryAfter, onRetry }: { retryAfter: string; onRetry: () => void }) {
  const t = useTranslations("shadowing.lessonSummary.ai");
  const deadline = Date.parse(retryAfter);
  const [open, setOpen] = useState(() => Number.isNaN(deadline) || Date.now() >= deadline);
  useEffect(() => {
    if (Number.isNaN(deadline) || Date.now() >= deadline) {
      setOpen(true);
      return;
    }
    setOpen(false);
    const timer = setTimeout(() => setOpen(true), deadline - Date.now());
    return () => clearTimeout(timer);
  }, [deadline]);
  return (
    <Button
      variant="outline"
      size="sm"
      aria-disabled={open ? undefined : true}
      className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
      onClick={() => {
        if (open) onRetry();
      }}
    >
      {t("retry")}
    </Button>
  );
}

function Words({ words, savedCards }: { words: WordView[]; savedCards: SavedCard[] }) {
  const t = useTranslations("shadowing.lessonSummary");
  return (
    <ul className="grid gap-md sm:grid-cols-3">
      {words.map((word) => (
        <li key={`${word.entSeq}-${word.source.lineId}`}>
          <Card className="flex h-full flex-col gap-sm p-lg">
            <div className="flex items-start justify-between gap-sm">
              <div className="min-w-0 space-y-2xs">
                <p lang="ja" className="text-heading-lg font-bold">{word.written}</p>
                <p lang="ja" className="text-caption text-muted-foreground">{word.reading}</p>
              </div>
              <SaveToggle sourceKind="vocabulary" lineId={word.source.lineId} targetWord={word.surface} savedCards={savedCards} />
            </div>
            <p className="text-body">{word.meaning}</p>
            <div className="flex items-center justify-between gap-sm">
              {word.common ? <Badge variant="primary">{t("words.common")}</Badge> : <span />}
              <span className="text-caption text-muted-foreground">{t(`pos.${word.posKey}`)}</span>
            </div>
            <p lang="ja" className="mt-auto border-t border-border pt-sm text-caption text-muted-foreground">{word.source.textJp}</p>
          </Card>
        </li>
      ))}
    </ul>
  );
}

function Expressions({ items, savedCards }: { items: ExpressionView[]; savedCards: SavedCard[] }) {
  const t = useTranslations("shadowing.lessonSummary.expressions");
  return (
    <ul className="space-y-sm">
      {items.map((item) => (
        <li key={`${item.expression}-${item.source.lineId}`}>
          <Card className="grid gap-md p-lg sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <div className="flex items-start justify-between gap-sm">
              <div className="space-y-xs">
                <p lang="ja" className="text-heading font-bold">{item.expression}</p>
                <Badge variant="primary">{t(`commonness.${item.commonness}`)}</Badge>
              </div>
              <SaveToggle sourceKind="expression" lineId={item.source.lineId} targetWord={item.expression} savedCards={savedCards} />
            </div>
            <Labeled label={t("meaningUse")}>{item.meaningUse}</Labeled>
            <Labeled label={t("nuance")}>{item.nuance}</Labeled>
          </Card>
        </li>
      ))}
    </ul>
  );
}

function Grammar({ items }: { items: GrammarView[] }) {
  const t = useTranslations("shadowing.lessonSummary.grammar");
  return (
    <ul className="grid gap-md sm:grid-cols-2">
      {items.map((item) => (
        <li key={item.grammarId}>
          <Card className="flex h-full flex-col gap-sm p-lg">
            <div className="flex items-start justify-between gap-sm">
              <p lang="ja" className="text-heading font-bold">{item.title}</p>
              {item.jlpt && <Badge variant="primary">{item.jlpt}</Badge>}
            </div>
            <p className="text-body">{item.meaningShort}</p>
            <p className="text-body text-muted-foreground">{item.explanation}</p>
            <div className="mt-auto space-y-sm border-t border-border pt-sm">
              <Labeled label={t("fromLesson")} lang="ja">{item.source.textJp}</Labeled>
              <Labeled label={t("tryIt")} lang="ja" description={t("practiceLabel")}>{item.tryIt}</Labeled>
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}

function Culture({ items }: { items: CultureView[] }) {
  return (
    <ul className="grid gap-md sm:grid-cols-2">
      {items.map((item) => (
        <li key={`${item.title}-${item.source.lineId}`}>
          <Card className="h-full space-y-sm p-lg">
            <h3 className="text-body-lg font-semibold">{item.title}</h3>
            <p className="text-body text-muted-foreground">{item.body}</p>
          </Card>
        </li>
      ))}
    </ul>
  );
}

/** A small caption label over one value; `description` is screen-reader text (e.g. "practice example"). */
function Labeled({ label, children, lang, description }: { label: string; children: ReactNode; lang?: string; description?: string }) {
  return (
    <div className="space-y-2xs">
      <p className="text-caption font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
        {description && <span className="sr-only"> — {description}</span>}
      </p>
      <p lang={lang} className="text-body">{children}</p>
    </div>
  );
}
