import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const FORBIDDEN = /Asia\/Ho_Chi_Minh|Asia\/Saigon|VN_OFFSET_MS|VN_TIME_ZONE|vnDateString|vnDayStart|vnDaysAgo|isoWeekdayOfVnDate|\+07:?00|(UTC|GMT)\+0?7b/;
/** The only two declarations allowed to name the zone (spec §3.6). */
const ALLOWED = new Map([
  ["lib/time/study-day.ts", 'export const FALLBACK_STUDY_TIMEZONE = "Asia/Ho_Chi_Minh";'],
  ["lib/leaderboard/week.ts", 'export const LEADERBOARD_WEEK_TIMEZONE = "Asia/Ho_Chi_Minh";'],
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.(ts|tsx|sql)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(path);
  }
  return out;
}

/** Comments are prose about the zone, not uses of it. */
function code(text: string, sql: boolean): string {
  const noBlock = text.replace(/\/\*[\s\S]*?\*\//g, "");
  return noBlock.split("\n").map((line) => line.replace(sql ? /--.*$/ : /\/\/.*$/, "")).join("\n");
}

describe("no hardcoded VN day boundary outside the two named constants", () => {
  const files = ["app", "lib", "components", "supabase/migrations"].flatMap((dir) => walk(join(ROOT, dir)));

  it("scans the real tree", () => {
    expect(files.length).toBeGreaterThan(500);
    expect(files.some((file) => file.endsWith("20260712000001_schema.sql"))).toBe(true);
  });

  it("finds the zone only in FALLBACK_STUDY_TIMEZONE and LEADERBOARD_WEEK_TIMEZONE", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const rel = relative(ROOT, file).replaceAll("\\", "/");
      const lines = code(readFileSync(file, "utf8"), file.endsWith(".sql")).split("\n");
      lines.forEach((line, index) => {
        if (!FORBIDDEN.test(line)) return;
        if (ALLOWED.get(rel) === line.trim()) return;
        offenders.push(`${rel}:${index + 1}: ${line.trim()}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});
