import type { ReactNode } from "react";
import { Link } from "@/lib/i18n/navigation";
import { HubEmptyState } from "./hub-empty-state";
import { HubSectionHeading } from "./hub-section-heading";

/**
 * A titled three- or four-up grid of studio cards with an optional "View all" and its
 * own empty copy. The cards are `<li>`s; an empty list shows the empty state.
 */
export function HubShelf({ title, viewAll, empty, children, columns = 4 }: {
  title: string;
  viewAll?: { href: string; label: string };
  empty: { title: string; body: string };
  children: ReactNode[];
  columns?: 3 | 4;
}) {
  return (
    <section aria-label={title}>
      <HubSectionHeading
        title={title}
        action={viewAll ? (
          <Link href={viewAll.href} className="inline-flex min-h-hit-target items-center text-caption font-semibold text-primary-strong hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {viewAll.label} <span aria-hidden="true">&nbsp;→</span>
          </Link>
        ) : undefined}
      />
      {children.length ? (
        <ul className={`mt-md grid grid-cols-2 gap-md ${columns === 3 ? "xl:grid-cols-3" : "xl:grid-cols-4"}`}>{children}</ul>
      ) : (
        <HubEmptyState title={empty.title} body={empty.body} />
      )}
    </section>
  );
}
