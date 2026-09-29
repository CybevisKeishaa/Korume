export function formatCourseDuration(
  minutes: number,
  labels: { minutes: (value: number) => string; hours: (value: number) => string },
): string {
  return minutes < 60
    ? labels.minutes(minutes)
    : labels.hours(Math.round(minutes / 30) / 2);
}

export function formatLevelBand<Band extends string>(
  band: { from: Band; to: Band } | null,
  labels: { band: (value: Band) => string; range: (from: string, to: string) => string },
): string | null {
  if (!band) return null;
  return band.from === band.to ? labels.band(band.from) : labels.range(labels.band(band.from), labels.band(band.to));
}

/**
 * The hour count as the locale writes it ("3.5" / "3,5"). The catalog forbids
 * ICU `#`, so a message takes the number for plural choice and this text to show.
 */
export function formatHours(hours: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(hours);
}

/** The card form of a duration, as the path cards show it ("3h 20m", "8h", "45m"). */
export function formatCompactDuration(
  minutes: number,
  labels: { minutes: (value: number) => string; hours: (value: number) => string; hoursMinutes: (hours: number, minutes: number) => string },
): string {
  if (minutes < 60) return labels.minutes(minutes);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? labels.hours(hours) : labels.hoursMinutes(hours, rest);
}
