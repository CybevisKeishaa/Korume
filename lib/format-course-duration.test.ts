import { expect, it } from "vitest";
import { formatCompactDuration, formatCourseDuration, formatHours, formatLevelBand } from "./format-course-duration";

it("uses the supplied catalog formatters and rounds hours to the nearest half", () => {
  const labels = {
    minutes: (value: number) => `${value} min`,
    hours: (value: number) => `${value} hours`,
  };

  expect(formatCourseDuration(45, labels)).toBe("45 min");
  expect(formatCourseDuration(74, labels)).toBe("1 hours");
  expect(formatCourseDuration(105, labels)).toBe("2 hours");
});

it("localises a level band through the catalog and joins a spanning range", () => {
  const labels = {
    band: (value: string) => ({ beginner: "Sơ cấp", intermediate: "Trung cấp", advanced: "Cao cấp" })[value] ?? value,
    range: (from: string, to: string) => `${from}–${to}`,
  };

  expect(formatLevelBand({ from: "intermediate", to: "intermediate" }, labels)).toBe("Trung cấp");
  expect(formatLevelBand({ from: "beginner", to: "intermediate" }, labels)).toBe("Sơ cấp–Trung cấp");
  expect(formatLevelBand(null, labels)).toBeNull();
});

it("writes a fractional hour count the way each locale does", () => {
  expect(formatHours(3.5, "en")).toBe("3.5");
  expect(formatHours(3.5, "vi")).toBe("3,5");
  expect(formatHours(8, "vi")).toBe("8");
});

it("writes the compact card duration without a zero-minute tail", () => {
  const labels = {
    minutes: (value: number) => `${value}m`,
    hours: (value: number) => `${value}h`,
    hoursMinutes: (hours: number, minutes: number) => `${hours}h ${minutes}m`,
  };

  expect(formatCompactDuration(45, labels)).toBe("45m");
  expect(formatCompactDuration(200, labels)).toBe("3h 20m");
  expect(formatCompactDuration(480, labels)).toBe("8h");
});
