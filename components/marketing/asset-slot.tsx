import Image from "next/image";
import { cn } from "@/lib/utils";

type Ratio = "16/9" | "4/3" | "1/1" | "3/4";

const ratioClass: Record<Ratio, string> = {
  // Aspect ratios express a relationship, not a copied pixel, so they are a
  // legitimate arbitrary value under Rule #0 (spec §2 of the screen-port
  // workflow design).
  "16/9": "aspect-[16/9]",
  "4/3": "aspect-[4/3]",
  "1/1": "aspect-[1/1]",
  "3/4": "aspect-[3/4]",
};

export interface AssetSlotProps {
  ratio: Ratio;
  /** What the photograph shows. Becomes the alt text once a real file exists. */
  description: string;
  /** Omit while the photograph does not exist yet. */
  src?: string;
  /**
   * Override for `DEFAULT_SIZES`. Pass it when the slot renders MUCH narrower
   * than that upper bound — see the note on the constant.
   */
  sizes?: string;
  className?: string;
  priority?: boolean;
}

/**
 * The widest any filled slot on this page gets. `fill` with no `sizes` makes
 * Next assume the image is 100vw, so the browser picks the 3840px srcset entry
 * for a slot a few hundred px wide. Measured on §2's photograph the moment it
 * was filled: 1336 KB and 4.9s, against 190 KB for the same file at a sane
 * width — and the section rendered an empty right third for those seconds.
 *
 * ⚠️ This is an UPPER BOUND, so it can only over-serve, never soften an image —
 * but "over-serve" is not free, and it stops being harmless once a slot is much
 * smaller than the bound. §3's Watch thumbnail renders ~106 CSS px wide, where
 * this default selects the 1080px variant: **74.7 KB** as WebP / **980 KB** as
 * PNG, against **15.6 KB** / **149 KB** for the 384px variant that slot
 * actually needs — 4.8x and 6.6x (measured 2026-08-29 against the dev
 * optimizer). Hence `sizes`: a slot far below the bound passes its own.
 *
 * ⚠️ ONE FACT FOR EVERY `sizes` CONSTANT THAT HAS A BELOW-1024 CLAUSE, stated
 * here because this is the shared boundary they all pass through. Since the
 * mobile handoff gate (`app/[locale]/layout.tsx`, hidden in `globals.css`
 * below 1024) the marketing page never renders below 1024, so **no below-1024
 * clause in any of them can be selected**. Five of the page's eight `sizes`
 * constants have one: this file's own trailing `100vw`, `journey.tsx`'s
 * `300px`, `cta.tsx`'s `MASCOT_SIZES` `1px`, `trust.tsx`'s `100vw`, and
 * `recommendation.tsx`'s `560px`. (`cta.tsx`'s `BACKGROUND_SIZES = "100vw"`,
 * `capability-chain.tsx` and `pitch-showcase.tsx` are not in the list —
 * unconditional values are reachable at every width.)
 *
 * **Those five all STAY**, and for a reason that is about grammar, not about
 * layout: `<source-size-list>` requires a final unconditional
 * `<source-size-value>`, and an attribute without one is invalid — the browser
 * then falls back to 100vw, which is the opposite of what each of them exists
 * for. Do not re-derive one of these tails from a measurement; there is
 * nothing left to measure.
 *
 * ⚠️ That reason does NOT extend to an unreachable *media-query branch*, which
 * the grammar does not require. `recommendation.tsx` had one — `(min-width:
 * 640px) 440px` — and it was deleted rather than annotated (`AGENTS.md` §6,
 * no dead code). An earlier version of this docblock told the reader to keep
 * it, which would have preserved dead code under a false justification.
 */
const DEFAULT_SIZES = "(min-width: 1024px) 45vw, 100vw";

/**
 * The landing page's pending-photograph boundary (spec §5).
 *
 * Five photographs the reference carries were missing when this was written.
 * This is the one component that stands in for all of them, so that filling a
 * slot is one prop at one call site with no layout change.
 *
 * ▶ Every slot on the landing page is now FILLED — all six call sites pass
 * `src` and the files are in `public/marketing/`. They arrived over 2026-08-28
 * to 2026-09-01, not on one day; `git log --diff-filter=A --date=short --
 * public/marketing/` is the record, and no date is restated here. The pending
 * branch below is therefore unreached on `/` today. It stays because the
 * boundary is the point: the next surface that needs a photograph gets the same
 * treatment. Re-derive rather than trusting this line — it returns 6:
 * `grep -rl "<AssetSlot" components/marketing --include="*.tsx" | grep -v asset-slot`
 * against `ls public/marketing/`. The trailing filter is load-bearing, not
 * tidiness: a recipe written inside the file it searches matches its own text,
 * so it must drop this file and its test or it counts them as call sites.
 *
 * The pending state is deliberately, visibly a placeholder — never a decorative
 * gradient that could be mistaken for finished art, and never filled by slicing
 * the flat reference PNG (spec §5.2). A slot may only be filled from a source
 * whose origin is known and recorded.
 */
export function AssetSlot({ ratio, description, src, sizes, className, priority }: AssetSlotProps) {
  if (src) {
    return (
      <div data-asset-slot className={cn("relative overflow-hidden rounded-lg", ratioClass[ratio], className)}>
        <Image
          src={src}
          alt={description}
          fill
          // See `DEFAULT_SIZES` for why this is never omitted, and why a slot
          // far narrower than that bound overrides it.
          sizes={sizes ?? DEFAULT_SIZES}
          priority={priority}
          className="object-cover"
        />
      </div>
    );
  }

  return (
    <div
      data-asset-slot
      data-asset-pending="true"
      role="img"
      aria-label={`${description} (image pending)`}
      className={cn(
        "flex items-center justify-center rounded-lg border border-dashed border-border bg-muted",
        ratioClass[ratio],
        className,
      )}
    >
      <span className="px-md text-center text-caption text-muted-foreground">{description}</span>
    </div>
  );
}
