import type { Metadata } from "next";
import type { Locale } from "@/lib/i18n";
import { getTranslations } from "@/lib/i18n/server";
import { getGrammarList } from "@/lib/data/content";
import { jlptLevelSchema } from "@/lib/validation/content";
import { LevelTabs } from "@/components/learning/level-tabs";
import { Container } from "@/components/ui/container";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export async function generateMetadata({
  params,
}: {
  params: { locale: Locale };
}): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: "grammar" });
  return { title: t("title") };
}
export const dynamic = "force-dynamic";

export default async function GrammarPage({
  searchParams,
}: {
  searchParams: { level?: string };
}) {
  const t = await getTranslations("grammar");
  const level = jlptLevelSchema.safeParse(searchParams.level).data;
  const grammar = await getGrammarList(level);

  return (
    <Container className="py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("subtitleCount", { count: grammar.length })}
            {level ? ` · ${level}` : ""}
          </p>
        </div>
        <LevelTabs basePath="/grammar" active={level} />
      </div>

      <div className="space-y-4">
        {grammar.map((g) => (
          <Card key={g.id}>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <CardTitle className="font-jp">{g.title}</CardTitle>
                {g.jlpt_level && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {g.jlpt_level}
                  </span>
                )}
              </div>
              {g.structure_pattern && (
                <p className="font-jp text-sm text-primary-strong">{g.structure_pattern}</p>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm">{g.explanation}</p>
              {g.example_sentences?.length > 0 && (
                <ul className="space-y-1 border-l-2 border-border pl-3">
                  {g.example_sentences.map((ex, i) => (
                    <li key={i} className="text-sm">
                      <span className="font-jp">{ex.jp}</span>
                      <span className="ml-2 text-muted-foreground">{ex.en}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {grammar.length === 0 && (
        <p className="text-muted-foreground">{t("empty")}</p>
      )}
    </Container>
  );
}
