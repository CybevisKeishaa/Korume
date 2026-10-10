import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export type DashboardArea = "continue" | "mission" | "korume" | "journey" | "weakness" | "weekly" | "activity" | "achievements" | "quick";

export function DashboardCard({ id, area, eyebrow, children, labelledBy, focusable = false }: {
  id: string;
  area: DashboardArea;
  eyebrow: string;
  children: ReactNode;
  labelledBy?: string;
  focusable?: boolean;
}) {
  const headingId = labelledBy ?? `${id}-title`;
  return (
    <Card id={id} data-area={area} role="region" aria-labelledby={headingId} tabIndex={focusable ? -1 : undefined}>
      <CardHeader>
        <CardTitle id={headingId} className="text-xs uppercase tracking-[0.2em] text-primary-strong">{eyebrow}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function CardSkeleton({ area }: { area: DashboardArea }) {
  return <div aria-busy="true" data-area={area} className="rounded-lg border border-border bg-card p-lg"><Skeleton className="h-4 w-28" /><Skeleton className="mt-lg h-20 w-full" /></div>;
}
