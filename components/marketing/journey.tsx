import { Link } from "@/lib/i18n/navigation";
import { getTranslations } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";
import { buttonStyles } from "@/components/ui/button";
import { Section } from "./section";
import { AssetSlot } from "./asset-slot";
import {
  CtaGlyph,
  RecordGlyph,
  ReviewDotGrid,
  SaveGlyph,
  ShadowWaveform,
  StepArrow,
  UnderstandProgress,
  WatchPlayGlyph,
  WatchProgress,
} from "./journey-art";
import type { Translator } from "./translator";

/**
 * §3 (spec §4, §13).
 *
 * ## Composition — a left rail, not a stack (spec §13, G5)
 *
 * `346:6275` puts eyebrow, heading, body and the CTA in a narrow left rail and
 * the five cards in the wide column beside it. The first build stacked them —
 * a `text-display` heading across the full width, then the body, then the CTA,
 * then the card row underneath — which is the same root cause the user rejected
 * in §2. `Section`'s `rail` prop (Task A1) is the shared mechanism for that
 * split; this section is its second consumer, so the geometry is fixed in one
 * place rather than re-derived here.
 *
 * ## The cards carry miniature UI, not captions (spec §13.1.2)
 *
 * The first build drew five near-empty shells: a dashed pending slot, two lines
 * of plain text, a flat squiggle, two chips, three words. Every gate passed and
 * the section read dead. Each card now depicts the step it names — a still with
 * player chrome, a transcript panel, an amplitude waveform with a record
 * affordance, a mined sentence with its chips, a review grid — drawn in
 * `journey-art.tsx`. All of it is decoration: see that file's docblock for the
 * invariant, which every piece here relies on.
 *
 * ⚠️ Card 3 draws an AUDIO WAVEFORM, not a pitch contour. An earlier version of
 * this comment argued the opposite; `journey-art.tsx`'s `ShadowWaveform`
 * docblock records why that reasoning was over-applied and what supersedes it.
 *
 * ## Structure the frame gets wrong, and this keeps
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
 * No animation: this section has no motion of its own, so its
 * `prefers-reduced-motion` obligation is satisfied vacuously (as §2's
 * constellation is) rather than by an implemented, gated transition. The
 * whole-page motion pass of spec §13.1 is a later task.
 *
 * Looks up the translator once and passes it down as a prop — see
 * `translator.ts` (task 4 fix F5) — rather than each subcomponent calling
 * `getTranslations` itself.
 */
type StepKey = "watch" | "understand" | "shadow" | "mine" | "remember";

const STEPS: readonly StepKey[] = ["watch", "understand", "shadow", "mine", "remember"];

/**
 * 1672x941 is exactly the 16/9 the slot declares, so filling it moved no
 * layout — one `src` prop at one call site, which is the boundary `AssetSlot`
 * exists for. Provenance recorded in `progress.md` per spec §5.2:
 * user-generated from the written per-slot description, licensing ruled closed
 * 2026-08-26.
 */
const JOURNEY_THUMB = "/marketing/journey-thumb.png";

/**
 * ⚠️ `AssetSlot`'s default `sizes` is an upper bound sized for §2's photograph
 * (45vw). This slot is a FIFTH of a ~71% column: it renders ~106 CSS px wide at
 * 1280, where that bound selects the 1080px variant — 74.7 KB as WebP against
 * 15.6 KB for the 384px variant this slot actually needs (measured against the
 * dev optimizer, 2026-08-29; 980 KB against 149 KB without WebP). So it passes
 * its own bound. Verified in the browser: `w=384`, 15 KB transferred.
 *
 * Absolute px rather than vw, because this slot's width does NOT track the
 * viewport: `CARD_BASIS` clamps it between 8rem and 11rem, and above `lg` the
 * container caps at `max-w-6xl` so it is a constant ~106 CSS px from 1152px up.
 * A vw expression would under-serve on a phone and over-serve on a large
 * display. (Rule #0 is about class names copying Figma pixels; `sizes` is a
 * browser hint that has to be stated in real layout units, and these are
 * measured from the built page, not read off the frame.)
 *
 * The values allow for the COVER CROP, and the derivation runs from the slot's
 * HEIGHT, not its width (fix round m2 — the first version worked from the width
 * and landed ~10% short). The file is 16/9 and the slot renders taller than it
 * is wide: `object-cover` therefore scales the source until its HEIGHT covers
 * the slot's, and crops the width. So the source width required is
 * `slotHeight * 16/9`, not `slotWidth * anything`. Measured live at 1280 the
 * slot is 106 x 123 CSS px, so it needs 123 * 1.778 ~= 219 -> 220. The widest
 * the card ever gets is 11rem, at 896-1023px where the section is still
 * stacked, which is the 300.
 *
 * (Both the old 200 and this 220 select the same variant at DPR 1, 1.5 and 2 —
 * `w=384` at the DPR this machine reports — so this is a correctness fix to a
 * number a future editor would trust, not a measured saving.)
 */
const THUMB_SIZES = "(min-width: 1024px) 220px, 300px";

// Mirrors `Section`'s own `${id}-heading` convention (section.tsx) so the
// scroll container's `aria-labelledby` (fix round 1, F2) can point at the
// heading `Section` already renders, with no new catalog string.
const SECTION_ID = "journey";
const HEADING_ID = `${SECTION_ID}-heading`;

/**
 * One card's share of the row.
 *
 * Relationship-expressing, not an absolute literal (Rule #0). The middle term
 * is literally "a fifth of the row, less the four gaps between the cards",
 * written against the gap TOKEN so changing `gap-2xs` cannot silently leave
 * the row overflowing by a few pixels. It is floored and capped in rem so a
 * card never shrinks below a readable width or grows past a sensible one —
 * the same idiom the previous `clamp(9rem,30vw,13rem)` used, retuned because
 * the split layout replaced the viewport-wide row with a ~71% column: 30vw is
 * now nearly three times the space a card actually has.
 *
 * `basis-56` / `max-w-md` would be hardcoded rem the Rule #0 scan cannot see —
 * `theme.extend.spacing` EXTENDS Tailwind's default numeric scale.
 */
const CARD_BASIS = "basis-[clamp(8rem,calc((100%_-_4_*_var(--space-2xs))/5),11rem)]";

export async function Journey() {
  const t = await getTranslations("marketing");

  return (
    <Section
      id={SECTION_ID}
      eyebrow={t("journey.eyebrow")}
      heading={t("journey.heading")}
      layout="split"
      rail={
        <>
          <p className="text-body text-muted-foreground">{t("journey.body")}</p>
          <Link
            href="/shadowing/explore"
            className={buttonStyles({ variant: "outline", className: "mt-lg" })}
          >
            {t("journey.cta")}
            <CtaGlyph />
          </Link>
        </>
      }
    >
      <ol
        tabIndex={0}
        aria-labelledby={HEADING_ID}
        className="flex items-stretch gap-2xs overflow-x-auto"
      >
        {STEPS.map((step, i) => (
          <li key={step} className={cn("flex min-w-0 shrink-0 items-center gap-2xs", CARD_BASIS)}>
            <StepCard step={step} t={t} />
            {i < STEPS.length - 1 ? <StepArrow /> : null}
          </li>
        ))}
      </ol>
    </Section>
  );
}

/**
 * The card frame every step shares, plus the dispatch to its body.
 *
 * `items-stretch` on the row plus `h-full` here makes all five the same height;
 * each body then puts `flex-1` on its own panel so the surplus goes INSIDE the
 * depicted UI instead of pooling as dead space under the text, which is what
 * the first build did.
 */
function StepCard({ step, t }: { step: StepKey; t: Translator }) {
  return (
    <div
      data-step={step}
      className="flex h-full min-w-0 flex-1 flex-col rounded-lg border border-border bg-card p-sm"
    >
      {step === "watch" ? <WatchBody t={t} /> : null}
      {step === "understand" ? <UnderstandBody t={t} /> : null}
      {step === "shadow" ? <ShadowBody t={t} /> : null}
      {step === "mine" ? <MineBody t={t} /> : null}
      {step === "remember" ? <RememberBody t={t} /> : null}
    </div>
  );
}

/** "1 Watch" — the index in the accent, the name in the foreground. */
function StepHeading({ step, t }: { step: StepKey; t: Translator }) {
  return (
    <p className="text-caption">
      <span className="text-primary-strong">{t(`journey.steps.${step}.index`)}</span>{" "}
      <span className="text-foreground">{t(`journey.steps.${step}.name`)}</span>
    </p>
  );
}

/**
 * The inset the reference draws inside every card except Watch's.
 *
 * `cn()`, not a template literal (fix round m4): every other composed class
 * string in this section goes through tailwind-merge, and `WatchBody`'s comment
 * explains a place where that resolution is load-bearing. One caller passing a
 * conflicting utility to a concatenating parent is a bug with no symptom until
 * it happens.
 */
function StepPanel({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "mt-xs flex flex-1 flex-col rounded-md border border-border bg-muted p-xs",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * Card 1. The reference puts the label BELOW the still rather than above it —
 * the still is the card's subject and the caption annotates it — so this one
 * body deliberately does not lead with `StepHeading`.
 */
function WatchBody({ t }: { t: Translator }) {
  return (
    <>
      {/* `relative` is the positioning context the two chrome layers anchor to,
          and `overflow-hidden` keeps the scrim ramp inside the rounded corners.
          Both chrome layers come after the slot in this subtree, which is what
          paints them above the photograph — see `journey-art.tsx`.

          `flex-1` + `aspect-auto`: the still is this card's subject and the
          reference fills the card with it, so it takes the height the other
          four cards' content sets instead of leaving 16/9's leftover as dead
          space under the caption. The slot keeps `ratio="16/9"` — that is the
          shape it falls back to wherever the height is NOT definite, and the
          declared ratio of the file — and `object-cover` crops to whatever the
          row's height turns out to be. Same mechanism §2's photograph uses
          (`lg:aspect-auto`), so tailwind-merge resolving the two `aspect-*`
          classes in `AssetSlot`'s own `cn()` is load-bearing here too. */}
      <div className="relative flex-1 overflow-hidden rounded-md">
        <AssetSlot
          ratio="16/9"
          description={t("journey.thumbnailAlt")}
          src={JOURNEY_THUMB}
          sizes={THUMB_SIZES}
          className="aspect-auto h-full rounded-md"
        />
        <WatchPlayGlyph />
        <WatchProgress />
      </div>

      <div className="mt-xs flex flex-col gap-2xs">
        <StepHeading step="watch" t={t} />
        <p className="text-caption text-muted-foreground">{t("journey.steps.watch.detail")}</p>
      </div>
    </>
  );
}

/**
 * Card 2. A transcript panel: the active line marked with the accent rule the
 * player uses, its translation under a hairline, and the clip's position along
 * the card's base.
 *
 * ⚠️ The reference also shows a romaji line under the Japanese and a small tag
 * chip above it. The catalog is frozen (no new copy keys), and inventing either
 * string here would be inventing content, so both are left out and reported
 * rather than faked.
 */
function UnderstandBody({ t }: { t: Translator }) {
  return (
    <>
      <StepHeading step="understand" t={t} />
      <StepPanel>
        {/* One step up the scale from its translation, as the reference sets
            them: the Japanese is what you are reading, the English annotates. */}
        <p className="border-l border-primary pl-xs font-jp text-body text-foreground">
          {t("journey.steps.understand.detail")}
        </p>
        <p className="mt-xs border-t border-border pt-xs text-caption text-muted-foreground">
          {t("journey.steps.understand.gloss")}
        </p>
      </StepPanel>
      <div className="mt-xs">
        <UnderstandProgress />
      </div>
    </>
  );
}

/** Card 3. Waveform and record affordance in the panel, the score beneath it. */
function ShadowBody({ t }: { t: Translator }) {
  return (
    <>
      <StepHeading step="shadow" t={t} />
      <StepPanel className="justify-center gap-xs">
        <ShadowWaveform />
        <div className="flex justify-center">
          <RecordGlyph />
        </div>
      </StepPanel>
      <p className="mt-xs text-center font-display text-heading font-bold text-foreground">
        {t("journey.steps.shadow.detail")}
      </p>
    </>
  );
}

/**
 * Splits `sentence` around the first occurrence of `fragment`.
 *
 * Returns `null` when the fragment is not in the sentence, so the caller can
 * fall back to the plain sentence instead of throwing. That fallback exists for
 * one reason: the copy catalog is frozen for the English pass but the user is
 * writing the Vietnamese one, and a translation could word the sentence so the
 * mined fragment no longer occurs verbatim inside it. It must never become the
 * silent normal path, which is why `journey.test.tsx` asserts the fragment IS
 * found today AND that the marked branch is the one that renders.
 */
function splitAroundFragment(
  sentence: string,
  fragment: string,
): { before: string; target: string; after: string } | null {
  const at = fragment.length > 0 ? sentence.indexOf(fragment) : -1;
  if (at < 0) return null;
  return {
    before: sentence.slice(0, at),
    target: fragment,
    after: sentence.slice(at + fragment.length),
  };
}

/**
 * Card 4. The mined sentence in the panel with its target word marked, then the
 * chips: the JLPT level in the house tint pattern, the grammar tag outlined,
 * and a save affordance that is drawn rather than named (no catalog string is
 * invented for it).
 *
 * ⚠️ The panel shows the FULL sentence, not the bare fragment (task A2 review
 * I1). The first build rendered `mine.detail` alone — five characters floating
 * in a ~124 x 105 px panel, unmistakably the emptiest object in a row of five,
 * which is the "correct but lifeless" symptom §3 was rebuilt to remove. It is
 * also the wrong picture of the feature: sentence mining is "sentence + target
 * word" (CLAUDE.md §5, priority 3), and `zoom-c4.png` draws a two-line sentence
 * over the chips.
 *
 * NO NEW COPY KEY was needed and none was added. The sentence is already in the
 * catalog as `journey.steps.understand.detail` (`この店は、思ったより安い。`)
 * and `journey.steps.mine.detail` (`思ったより`) is literally a substring of it,
 * so the marking is a render-time split rather than new content. The reference
 * repeats card 2's sentence in card 4 for the same reason: the point of the
 * pair of cards is that the same line you understood is the line you mine. Both
 * leaves still render, so the catalog coverage guard's total stays 23.
 */
function MineBody({ t }: { t: Translator }) {
  const sentence = t("journey.steps.understand.detail");
  const parts = splitAroundFragment(sentence, t("journey.steps.mine.detail"));

  return (
    <>
      <StepHeading step="mine" t={t} />
      <StepPanel className="justify-center">
        {/* Same size and face as card 2's line — it IS card 2's line, and the
            pair only reads as "the sentence you understood is the sentence you
            mine" if it looks like the same object. `leading-jp` because this
            one wraps to three lines where card 2's has room to breathe. */}
        <p data-mine-sentence className="font-jp text-body leading-jp text-foreground">
          {parts ? (
            <>
              {parts.before}
              {/* The house tint pattern (`bg-primary/10` + `text-primary-strong`,
                  as card 4's own N3 chip and §2's chips use it), already covered
                  by `lib/design-tokens.contrast.test.ts`'s SURFACES x TINTED
                  sweep at 4.5:1 both plain and alpha-blended. It marks the
                  target with colour AND with a distinct ground, so it does not
                  rest on hue alone (WCAG 1.4.1). */}
              {/* `box-decoration-clone`, not `whitespace-nowrap`: the panel is
                  ~92 CSS px wide and this mark WILL straddle a line break.
                  Cloning gives each line fragment its own rounded box, so the
                  wrap reads as intentional; forcing nowrap instead would make a
                  longer fragment (the Vietnamese pass may write one) overflow
                  the card, which is the class of bug this fix round exists to
                  remove. */}
              <span
                data-mine-target
                className="box-decoration-clone rounded-sm bg-primary/10 text-primary-strong"
              >
                {parts.target}
              </span>
              {parts.after}
            </>
          ) : (
            sentence
          )}
        </p>
      </StepPanel>
      {/* Three chips, as the reference draws them. The third is the save
          affordance: icon-only and unbordered, because at our 12px type floor
          (a deviation review already recorded for §2) a bordered "⊕ Save" chip
          does not fit beside the other two in a card ~19% narrower than the
          reference's — our container caps at `max-w-6xl` where the reference's
          card row runs nearly to the page edge. `ml-auto` sets it against the
          card's right edge, which is where the reference puts a card's icon
          affordance. */}
      <div data-mine-chips className="mt-xs flex items-center gap-2xs">
        <span className="shrink-0 rounded-sm bg-primary/10 px-2xs text-caption text-primary-strong">
          {t("journey.steps.mine.level")}
        </span>
        <span className="shrink-0 rounded-sm border border-border px-2xs text-caption text-muted-foreground">
          {t("journey.steps.mine.tag")}
        </span>
        <span data-save-chip aria-hidden="true" className="ml-auto flex shrink-0 items-center">
          <SaveGlyph />
        </span>
      </div>
    </>
  );
}

/**
 * Card 5. A titled schedule panel over the review grid.
 *
 * The grid gets its own bordered box, as `zoom-c5.png` draws it: the title sits
 * in one inset and the schedule in a second beneath it, which is what makes the
 * dots read as a calendar rather than as a loose scatter under a label.
 */
function RememberBody({ t }: { t: Translator }) {
  return (
    <>
      <StepHeading step="remember" t={t} />
      <StepPanel className="gap-xs">
        <p className="rounded-sm border border-border bg-card px-2xs py-2xs text-caption text-muted-foreground">
          {t("journey.steps.remember.detail")}
        </p>
        <div className="flex flex-1 items-center rounded-sm border border-border px-2xs py-xs">
          <ReviewDotGrid />
        </div>
      </StepPanel>
    </>
  );
}
