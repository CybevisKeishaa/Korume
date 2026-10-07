import { Link } from "@/lib/i18n/navigation";
import { useTranslations } from "@/lib/i18n";
import { CARD_WARM, EYEBROW, LINK } from "./card-styles";

export function PersonalGoal({ goal }: { goal: string | null }) {
  const t = useTranslations("profile");
  return (
    <section className={CARD_WARM} aria-labelledby="profile-goal">
      <h2 id="profile-goal" className={EYEBROW}>{t("goal.eyebrow")}</h2>
      {goal ? (
        <>
          <blockquote className="mt-sm text-xl leading-relaxed [overflow-wrap:anywhere]">“{goal}”</blockquote>
          <p className="mt-sm text-xs text-muted-foreground">{t("goal.caption")}</p>
        </>
      ) : (
        <>
          <p className="mt-sm text-sm text-muted-foreground">{t("goal.empty")}</p>
          <Link href="/profile/edit" className={`${LINK} mt-xs inline-block`}>{t("goal.emptyCta")}</Link>
        </>
      )}
    </section>
  );
}
