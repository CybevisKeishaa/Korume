import Image from "next/image";
import { Link } from "@/lib/i18n/navigation";
import { getTranslations } from "@/lib/i18n/server";
import { buttonStyles } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Section } from "./section";
import { PitchChart } from "./pitch-chart";
import type { Translator } from "./translator";

/**
 * §4 (spec §7, §13).
 *
 * ## Composition — a rail and a two-column card, not a stack (spec §13, G5)
 *
 * The first build stacked everything: a full-width `text-display` heading, then
 * the card, then the sub-scores, then the Overall Score and the Companion side
 * by side beneath it. Reference `346:6275` reads left to right as
 *
 *   text rail (~28%) │ showcase card [ chart+scores (~65%) │ score column (~35%) ]
 *
 * The rail is `Section`'s split layout (task A1), shared with §2/§3 so the
 * geometry is fixed in one place. The card's own split is local to this
 * section.
 *
 * ⚠️ The inner split is 2fr/1fr, not the 5fr/2fr the rail uses. Measured off
 * the reference crop (`s4-pitch.png`, a 2x export) by a luminance column
 * profile rather than by eye: the card's border columns sit at x=514 and
 * x=1654 and the column divider at x=1242, so the score column is 36% of the
 * card's outer width and ~35% of its content width once the card's padding and
 * the column gap are taken out. The task brief's prose said "~28%"; the
 * reference is the binding authority (spec §13.1(2)) and 28% leaves the
 * Companion's three-line body about 78 CSS px to wrap into at `lg`, which is
 * how the deviation was noticed. Reported to the controller.
 *
 * ## The numbers are not claims
 *
 * The four sub-scores and the Overall Score are illustrative design mock data,
 * exactly as `lib/marketing/pitch-demo.ts`'s contours are — see that file's
 * header. Nothing here derives a threshold from them.
 *
 * NO MOTION. This is the static half of spec §13; the whole-page motion pass is
 * a later task. Nothing here declares a transition, keyframe or scroll trigger,
 * so this section's `prefers-reduced-motion` obligation is satisfied vacuously
 * (as §2's and §3's are).
 *
 * Looks up the translator once and passes it down as a prop — see
 * `translator.ts` (task 4 fix F5) — rather than each subcomponent calling
 * `getTranslations` itself.
 */
const SUB_SCORES = ["pitch", "rhythm", "pronunciation", "timing"] as const;

/**
 * The Companion mascot. Already wired in an earlier task; do not re-cut or
 * re-source it, and do not reach for `mix-blend-mode: screen`, which the
 * asset's real alpha channel retired.
 */
const MASCOT = "/mascot/poses/noting.png";

/**
 * Rendered size of the mascot, in CSS px.
 *
 * Explicit width/height attributes rather than a `w-[6.5rem]` class: Rule #0 is
 * about class names copying frame pixels, and an intrinsic element size is the
 * escape the rule itself points at. 340x304 is the file's intrinsic size, so
 * 104x93 keeps its aspect ratio to within a rounding step.
 *
 * ⚠️ 104 is not a taste call, it is the widest value that CANNOT collide with
 * the Companion's copy. The image has NO transparent margin — measured, its
 * alpha bounding box is the full 340x304 — so any overlap with the text box is
 * opaque fur over words, which `z-10` only papers over. With the mascot pulled
 * `-right-lg` past the card and the copy reserving `pr-3xl`, the clearance is
 *
 *     width <= overhang (24) + reserved right padding (64) = 88 + 16 (the
 *     card's own `p-md`) = 104
 *
 * — independent of the card's width, so it holds at every viewport where the
 * overhang applies. Growing the mascot means growing the reserved padding, and
 * `3xl` is the top of the spacing scale.
 */
const MASCOT_WIDTH = 104;
const MASCOT_HEIGHT = 93;
/**
 * The slot renders at a fixed 104 CSS px at every viewport — it is a decorative
 * fixed-size element, not a fluid one — so `sizes` is that width, flat.
 *
 * ⚠️ This replaces `unoptimized`, whose comment called this "a fixed local
 * decorative icon". It is not an icon: `noting.png` is 340x304 and 166 KB, and
 * `unoptimized` shipped all 166 KB to paint ~100 px. With the optimizer and
 * this hint the browser picks the 128px variant instead — measured at 4.9 KB
 * in the browser, a 34x saving. See the task report.
 */
const MASCOT_SIZES = "104px";

export async function PitchShowcase() {
  const t = await getTranslations("marketing");

  return (
    <Section
      id="pitch"
      eyebrow={t("pitch.eyebrow")}
      heading={t("pitch.heading")}
      rail={
        <>
          <p className="text-body text-muted-foreground">{t("pitch.body")}</p>
          <Link
            href="/shadowing"
            className={buttonStyles({ variant: "outline", className: "mt-lg" })}
          >
            {t("pitch.cta")}
          </Link>
        </>
      }
    >
      <div className="rounded-lg border border-border bg-card p-lg">
        {/* `min-w-0` on both cells for the same reason `Section` carries it on
            its own two (see that file's INVARIANT): below `lg` this collapses
            to one implicit `auto` track whose minimum is content-based, and the
            chart column holds a full-width SVG and a four-column score row. */}
        <div className="grid gap-lg lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="min-w-0">
            <PitchChart t={t} />

            <p className="mt-md font-jp text-body-lg leading-jp">{t("pitch.example.jp")}</p>
            {/* ⚠️ The reference also prints a romaji line under the Japanese.
                The catalog is frozen (no new copy keys) and romaji is study
                content, not decoration, so inventing one here would be
                inventing content. Left out and reported instead. */}

            <SubScores t={t} />
          </div>

          {/* `flex flex-col` + the Companion's `lg:mt-auto`: the grid stretches
              this cell to the chart column's height, and the reference sets the
              Companion card against the card's bottom rather than leaving a
              well of dead space under it. */}
          <div className="flex min-w-0 flex-col lg:border-l lg:border-border lg:pl-lg">
            <p className="text-caption text-muted-foreground">{t("pitch.scores.overallLabel")}</p>
            <p className="font-display text-display font-bold">{t("pitch.scores.overall")}</p>
            <p className="text-body-lg text-success-strong">{t("pitch.scores.verdict")}</p>

            <CompanionCard t={t} />
          </div>
        </div>
      </div>
    </Section>
  );
}

/**
 * "86" in the success tone, "/100" in the metadata tone, with a hairline
 * between each pair of cells — as the reference styles them, against the
 * build's uniform white `86/100`.
 *
 * The split is a RENDER-TIME split of the frozen catalog string, not a new
 * copy key (the same move `journey.tsx`'s mined-sentence marking makes). If a
 * translation ever writes the value without a `/`, `ScoreValue` falls back to
 * rendering it whole rather than throwing or silently dropping half of it.
 *
 * The dividers are CSS borders on the cells, so they add no node to the
 * accessibility tree and need no `aria-hidden`, no `role="separator"` and no
 * catalog string. They appear only from `sm` up, where the row is a single line
 * of four: in the two-column layout below that, a left border on the third cell
 * would draw a stray rule at the start of the second row.
 */
function SubScores({ t }: { t: Translator }) {
  return (
    <dl className="mt-md grid grid-cols-2 gap-y-sm border-t border-border pt-md sm:grid-cols-4 sm:gap-y-0">
      {SUB_SCORES.map((score) => (
        <div
          key={score}
          data-subscore={score}
          className={cn(
            "min-w-0",
            "sm:border-l sm:border-border sm:px-sm sm:first:border-l-0 sm:first:pl-0",
          )}
        >
          <dt className="text-caption text-muted-foreground">{t(`pitch.scores.${score}.name`)}</dt>
          <dd className="mt-2xs">
            <ScoreValue value={t(`pitch.scores.${score}.value`)} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** `"86/100"` → a green `86` and a grey `/100`; anything without a `/` renders whole. */
function ScoreValue({ value }: { value: string }) {
  const at = value.indexOf("/");
  if (at < 0) {
    return <span className="font-display text-heading font-semibold">{value}</span>;
  }
  return (
    <>
      <span
        data-score-number
        className="font-display text-heading font-semibold text-success-strong"
      >
        {value.slice(0, at)}
      </span>
      <span data-score-suffix className="text-caption text-muted-foreground">
        {value.slice(at)}
      </span>
    </>
  );
}

/**
 * The Companion's note on the take, with the mascot breaking out of the card's
 * top and right edges as the reference draws it.
 *
 * ⚠️ Three properties make an overflowing decorative image safe here, and all
 * three are load-bearing — the same set `problem.tsx` documents for §2's
 * photograph and `journey-art.tsx` for §3's player chrome:
 *
 *  1. `pointer-events-none` on the mascot. It is decoration with nothing to
 *     click, and once it overhangs the card it sits above the section's other
 *     content; without this it could intercept a pointer aimed at text.
 *  2. `relative z-10` on the text block, so the copy always paints ABOVE the
 *     mascot. The mascot's own alpha channel does the blending §2 needed a mask
 *     gradient for, but alpha only softens the overlap — it does not decide the
 *     paint order.
 *  3. The overhang is bounded by the SHOWCASE CARD's own `p-lg`. `-right-lg` is
 *     exactly that padding, so the mascot's right edge lands on the card's
 *     inner border edge and never reaches the page edge. That is what keeps
 *     this out of WCAG 1.4.10 (Reflow) territory at every viewport width.
 *
 * The overhang is `xl:` (>=1280), not `lg:`. Between 1024 and 1279 the score
 * column is ~170 CSS px wide and a 124 px mascot cannot sit beside three lines
 * of text there; below `xl` it stays in flow under the copy, right-aligned,
 * which is also what it does in the stacked mobile layout.
 *
 * Surface: `bg-primary/5` with `border-primary/30`, the warm tint the reference
 * gives this card. Measured against `--card`: `text-foreground` 14.6:1 and
 * `text-primary-strong` 6.9:1, both AA. The automated sweep in
 * `lib/design-tokens.contrast.test.ts` covers the same tones on the bare card
 * and on a 10% tint; a 5% tint lies between two already-covered cases, and both
 * of those pass.
 */
function CompanionCard({ t }: { t: Translator }) {
  return (
    <div
      data-companion
      className="relative mt-lg rounded-lg border border-primary/30 bg-primary/5 p-md lg:mt-auto"
    >
      <div className="relative z-10 xl:pr-3xl">
        <p className="text-caption text-primary-strong">{t("pitch.companion.name")}</p>
        <p className="mt-2xs text-caption text-foreground">{t("pitch.companion.body")}</p>
      </div>
      <Image
        data-mascot
        src={MASCOT}
        alt=""
        aria-hidden="true"
        width={MASCOT_WIDTH}
        height={MASCOT_HEIGHT}
        sizes={MASCOT_SIZES}
        className="pointer-events-none ml-auto mt-xs block xl:absolute xl:-right-lg xl:-top-lg xl:mt-0"
      />
    </div>
  );
}
