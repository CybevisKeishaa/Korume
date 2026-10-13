import { Link } from "@/lib/i18n/navigation";
import { getTranslations } from "@/lib/i18n/server";
import { notFound } from "next/navigation";
import { getVocabById, getVocabExamples } from "@/lib/data/content";
import { Container } from "@/components/ui/container";
import { VocabExamplesPanel } from "@/components/learning/vocab-examples-panel";

export const dynamic = "force-dynamic";

export default async function VocabDetailPage({ params }: { params: { id: string } }) {
  const t = await getTranslations("vocab");
  const vocab = await getVocabById(params.id);
  if (!vocab) notFound();

  const examples = await getVocabExamples(params.id);

  return (
    <Container className="py-10">
      <Link href="/vocab" className="text-body text-muted-foreground hover:text-foreground">
        {t("backToList")}
      </Link>

      <div className="mt-6">
        <h1 data-type-exempt="vocab-detail-glyph" className="font-jp text-4xl">{vocab.word}</h1>
        {vocab.reading && (
          <p className="font-jp mt-1 text-body-lg text-muted-foreground">{vocab.reading}</p>
        )}
        <p className="mt-2 text-body-lg">{vocab.meaning_en}</p>
        <p className="mt-1 text-body text-muted-foreground">
          {vocab.part_of_speech}
          {vocab.jlpt_level ? ` · ${vocab.jlpt_level}` : ""}
        </p>
      </div>

      <div className="mt-8">
        <VocabExamplesPanel vocabId={vocab.id} initialExamples={examples} level={vocab.jlpt_level ?? undefined} />
      </div>
    </Container>
  );
}
