import type { Metadata } from "next";
import type { Locale } from "@/lib/i18n";
import { Link } from "@/lib/i18n/navigation";
import { getTranslations } from "@/lib/i18n/server";
import { getVocabList } from "@/lib/data/content";
import { jlptLevelSchema } from "@/lib/validation/content";
import { LevelTabs } from "@/components/learning/level-tabs";
import { Container } from "@/components/ui/container";
import { buttonStyles } from "@/components/ui/button";

export async function generateMetadata({
  params,
}: {
  params: { locale: Locale };
}): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: "vocab" });
  return { title: t("title") };
}
export const dynamic = "force-dynamic";

export default async function VocabPage({
  searchParams,
}: {
  searchParams: { level?: string };
}) {
  const t = await getTranslations("vocab");
  const tCommon = await getTranslations("common");
  const level = jlptLevelSchema.safeParse(searchParams.level).data;
  const vocab = await getVocabList(level);

  return (
    <Container className="py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("subtitleCount", { count: vocab.length })}
            {level ? ` · ${level}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <LevelTabs basePath="/vocab" active={level} />
          <Link
            href={`/vocab/review${level ? `?level=${level}` : ""}`}
            className={buttonStyles({ size: "sm" })}
          >
            {tCommon("actions.review")}
          </Link>
        </div>
      </div>

      <ul className="divide-y divide-border rounded-lg border border-border">
        {vocab.map((v) => (
          <li key={v.id}>
            <Link
              href={`/vocab/${v.id}`}
              className="flex items-baseline justify-between gap-4 p-4 hover:bg-secondary"
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
        <p className="text-muted-foreground">{t("empty")}</p>
      )}
    </Container>
  );
}
