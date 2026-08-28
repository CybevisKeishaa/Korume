import { getTranslations } from "@/lib/i18n/server";
import { Section } from "./section";
import { AssetSlot } from "./asset-slot";
import { ChipIcon, type ChipKey } from "./problem-chip-icon";
import { ProblemConnectors } from "./problem-connectors";
import type { Translator } from "./translator";

/**
 * §2 (spec §4, §8.2.1, §13).
 *
 * ## Composition — three zones, not two (spec §13, G5, user ruling 2026-08-28)
 *
 * The first build stacked eyebrow + heading above a 2fr/1fr body, which the
 * user judged markedly worse than `346:6275` ("bố cục nó xấu hẳn so với ảnh
 * png"). The reference reads left to right as three zones:
 *
 *   text rail (~28%) │ constellation │ photograph, bled to the page edge
 *
 * The rail is `Section`'s new split layout, shared with §3–§9 so this is fixed
 * once. The constellation takes the left ~56% of the showcase column; the
 * remainder is deliberately left empty because the photograph — absolutely
 * positioned against the `<section>`, escaping `Container`'s max width — lands
 * there. Those two percentages are a relationship between columns, not copied
 * pixels: the photograph's left edge clears the constellation from the `lg`
 * breakpoint all the way up, because the container stops growing at
 * `max-w-6xl` while the section (and so the photograph) keeps tracking the
 * viewport.
 *
 * ⚠️ The photograph does not exist yet (spec §5.2), so this stays an
 * `AssetSlot` in its visibly-pending state. Filling it later is one `src` prop
 * at this one call site. The reference fades the photograph's left edge into
 * the background; that fade is deliberately NOT built here — fading a dashed
 * placeholder would stop it reading as a placeholder, and the fade is owed to
 * whoever supplies the real photograph.
 *
 * ⚠️ The connectors express a DECORATIVE relationship. They are not derived
 * from user state, SRS data or the difficulty engine, nothing in them is
 * clickable, and removing the SVG loses decoration and nothing else — every
 * chip's meaning is in its own text. Do not wire them to anything.
 *
 * Nothing in this section animates. §13.1 puts §2 in scope for motion, but as
 * a later whole-page pass over the composed page; this task is its static half
 * (composition, arrangement, stroke quality) and adds no transition, keyframe
 * or scroll trigger. Reduced-motion behaviour is therefore unchanged.
 *
 * Looks up the translator once and passes it down as a prop — see
 * `translator.ts` (task 4 fix F5) — rather than each subcomponent calling
 * `getTranslations` itself.
 */
const TOP_CHIPS: readonly ChipKey[] = ["vocabulary", "grammar", "kanji"];
const BOTTOM_CHIPS: readonly ChipKey[] = ["pronunciation", "listening", "srs"];

export async function Problem() {
  const t = await getTranslations("marketing");

  return (
    <Section
      id="problem"
      eyebrow={t("problem.eyebrow")}
      heading={t("problem.heading")}
      rail={<p className="text-body text-muted-foreground">{t("problem.body")}</p>}
    >
      {/* 56% of the showcase column: the constellation's share of the
          zone the reference splits between it and the photograph. */}
      <div className="lg:w-[56%]">
        <ChipRow chips={TOP_CHIPS} t={t} />

        {/* The band the connectors map their 0..100 coordinate space onto —
            its height is set by the sentence it wraps, and `relative` makes it
            the overlay's positioning context (NOT the photograph's, which
            anchors to the section). */}
        <div className="relative py-xl">
          <ProblemConnectors />

          <div className="relative text-center">
            <p className="font-jp text-body-lg">{t("problem.example.jp")}</p>
            <p className="mt-2xs text-caption text-muted-foreground">{t("problem.example.en")}</p>
          </div>
        </div>

        <ChipRow chips={BOTTOM_CHIPS} t={t} />
      </div>

      {/* Full-bleed to the section's right edge and its full height from `lg`
          up; a normal portrait slot in the flow below that, where there is no
          three-zone composition to bleed into. Only the left border survives
          the bleed — enough to keep the pending state legible as a boundary
          without drawing a box that stops short of the page edge. */}
      <AssetSlot
        ratio="3/4"
        description={t("problem.photoAlt")}
        className="mt-xl lg:absolute lg:inset-y-0 lg:right-0 lg:mt-0 lg:aspect-auto lg:w-[30%] lg:rounded-none lg:border-y-0 lg:border-r-0"
      />
    </Section>
  );
}

/**
 * One row of three capability chips: compact and near-square, with a
 * decorative line icon over the label, as `346:6275` draws them. The build's
 * wide two-line rectangles were what made this zone read as a table.
 *
 * `data-chip` / `data-chip-detail` are the hooks the §2 coverage guards use —
 * keep them.
 */
function ChipRow({ chips, t }: { chips: readonly ChipKey[]; t: Translator }) {
  return (
    // Same `grid-cols-3` + `gap-sm` as the connector overlay, so every column
    // centre line sits under its chip's centre line. Changing one without the
    // other pulls the rays off the chips.
    <div className="grid gap-sm sm:grid-cols-3">
      {chips.map((chip) => (
        <div
          key={chip}
          data-chip
          className="flex flex-col items-center rounded-md border border-border bg-card px-xs py-md text-center"
        >
          <ChipIcon chip={chip} className="h-lg w-lg text-primary-strong" />
          <p className="mt-xs text-caption font-medium">{t(`problem.chips.${chip}.name`)}</p>
          <p data-chip-detail className="mt-2xs font-jp text-caption text-muted-foreground">
            {t(`problem.chips.${chip}.detail`)}
          </p>
        </div>
      ))}
    </div>
  );
}
