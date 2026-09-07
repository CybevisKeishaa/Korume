import type { ReactNode } from "react";

export interface HubSectionHeadingProps {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
}

/** Shared semantic heading row for the Hub's authored shelves. */
export function HubSectionHeading({ eyebrow, title, action }: HubSectionHeadingProps) {
  return (
    <header className="flex items-end justify-between gap-md">
      <div className="min-w-0">
        {eyebrow && <p className="text-caption font-semibold uppercase tracking-wide text-primary-strong">{eyebrow}</p>}
        <h2 className="mt-1 text-heading-lg font-semibold tracking-tight text-foreground">{title}</h2>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}
