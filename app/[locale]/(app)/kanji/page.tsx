import { Link } from "@/lib/i18n/navigation";
import { getKanjiList } from "@/lib/data/content";
import { jlptLevelSchema } from "@/lib/validation/content";
import { LevelTabs } from "@/components/learning/level-tabs";
import { Container } from "@/components/ui/container";
import { buttonStyles } from "@/components/ui/button";

export const metadata = { title: "Kanji" };
export const dynamic = "force-dynamic";

export default async function KanjiPage({
  searchParams,
}: {
  searchParams: { level?: string };
}) {
  const level = jlptLevelSchema.safeParse(searchParams.level).data;
  const kanji = await getKanjiList(level);

  return (
    <Container className="py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Kanji</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {kanji.length} character{kanji.length === 1 ? "" : "s"}
            {level ? ` · ${level}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <LevelTabs basePath="/kanji" active={level} />
          <Link
            href={`/kanji/review${level ? `?level=${level}` : ""}`}
            className={buttonStyles({ size: "sm" })}
          >
            Review
          </Link>
        </div>
      </div>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {kanji.map((k) => (
          <li key={k.id}>
            <Link
              href={`/kanji/${k.id}`}
              className="flex h-full flex-col items-center rounded-lg border border-border bg-card p-4 text-center transition-colors hover:border-primary"
            >
              <span className="font-jp text-4xl leading-none">{k.character}</span>
              <span className="mt-2 text-xs text-muted-foreground">
                {k.meaning_en}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {kanji.length === 0 && (
        <p className="text-muted-foreground">No kanji at this level yet.</p>
      )}
    </Container>
  );
}
