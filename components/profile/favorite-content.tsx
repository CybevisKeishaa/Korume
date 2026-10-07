import { useTranslations } from "@/lib/i18n";
import { CARD, CHIP, EYEBROW } from "./card-styles";

const KNOWN = ["youtube", "nhk", "podcast", "drama", "anime", "vlog", "news"] as const;
type Known = (typeof KNOWN)[number];
const isKnown = (s: string): s is Known => (KNOWN as readonly string[]).includes(s);

export function FavoriteContent({ sources }: { sources: string[] | null }) {
  const t = useTranslations("profile");
  const known = (sources ?? []).filter(isKnown);
  return (
    <section className={CARD} aria-labelledby="profile-favorite">
      <h2 id="profile-favorite" className={EYEBROW}>{t("favorite.title")}</h2>
      {known.length === 0 ? (
        <p className="mt-sm text-sm text-muted-foreground">{t("favorite.empty")}</p>
      ) : (
        <ul className="mt-sm flex flex-wrap gap-xs">
          {known.map((s) => <li key={s} className={CHIP}>{t(`favorite.source.${s}`)}</li>)}
        </ul>
      )}
    </section>
  );
}
