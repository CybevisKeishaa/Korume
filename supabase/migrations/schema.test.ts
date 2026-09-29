import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("schema migration", () => {
  it("breaks latest-transcript ties by id so sentence counts are deterministic", () => {
    const schema = readFileSync("supabase/migrations/20260712000001_schema.sql", "utf8");
    expect(schema).toContain("order by t.video_id, t.created_at desc, t.id desc");
  });

  it("aggregates the caller's score window in the database", () => {
    const schema = readFileSync("supabase/migrations/20260712000001_schema.sql", "utf8");
    expect(schema).toContain("create function pronunciation_metric_means(p_start timestamptz, p_end timestamptz)");
    expect(schema).toContain("security invoker");
    expect(schema).toContain("where s.user_id = auth.uid()");
    expect(schema).toContain("and s.created_at >= p_start");
    expect(schema).toContain("and s.created_at < p_end");
    expect(schema).toContain("revoke all on function pronunciation_metric_means(timestamptz, timestamptz) from public;");
    expect(schema).toContain("grant execute on function pronunciation_metric_means(timestamptz, timestamptz) to authenticated;");
  });
});
