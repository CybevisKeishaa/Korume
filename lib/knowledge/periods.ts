/** Knowledge periods are the UTC day and the UTC calendar month (spec §4.3) — the SQL uses the same. */
export function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export function utcMonth(now: Date): string {
  return `${now.toISOString().slice(0, 7)}-01`;
}

export function nextUtcMidnight(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
}

export function nextUtcMonth(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}
