import { cn } from "@/lib/utils";

/**
 * The Hub/Explore content shell: a flexible main column beside an optional
 * sticky companion rail. Geometry lives here and nowhere else — measured from
 * Figma frame 149:2, where the rail is 340px beside a flexible main column
 * (spec §7.1). Below `xl` the rail is not rendered as a sized column at all,
 * which is why the rail must never be the only place information appears.
 */
export function TwoColumnShell({
  children,
  rail,
  railLabel,
  className,
  ...props
}: {
  children: React.ReactNode;
  rail?: React.ReactNode;
  railLabel: string;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        // The shell owns its own measure and gutters — pages inside it do not
        // wrap themselves in <Container>. `--layout-content-max` is consumed
        // HERE and nowhere else; container.tsx keeps max-w-6xl on purpose.
        "mx-auto w-full max-w-content px-[--layout-gutter]",
        "flex flex-col gap-[--layout-column-gap] xl:flex-row",
        className,
      )}
      {...props}
    >
      <div className="min-w-0 flex-1">{children}</div>
      {rail ? (
        // `hidden xl:block`, not `xl:w-0`: an empty-but-present complementary
        // landmark is still announced by screen readers on small viewports.
        <aside
          aria-label={railLabel}
          className="hidden shrink-0 self-start xl:sticky xl:top-md-lg xl:block xl:w-companion"
        >
          {rail}
        </aside>
      ) : null}
    </div>
  );
}
