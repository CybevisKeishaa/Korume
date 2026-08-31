import { Container } from "@/components/ui/container";
import { cn } from "@/lib/utils";

export interface SectionProps {
  /** Anchor id; also what the accessible region is keyed to. */
  id: string;
  /** Small label above the heading. Presentational text, never a heading. */
  eyebrow?: string;
  heading: string;
  /** 1 only for the hero; every other section is 2. */
  headingLevel?: 1 | 2;
  /**
   * Body copy (and any CTA) that belongs BESIDE the section's showcase rather
   * than above it. Supplying it selects the split layout described below;
   * omitting it keeps the original stacked layout, byte for byte.
   */
  rail?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

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
 * Passing `rail` turns that on. Two consequences worth stating:
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
 * `relative` is unconditional: a section whose showcase bleeds to the page edge
 * (§2's photograph) needs the section element — not the max-width `Container` —
 * as its positioning context. It changes nothing for sections that don't.
 */
export function Section({
  id,
  eyebrow,
  heading,
  headingLevel = 2,
  rail,
  children,
  className,
}: SectionProps) {
  const headingId = `${id}-heading`;
  const Heading = headingLevel === 1 ? "h1" : "h2";
  // `!= null`, not `!== undefined`: §3-§9 adopt this prop next and the shape
  // they will write is `rail={cond ? <Body /> : null}`. Under `!== undefined`
  // that selects the split layout with an empty rail div and a silently
  // narrowed heading — a layout change with no visible cause (fix F6).
  const isSplit = rail != null;

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
        className={cn(
          "text-balance font-display font-bold",
          headingLevel === 1 && "text-hero",
          headingLevel === 2 && (isSplit ? "text-heading-lg" : "text-display"),
          !isSplit && "max-w-3xl",
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
      className={cn("relative py-2xl", className)}
    >
      <Container>
        {isSplit ? (
          <div className={cn("grid gap-xl lg:items-start", SPLIT_COLUMNS)}>
            {/* `min-w-0` on both items: see the docblock's INVARIANT. */}
            <div className="min-w-0">
              {headingBlock}
              <div data-section-rail className="mt-md">
                {rail}
              </div>
            </div>
            <div data-section-showcase className="min-w-0">
              {children}
            </div>
          </div>
        ) : (
          <>
            {headingBlock}
            <div className="mt-lg">{children}</div>
          </>
        )}
      </Container>
    </section>
  );
}
