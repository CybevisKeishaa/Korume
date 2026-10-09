export type Daypart = "morning" | "afternoon" | "evening" | "lateEvening";

export function daypartAt(instant: Date, timeZone: string): Daypart {
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone, hour: "2-digit", hourCycle: "h23" })
    .formatToParts(instant).find((part) => part.type === "hour")?.value);
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "lateEvening";
}
