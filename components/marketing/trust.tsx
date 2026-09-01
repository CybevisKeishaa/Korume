import { getTranslations } from "@/lib/i18n/server";
import { Section } from "./section";
import { AssetSlot } from "./asset-slot";
import { TrustIcon, type TrustKey } from "./trust-icon";
import type { Translator } from "./translator";

/**
 * §7 (spec §4, §11 ruling 11, §13).
 *
 * ## Composition — the rail split, three equal cards, and a photograph that
 * bleeds off the right edge
 *
 * Measured off `346:6275` (the whole-page export; §7 is the band at y≈1443-1535
 * of 1821), the section reads left to right as
 *
 *   rail [eyebrow + heading, NO body] │ [ card ][ card ][ card ] │ photograph →
 *
 * with the photograph running off the page's right edge and under the third
 * card. In reference coordinates the three cards are 207..372, 379..543 and
 * 550..714 — three equal 165px cards with a 7px gap, i.e. `grid-cols-3` and a
 * small gap rather than any hand-set width. The rail holds the eyebrow and a
 * two-line heading and nothing else.
 *
 * ⚠️ The plan's Task 10 drew this as `lg:grid-cols-[2fr_1fr]` with the
 * photograph as the narrow column and the claims as a `sm:grid-cols-3` list
 * inside the wide one. That is not what the reference draws, and it is the same
 * stacked shape the user rejected in §2 ("bố cục nó xấu hẳn so với ảnh png").
 * The plan also pinned the three claims as hardcoded English; two of the three
 * strings it named no longer exist. Both were corrected against the reference
 * and the catalog before this file was written.
 *
 * ## §7 is the first split with no rail body
 *
 * `Section` selected its split layout by `rail != null`, so a rail carrying
 * only eyebrow and heading could not be expressed. Hence `split` — and hence
 * the note on that prop: task 11 collapses it together with §8's centred
 * alignment into one layout decision, with two consumers in view instead of
 * one.
 *
 * ## NO MOTION
 *
 * This is the static half of spec §13; the whole-page motion pass is task
 * A-MOTION. Nothing here declares a transition, keyframe or scroll trigger, so
 * this section's `prefers-reduced-motion` obligation is satisfied vacuously, as
 * §2-§6's are. What it will later want to animate: the three cards settling in
 * sequence, and the window's glow warming as the section enters.
 *
 * Looks the translator up once and passes it down as a prop (`translator.ts`,
 * task 4 fix F5) rather than each card calling `getTranslations` itself.
 */
export const TRUST_PHOTO = "/marketing/trust-window.png";

/**
 * The three claims, in the reference's order.
 *
 * ⚠️ THESE THREE ARE PROMISES, NOT MARKETING COPY (spec §11 ruling 11). They
 * restate the `CLAUDE.md` §2 non-negotiables: recordings encrypted at rest and
 * not public by default · full export and deletion of user data · no training
 * on user data without consent. The WORDING is the owner's and has already been
 * re-voiced once (2026-09-02); the SUBJECTS are not editorial. Dropping one, or
 * softening it into something the product does not actually guarantee, means
 * the product changed — and that is a different conversation, not a copy edit.
 *
 * Exported so `trust.test.tsx` asserts against the list this file renders from
 * rather than a parallel copy kept in step by hand (CLAUDE.md §6).
 */
export const TRUST_CARDS: readonly TrustKey[] = ["recordings", "data", "ai"];

/**
 * ⚠️ THE PHOTOGRAPH'S FADE IS LONGER THAN §2's, AND THAT IS THE MEASUREMENT,
 * NOT A PREFERENCE.
 *
 * §2 fades over the first 20% of its photograph because at its width that is
 * already past the content it overlaps. §7 cannot copy that number. In the
 * reference the cards end at x=714 of 864 (82.6% of the page) and the
 * photograph's opaque edge lands at ~695 — it crosses only the third card's
 * ~15px right padding, leaving every glyph of text clear of it.
 *
 * Our content is proportionally narrower and our gutters proportionally wider:
 * `Container` is `max-w-6xl` (1152) inside a 1280 viewport, so the cards end at
 * x=1184 (92.5% of the page) where the reference's end at 82.6%. The
 * reference's photograph WIDTH and its CLEARANCE from the third card therefore
 * cannot both hold — the same trade §2's docblock records for its own overlap,
 * and it comes from `Section`'s max width, which task 12 owns and which was not
 * §7's to pull.
 *
 * So the photograph keeps a reference-like width and pays for it with a LONGER
 * fade — transparent until 70% of its own width. Measured live at 1280: the
 * slot runs x=936..1265 and the cards end at x=1176, so full opacity lands at
 * x≈1166, ten pixels inside the third card's right padding. That reproduces the
 * reference's relationship (opaque edge ~19px left of the cards' right edge at
 * its scale) rather than its raw percentage.
 *
 * ⚠️ WHAT THE FADE IS *NOT* DOING: it is not what keeps the third card's text
 * readable. `bg-card` is fully opaque (measured `rgb(24, 27, 33)`, alpha 1), so
 * the photograph never reaches that text at all — its contrast is against the
 * card, measured at 5.38:1 for the body and 15.67:1 for the claim, both past
 * the 4.5:1 AA floor. The fade is compositional: it stops the photograph's hard
 * left edge from cutting across the strips above and below the cards, which are
 * the only places it is actually seen. The thing that protects the text is
 * mechanism 2 below, and that is proven rather than assumed — with `z-10`
 * removed the photograph paints straight over the third card and its text
 * becomes unreadable (mutation-checked in the browser at 1280).
 *
 * Scoped to a descendant `img`, exactly as §2's is: `AssetSlot` renders an
 * `img` ONLY in its filled branch, so a pending dashed placeholder cannot be
 * faded into the page (spec §5.2 forbids that). Do not re-scope it to the
 * wrapper. Percentages, not pixels — the fade is a proportion of the photo.
 */
const PHOTO_LEFT_FADE =
  "lg:[&_img]:[mask-image:linear-gradient(to_right,transparent,#000_70%)]";

/**
 * `AssetSlot`'s default `sizes` is an upper bound (45vw) sized for §2's
 * photograph. This slot renders at 26vw from `lg` up and full width below it,
 * so it declares its own — see `DEFAULT_SIZES` for what omitting it costs.
 *
 * A `vw` term is right here (unlike §5's still, which needed absolute lengths
 * to reach the small `imageSizes` variants): this slot is genuinely large at
 * every breakpoint, so the `deviceSizes` list is the one it should be picking
 * from.
 */
const PHOTO_SIZES = "(min-width: 1024px) 26vw, 100vw";

export async function Trust() {
  const t = await getTranslations("marketing");

  return (
    <Section id="trust" eyebrow={t("trust.eyebrow")} heading={t("trust.heading")} split>
      {/* `relative z-10` is not decoration, and the overlap it guards is real:
          measured at 1280 the photograph's box covers 240 of the third card's
          243px. Mechanism 2 of 3. Being absolutely positioned and LATER in the
          subtree, the photograph paints over the third card without this —
          verified by removing the class in the browser, where the card's text
          disappears into the window's glow. `pointer-events-none` (below) does
          NOT cover this case: it stops hit-testing, never painting. */}
      <ul data-trust-cards className="relative z-10 grid gap-sm sm:grid-cols-3">
        {TRUST_CARDS.map((claim) => (
          <ClaimCard key={claim} claim={claim} t={t} />
        ))}
      </ul>

      {/* Below `lg` this is an ordinary block beneath the cards, at its own 3/4
          ratio. From `lg` up it leaves the flow, bleeds to the page's right
          edge and fills the section's height — which is why `Section` carries
          an unconditional `relative` and why the width is a percentage of the
          SECTION (the full viewport), not of the max-width `Container`.

          `pointer-events-none` is unconditional rather than `lg:`-only, and is
          mechanism 3 of 3: even the fade's fully transparent strip is still a
          hit-testable box over the third card, so a text selection under it
          would silently stop working. Isolated by probing the card's right edge
          with `elementFromPoint`: with both mechanisms off the probe returns
          the `IMG`; with either one on it returns the card. They are not
          redundant — mechanism 2 also fixes paint order, which this does not. */}
      <AssetSlot
        ratio="3/4"
        description={t("trust.photoAlt")}
        src={TRUST_PHOTO}
        sizes={PHOTO_SIZES}
        className={`pointer-events-none mt-xl lg:absolute lg:inset-y-0 lg:right-0 lg:mt-0 lg:aspect-auto lg:w-[26%] lg:rounded-none ${PHOTO_LEFT_FADE}`}
      />
    </Section>
  );
}

/**
 * One claim: the ringed icon, the claim, then the sentence that makes it
 * concrete — the reference's stack, in that order.
 *
 * The ring is a `rounded-full` border rather than a filled disc, matching the
 * reference's thin circular outline. Its ⌀24 against a 165px card scales to
 * `h-xl w-xl` (32px) against our ~243px card; the glyph inside is `md-lg`
 * (20px), holding the reference's ~0.55 glyph-to-ring ratio.
 */
function ClaimCard({ claim, t }: { claim: TrustKey; t: Translator }) {
  return (
    <li
      data-trust-card={claim}
      className="min-w-0 rounded-lg border border-border bg-card p-md-lg"
    >
      <span className="flex h-xl w-xl items-center justify-center rounded-full border border-border text-primary-strong">
        <TrustIcon claim={claim} className="h-md-lg w-md-lg" />
      </span>
      <h3 className="mt-sm text-body font-medium">{t(`trust.cards.${claim}.name`)}</h3>
      <p className="mt-2xs text-caption text-muted-foreground">
        {t(`trust.cards.${claim}.body`)}
      </p>
    </li>
  );
}
