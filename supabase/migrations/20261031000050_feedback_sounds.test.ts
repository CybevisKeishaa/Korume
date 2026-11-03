import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(join(process.cwd(), "supabase/migrations/20261031000050_feedback_sounds.sql"), "utf8")
  .replace(/--[^\n]*/g, "")
  .replace(/\s+/g, " ")
  .trim()
  .toLowerCase();

describe("feedback sounds SQL contract", () => {
  it("adds one column, on by default, and nothing else (additive from 049)", () => {
    expect(sql).toBe("alter table user_preferences add column feedback_sounds boolean not null default true;");
  });
});
