import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrations = join(process.cwd(), "supabase", "migrations");
const community = readFileSync(join(migrations, "20260714000014_community_admin.sql"), "utf8");
const profile = readFileSync(join(migrations, "20261007000044_port_profile.sql"), "utf8");

describe("profile SQL contracts", () => {
  it("reserves all seven profile columns for save_profile while retaining timezone detection", () => {
    const grant = community.match(/grant update \(([\s\S]*?)\) on users to authenticated;/i);
    expect(grant).not.toBeNull();
    const columns = grant![1]!.split(",").map((column) => column.trim());
    expect(columns).toContain("study_timezone");
    for (const column of ["username", "bio", "country", "native_language", "target_jlpt_level", "learning_goal", "preferred_practices"]) {
      expect(columns).not.toContain(column);
    }
  });

  it("returns only the four fields consumed by the profile reader", () => {
    const signature = profile.match(/create function todays_memory\(p_tz text\) returns table \(([^)]*)\)/i);
    expect(signature).not.toBeNull();
    expect(signature![1]!.split(",").map((column) => column.trim().split(/\s+/)[0])).toEqual([
      "id", "line_text_jp", "title", "occurred_at",
    ]);
  });
});
