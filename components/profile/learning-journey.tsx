import { Link } from "@/lib/i18n/navigation";
import { useFormatter, useTranslations } from "@/lib/i18n";
import type { MilestoneKind, ProfileView } from "@/lib/profile/view";
import { CARD, EYEBROW, LINK } from "./card-styles";

const KIND_SET = {
  first_activity: true, first_video_completed: true, first_mastered_word: true, first_certification_passed: true,
  badge_earned: true, first_meeting: true, first_shadow: true, jlpt_passed: true, pinned_line: true,
} satisfies Record<MilestoneKind, true>;
const isKnownKind = (k: string): k is MilestoneKind => k in KIND_SET;

export function LearningJourney({ items, className }: { items: ProfileView["journey"]; className?: string }) {
  const t = useTranslations("profile");
  const format = useFormatter();
  const known = items.filter((i) => isKnownKind(i.kind));
  return (
    <section className={`${CARD} ${className ?? ""}`} aria-labelledby="profile-journey">
      <p className={EYEBROW}>{t("journey.eyebrow")}</p>
      <h2 id="profile-journey" className="mt-xs text-2xl font-bold">{t("journey.title")}</h2>
      {known.length === 0 ? (
        <div className="mt-md">
          <p className="text-sm text-muted-foreground">{t("journey.empty")}</p>
          <Link href="/shadowing" className={`${LINK} mt-xs inline-block`}>{t("journey.emptyCta")}</Link>
        </div>
      ) : (
        <ol className="mt-md">
          {known.map((item, i) => (
            <li
              key={`${i}-${item.kind}-${item.at}`}
              aria-current={i === 0 ? "step" : undefined}
              className="relative grid gap-2xs pb-md ps-lg last:pb-0 before:absolute before:start-0 before:top-1 before:size-2.5 before:rounded-full before:bg-muted-foreground/60 aria-[current=step]:before:bg-primary after:absolute after:start-[0.2rem] after:top-4 after:bottom-0 after:w-px after:bg-border last:after:hidden"
            >
              <p className="text-xs text-primary-strong">
                {format.dateTime(new Date(item.at), { month: "short", year: "numeric" })}
              </p>
              <p className="font-medium">{t(`journey.kind.${item.kind}`)}</p>
              <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">
                {t(`journey.line.${item.kind}`, { hasLabel: item.label ? "yes" : "no", label: item.label ?? "" })}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
