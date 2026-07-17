import { Link } from "@/lib/i18n/navigation";
import { notFound } from "next/navigation";
import { getVocabById, getVocabExamples } from "@/lib/data/content";
import { Container } from "@/components/ui/container";
import { VocabExamplesPanel } from "@/components/learning/vocab-examples-panel";

export const dynamic = "force-dynamic";

export default async function VocabDetailPage({ params }: { params: { id: string } }) {
  const vocab = await getVocabById(params.id);
  if (!vocab) notFound();

  const examples = await getVocabExamples(params.id);

  return (
    <Container className="py-10">
      <Link href="/vocab" className="text-sm text-muted-foreground hover:text-foreground">
        ← All vocabulary
      </Link>

      <div className="mt-6">
        <h1 className="font-jp text-4xl">{vocab.word}</h1>
        {vocab.reading && (
          <p className="font-jp mt-1 text-lg text-muted-foreground">{vocab.reading}</p>
        )}
        <p className="mt-2 text-lg">{vocab.meaning_en}</p>
        <p className="mt-1 text-sm text-muted-foreground">
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
