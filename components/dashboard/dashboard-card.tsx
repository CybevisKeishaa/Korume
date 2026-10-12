import type { KeyboardEventHandler, ReactNode } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export type DashboardArea = "continue" | "mission" | "korume" | "journey" | "weakness" | "weekly" | "activity" | "achievements" | "quick";

export function DashboardCard({ id, area, eyebrow, children, labelledBy, describedBy, focusable = false, tabIndex, onKeyDown, background }: {
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
}) {
  const headingId = labelledBy ?? `${id}-title`;
  return (
    <Card id={id} data-area={area} role="region" aria-labelledby={headingId} aria-describedby={describedBy} tabIndex={tabIndex ?? (focusable ? -1 : undefined)} onKeyDown={onKeyDown} className={background ? "relative isolate overflow-hidden" : undefined}>
      {background && <div aria-hidden="true" className="absolute inset-0 -z-10">{background}</div>}
      <CardHeader>
        <h2 id={headingId} className="text-xs font-semibold uppercase leading-none tracking-[0.2em] text-primary-strong">{eyebrow}</h2>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function CardSkeleton({ area }: { area: DashboardArea }) {
  return <div aria-busy="true" data-area={area} className="rounded-lg border border-border bg-card p-lg"><Skeleton className="h-4 w-28" /><Skeleton className="mt-lg h-20 w-full" /></div>;
}
