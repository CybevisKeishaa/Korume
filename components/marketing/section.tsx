import { MarketingContainer } from "./marketing-container";
import { cn } from "@/lib/utils";

/**
 * The three compositions this page uses. One prop, because alignment and
 * heading size are not independent: each layout pairs a measured heading token
 * with the arrangement that token was measured for.
 *
 * - `stacked`  — eyebrow + heading above the showcase, `text-display` (40px).
 * - `split`    — narrow rail beside a wide showcase, `text-heading-lg` (24px).
 * - `centred`  — everything centred, `text-title` (28px). §8's shape.
 */
export type SectionLayout = "stacked" | "split" | "centred";

interface SectionBase {
  /** Anchor id; also what the accessible region is keyed to. */
  id: string;
  /** Small label above the heading. Presentational text, never a heading. */
  eyebrow?: string;
  heading: string;
  /** 1 only for the hero; every other section is 2. */
  headingLevel?: 1 | 2;
  /** Opt this section into the scroll-progress provider's custom property. */
  scrollProgress?: boolean;
  /**
   * Full-bleed layers painted BEHIND the `MarketingContainer` — a background photo,
   * a scrim, a decorative figure that must sit under the copy. Rendered as the
   * section's first child, outside the max-width wrapper, so `absolute inset-0`
   * against the section's own box does what it reads like.
   *
   * ⚠️ NOT the same thing as §2's and §7's photographs, which travel through
   * `children`. Those are PARTIAL bleeds scoped to the showcase column's right
   * edge and belong to that column's composition; this is for a layer behind
   * the whole band, including the copy. The distinction matters because content
   * must paint above a backdrop and beside a partial bleed.
   */
  backdrop?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/**
 * ⚠️ `rail` IS ONLY ACCEPTED UNDER `layout="split"`, AND THAT IS ENFORCED BY THE
 * TYPE, not by a runtime guard. Passing rail content to a stacked or centred
 * section would silently drop it — the mirror image of the bug fix F6 guarded
 * against, where `rail={cond ? <X/> : null}` silently SELECTED a layout. Making
 * the pair a discriminated union means neither mistake compiles.
 */
export type SectionProps = SectionBase &
  (
    | { layout?: "stacked" | "centred"; rail?: never }
    | {
        layout: "split";
        /**
         * Body copy (and any CTA) that belongs BESIDE the showcase rather than
         * above it. Optional even here: §7's rail carries only the eyebrow and
         * heading, and omitting this renders no rail element at all rather than
         * an empty one.
         */
        rail?: React.ReactNode;
      }
  );

/** ~28/72. A relationship between two columns, not a copied pixel width. */
const SPLIT_COLUMNS = "lg:grid-cols-[minmax(0,2fr)_minmax(0,5fr)]";

/**
 * The landing page's body-section wrapper (spec §2, §6).
 *
 * This component owns the page's vertical rhythm. G4 — the reference is ~2698px
 * tall for content the frame spends 4028px on — is fixed here and nowhere else,
 * so that tightening the page is one edit rather than nine. Sections must not
 * add their own top/bottom padding.
 *
 * ## The split layout (spec §13, G5 — user ruling 2026-08-28)
 *
 * Stacking eyebrow + heading + children was the ROOT CAUSE of the composition
 * the user rejected: a `text-display` heading with `max-w-3xl` spans most of the
 * viewport in three oversized lines and shoves the section's showcase into the
 * space beneath it. `346:6275` does the opposite — a narrow left rail carries
 * eyebrow, heading and body while a wide column carries the showcase alongside.
 *
 * `layout="split"` turns that on. Two consequences worth stating:
 * - the heading drops from `text-display` to `text-heading-lg` (24px), because
 *   40px in a ~28% column wraps into a wall. That step did not exist before
 *   this layout needed it: the scale ran 20px -> 28px, and review measured the
 *   reference's rail heading at ~23.7px by two independent routes (cap height
 *   calibrated on the eyebrow as a control, and characters-per-line at a rail
 *   width matching the reference's to within 1%). 20px read ~18% undersized;
 *   28px wraps to five lines here. So `--text-heading-lg` was added to
 *   `app/globals.css` (fix F1) rather than reaching for an arbitrary value,
 *   which Rule #0 forbids. It is a token step, not a hand-tuned size.
 * - `max-w-3xl` is dropped in the split — the rail column IS the measure, and a
 *   second cap fighting it is what makes the two disagree at some widths.
 *
 * Below `lg` the split stacks exactly as the original layout does, so the
 * mobile composition is unchanged.
 *
 * ⚠️ BOTH grid items carry `min-w-0`, and that is load-bearing (task A2 review
 * C1). `SPLIT_COLUMNS` applies only at `lg:`; below it the grid falls back to
 * one implicit `auto` track, where a grid item's `min-width: auto` resolves to
 * a CONTENT-BASED minimum. Any showcase that does not shrink — §3's five-card
 * `overflow-x-auto` row is the first — then widens its own column past the
 * grid, and with it the page: measured at a 375px viewport, `scrollWidth` 587
 * against `clientWidth` 375, with the rail's heading and body clipped off the
 * right edge. That is a WCAG 1.4.10 (Reflow) failure, not only a visual one.
 * `minmax(0, …)` supplies the same `0` at `lg` and above, which is why the
 * defect was invisible at desktop widths. §4-§9 adopt `rail` next, so the
 * hardening belongs here rather than at any one consumer.
 *
 * INVARIANT: at every viewport width, no section may make
 * `document.documentElement.scrollWidth` exceed `clientWidth`. jsdom does no
 * layout and cannot assert that; `section.test.tsx` guards the MECHANISM (the
 * class is present on both items) and the OUTCOME assertion at a 320px
 * viewport is owed to the queued Playwright pass (Task 13/V).
 *
 * ## The centred layout (§8)
 *
 * §8 is a full-bleed band with its content centred over a photograph. It is a
 * `Section` and not a bespoke element on purpose: this component owns the
 * page's vertical rhythm, and a section that sets its own `py-*` puts G4 back
 * in nine places. Its heading token was measured, not chosen — §7's rail
 * heading has a 12px capital in `346:6275` and ships at `text-heading-lg`
 * (24px); §8's measures 14px, so 24 x 14/12 = 28px = `text-title`.
 *
 * ⚠️ This is the layout API the §7 task deferred here. `split` (a boolean) and
 * `rail != null` were TWO selectors for one layout, kept only until a second
 * consumer existed to design against. §8 is that consumer, and it needed a
 * third arrangement AND a third heading size — which is why the answer is one
 * `layout` prop rather than an `align` flag bolted onto the old pair.
 *
 * `relative` is unconditional: a section whose showcase bleeds to the page edge
 * (§2's and §7's photographs, §8's background) needs the section element — not
 * the max-width `MarketingContainer` — as its positioning context. It changes
 * nothing for sections that don't.
 *
 * ## Anchor clearance (task 11 review M1)
 *
 * ⚠️ `scroll-mt-header` is load-bearing and belongs HERE, not at a consumer.
 * Every section's `id` is a live anchor target, and the site header is
 * `position: sticky` — so without a scroll margin the browser puts the section's
 * top at y = 0 and the header paints over whatever is in its first ~65px.
 * Measured at 1280 before the fix: `/en#cta` put `#cta-heading` at 47.97px under
 * a bar occupying 0..64.67px, i.e. the top ~17px of the section's ACCESSIBLE
 * NAME (`aria-labelledby`) was hidden.
 *
 * §2-§7 concealed rather than escaped this: their `eyebrow` is what lands in the
 * bar's strip instead of the heading, and an eyebrow is decoration. §8 and §9
 * are the first sections with none — correctly, since the catalog has no
 * `cta.eyebrow`/`signoff.eyebrow` and adding one would be inventing copy — which
 * is what exposed it. The token is the header's own (`--layout-header-height`,
 * consumed by `site-header.tsx` as `h-header`), so resizing the bar cannot leave
 * this stale. The bar's 1px bottom border is outside the token and is absorbed
 * by `py-2xl` above the heading.
 */
export function Section(props: SectionProps) {
  const {
    id,
    eyebrow,
    heading,
    headingLevel = 2,
    scrollProgress = false,
    backdrop,
    children,
    className,
  } = props;
  const layout: SectionLayout = props.layout ?? "stacked";
  const rail = props.layout === "split" ? props.rail : undefined;
  const headingId = `${id}-heading`;
  const Heading = headingLevel === 1 ? "h1" : "h2";
  const isSplit = layout === "split";
  const isCentred = layout === "centred";

  const headingBlock = (
    <>
      {eyebrow ? (
        <p
          data-eyebrow
          className="mb-2xs font-display text-caption uppercase tracking-widest text-primary-strong"
        >
          {eyebrow}
        </p>
      ) : null}
      <Heading
        id={headingId}
        data-section-heading
        // §1's masked-block entrance (Task 5, ruling R9). Derived from
        // `headingLevel` rather than a new `heroHeading` prop: the hero is the
        // only `headingLevel={1}` consumer, and this doc comment already says
        // so above — a second selector for the same fact is the exact defect
        // this component's `split`/`rail != null` history already fixed once.
        data-hero-heading={headingLevel === 1 ? true : undefined}
        className={cn(
          "text-balance font-display font-bold",
          headingLevel === 1 && "text-hero",
          headingLevel === 2 && isSplit && "text-heading-lg",
          headingLevel === 2 && isCentred && "text-title",
          headingLevel === 2 && layout === "stacked" && "text-display",
          // The centred layout caps its own measure on the wrapper instead, so
          // the cap and the centring cannot disagree at some widths.
          layout === "stacked" && "max-w-3xl",
        )}
      >
        {heading}
      </Heading>
    </>
  );

  return (
    <section
      id={id}
      aria-labelledby={headingId}
      data-scroll-progress={scrollProgress ? "" : undefined}
      // The entrance contract (Task A-MOTION). Attributes only: the stagger
      // must not introduce a wrapper, because §6's mascot sits on the node
      // grid's bottom edge to within 1px and e2e asserts it.
      data-reveal="pending"
      className={cn("relative scroll-mt-header py-2xl", className)}
    >
      {backdrop}
      <MarketingContainer>
        {isSplit ? (
          <div className={cn("grid gap-xl lg:items-start", SPLIT_COLUMNS)}>
            {/* `min-w-0` on both items: see the docblock's INVARIANT. */}
            <div className="min-w-0">
              {headingBlock}
              {/* Rendered only when the rail HAS body content: `split` selects
                  this layout for §7, whose rail is eyebrow + heading alone, and
                  an empty wrapper would put `mt-md` of dead space under the
                  heading and a meaningless node in the tree. */}
              {rail != null ? (
                <div data-section-rail className="mt-md">
                  {rail}
                </div>
              ) : null}
            </div>
            <div data-section-showcase className="min-w-0">
              {children}
            </div>
          </div>
        ) : isCentred ? (
          // `mx-auto max-w-3xl` caps the measure here rather than on the
          // heading, so a centred heading and a centred body cannot end up on
          // different measures — which is what `max-w-3xl` on the heading plus
          // a wider wrapper would do at some widths.
          //
          // ⚠️ `relative z-10` is load-bearing whenever `backdrop` is used, and
          // it lives here rather than at the consumer because the consumer does
          // not own the heading. A backdrop layer is POSITIONED, so it paints
          // above in-flow text no matter which order the two appear in; without
          // this the heading disappears under §8's photograph.
          <div data-section-centred className="relative z-10 mx-auto max-w-3xl text-center">
            {headingBlock}
            <div data-section-body className="mt-lg">{children}</div>
          </div>
        ) : (
          <>
            {headingBlock}
            <div data-section-body className="mt-lg">{children}</div>
          </>
        )}
      </MarketingContainer>
    </section>
  );
}
