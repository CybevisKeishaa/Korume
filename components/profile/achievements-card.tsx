import { useTranslations } from "@/lib/i18n";
import type { ProfileView } from "@/lib/profile/view";
import { useBadgeCopy } from "@/components/learning/use-badge-copy";
import { CARD, CHIP, EYEBROW } from "./card-styles";

export function AchievementsCard({ achievements, className }: { achievements: ProfileView["achievements"]; className?: string }) {
  const t = useTranslations("profile");
  const badge = useBadgeCopy();
  return (
    <section className={`${CARD} ${className ?? ""}`} aria-labelledby="profile-achievements">
      <h2 id="profile-achievements" className={EYEBROW}>{t("achievements.title")}</h2>
      {achievements.length === 0 ? (
        <p className="mt-sm text-sm text-muted-foreground">{t("achievements.empty")}</p>
      ) : (
        <ul className="mt-sm flex flex-wrap gap-xs">
          {achievements.map((a) => <li key={a.id} className={CHIP} title={badge.description(a.name) ?? undefined}>{badge.name(a.name)}</li>)}
        </ul>
      )}
    </section>
  );
}
