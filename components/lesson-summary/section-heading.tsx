/** The frame's section head: an orange eyebrow, the `h2`, and an optional one-line subtitle. */
export function SectionHeading({ id, eyebrow, title, subtitle }: { id: string; eyebrow: string; title: string; subtitle?: string }) {
  return (
    <div className="space-y-2xs">
      <p className="text-caption font-semibold uppercase tracking-wide text-primary-strong">{eyebrow}</p>
      <h2 id={id} className="text-heading-lg font-bold">{title}</h2>
      {subtitle && <p className="text-body text-muted-foreground">{subtitle}</p>}
    </div>
  );
}
