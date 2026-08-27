import { getTranslations } from "@/lib/i18n/server";

/**
 * The video card's right rail — the sentence currently under study.
 * Split out of `hero-video-card.tsx` per the file-size seam the task 4 brief
 * names (video card vs sentence rail).
 *
 * Ruling 2: the catalog's `hero.sentence.jp` no longer carries the frame's
 * literal space before 静か — that space was a highlight boundary leaking
 * into content, removed in Task 1. The highlight is reconstructed here by
 * deriving the target word from `hero.keyWords.quiet.jp` (its kanji reading
 * lives before the full-width "（"), never by reintroducing a space into the
 * string.
 */
export async function HeroSentenceRail() {
  const t = await getTranslations("marketing");

  const sentence = t("hero.sentence.jp");
  const quietWord = t("hero.keyWords.quiet.jp").split("（")[0] ?? "";
  const splitIndex = sentence.indexOf(quietWord);
  const before = splitIndex >= 0 ? sentence.slice(0, splitIndex) : sentence;
  const after = splitIndex >= 0 ? sentence.slice(splitIndex + quietWord.length) : "";

  return (
    <div className="flex flex-col gap-sm border-border p-md lg:w-companion lg:shrink-0 lg:border-s">
      <div className="flex items-center justify-between text-caption text-muted-foreground">
        <span>{t("hero.sentence.label")}</span>
        <span>{t("hero.sentence.position")}</span>
      </div>

      <p className="font-jp text-body text-foreground">
        {before}
        {splitIndex >= 0 ? (
          <span className="text-primary-strong">{quietWord}</span>
        ) : null}
        {after}
      </p>

      <p className="text-caption text-muted-foreground">{t("hero.sentence.romaji")}</p>
      <p className="text-caption text-foreground">{t("hero.sentence.en")}</p>

      <div>
        <p className="text-caption uppercase tracking-wide text-muted-foreground">
          {t("hero.keyWords.heading")}
        </p>
        <ul className="mt-2xs flex flex-col gap-2xs">
          <li className="text-caption text-foreground">
            <span className="font-jp">{t("hero.keyWords.street.jp")}</span>{" "}
            <span className="text-muted-foreground">· {t("hero.keyWords.street.en")}</span>
          </li>
          <li className="text-caption text-foreground">
            <span className="font-jp">{t("hero.keyWords.quiet.jp")}</span>{" "}
            <span className="text-muted-foreground">· {t("hero.keyWords.quiet.en")}</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
