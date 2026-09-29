/**
 * Rounded like the frame (80 / 120 reads 67%), but an unfinished course never
 * reads 100%. Shared, so a label formatted on the server matches the bar.
 */
export function courseProgressPercent(total: number, completed: number): number {
  const rounded = Math.round((completed / total) * 100);
  return completed < total ? Math.min(99, rounded) : 100;
}

export function HubCourseProgress({ total, completed, labels, variant = "full" }: {
  total: number;
  completed: number;
  labels: { complete: (percent: number) => string; lessons: (completed: number, total: number) => string };
  /** `bar` drops the visible text line (a path card); the bar keeps its accessible name. */
  variant?: "full" | "bar";
}) {
  // An empty collection has no progress to report; a 0% bar would stand in for an unknown.
  if (total === 0) return null;
  const percent = courseProgressPercent(total, completed);
  const label = labels.complete(percent);
  const bar = (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className={variant === "full" ? "mt-xs h-2 overflow-hidden rounded-full bg-muted" : "h-1 overflow-hidden rounded-full bg-muted"}>
      <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
    </div>
  );
  if (variant === "bar") return <div className="mt-sm">{bar}</div>;
  return <div className="mt-md"><p className="text-caption text-muted-foreground">{label} · {labels.lessons(completed, total)}</p>{bar}</div>;
}
