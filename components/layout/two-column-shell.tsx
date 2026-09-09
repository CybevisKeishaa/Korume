import { cn } from "@/lib/utils";

/**
 * The Hub/Explore desktop content shell: a flexible main column beside an
 * optional sticky companion rail. Geometry lives here and nowhere else. The
 * 300px rail is the approved fluid-desktop adaptation of Figma frame 149:2's
 * 340px rail. The rail must never be the only place information appears.
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
        // Tokenized gutters and gap let the main column absorb width released
        // by the navigation without a centred maximum measure. A consumer
        // without a rail keeps the same shell contract but no empty rail track.
        "grid w-full gap-[--layout-column-gap] px-[--layout-gutter]",
        rail
          ? "grid-cols-[minmax(0,1fr)_var(--layout-companion-width)]"
          : "grid-cols-[minmax(0,1fr)]",
        className,
      )}
      {...props}
    >
      <div className="min-w-0">{children}</div>
      {rail ? (
        <aside
          aria-label={railLabel}
          className="sticky top-md-lg w-[--layout-companion-width] shrink-0 self-start"
        >
          {rail}
        </aside>
      ) : null}
    </div>
  );
}
