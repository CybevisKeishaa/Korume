"use client";
import { useTranslations } from "@/lib/i18n";
import { quoteKey } from "@/lib/vocabulary/print/quotes";
import type { WorksheetSettings } from "@/lib/vocabulary/print/settings";

export interface SheetLabels {
  wordmark: string;
  documentName: string;
  title: string;
  footer: string;
  englishMeaning: string;
  strokeOrder: string;
  answers: string;
  pageNumber: (page: number, count: number) => string;
  quote: (pageIndex: number) => string;
  credit: (sources: string) => string;
}

/** Client-only: the labels hold functions, so they are built where they are used, never passed across RSC. */
export function useSheetLabels(mode: WorksheetSettings["mode"], title: string): SheetLabels {
  const t = useTranslations("vocab.print");
  const documentName = mode === "practice" ? t("docPractice") : t("docSelfTest");
  return {
    wordmark: t("wordmark"), documentName, title, footer: t("footer", { document: documentName }),
    englishMeaning: t("englishMeaning"), strokeOrder: t("strokeOrder"), answers: t("answers"),
    pageNumber: (page, count) => t("pageNumber", { page, count }),
    quote: (pageIndex) => t(quoteKey(pageIndex) as Parameters<typeof t>[0]),
    credit: (sources) => t("credit", { sources }),
  };
}
