"use client";

import { useEffect, useState } from "react";
import type { LessonVocabularyItem } from "@/lib/analysis/types";
import type { SavedCard } from "@/lib/summary/snapshot";
import type { WordView } from "@/lib/summary/analysis/view";
import { LESSON_WORDS_FETCH, pageOf, wordRows } from "@/lib/summary/word-list";
import { Button } from "@/components/ui/button";
import { useLocale, useTranslations } from "@/lib/i18n";
import { EnglishChip } from "./english-chip";
import { SaveToggle } from "./save-toggle";

const ROW = "grid min-w-0 flex-1 gap-2xs sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,2fr)] sm:items-center sm:gap-md";

/** The list view of "Words worth remembering": the AI's picks, then the lesson's most frequent words, 8 per page. */
export function WordList({ videoId, words, savedCards }: { videoId: string; words: WordView[]; savedCards: SavedCard[] }) {
  const t = useTranslations("shadowing.lessonSummary.words");
  const locale = useLocale();
  const [lessonWords, setLessonWords] = useState<LessonVocabularyItem[] | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [requestedPage, setRequestedPage] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/videos/${videoId}/vocabulary?limit=${LESSON_WORDS_FETCH}`, { signal: controller.signal })
      .then(async (response) => {
        const body: unknown = response.ok ? await response.json() : null;
        const items = (body as { data?: { items?: unknown } } | null)?.data?.items;
        if (!Array.isArray(items)) throw new Error(`lesson vocabulary ${response.status}`);
        setLessonWords(items as LessonVocabularyItem[]);
        setStatus("ready");
      })
      .catch(() => {
        // The AI's picks still list on their own; only the extra lesson words are missing.
        if (!controller.signal.aborted) setStatus("error");
      });
    return () => controller.abort();
  }, [videoId]);

  const { items, page, pageCount } = pageOf(wordRows(words, lessonWords, locale), requestedPage);
  const atStart = page === 0;
  const atEnd = page === pageCount - 1;

  return (
    <div className="space-y-sm">
      <p role="status" aria-live="polite" className="text-caption text-muted-foreground empty:hidden">
        {status === "loading" ? t("listLoading") : status === "error" ? t("listError") : ""}
      </p>
      <div className="rounded-lg border border-border bg-card">
        <div aria-hidden className="flex items-center gap-md border-b border-border px-lg py-xs text-caption font-semibold text-muted-foreground max-sm:hidden">
          <div className={ROW}>
            <span>{t("columnWord")}</span>
            <span>{t("columnReading")}</span>
            <span>{t("columnMeaning")}</span>
          </div>
          <span className="w-8" />
        </div>
        <ul aria-label={t("listLabel")} className="divide-y divide-border">
          {items.map((row) => (
            <li key={row.key} className="flex items-center gap-md px-lg py-sm">
              <div className={ROW}>
                <span lang="ja" className="truncate text-body font-bold">{row.written}</span>
                <span lang="ja" className="truncate text-caption text-muted-foreground">{row.reading}</span>
                <span className="line-clamp-2 text-body sm:line-clamp-1" title={row.meaning}>
                  {row.meaningLocale === "en" && <EnglishChip />}
                  {row.meaning}
                </span>
              </div>
              <SaveToggle sourceKind="vocabulary" lineId={row.lineId} targetWord={row.targetWord} savedCards={savedCards} />
            </li>
          ))}
        </ul>
      </div>
      {pageCount > 1 && (
        <nav aria-label={t("listPages")} className="flex items-center justify-end gap-sm">
          <Button variant="outline" size="sm" aria-disabled={atStart || undefined} onClick={() => !atStart && setRequestedPage(page - 1)}
            className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50">
            {t("previous")}
          </Button>
          <span aria-live="polite" className="text-caption text-muted-foreground">{t("page", { page: page + 1, count: pageCount })}</span>
          <Button variant="outline" size="sm" aria-disabled={atEnd || undefined} onClick={() => !atEnd && setRequestedPage(page + 1)}
            className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50">
            {t("next")}
          </Button>
        </nav>
      )}
    </div>
  );
}
