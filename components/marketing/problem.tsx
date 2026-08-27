import { getTranslations } from "@/lib/i18n/server";
import { Section } from "./section";
import { AssetSlot } from "./asset-slot";
import type { Translator } from "./translator";

/**
 * §2 (spec §4, §8.2.1).
 *
 * The reference arranges the six chips AROUND the centred example sentence
 * (three above, three below) and connects them to it with dotted lines
 * through a glowing centre node; the frame squeezes them into two flat rows
 * with nothing between them. The reference's arrangement wins (gap G2).
 *
 * ⚠️ The connectors express a DECORATIVE relationship. They are not derived
 * from user state, SRS data or the difficulty engine, nothing in them is
 * clickable, and removing the SVG loses decoration and nothing else — every
 * chip's meaning is in its own text. Do not wire them to anything.
 *
 * Looks up the translator once and passes it down as a prop — see
 * `translator.ts` (task 4 fix F5) — rather than each subcomponent calling
 * `getTranslations` itself.
 */
type ChipKey = "vocabulary" | "grammar" | "kanji" | "pronunciation" | "listening" | "srs";

const TOP_CHIPS: readonly ChipKey[] = ["vocabulary", "grammar", "kanji"];
const BOTTOM_CHIPS: readonly ChipKey[] = ["pronunciation", "listening", "srs"];

export async function Problem() {
  const t = await getTranslations("marketing");

  return (
    <Section id="problem" eyebrow={t("problem.eyebrow")} heading={t("problem.heading")}>
      <div className="grid gap-xl lg:grid-cols-[2fr_1fr]">
        <div>
          <p className="max-w-xl text-body-lg text-muted-foreground">{t("problem.body")}</p>

          <div className="relative mt-xl">
            <Constellation />

            <ChipRow chips={TOP_CHIPS} t={t} />

            <div className="relative mx-auto max-w-md py-lg text-center">
              <p className="font-jp text-title">{t("problem.example.jp")}</p>
              <p className="mt-2xs text-body text-muted-foreground">{t("problem.example.en")}</p>
            </div>

            <ChipRow chips={BOTTOM_CHIPS} t={t} />
          </div>
        </div>

        <AssetSlot ratio="3/4" description={t("problem.photoAlt")} />
      </div>
    </Section>
  );
}

function ChipRow({
  chips,
  t,
}: {
  chips: readonly ChipKey[];
  t: Translator;
}) {
  return (
    <div className="relative grid gap-md sm:grid-cols-3">
      {chips.map((chip) => (
        <div
          key={chip}
          data-chip
          className="rounded-lg border border-border bg-card p-md text-center"
        >
          <p className="text-body font-medium">{t(`problem.chips.${chip}.name`)}</p>
          <p data-chip-detail className="mt-2xs font-jp text-caption text-muted-foreground">
            {t(`problem.chips.${chip}.detail`)}
          </p>
        </div>
      ))}
    </div>
  );
}

/**
 * Decorative-only connective rays from a centre node out to each chip.
 * `aria-hidden` + `focusable="false"` keep it out of the accessibility tree
 * and the tab order; the exact geometry (dotted rays from 347:6424) is a
 * later polish pass, not something this task's tests assert on.
 *
 * Content-preserving under `prefers-reduced-motion` (CLAUDE.md §2 rule 4):
 * this markup carries no animation of its own today, so there is nothing to
 * gate — a future animated version must render the same static rays when
 * reduced motion is requested, never omit them.
 */
function Constellation() {
  return (
    <svg
      data-connector
      aria-hidden="true"
      focusable="false"
      className="pointer-events-none absolute inset-0 hidden h-full w-full lg:block"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      <line x1="50" y1="50" x2="16" y2="16" className="stroke-border" strokeDasharray="2 2" />
      <line x1="50" y1="50" x2="50" y2="8" className="stroke-border" strokeDasharray="2 2" />
      <line x1="50" y1="50" x2="84" y2="16" className="stroke-border" strokeDasharray="2 2" />
      <line x1="50" y1="50" x2="16" y2="84" className="stroke-border" strokeDasharray="2 2" />
      <line x1="50" y1="50" x2="50" y2="92" className="stroke-border" strokeDasharray="2 2" />
      <line x1="50" y1="50" x2="84" y2="84" className="stroke-border" strokeDasharray="2 2" />
      <circle cx="50" cy="50" r="1.5" className="fill-primary-strong" />
    </svg>
  );
}
