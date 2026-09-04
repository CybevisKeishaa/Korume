import { Container } from "@/components/ui/container";
import { cn } from "@/lib/utils";

/**
 * The marketing pages' content column (task 12).
 *
 * ## Why this exists rather than a wider `Container`
 *
 * `Container` has 36 consumers and only four are marketing surfaces (this
 * component's own consumers: `section.tsx`, `site-header.tsx`, and
 * `site-footer.tsx` twice). Widening it would silently re-lay-out every
 * dashboard, kanji, vocab, shadowing, admin and auth screen — none of which
 * frame `347:6277` says anything about. So the marketing measure is a separate
 * fact with a separate home, and that home is here.
 *
 * ## The width was measured, not chosen
 *
 * `347:6277` is the binding design for `/` (spec §11 ruling 1) and its natural
 * size is **1280 x 4028** — so the design's own viewport is 1280, the width we
 * measure at. The visual quality bar `346:6275` is a 0.675x render of the same
 * page (864 x 1821); scanning it for the most common bounded content edge
 * (ignoring full-bleed rows, against the page's own background) puts the
 * design's content **3.46% of the page width** in from each side — ~44px at
 * 1280. `Container`'s `max-w-6xl` (1152) puts ours 96px in.
 *
 * 1256 is what reproduces that: at 1280 the box is 1256 (12px each side), plus
 * `Container`'s own `lg:px-8` gutter, so content starts 44px in and is 1192
 * wide against the old 1088. The odd-looking number is the house style, not an
 * accident — `--layout-sidebar-width` is 224px and `--layout-content-max` is
 * 1240px, both measured off frames the same way.
 *
 * ⚠️ It is deliberately NOT `--layout-content-max`, which is the SHADOWING
 * SHELL's width. Reusing it would make one edit move two unrelated surfaces.
 *
 * ## What this closes
 *
 * Three findings deferred here from earlier tasks, all the same cause:
 * §3/§4's showcase column stopping ~21% short of the reference's, §6's
 * between-tile gap, and §7's photograph reading as a narrower strip than the
 * reference's because the cards it sits beside end too near the page edge.
 */
export function MarketingContainer({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  // `max-w-marketing` must WIN over Container's `max-w-6xl` rather than sit
  // beside it. That is why the name is registered in lib/utils.ts's
  // tailwind-merge `max-w` group — unregistered, twMerge keeps both and leaves
  // CSS source order to decide the page's width.
  return <Container className={cn("max-w-marketing", className)} {...props} />;
}
