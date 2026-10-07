/** Whole minutes, floored: "5h 20m" never claims a minute not yet studied. */
export function formatStudyDuration(seconds: number): { hours: number; minutes: number } {
  const total = Math.max(0, Math.floor(seconds / 60));
  return { hours: Math.floor(total / 60), minutes: total % 60 };
}
