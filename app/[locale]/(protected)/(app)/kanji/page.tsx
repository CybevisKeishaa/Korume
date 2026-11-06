import type { Metadata } from "next";
import { AppFooter } from "@/components/layout/app-footer";
import type { Locale } from "@/lib/i18n";
import { Link } from "@/lib/i18n/navigation";
import { getTranslations } from "@/lib/i18n/server";
import { getKanjiList } from "@/lib/data/content";
import { listKanjiFavorites } from "@/lib/data/kanji-learner";
import { jlptLevelSchema } from "@/lib/validation/content";
import { LevelTabs } from "@/components/learning/level-tabs";
import { Container } from "@/components/ui/container";
import { buttonStyles } from "@/components/ui/button";
import { kanjiModalHref } from "@/lib/kanji/href";
import { formatKanjiContext } from "@/lib/kanji/context";

export async function generateMetadata({
  params,
}: {
  params: { locale: Locale };
}): Promise<Metadata> {
  const t = await getTranslations({ locale: params.locale, namespace: "kanji" });
  return { title: t("title") };
}
export const dynamic = "force-dynamic";

export default async function KanjiPage({
  searchParams,
}: {
  searchParams: { level?: string };
}) {
  const t = await getTranslations("kanji");
  const tCommon = await getTranslations("common");
  const level = jlptLevelSchema.safeParse(searchParams.level).data;
  // The favorites strip is extra: its failure hides the strip, not the list.
  const [kanji, favorites] = await Promise.all([getKanjiList(level), listKanjiFavorites().catch(() => [])]);
  const search = level ? `level=${level}` : "";
  // A glyph opens the inspect modal over this list; with a level, ‹ › walk that level (spec §5.1).
  const from = level ? formatKanjiContext({ kind: "level", level }) : undefined;

  return (
    <>
    <Container className="py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-title font-bold">{t("title")}</h1>
          <p className="mt-1 text-body text-muted-foreground">
            {t("subtitleCount", { count: kanji.length })}
            {level ? ` · ${level}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <LevelTabs basePath="/kanji" active={level} />
          <Link
            href={`/kanji/review${level ? `?level=${level}` : ""}`}
            className={buttonStyles({ size: "sm" })}
          >
            {tCommon("actions.review")}
          </Link>
        </div>
      </div>

      {favorites.length > 0 && (
        <section aria-labelledby="kanji-saved" className="mb-6">
          <h2 id="kanji-saved" className="text-caption font-medium text-muted-foreground">{t("saved")}</h2>
          <ul className="mt-xs flex flex-wrap gap-xs">
            {favorites.map((favorite) => (
              <li key={favorite.literal}>
                {/* Opens the modal with ‹ › walking the saved list, newest first (spec §4.4). */}
                <Link
                  href={kanjiModalHref("/kanji", search, favorite.literal, formatKanjiContext({ kind: "favorites" }))}
                  scroll={false}
                  className="flex items-center gap-xs rounded-md border border-border bg-card px-sm py-2xs transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span lang="ja" className="font-jp text-heading font-bold">{favorite.literal}</span>
                  {favorite.hanViet.length > 0 && <span className="text-caption text-muted-foreground">{favorite.hanViet.join(", ")}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {kanji.map((k) => (
          <li key={k.id}>
            <Link
              href={kanjiModalHref("/kanji", search, k.character, from)}
              scroll={false}
              className="flex h-full flex-col items-center rounded-lg border border-border bg-card p-4 text-center transition-colors hover:border-primary"
            >
              <span className="font-jp text-display">{k.character}</span>
              <span className="mt-2 text-caption text-muted-foreground">
                {k.meaning_en}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {kanji.length === 0 && (
        <p className="text-muted-foreground">{t("empty")}</p>
      )}
    </Container>
    <AppFooter />
    </>
  );
}
