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
 * once. The constellation takes the left ~56% of the showcase column, and the
 * photograph — absolutely positioned against the `<section>`, escaping
 * `Container`'s max width — takes the section's right 41.5%. Both are
 * relationships between columns, not copied pixels.
 *
 * ## Why the two overlap, and why that is safe (fix F10)
 *
 * The photograph was `lg:w-[30%]` while the slot was a hard-edged dashed
 * placeholder that had to clear the constellation. Measured off `346:6275`
 * (chroma/variance scan of the 2× crop, `s2-problem.png`): the reference's
 * photograph starts at 57.7% of the section and runs to the edge — **42.2%**,
 * and its left edge sits within ~6px of the chip grid's right edge. So in the
 * reference the photograph does not clear the chips; it begins exactly where
 * they end and the fade does the blending.
 *
 * Our chip grid is wider than the reference's (~423px against ~329px at
 * 1280 — our 12px type floor against the reference's ~7.5px equivalent, a
 * deviation review already recorded), so the reference's WIDTH and the
 * reference's CLEARANCE cannot both hold. §13.1(2) makes the reference
 * binding, so the width wins and the two zones overlap. Three properties make
 * that safe, and all three are load-bearing:
 *
 *  1. `PHOTO_LEFT_FADE` is transparent at the photograph's left edge, so the
 *     overlapping strip is the fade's faintest part. Measured (overlap vs the
 *     fade's own length): 1280 → 104.6 / 105.0, so the fade reaches full
 *     opacity within half a pixel of the chip grid's right edge, and the two
 *     only diverge further apart as the viewport grows (1440 → 91 / 118,
 *     1920 → 50 / 158), because the container caps at `max-w-6xl` while the
 *     photograph keeps tracking the section. At the NARROW end of `lg` it goes
 *     the other way (1024 → 99.8 / 83.7): the photograph is fully opaque for
 *     the last ~16px behind the SRS chip, which is exactly why (2) is not
 *     optional.
 *  2. The constellation is lifted above the photograph (`relative z-10`) and
 *     every chip is an OPAQUE `bg-card` card, so nothing behind a chip can
 *     reach its text. Verified in the browser, not assumed.
 *  3. The photograph is `pointer-events-none`, so even the transparent part of
 *     it can never intercept a pointer aimed at the constellation. It is a
 *     decoration with nothing to click; the `<img>` keeps its `alt`, which
 *     pointer-events does not touch.
 *
 * The photograph is `PROBLEM_PHOTO` (fix F7). It was pending at first commit;
 * spec §5.2 needs a source whose origin is recorded, and `progress.md` now
 * records it — user-generated from the written per-slot description, licensing
 * ruled closed 2026-08-26. Its intrinsic 1086x1448 is exactly the 3/4 the slot
 * declares, so filling it moved no layout: it was one `src` prop at one call
 * site, as designed.
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
const PROBLEM_PHOTO = "/marketing/problem-desk.png";

/**
 * The reference dissolves the photograph's left edge into the page instead of
 * cutting it on a hard line. Held back at first commit for a good reason: the
 * slot was pending, and fading a dashed placeholder into the background would
 * stop it reading as a placeholder, which spec §5.2 forbids.
 *
 * ⚠️ That reason is encoded here, not just remembered. The mask is scoped to a
 * descendant `img`, and `AssetSlot` renders an `img` ONLY in its filled branch —
 * the pending branch is a dashed div with a `<span>`. So if `src` were ever
 * removed, the placeholder comes back with a hard boundary and this rule matches
 * nothing. An unfilled slot cannot fade. Do not re-scope this to the wrapper.
 *
 * `lg:` only: below that the photograph is an ordinary in-flow card with nothing
 * to bleed into. Percentages, not pixels — the fade is a proportion of the photo.
 */
const PHOTO_LEFT_FADE =
  "lg:[&_img]:[mask-image:linear-gradient(to_right,transparent,#000_20%)]";

const TOP_CHIPS: readonly ChipKey[] = ["vocabulary", "grammar", "kanji"];
const BOTTOM_CHIPS: readonly ChipKey[] = ["pronunciation", "listening", "srs"];

export async function Problem() {
  const t = await getTranslations("marketing");

  return (
    <Section
      id="problem"
      eyebrow={t("problem.eyebrow")}
      heading={t("problem.heading")}
      layout="split"
      rail={<p className="text-body text-muted-foreground">{t("problem.body")}</p>}
    >
      {/* 56% of the showcase column: the constellation's share of the
          zone the reference splits between it and the photograph.

          `relative z-10` is not decoration. The photograph is absolutely
          positioned and comes LATER in this subtree, so with both at
          `z-index: auto` it would paint over the constellation's right
          column. Lifting the constellation into its own stacking context is
          what puts the photograph behind the chips instead of on top of them
          (fix F10). Do not drop it while the two zones overlap. */}
      <div data-constellation className="relative z-10 lg:w-[56%]">
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
          three-zone composition to bleed into. `lg:aspect-auto` lets the two
          insets drive the height instead of the declared 3/4.

          `pointer-events-none` is unconditional rather than `lg:` only: the
          slot is a decoration at every width, and a rule that only holds above
          a breakpoint is one someone has to remember. See the docblock. */}
      <AssetSlot
        ratio="3/4"
        description={t("problem.photoAlt")}
        src={PROBLEM_PHOTO}
        className={`pointer-events-none mt-xl lg:absolute lg:inset-y-0 lg:right-0 lg:mt-0 lg:aspect-auto lg:w-[41.5%] lg:rounded-none ${PHOTO_LEFT_FADE}`}
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
