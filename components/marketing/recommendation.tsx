import { Link } from "@/lib/i18n/navigation";
import { getTranslations } from "@/lib/i18n/server";
import { buttonStyles } from "@/components/ui/button";
import { Section } from "./section";
import { AssetSlot } from "./asset-slot";
import { FamiliarDonut } from "./recommendation-donut";
import type { Translator } from "./translator";

/**
 * §5 (spec §4, §13 — the i+1 recommendation, CLAUDE.md §5 #2).
 *
 * ## Composition — the rail split, then three cards (spec §13, G5)
 *
 * Measured off `346:6275` (the whole-page export, §5 is the band at y≈1090-1250
 * of 1821), the section reads left to right as
 *
 *   text rail (~28.6%) │ showcase [ "Recommended for you" card ] [ "Why?" card ]
 *
 * with the first showcase card holding two more side by side: the video still
 * and the familiar-words figure. In reference coordinates the content spans
 * x = 31..834; the rail ends at ~215 and the showcase card starts at 255, which
 * is `Section`'s own 2fr/5fr split to within a couple of px — so the rail is
 * that shared prop (task A1) rather than geometry re-derived here. Inside the
 * showcase the main card runs 255..655 and the Why card 676..834, i.e. ~2.5:1,
 * which is the 5fr/2fr below.
 *
 * The plan's Task 8 stacked eyebrow + heading above a single card. That is the
 * same root cause the user rejected in §2 ("bố cục nó xấu hẳn so với ảnh png"),
 * so this section is built to the reference's composition from the start rather
 * than through a second rebuild task the way §2, §3 and §4 each needed.
 *
 * ## What the reference shows that this deliberately does NOT build
 *
 * Four strings appear in `346:6275` and do not exist in `messages/**`: the
 * `i+1 Perfect Next Step` badge over the still, the `Daily Life` / `Commuting`
 * topic chips, the `New Words: 8` line, and the still's `12 min` duration chip.
 * Inventing them here would be inventing product copy that the Vietnamese pass
 * would then have to match. The catalog is the boundary; they are reported to
 * the controller instead. Everything the catalog *does* carry is rendered.
 *
 * ## The numbers are not claims
 *
 * `96`, `Familiar Words` and the four reasons are illustrative design mock
 * data, exactly as `lib/marketing/pitch-demo.ts`'s contours are. Nothing here
 * reads user state, and no code may derive a threshold from them — the real
 * i+1 scorer is `backend-engineer`'s `/lib/difficulty`.
 *
 * ## NO MOTION
 *
 * This is the static half of spec §13; the whole-page motion pass is a later
 * task. Nothing here declares a transition, keyframe or scroll trigger, so this
 * section's `prefers-reduced-motion` obligation is satisfied vacuously — as
 * §2's, §3's and §4's are.
 *
 * Looks up the translator once and passes it down as a prop — see
 * `translator.ts` (task 4 fix F5) — rather than each subcomponent calling
 * `getTranslations` itself.
 */
const STILL = "/marketing/recommend-commute.png";

/**
 * ⚠️ `AssetSlot`'s default `sizes` is an upper bound sized for §2's full-bleed
 * photograph (45vw); this slot is far below it, and `fill` with too generous a
 * hint is what made §2 fetch a 3840px variant and paint an empty section for
 * 4.9s. Derived from the slot's rendered geometry, not from the frame:
 *
 *   >=1024  measured live at 1280: the slot renders 206 CSS px  => 240
 *   640..1023  the section is stacked and the main card takes the whole
 *           container, still two columns: ~435 CSS px at 1023  => 440
 *   <640    one column, slot = viewport - ~100 (gutters + two card paddings);
 *           539 at the top of that band  => 560
 *
 * All three are absolute px with NO `vw` term, deliberately: `next/image` only
 * puts the small `imageSizes` variants (256/384) in the srcset when `sizes`
 * parses to pure lengths — a `100vw` fallback here forces the `deviceSizes`
 * list, whose smallest entry is 640. Measured against the dev optimizer: 640w
 * = 30.4 KB where 256w = 8.9 KB for the same slot.
 *
 * The file is exactly 16/9 (1672x941) and so is the slot, so `object-cover`
 * crops nothing and the required source width is the slot's own width — the
 * height-driven derivation `journey.tsx` documents does not apply here.
 */
const STILL_SIZES = "(min-width: 1024px) 240px, (min-width: 640px) 440px, 560px";

/** ~2.5:1 — the main card against the "Why this video?" card, as measured above. */
const SHOWCASE_COLUMNS = "lg:grid-cols-[minmax(0,5fr)_minmax(0,2fr)]";

const REASONS = ["vocabulary", "speed", "expressions", "difficulty"] as const;

export async function Recommendation() {
  const t = await getTranslations("marketing");

  return (
    <Section
      id="recommend"
      eyebrow={t("recommend.eyebrow")}
      heading={t("recommend.heading")}
      rail={<p className="text-body text-muted-foreground">{t("recommend.body")}</p>}
    >
      {/* `min-w-0` on both cells for the reason `Section`'s own INVARIANT
          records: below `lg` this collapses to one implicit `auto` track whose
          minimum is content-based, and both cells hold non-shrinking content
          (an image and a run of unbroken reason text). */}
      <div className={`grid gap-lg ${SHOWCASE_COLUMNS}`}>
        <div className="min-w-0 rounded-lg border border-border bg-card p-md-lg">
          <p className="text-body font-medium">{t("recommend.cardHeading")}</p>
          {/* The hairline under a card's label is the reference's rhythm for
              this section — it repeats under "Why this video?" and between the
              figure and its CTA. Border, not a <hr>: it adds no node to the
              accessibility tree and needs no catalog string. */}
          <div className="mt-sm grid gap-md border-t border-border pt-md sm:grid-cols-2">
            <VideoCard t={t} />
            <FamiliarCard t={t} />
          </div>
        </div>

        <WhyCard t={t} />
      </div>
    </Section>
  );
}

/**
 * The recommended video: the still, then its Japanese title and the English
 * gloss beneath, as the reference stacks them.
 *
 * The still is a real photograph (`b30661f`), not a pending `AssetSlot` — its
 * provenance is recorded in `progress.md` per spec §5.2. `AssetSlot` is still
 * the boundary, so filling or replacing it stays one `src` prop at one call
 * site with no layout change.
 */
function VideoCard({ t }: { t: Translator }) {
  return (
    <div
      data-recommend-card="video"
      className="flex min-w-0 flex-col rounded-md border border-border p-sm"
    >
      <AssetSlot
        ratio="16/9"
        description={t("recommend.stillAlt")}
        src={STILL}
        sizes={STILL_SIZES}
        className="rounded-md"
      />
      <p className="mt-sm font-jp text-heading leading-jp">{t("recommend.video.jp")}</p>
      <p className="mt-2xs text-body text-muted-foreground">{t("recommend.video.en")}</p>
    </div>
  );
}

/**
 * The familiar-words figure: the donut with the percentage typeset inside it,
 * the label beside it, and the CTA on the card's bottom edge.
 *
 * ⚠️ The arc is decoration and the NUMBER is the content. `FamiliarDonut` is
 * `aria-hidden`, and the `96` / `%` below are ordinary text absolutely centred
 * over it, so a screen reader reads a number rather than announcing an image or
 * saying nothing at all. `text-title` against `text-body` is the plan's percent
 * treatment — a large value with a smaller unit — satisfied inside the ring
 * rather than instead of it.
 *
 * `mt-auto` on the CTA (and `h-full` on the card) pins it to the bottom edge so
 * it lines up with the video card's own baseline, which is what the reference
 * draws; without it the button floats directly under a short label.
 */
function FamiliarCard({ t }: { t: Translator }) {
  const percent = Number(t("recommend.familiar.value"));

  return (
    <div
      data-recommend-card="familiar"
      className="flex h-full min-w-0 flex-col rounded-md border border-border p-sm"
    >
      <div className="flex items-center gap-sm">
        {/* `text-success-strong` on the wrapper is what the arc's
            `currentColor` gradient resolves to: `--success-strong` on `--card`
            measures 9.83:1, so the ring is a real token, not an arbitrary hex.
            The percentage is centred over the ring by a second absolutely
            positioned layer — `items-center` on the box, `items-baseline` on
            the pair inside it, so the `%` sits on the number's baseline while
            the pair as a whole stays optically centred. */}
        <div className="relative shrink-0 text-success-strong">
          <FamiliarDonut percent={percent} />
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="flex items-baseline text-foreground">
              <span data-familiar-value className="font-display text-heading font-bold leading-none">
                {t("recommend.familiar.value")}
              </span>
              <span data-familiar-unit className="text-caption text-muted-foreground">
                {t("recommend.familiar.unit")}
              </span>
            </p>
          </div>
        </div>
        <div className="min-w-0">
          <p className="font-display text-body font-semibold">
            {t("recommend.familiar.label")}
          </p>
          <p className="mt-2xs text-caption text-muted-foreground">
            {t("recommend.familiar.body")}
          </p>
        </div>
      </div>

      <div className="mt-sm border-t border-border pt-sm sm:mt-auto">
        <Link
          href="/shadowing/explore"
          className={buttonStyles({ className: "w-full" })}
        >
          {t("recommend.cta")}
        </Link>
      </div>
    </div>
  );
}

/**
 * "Why this video?" — the four reasons, each with a check mark, separated by
 * the same hairline the main card uses under its label.
 *
 * A `<ul>`, because it is a list and announces as one. The check glyphs are
 * `aria-hidden`: every reason's meaning is in its own visible text, and a
 * screen reader that announced "tick" four times would be reading decoration.
 */
function WhyCard({ t }: { t: Translator }) {
  return (
    <div
      data-recommend-card="why"
      className="min-w-0 rounded-lg border border-border bg-card p-md-lg"
    >
      <p className="text-body font-medium">{t("recommend.why.heading")}</p>
      <ul className="mt-sm border-t border-border">
        {REASONS.map((reason) => (
          <li key={reason} className="flex items-start gap-sm border-b border-border py-sm last:border-b-0">
            <CheckGlyph />
            <span data-reason={reason} className="text-caption text-muted-foreground">
              {t(`recommend.why.${reason}`)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The reasons' check mark. Hand-drawn inline SVG in the house style of
 * `problem-chip-icon.tsx` (there is no icon library in this repo): one
 * `viewBox="0 0 24 24"`, `currentColor`, round caps and joins, size from the
 * caller's token classes rather than a width/height attribute.
 *
 * The two-segment path with an over-run on the long arm is deliberate — the
 * reference's tick is a drawn stroke with a rising tail, not a font glyph.
 */
function CheckGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className="mt-2xs h-md-lg w-md-lg shrink-0 text-primary-strong"
    >
      <path d="M4.5 12.6 9.4 17.5 19.5 6.2" />
    </svg>
  );
}
