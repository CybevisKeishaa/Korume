export function HubCourseProgress({ total, completed, labels }: {
  total: number;
  completed: number;
  labels: { complete: (percent: number) => string; lessons: (completed: number, total: number) => string };
}) {
  // An empty collection has no progress to report; a 0% bar would stand in for an unknown.
  if (total === 0) return null;
  // Rounded like the frame (80 / 120 reads 67%), but an unfinished course never reads 100%.
  const rounded = Math.round((completed / total) * 100);
  const percent = completed < total ? Math.min(99, rounded) : 100;
  const label = labels.complete(percent);
  return <div className="mt-md"><p className="text-caption text-muted-foreground">{label} · {labels.lessons(completed, total)}</p><div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className="mt-xs h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} /></div></div>;
}
