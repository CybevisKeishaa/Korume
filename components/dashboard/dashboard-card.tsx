import type { KeyboardEventHandler, ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export type DashboardArea = "continue" | "mission" | "korume" | "journey" | "weakness" | "weekly" | "activity" | "achievements" | "quick";

export function DashboardCard({ id, area, eyebrow, children, labelledBy, describedBy, focusable = false, tabIndex, onKeyDown, background, aside, bare = false }: {
  id: string;
  area: DashboardArea;
  eyebrow: string;
  children: ReactNode;
  labelledBy?: string;
  describedBy?: string;
  focusable?: boolean;
  tabIndex?: number;
  onKeyDown?: KeyboardEventHandler<HTMLDivElement>;
  /** Decorative layer painted behind the content (Continue Learning's lesson cover). */
  background?: ReactNode;
  /** Decorative glyph on the eyebrow's line (Weekly's trend, Achievements' trophy). */
  aside?: ReactNode;
  /** A titled section without card chrome (Quick Access's tiles are the cards). */
  bare?: boolean;
}) {
  const headingId = labelledBy ?? `${id}-title`;
  const head = <div className="dashboard-card-head"><h2 id={headingId} className="dash-eyebrow">{eyebrow}</h2>{aside}</div>;
  if (bare) return <section id={id} data-area={area} aria-labelledby={headingId}>{head}{children}</section>;
  return (
    <Card id={id} data-area={area} role="region" aria-labelledby={headingId} aria-describedby={describedBy} tabIndex={tabIndex ?? (focusable ? -1 : undefined)} onKeyDown={onKeyDown}
      className={background ? "dashboard-card relative isolate overflow-hidden" : "dashboard-card"}>
      {background && <div aria-hidden="true" className="absolute inset-0 -z-10">{background}</div>}
      {head}
      <div className="dashboard-card-body">{children}</div>
    </Card>
  );
}

export function CardSkeleton({ area }: { area: DashboardArea }) {
  return <div aria-busy="true" data-area={area} className="dashboard-card rounded-lg border border-border bg-card"><Skeleton className="h-4 w-28" /><Skeleton className="mt-lg h-20 w-full" /></div>;
}
