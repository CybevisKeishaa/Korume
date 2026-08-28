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
  className?: string;
  priority?: boolean;
}

/**
 * The landing page's pending-photograph boundary (spec §5).
 *
 * Five photographs the reference carries do not exist in the repo. This is the
 * one component that stands in for all five, so that filling a slot later is
 * one prop at one call site with no layout change.
 *
 * The pending state is deliberately, visibly a placeholder — never a decorative
 * gradient that could be mistaken for finished art, and never filled by slicing
 * the flat reference PNG (spec §5.2). A slot may only be filled from a source
 * whose origin is known and recorded.
 */
export function AssetSlot({ ratio, description, src, className, priority }: AssetSlotProps) {
  if (src) {
    return (
      <div data-asset-slot className={cn("relative overflow-hidden rounded-lg", ratioClass[ratio], className)}>
        <Image
          src={src}
          alt={description}
          fill
          // `fill` with no `sizes` makes Next assume the image is 100vw, so the
          // browser picks the 3840px srcset entry for a slot a few hundred px
          // wide. Measured on §2's photograph the moment it was filled: 1336 KB
          // and 4.9s, against 190 KB for the same file at a sane width — and
          // the section rendered an empty right third for those seconds. No
          // filled slot on this page is ever wider than ~45vw (the widest is
          // §2's photograph, at 41.5% of the section — and the section IS the
          // viewport, since that slot bleeds past the container), so this is an
          // upper bound that can only over-serve, never soften an image. NOT a
          // new prop: the slot's public interface is unchanged.
          sizes="(min-width: 1024px) 45vw, 100vw"
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
