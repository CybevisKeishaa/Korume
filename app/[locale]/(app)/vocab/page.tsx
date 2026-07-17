import { Link } from "@/lib/i18n/navigation";
import { getVocabList } from "@/lib/data/content";
import { jlptLevelSchema } from "@/lib/validation/content";
import { LevelTabs } from "@/components/learning/level-tabs";
import { Container } from "@/components/ui/container";
import { buttonStyles } from "@/components/ui/button";

export const metadata = { title: "Vocab" };
export const dynamic = "force-dynamic";

export default async function VocabPage({
  searchParams,
}: {
  searchParams: { level?: string };
}) {
  const level = jlptLevelSchema.safeParse(searchParams.level).data;
  const vocab = await getVocabList(level);

  return (
    <Container className="py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Vocabulary</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {vocab.length} word{vocab.length === 1 ? "" : "s"}
            {level ? ` · ${level}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <LevelTabs basePath="/vocab" active={level} />
          <Link
            href={`/vocab/review${level ? `?level=${level}` : ""}`}
            className={buttonStyles({ size: "sm" })}
          >
            Review
          </Link>
        </div>
      </div>

      <ul className="divide-y divide-border rounded-lg border border-border">
        {vocab.map((v) => (
          <li key={v.id}>
            <Link
              href={`/vocab/${v.id}`}
              className="flex items-baseline justify-between gap-4 p-4 hover:bg-muted"
            >
              <div>
                <span className="font-jp text-lg">{v.word}</span>
                {v.reading && (
                  <span className="ml-2 font-jp text-sm text-muted-foreground">
                    {v.reading}
                  </span>
                )}
                <p className="text-sm text-muted-foreground">{v.meaning_en}</p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">
                {v.part_of_speech}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {vocab.length === 0 && (
        <p className="text-muted-foreground">No vocabulary at this level yet.</p>
      )}
    </Container>
  );
}
