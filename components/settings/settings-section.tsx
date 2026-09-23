import { cn } from "@/lib/utils";

/**
 * One titled band of the settings page — Learning, Appearance, Privacy & Data
 * (spec §5).
 *
 * A `<section>` with its heading wired by `aria-labelledby`, so the three bands
 * are real landmarks a screen-reader user can jump between rather than styled
 * `<div>`s. `id` is on the section because the Danger Zone and the memory-erase
 * page both return the reader to `/settings#privacy`.
 *
 * Rows are separated by a divider rather than spacing, which is what the frame
 * draws and what keeps a long list scannable; `divide-y` puts the rule between
 * rows only, so the band never opens or closes with a stray line.
 */
export function SettingsSection({
  id,
  title,
  subtitle,
  children,
  className,
}: {
  id?: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  className?: string;
}) {
  const headingId = `${id ?? title.toLowerCase().replace(/\s+/g, "-")}-heading`;
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={cn("mt-xl rounded-lg border border-border bg-card p-lg", className)}
    >
      <h2 id={headingId} className="text-body-lg font-semibold">
        {title}
      </h2>
      <p className="mt-2xs text-caption text-muted-foreground">{subtitle}</p>
      <div className="mt-md divide-y divide-border">{children}</div>
    </section>
  );
}
