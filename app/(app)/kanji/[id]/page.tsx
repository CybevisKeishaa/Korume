import Link from "next/link";
import { notFound } from "next/navigation";
import { getKanjiById } from "@/lib/data/content";
import { StrokeOrder } from "@/components/motion/stroke-order";
import { Container } from "@/components/ui/container";

export const dynamic = "force-dynamic";

export default async function KanjiDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const kanji = await getKanjiById(params.id);
  if (!kanji) notFound();

  const on = kanji.kanji_readings.filter((r) => r.reading_type === "on");
  const kun = kanji.kanji_readings.filter((r) => r.reading_type === "kun");

  return (
    <Container className="py-10">
      <Link
        href="/kanji"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← All kanji
      </Link>

      <div className="mt-6 grid gap-8 md:grid-cols-[240px_1fr]">
        <div className="w-full max-w-[240px]">
          <StrokeOrder character={kanji.character} />
          <p className="mt-2 text-center text-xs text-muted-foreground">
            {kanji.stroke_count} stroke{kanji.stroke_count === 1 ? "" : "s"}
            {kanji.jlpt_level ? ` · ${kanji.jlpt_level}` : ""}
          </p>
        </div>

        <div>
          <h1 className="font-jp text-5xl leading-none">{kanji.character}</h1>
          <p className="mt-3 text-lg">
            {kanji.meaning_en}
            {kanji.meaning_vi && (
              <span className="text-muted-foreground"> · {kanji.meaning_vi}</span>
            )}
          </p>

          <dl className="mt-6 space-y-2 text-sm">
            <div className="flex gap-3">
              <dt className="w-16 shrink-0 text-muted-foreground">On</dt>
              <dd className="font-jp">
                {on.length ? on.map((r) => r.reading).join("、") : "—"}
              </dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-16 shrink-0 text-muted-foreground">Kun</dt>
              <dd className="font-jp">
                {kun.length ? kun.map((r) => r.reading).join("、") : "—"}
              </dd>
            </div>
          </dl>

          {kanji.mnemonic_text && (
            <div className="mt-6 rounded-lg bg-muted p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Mnemonic
              </p>
              <p className="mt-1 text-sm">{kanji.mnemonic_text}</p>
            </div>
          )}
        </div>
      </div>
    </Container>
  );
}
