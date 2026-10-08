import { Link } from "@/lib/i18n/navigation";
import { useFormatter, useTranslations } from "@/lib/i18n";
import type { MilestoneKind, ProfileView } from "@/lib/profile/view";
import { useBadgeCopy } from "@/components/learning/use-badge-copy";
import { CARD, EYEBROW, LINK } from "./card-styles";

const KIND_SET = {
  first_activity: true, first_video_completed: true, first_mastered_word: true, first_certification_passed: true,
  badge_earned: true, first_meeting: true, first_shadow: true, jlpt_passed: true, pinned_line: true,
} satisfies Record<MilestoneKind, true>;
const isKnownKind = (k: string): k is MilestoneKind => k in KIND_SET;

/** Milestones shown before "Show more" (Figma 66:166 shows five); the rest stay one click away. */
export const JOURNEY_VISIBLE = 5;

const ITEM = "relative grid gap-2xs pb-md ps-lg before:absolute before:start-0 before:top-1 before:size-2.5 before:rounded-full before:bg-muted-foreground/60 aria-[current=step]:before:bg-primary after:absolute after:start-[0.2rem] after:top-4 after:bottom-0 after:w-px after:bg-border";

export function LearningJourney({ items, className }: { items: ProfileView["journey"]; className?: string }) {
  const t = useTranslations("profile");
  const format = useFormatter();
  const badge = useBadgeCopy();
  const known = items.filter((i) => isKnownKind(i.kind));
  const row = (item: (typeof known)[number], i: number, last: boolean) => {
    const label = item.kind === "badge_earned" && item.label ? badge.name(item.label) : item.label;
    return (
      <li key={`${i}-${item.kind}-${item.at}`} aria-current={i === 0 ? "step" : undefined} className={`${ITEM} ${last ? "pb-0 after:hidden" : ""}`}>
        <p className="text-xs text-primary-strong">
          {format.dateTime(new Date(item.at), { month: "short", year: "numeric" })}
        </p>
        <p className="font-medium">{t(`journey.kind.${item.kind}`)}</p>
        <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">
          {t(`journey.line.${item.kind}`, { hasLabel: label ? "yes" : "no", label: label ?? "" })}
        </p>
      </li>
    );
  };
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
        <>
          <ol className="mt-md">{known.slice(0, JOURNEY_VISIBLE).map((item, i) => row(item, i, i === Math.min(known.length, JOURNEY_VISIBLE) - 1 && known.length <= JOURNEY_VISIBLE))}</ol>
          {known.length > JOURNEY_VISIBLE && (
            // Flex column + order-last keeps the toggle under the last milestone once open, so it never splits
            // the timeline; a browser without styleable <details> just shows it above the folded items.
            <details className="group flex flex-col">
              <summary className={`${LINK} order-last ms-lg mt-xs w-fit cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>
                <span className="group-open:hidden">{t("journey.more", { count: known.length - JOURNEY_VISIBLE })}</span>
                <span className="hidden group-open:inline">{t("journey.less")}</span>
              </summary>
              <ol start={JOURNEY_VISIBLE + 1}>
                {known.slice(JOURNEY_VISIBLE).map((item, i) => row(item, JOURNEY_VISIBLE + i, i === known.length - JOURNEY_VISIBLE - 1))}
              </ol>
            </details>
          )}
        </>
      )}
    </section>
  );
}
