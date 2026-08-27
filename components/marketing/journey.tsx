import { Link } from "@/lib/i18n/navigation";
import { getTranslations } from "@/lib/i18n/server";
import { buttonStyles } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Section } from "./section";
import { AssetSlot } from "./asset-slot";
import type { Translator } from "./translator";

/**
 * §3 (spec §4).
 *
 * ⚠️ The frame renders this section STRUCTURALLY wrong: cards 1 and 5 stacked
 * in a left column, 2/3/4 in a right row, one arrow for the whole section,
 * unequal card heights. The reference — and the correct structure — is a
 * single horizontal row of five equal cards with an arrow between each
 * adjacent pair (four arrows total). The reference wins.
 *
 * Narrow viewports: the row stays ONE row and scrolls horizontally
 * (`overflow-x-auto`) rather than wrapping into multiple lines. Wrapping
 * would either separate an arrow from the pair it connects or force arrows
 * to re-orient vertically, and per spec §4.1 the arrows must stay decorative
 * of a left-to-right sequence, never restructured per breakpoint. Scrolling
 * preserves "five cards, four arrows, one row" as a structural invariant
 * instead of a desktop-only shape. The scroll container itself is
 * `tabIndex={0}` with an accessible name (fix round 1, F2) so a keyboard-only
 * user — who has no focusable descendant to scroll-into-view, since no card
 * is a link or button — can still reach every step on a viewport too narrow
 * to show all five at once.
 *
 * The arrows (`StepArrow`) are decorative (spec §4.1): they carry no data,
 * are hidden from assistive technology and the tab order, and are derived
 * from nothing — not user state, not SRS data. The ordering they express is
 * already carried by the "1".."5" indices and DOM reading order, so deleting
 * every arrow loses decoration and nothing else. This is the one connector
 * in the whole port that repeats (§2's constellation and §6's chain do not),
 * which is why it alone gets a shared unit.
 *
 * No animation: this section has no motion of its own, so its
 * `prefers-reduced-motion` obligation is satisfied vacuously (as §2's
 * constellation is) rather than by an implemented, gated transition.
 *
 * Looks up the translator once and passes it down as a prop — see
 * `translator.ts` (task 4 fix F5) — rather than each subcomponent calling
 * `getTranslations` itself.
 */
type StepKey = "watch" | "understand" | "shadow" | "mine" | "remember";

const STEPS: readonly StepKey[] = ["watch", "understand", "shadow", "mine", "remember"];

// Mirrors `Section`'s own `${id}-heading` convention (section.tsx:32) so the
// scroll container's `aria-labelledby` (fix round 1, F2) can point at the
// heading `Section` already renders, with no new catalog string.
const SECTION_ID = "journey";
const HEADING_ID = `${SECTION_ID}-heading`;

export async function Journey() {
  const t = await getTranslations("marketing");

  return (
    <Section id={SECTION_ID} eyebrow={t("journey.eyebrow")} heading={t("journey.heading")}>
      <p className="max-w-xl text-body-lg text-muted-foreground">{t("journey.body")}</p>
      <Link href="/shadowing/explore" className={buttonStyles({ variant: "outline", className: "mt-lg" })}>
        {t("journey.cta")}
      </Link>

      <ol
        tabIndex={0}
        aria-labelledby={HEADING_ID}
        className="mt-xl flex items-stretch gap-2xs overflow-x-auto"
      >
        {STEPS.map((step, i) => (
          <li
            key={step}
            // Relationship-expressing, not an absolute literal (Rule #0): a
            // fraction of the viewport, floored and capped in rem so a card
            // never shrinks below a readable width or grows past a sensible
            // one. Fix round 1, F1 — `basis-56` resolved to a hardcoded
            // `14rem` because Tailwind's default numeric scale survives
            // `theme.extend`, which is the same defect class as `p-6`/`gap-2`.
            className="flex min-w-0 shrink-0 basis-[clamp(9rem,30vw,13rem)] items-center gap-2xs"
          >
            <StepCard step={step} t={t} />
            {i < STEPS.length - 1 ? <StepArrow /> : null}
          </li>
        ))}
      </ol>
    </Section>
  );
}

function StepCard({ step, t }: { step: StepKey; t: Translator }) {
  const isJapaneseDetail = step === "understand" || step === "mine";

  return (
    <div
      data-step={step}
      className="flex h-full min-w-0 flex-1 flex-col rounded-lg border border-border bg-card p-sm"
    >
      <p className="text-caption text-muted-foreground">
        <span>{t(`journey.steps.${step}.index`)}</span>{" "}
        <span className="text-foreground">{t(`journey.steps.${step}.name`)}</span>
      </p>

      {step === "watch" ? (
        <AssetSlot ratio="16/9" description={t("journey.thumbnailAlt")} className="mt-xs" />
      ) : null}

      <p
        className={cn(
          "mt-xs text-caption text-muted-foreground",
          isJapaneseDetail && "font-jp",
        )}
      >
        {t(`journey.steps.${step}.detail`)}
      </p>

      {step === "understand" ? (
        <p className="mt-2xs text-caption text-muted-foreground">
          {t("journey.steps.understand.gloss")}
        </p>
      ) : null}

      {step === "mine" ? (
        <p className="mt-2xs flex flex-wrap gap-2xs">
          <span className="rounded-sm border border-border px-2xs text-caption text-muted-foreground">
            {t("journey.steps.mine.level")}
          </span>
          <span className="rounded-sm border border-border px-2xs text-caption text-muted-foreground">
            {t("journey.steps.mine.tag")}
          </span>
        </p>
      ) : null}
    </div>
  );
}

/**
 * Decorative connector between two adjacent step cards. The only connector
 * shared across multiple call sites in the whole port (spec §4) — §2's
 * constellation and §6's chain are each used once and stay inline.
 */
function StepArrow() {
  return (
    <span data-step-arrow aria-hidden="true" className="shrink-0 text-primary-strong">
      →
    </span>
  );
}
