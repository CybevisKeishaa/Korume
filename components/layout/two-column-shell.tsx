import { cn } from "@/lib/utils";

/**
 * The Hub/Explore desktop content shell: a flexible main column beside an
 * optional sticky companion rail. Geometry lives here and nowhere else. The
 * rail is a share of the shell — 27.5%, frame 149:2's 339 of 1240 — capped at
 * that frame's own 340px. It was a fixed 300px until 2026-09-20; at a 1280
 * viewport that constant took 19% off the main column, which is the whole of
 * what read as "the right side is too big". The rail must never be the only
 * place information appears.
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
          className="sticky top-md-lg w-full self-start"
        >
          {rail}
        </aside>
      ) : null}
    </div>
  );
}
