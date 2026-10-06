import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { Container } from "@/components/ui/container";
import { PrintWorkspace } from "@/components/vocabulary-print/print-workspace";
import type { Locale } from "@/lib/i18n";
import { getTranslations } from "@/lib/i18n/server";
import { loadPrintDocument } from "@/lib/vocabulary/print/load";
import { parsePrintQuery, type PrintSource } from "@/lib/vocabulary/print/source";

export const dynamic = "force-dynamic";

type Props = { params: { locale: Locale }; searchParams: Record<string, string | string[] | undefined> };

/** One parse per request, so `loadPrintDocument`'s cache sees the same source object from metadata and page. */
const sourceOf = cache((query: string): PrintSource | null => {
  const params = new URLSearchParams(query);
  // A repeated key is ambiguous; Object.fromEntries would silently keep the last one.
  if (["source", "lesson", "set"].some((key) => params.getAll(key).length > 1)) return null;
  return parsePrintQuery(Object.fromEntries(params));
});
const queryOf = (searchParams: Props["searchParams"]) =>
  new URLSearchParams(Object.entries(searchParams).flatMap(([key, value]) => (Array.isArray(value) ? value.map((v) => [key, v]) : value === undefined ? [] : [[key, value]]))).toString();

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const source = sourceOf(queryOf(searchParams));
  if (!source) return {};
  const result = await loadPrintDocument(source, params.locale);
  if (result.kind !== "ok") return {};
  const t = await getTranslations({ locale: params.locale, namespace: "vocab.print" });
  return { title: t("pageTitle", { title: result.doc.title }) };
}

/** Spec §2.1: never reveals whether a lesson exists — unreadable and missing are the same 404. */
export default async function VocabularyPrintPage({ params, searchParams }: Props) {
  const source = sourceOf(queryOf(searchParams));
  if (!source) notFound();
  const result = await loadPrintDocument(source, params.locale);
  if (result.kind !== "ok") notFound();
  const t = await getTranslations({ locale: params.locale, namespace: "vocab.print" });
  const href = (set: "all" | "saved") => `/vocab/print?source=lesson&lesson=${source.lessonId}&set=${set}`;
  return (
    <Container>
      {/* key: All↔Saved is a search-param navigation that keeps the client component mounted; remount drops the old selection. */}
      <PrintWorkspace key={source.set} doc={result.doc} views={[
        { label: t("setAll"), href: href("all"), current: source.set === "all" },
        { label: t("setSaved"), href: href("saved"), current: source.set === "saved" },
      ]} />
    </Container>
  );
}
