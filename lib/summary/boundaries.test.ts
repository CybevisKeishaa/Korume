import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOTS = [
  "lib/summary", "components/lesson-summary", "app/[locale]/(protected)/(focus)/shadowing/[id]/summary",
  "app/api/videos/[id]/lesson-analysis", "app/api/videos/[id]/lesson-reflection", "app/api/videos/[id]/review-tomorrow",
];
const files = (dir: string): string[] => (existsSync(dir) ? readdirSync(dir) : []).flatMap((name) => {
  const path = join(dir, name);
  return statSync(path).isDirectory() ? files(path) : /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
});
const SOURCES = ROOTS.flatMap((root) => files(join(process.cwd(), root))).map((path) => ({ path, text: readFileSync(path, "utf8") }));

describe("Summary boundaries (spec R1, R7, §7.1)", () => {
  it("collects the Summary sources (a scan that finds nothing proves nothing)", () => {
    expect(SOURCES.length).toBeGreaterThanOrEqual(40);
  });

  it("never reads Companion memory", () => {
    for (const { path, text } of SOURCES) expect(text, path).not.toMatch(/lib\/data\/companion|companion_memories/);
  });

  it("has no plan-tier branch", () => {
    for (const { path, text } of SOURCES) expect(text, path).not.toMatch(/isPlus|getActivePlanTier|PlanTier|subscriptions/);
  });

  it("never imports workspace context, the workspace player or the drawer", () => {
    for (const { path, text } of SOURCES) {
      expect(text, path).not.toMatch(/shadowing-workspace\/(workspace-context|workspace-player|player-adapter|playback-root|drawer\/|use-playback-controller)/);
    }
  });
});
