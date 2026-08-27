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
  children: React.ReactNode;
  className?: string;
}

/**
 * The landing page's body-section wrapper (spec §2, §6).
 *
 * This component owns the page's vertical rhythm. G4 — the reference is ~2698px
 * tall for content the frame spends 4028px on — is fixed here and nowhere else,
 * so that tightening the page is one edit rather than nine. Sections must not
 * add their own top/bottom padding.
 */
export function Section({
  id,
  eyebrow,
  heading,
  headingLevel = 2,
  children,
  className,
}: SectionProps) {
  const headingId = `${id}-heading`;
  const Heading = headingLevel === 1 ? "h1" : "h2";

  return (
    <section id={id} aria-labelledby={headingId} className={cn("py-2xl", className)}>
      <Container>
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
            "max-w-3xl text-balance font-display font-bold",
            headingLevel === 1 ? "text-hero" : "text-display",
          )}
        >
          {heading}
        </Heading>
        <div className="mt-lg">{children}</div>
      </Container>
    </section>
  );
}
