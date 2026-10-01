import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
const { VIDEO_COLUMNS } = await import("./videos");

/**
 * `VIDEO_COLUMNS` is selected from the `videos` table AND from the `learner_videos` view (Hub, Explore,
 * lesson library). A column added to the shared list but not to the view 400s every learner_videos read
 * at runtime while every mocked unit test stays green — `channel_title` did exactly that (T2, found by the
 * Hub e2e in T11). The view's own column list is read from its migration.
 */
describe("VIDEO_COLUMNS against the learner_videos view", () => {
  it("names only columns the view exposes", () => {
    const sql = readFileSync(path.join(process.cwd(), "supabase/migrations/20260807000025_lesson_taxonomy.sql"), "utf8");
    const body = /create view learner_videos[\s\S]*?\bselect\b([\s\S]*?)\bfrom videos v\b/.exec(sql)?.[1];
    expect(body, "learner_videos definition").toBeDefined();
    const exposed = new Set([...body!.matchAll(/\bv\.([a-z_]+)/g)].map((match) => match[1]));
    expect(exposed.size).toBeGreaterThan(10);
    const columns = VIDEO_COLUMNS.split(",").map((column) => column.trim());
    expect(columns.filter((column) => !exposed.has(column))).toEqual([]);
  });

  it("reads the view's only definition: no later migration redefines learner_videos", () => {
    const directory = path.join(process.cwd(), "supabase/migrations");
    const definers = readdirSync(directory)
      .filter((file) => file.endsWith(".sql") && /create\s+(or\s+replace\s+)?view\s+(public\.)?learner_videos\b/i.test(readFileSync(path.join(directory, file), "utf8")));
    expect(definers).toEqual(["20260807000025_lesson_taxonomy.sql"]);
  });
});
