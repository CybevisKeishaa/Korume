import { Link, redirect } from "@/lib/i18n/navigation";
import { getLocale, getTranslations } from "@/lib/i18n/server";
import { notFound } from "next/navigation";
import { getKanjiById } from "@/lib/data/content";
import { getKanjiData } from "@/lib/dictionary/kanji-data-service";
import { parseKanjiLiteral } from "@/lib/dictionary/literal";
import { StrokeOrder } from "@/components/motion/stroke-order";
import { DictionaryAttribution } from "@/components/kanji/dictionary-attribution";
import { Container } from "@/components/ui/container";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The canonical kanji URL is the literal (`/kanji/緑`, spec §6.5). A legacy curated UUID redirects to it, and
 * a kanji that is only in the dictionary still gets a page, so no "View full details" link is ever dead.
 */
export default async function KanjiDetailPage({ params }: { params: { id: string } }) {
  if (UUID.test(params.id)) {
    const curated = await getKanjiById(params.id);
    if (!curated) notFound();
    redirect({ href: `/kanji/${encodeURIComponent(curated.character)}`, locale: await getLocale() });
  }

  const literal = parseKanjiLiteral(params.id);
  if (!literal) notFound();
  const kanji = await getKanjiData(literal, { commonWords: 10 });
  if (!kanji) notFound();
  const t = await getTranslations("kanji");

  return (
    <Container className="py-10">
      <Link href="/kanji" className="text-sm text-muted-foreground hover:text-foreground">
        {t("backToList")}
      </Link>

      <div className="mt-6 grid gap-8 md:grid-cols-[240px_1fr]">
        <div className="w-full max-w-[240px]">
          <StrokeOrder character={kanji.literal} paths={kanji.strokePaths} />
          <p className="mt-2 text-center text-xs text-muted-foreground">
            {t("strokeCount", { count: kanji.strokeCount })}
            {kanji.jlpt ? ` · ${kanji.jlpt}` : ""}
            {kanji.grade !== null ? ` · ${t("grade", { grade: kanji.grade })}` : ""}
            {kanji.frequency !== null ? ` · ${t("frequency", { rank: kanji.frequency })}` : ""}
          </p>
        </div>

        <div>
          <h1 className="font-jp text-5xl leading-none">{kanji.literal}</h1>
          <p className="mt-3 text-lg">
            {kanji.meaningsEn.join(", ")}
            {kanji.meaningVi && <span className="text-muted-foreground"> · {kanji.meaningVi}</span>}
          </p>

          <dl className="mt-6 space-y-2 text-sm">
            <div className="flex gap-3">
              <dt className="w-16 shrink-0 text-muted-foreground">{t("onReading")}</dt>
              <dd className="font-jp">{kanji.onReadings.length ? kanji.onReadings.join("、") : "—"}</dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-16 shrink-0 text-muted-foreground">{t("kunReading")}</dt>
              <dd className="font-jp">{kanji.kunReadings.length ? kanji.kunReadings.join("、") : "—"}</dd>
            </div>
          </dl>

          {kanji.mnemonic && (
            <div className="mt-6 rounded-lg bg-muted p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("mnemonic")}</p>
              <p className="mt-1 text-sm">{kanji.mnemonic}</p>
            </div>
          )}

          {kanji.commonWords.length > 0 && (
            <section className="mt-6">
              <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("commonWords")}</h2>
              <ul className="mt-2 space-y-1 text-sm">
                {kanji.commonWords.map((word) => (
                  <li key={word.entSeq} className="flex flex-wrap gap-x-3">
                    <span className="font-jp">{word.headword}</span>
                    <span className="font-jp text-muted-foreground">{word.reading}</span>
                    <span>{word.glossEn}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="mt-8">
            <DictionaryAttribution label={t("dictionarySources")} attribution={kanji.attribution} />
          </div>
        </div>
      </div>
    </Container>
  );
}
