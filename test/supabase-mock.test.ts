import { describe, expect, it } from "vitest";
import { createMockSupabase } from "./supabase-mock";

describe("createMockSupabase PostgREST cap", () => {
  it("caps an unpaged select at 1,000 rows and honours range, limit, and exact head count", async () => {
    const rows = Array.from({ length: 1_001 }, (_, index) => ({ id: index }));
    const supabase = createMockSupabase({ tables: { videos: () => ({ data: rows, error: null }) }, enforcePostgrestCap: true });

    const unpaged = await supabase.from("videos").select("id");
    expect(unpaged.data).toHaveLength(1_000);
    await expect(supabase.from("videos").select("id").range(1_000, 1_999)).resolves.toEqual({ data: [{ id: 1_000 }], error: null });
    await expect(supabase.from("videos").select("id").limit(2)).resolves.toEqual({ data: rows.slice(0, 2), error: null });
    await expect(supabase.from("videos").select("id", { count: "exact", head: true })).resolves.toEqual({ data: null, error: null, count: 1_001 });
  });
});
